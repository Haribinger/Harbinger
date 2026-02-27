# Chat Integrations & Built-in Chat Interfaces — Harbinger

Inventory of all chat-related surfaces and concrete ways to enhance them.

---

## 1. Chat integrations (channels)

These are **external or cross-channel** ways users/agents communicate. Configured in **Settings → Channels** and backed by the Go backend.

| Integration | Type | Backend | Frontend store | Purpose |
|-------------|------|---------|----------------|--------|
| **WebChat** | Built-in | — | `channelStore` (`webchat` default active) | In-app chat; no external service. |
| **Discord** | External | `channels.go` | `channelStore.channels.discord` | Bot token, guild/channel ID, webhook; receive/send via webhook. |
| **Telegram** | External | `channels.go` | `channelStore.channels.telegram` | Bot token, chat ID, webhook; send via Bot API, receive via webhook. |
| **Slack** | External | `channels.go` | `channelStore.channels.slack` | Bot token, app ID, channel ID, webhook; config only (relay format ready). |

**Backend endpoints (all under `/api/` and `/api/v1/`):**

- `GET /api/channels` — list config + status (enabled, hasToken, status).
- `POST /api/channels/discord` — configure Discord.
- `POST /api/channels/telegram` — configure Telegram.
- `POST /api/channels/slack` — configure Slack.
- `POST /api/channels/{channel}/test` — test connection.
- `POST /api/channels/relay` — relay a message to a channel (body: `agentId`, `agentName`, `channel`, `userId`, `message`).
- `GET /api/channels/conversations` — cross-channel conversation history (last 100).
- `GET/POST /api/channels/user-context` — per-user context (preferredChannel, responseStyle, watchingAgents, etc.).
- `POST /api/channels/discord/webhook` — Discord webhook (no auth).
- `POST /api/channels/telegram/webhook` — Telegram webhook (no auth).

**Agent bus (used by Command Center chat):**

- `POST /api/agents/broadcast` — send message to agents (body: `agentIds`, `message`, `type`); used for in-UI “chat to agent” flows.

---

## 2. Built-in chat interfaces

These are the **UI surfaces** where users (or OpenClaw) actually chat.

### 2.1 Chat page (`/chat`)

- **Path:** `harbinger-tools/frontend/src/pages/Chat/Chat.tsx`
- **Route:** `/chat`
- **State:** `agentStore` (activeAgent, activeChat, chats, addMessage, addChat, setActiveChat).
- **API:** `api/chat.ts` → `chatApi.sendMessage`, `chatApi.sendMessageStream`, `chatApi.getSessions`, etc.

**Behavior:** User picks an agent (from Agents or context), gets one active chat per agent. Messages sent via `chatApi.sendMessage` (non-streaming) or `sendMessageStream`. Right panel shows context (active tools, model/temperature/maxTokens).

**Backend note:** The frontend expects `/api/chat/sessions`, `/api/chat/message`, `/api/chat/stream`. These routes are **not** implemented in the Go backend today; either they 404 or a separate service is used. The main working path for “talk to agent” in-app is Command Center + `/api/agents/broadcast`.

### 2.2 Command Center chat panel (tab)

- **Path:** `harbinger-tools/frontend/src/pages/CommandCenter/CommandCenter.tsx` → `ChatPanel`.
- **Usage:** Open an agent workspace → open a “chat” tab; messages are in-memory in that tab.
- **API:** `POST /api/agents/broadcast` with `agentIds: [targetAgent.id]`, `message`, `type: 'chat'`.

**Behavior:** In-tab message list; user sends, backend broadcast returns a single response (or error). Good for quick agent commands from the command center.

### 2.3 OpenClaw gateway (Voice + WebChat)

- **Path:** `harbinger-tools/frontend/src/pages/OpenClaw/OpenClaw.tsx` + OpenClaw runtime (external).
- **Route:** `/openclaw`
- **Channels (from UI):** Voice, WebChat, Telegram, Slack — shown as “available” or “configurable”.

**Behavior:** OpenClaw translates voice/text into Harbinger API calls (e.g. spawn agent, run skill). WebChat is the in-OpenClaw text interface; Telegram/Slack are configured in Harbinger and can receive relayed agent output.

### 2.4 Other repo chat UIs (reference)

- **`lib/chat/`** (root): Next.js-style chat using `@ai-sdk/react`, `DefaultChatTransport`, `/stream/chat`. Used by the separate Next.js app (e.g. templates/bugs), not by the Vite command center.
- **`bugs/app/chat/`**: App-router chat pages; use same `lib/chat` components.

---

## 3. Data flow summary

