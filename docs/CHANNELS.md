# Channels — Harbinger

Channels are how users and agents communicate **outside** the in-app Chat page: Discord, Telegram, Slack, and the built-in WebChat. Config is in **Settings → Channels**; the backend stores tokens/IDs and handles webhooks + relay.

---

## 1. The four channel types

| Channel   | Purpose                          | Config source              | Inbound              | Outbound                    |
|-----------|----------------------------------|----------------------------|----------------------|-----------------------------|
| **WebChat** | In-app UI (Chat, Command Center) | Frontend only              | User in browser      | Same session                |
| **Discord** | Alerts + agent commands          | Bot token, Guild ID, Channel ID, Webhook URL | Webhook → backend   | Webhook URL or Bot API      |
| **Telegram**| Bot commands, alerts             | Bot token, Chat ID, Webhook secret | Webhook → backend   | Bot API `sendMessage`       |
| **Slack**   | Team alerts, commands            | Bot token, App ID, Channel ID, Webhook URL | (not implemented)    | (not implemented)           |

**WebChat** is always “on” in the frontend (`channelStore`: `webchat` enabled, active). The other three are **opt-in** and configured via Settings or env.

---

## 2. Backend (Go)

**File:** `backend/cmd/channels.go` (+ `comms.go` for relay)

**Config:** In-memory struct `channelCfg` (Discord, Telegram, Slack), filled from **env** on startup and updated when you POST from Settings. Optional: persisted to `.env` via `persistChannelEnv`.

**Env vars:**

- **Discord:** `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CHANNEL_ID`
- **Telegram:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`
- **Slack:** `SLACK_BOT_TOKEN`, `SLACK_APP_ID`, `SLACK_CHANNEL_ID`

**Endpoints:**

| Method + path                          | Auth   | Purpose |
|----------------------------------------|--------|--------|
| `GET /api/channels`                    | Bearer | List all channel configs (no raw tokens): enabled, status, hasToken, guildId/chatId/channelId. |
| `POST /api/channels/discord`           | Bearer | Set bot token, guild ID, channel ID, webhook URL; test token; persist env. |
| `POST /api/channels/telegram`         | Bearer | Set bot token, chat ID; persist env. |
| `POST /api/channels/slack`            | Bearer | Set bot token, app ID, channel ID; persist env. |
| `POST /api/channels/{channel}/test`   | Bearer | Test connection (Discord/Telegram: API call; Slack: token presence). |
| `POST /api/channels/discord/webhook`  | None   | Receive Discord events (e.g. messages); stored as OpenClaw events. |
| `POST /api/channels/telegram/webhook` | None   | Receive Telegram updates; validated with `X-Telegram-Bot-Api-Secret-Token` if `TELEGRAM_WEBHOOK_SECRET` set. |

Relay (sending agent output to a channel) is in **comms.go**:

| Method + path                 | Auth   | Purpose |
|-------------------------------|--------|--------|
| `POST /api/channels/relay`    | Bearer | Relay a message to Discord or Telegram (body: `agentId`, `agentName`, `channel`, `userId`, `message`). Formats per platform; Discord → webhook, Telegram → Bot API. **Slack:** not implemented. |

So: **channels** = config + webhooks + relay; **comms** = agent bus + user context + conversations + relay handler.

---

## 3. Frontend

**Store:** `harbinger-tools/frontend/src/store/channelStore.ts`

- **State:** `channels` (discord, telegram, slack, webchat) with `enabled`, `status`, `hasToken`, `metadata`; `activeChannel`; `userContexts`; `agentMessages`; `conversations`.
- **Actions:** `fetchChannels`, `configureChannel`, `testChannel`, `setActiveChannel`; `updateUserContext`, `getUserContext`, `trackUserSeen`; `broadcastAgentMessage`, `getAgentMessages`, `fetchAgentMessages`; `addConversation`, `fetchConversations`; `formatForChannel`.

**UI:** `harbinger-tools/frontend/src/pages/Settings/Settings.tsx` → **Channels** section (`ChannelsSection`)

- **Discord:** Bot Token, Guild/Server ID, Channel ID → Save / Test.
- **Telegram:** Bot Token, Chat ID → Save / Test.
- **Slack:** Mentioned in OpenClaw; Settings has no Slack form in the slice I saw — only Discord and Telegram have full forms. Slack can still be configured via API if you add a form.

On load, Settings calls `GET /api/channels` and shows status (connected / not configured). Save calls `POST /api/channels/discord` or `.../telegram` with the form body; Test calls `POST /api/channels/{channel}/test`.

---

## 4. Flow summary

1. **Configure:** User sets tokens/IDs in Settings → POST to `/api/channels/{discord|telegram|slack}` → backend updates `channelCfg` and env.
2. **Test:** User clicks Test → `POST /api/channels/{channel}/test` → backend checks token (and for Discord/Telegram does an API check).
3. **Inbound:** Discord/Telegram send events to `/api/channels/.../webhook` → backend appends to OpenClaw events (no auth on webhook; Telegram can use secret header).
4. **Outbound:** Something (e.g. agent response or “Relay to channel” in UI) calls `POST /api/channels/relay` with `channel: "discord"` or `"telegram"` → backend formats and sends (Discord webhook, Telegram Bot API). Slack is not wired in relay.

---

## 5. Gaps and enhancements

- **Slack:** Implement `sendSlackMessage` in `comms.go` and call it from `handleRelayMessage` when `channel == "slack"` (e.g. use `channelCfg.Slack.WebhookURL`). Add Slack form in Settings (token, app ID, channel ID, optional webhook URL).
- **Settings:** Add a “Relay to channel” control that calls `POST /api/channels/relay` (e.g. “Send last agent reply to Discord”) so users can test and use relay from the UI.
- **Webhook URL persistence:** Discord webhook URL is accepted in the config but may not be written to env; ensure it’s persisted if you want it to survive restarts.
- **OpenClaw:** OpenClaw page can call `GET /api/channels` and show Discord/Telegram/Slack as “connected” only when backend reports enabled + hasToken.

---

## 6. Quick reference

| What              | Where |
|-------------------|--------|
| Channel config    | Backend: `channels.go`; Frontend: `channelStore.ts` |
| Settings UI       | `Settings.tsx` → Channels section |
| Relay (send out)  | `comms.go` → `handleRelayMessage`; `POST /api/channels/relay` |
| Webhooks (receive)| `channels.go` → `handleDiscordWebhook`, `handleTelegramWebhook` |
| Conversations     | `GET /api/channels/conversations` (comms); `channelStore.fetchConversations` |

See also: **docs/CHAT_INTEGRATIONS_AND_ENHANCEMENTS.md** for how channels tie into Chat page, Command Center, and OpenClaw.