```
User (WebChat / Command Center / OpenClaw)
    → Chat UI (Chat.tsx or CommandCenter ChatPanel or OpenClaw)
    → Either:
        A) chatApi → /api/chat/* (not implemented in Go backend)
        B) POST /api/agents/broadcast → comms.go → agent bus / relay
    → Channels (optional): POST /api/channels/relay → Discord/Telegram/Slack
```

---

## 4. How to enhance

### 4.1 Backend: Implement `/api/chat/*` for the Chat page

- **Add in backend:**  
  - `GET/POST /api/chat/sessions` (list/create),  
  - `GET/DELETE /api/chat/sessions/:id`,  
  - `POST /api/chat/message` (non-streaming),  
  - `POST /api/chat/stream` (SSE or chunked streaming).
- **Persistence:** Store sessions and messages in PostgreSQL (e.g. `chat_sessions`, `chat_messages` tables) or in-memory with the same shape.
- **Agent reply:** Either call existing model router + LLM in Go, or proxy to an existing streaming endpoint used by OpenClaw/agents.
- **Effect:** Chat page stops depending on missing routes; history and streaming work without changing frontend contract.

### 4.2 Chat page: Streaming and UX

- **Use streaming:** In `Chat.tsx`, call `chatApi.sendMessageStream` and append chunks to the assistant message so the user sees tokens as they arrive.
- **Auto-scroll:** Keep a ref to the bottom of the message list and `scrollIntoView({ behavior: 'smooth' })` on new content (e.g. in the same effect that runs when `activeChat?.messages` or streaming buffer updates).
- **Containment:** Ensure the message list has a fixed height and `overflow-y: auto` so the page doesn’t grow unbounded (see “CRITICAL UI FIX” pattern: root max height, inner scroll).

### 4.3 Command Center ChatPanel: History and persistence

- **Persist tab chat:** Store `ChatPanel` messages in `commandCenterStore` (e.g. per `tab.id` or workspace+agent) or in backend so reopening the tab restores history.
- **Optional:** Reuse the same `/api/chat/sessions` + `/api/chat/message` once implemented, keyed by workspace + agent id, so Command Center and Chat page share history for that agent.

### 4.4 Channels: Slack and richer relay

- **Slack:** Implement `sendSlackMessage` in `channels.go` (or `comms.go`) and call it from `handleRelayMessage` when `channel == "slack"`, using `channelCfg.Slack.WebhookURL` or Slack API.
- **Relay from UI:** In Settings or OpenClaw, add “Send to channel” so the user can relay the last agent reply to Discord/Telegram/Slack via `POST /api/channels/relay`.
- **User context:** Use `GET/POST /api/channels/user-context` to remember preferred channel and response style per user (e.g. from Telegram `from.id`) and adapt formatting.

### 4.5 OpenClaw: Sync with Harbinger channels

- **Show real status:** OpenClaw page could call `GET /api/channels` and show Discord/Telegram/Slack as “connected” only when the backend reports enabled + hasToken.
- **WebChat in OpenClaw:** If OpenClaw has its own WebChat, document that it talks to Harbinger via the same `/api/agents/broadcast` or future `/api/chat/stream` so behavior is consistent.

### 4.6 Cross-channel conversation view

- **Conversations feed:** Add a small “Recent conversations” or “Cross-channel” panel (e.g. on Dashboard or Settings) that calls `GET /api/channels/conversations` and shows last N entries (channel, agent, message, time). Helps operators see what was said on Discord/Telegram without leaving the app.

### 4.7 Types and API contract

- **Frontend types:** `api/chat.ts` and `types/index.ts` already define `ChatMessage`, `ChatSession`, `SendMessageRequest`. Ensure backend responses match these so both Chat page and any future Command Center integration stay type-safe.
- **Error handling:** Replace any empty `.catch` in chat API calls with user-visible error state and optional toast so send failures are clear.

---

## 5. Quick reference

| What | Where |
|------|--------|
| Channel config (Discord, Telegram, Slack) | Backend: `channels.go`; Frontend: `channelStore.ts`, Settings UI |
| Relay to channel | `POST /api/channels/relay` |
| Agent broadcast (in-app “chat to agent”) | `POST /api/agents/broadcast`; used by Command Center ChatPanel |
| Chat page (sessions, send, stream) | `pages/Chat/Chat.tsx`, `api/chat.ts`; backend `/api/chat/*` missing |
| Command Center chat tab | `CommandCenter.tsx` → `ChatPanel` |
| OpenClaw (Voice + WebChat) | `OpenClaw.tsx`, OpenClaw runtime |
| Conversation history | `GET /api/channels/conversations` |
| User context | `GET/POST /api/channels/user-context` |

---

**See also:** [CHANNELS.md](CHANNELS.md) — dedicated reference for Discord, Telegram, Slack, and WebChat (config, endpoints, relay, webhooks).

**Doc version:** 1.0  
**Last updated:** 2026-02-26
