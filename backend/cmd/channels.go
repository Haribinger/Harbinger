package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// ---- Channel config (in-memory, persisted to env) ----

type ChannelConfig struct {
	Discord  DiscordConfig  `json:"discord"`
	Telegram TelegramConfig `json:"telegram"`
	Slack    SlackConfig    `json:"slack"`
}

type DiscordConfig struct {
	BotToken   string `json:"botToken"`
	GuildID    string `json:"guildId"`
	ChannelID  string `json:"channelId"`
	WebhookURL string `json:"webhookUrl"`
	Enabled    bool   `json:"enabled"`
	Status     string `json:"status"` // connected, disconnected, error
}

type TelegramConfig struct {
	BotToken      string `json:"botToken"`
	ChatID        string `json:"chatId"`
	WebhookURL    string `json:"webhookUrl"`
	WebhookSecret string `json:"webhookSecret"`
	Enabled       bool   `json:"enabled"`
	Status        string `json:"status"`
}

type SlackConfig struct {
	BotToken   string `json:"botToken"`
	AppID      string `json:"appId"`
	ChannelID  string `json:"channelId"`
	WebhookURL string `json:"webhookUrl"`
	Enabled    bool   `json:"enabled"`
	Status     string `json:"status"`
}

var (
	channelCfg   ChannelConfig
	channelCfgMu sync.RWMutex
)

func initChannels() {
	channelCfgMu.Lock()
	defer channelCfgMu.Unlock()

	channelCfg.Discord = DiscordConfig{
		BotToken:  os.Getenv("DISCORD_BOT_TOKEN"),
		GuildID:   os.Getenv("DISCORD_GUILD_ID"),
		ChannelID: os.Getenv("DISCORD_CHANNEL_ID"),
		Enabled:   os.Getenv("DISCORD_BOT_TOKEN") != "",
		Status:    "disconnected",
	}
	if channelCfg.Discord.Enabled {
		channelCfg.Discord.Status = "connected"
	}

	channelCfg.Telegram = TelegramConfig{
		BotToken:      os.Getenv("TELEGRAM_BOT_TOKEN"),
		ChatID:        os.Getenv("TELEGRAM_CHAT_ID"),
		WebhookSecret: os.Getenv("TELEGRAM_WEBHOOK_SECRET"),
		Enabled:       os.Getenv("TELEGRAM_BOT_TOKEN") != "",
		Status:        "disconnected",
	}
	if channelCfg.Telegram.Enabled {
		channelCfg.Telegram.Status = "connected"
	}

	channelCfg.Slack = SlackConfig{
		BotToken:  os.Getenv("SLACK_BOT_TOKEN"),
		AppID:     os.Getenv("SLACK_APP_ID"),
		ChannelID: os.Getenv("SLACK_CHANNEL_ID"),
		Enabled:   os.Getenv("SLACK_BOT_TOKEN") != "",
		Status:    "disconnected",
	}
	if channelCfg.Slack.Enabled {
		channelCfg.Slack.Status = "connected"
	}
}

// GET /api/channels — list all channel configs + status
func handleListChannels(w http.ResponseWriter, r *http.Request) {
	channelCfgMu.RLock()
	defer channelCfgMu.RUnlock()

	// Return masked tokens for security
	resp := map[string]any{
		"discord": map[string]any{
			"enabled":   channelCfg.Discord.Enabled,
			"status":    channelCfg.Discord.Status,
			"guildId":   channelCfg.Discord.GuildID,
			"channelId": channelCfg.Discord.ChannelID,
			"hasToken":  channelCfg.Discord.BotToken != "",
		},
		"telegram": map[string]any{
			"enabled":  channelCfg.Telegram.Enabled,
			"status":   channelCfg.Telegram.Status,
			"chatId":   channelCfg.Telegram.ChatID,
			"hasToken": channelCfg.Telegram.BotToken != "",
		},
		"slack": map[string]any{
			"enabled":   channelCfg.Slack.Enabled,
			"status":    channelCfg.Slack.Status,
			"appId":     channelCfg.Slack.AppID,
			"channelId": channelCfg.Slack.ChannelID,
			"hasToken":  channelCfg.Slack.BotToken != "",
		},
	}
	writeJSON(w, http.StatusOK, resp)
}

// POST /api/channels/discord — configure Discord
func handleConfigureDiscord(w http.ResponseWriter, r *http.Request) {
	var body struct {
		BotToken   string `json:"botToken"`
		GuildID    string `json:"guildId"`
		ChannelID  string `json:"channelId"`
		WebhookURL string `json:"webhookUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	channelCfgMu.Lock()
	if body.BotToken != "" {
		channelCfg.Discord.BotToken = body.BotToken
		os.Setenv("DISCORD_BOT_TOKEN", body.BotToken)
	}
	if body.GuildID != "" {
		channelCfg.Discord.GuildID = body.GuildID
		os.Setenv("DISCORD_GUILD_ID", body.GuildID)
	}
	if body.ChannelID != "" {
		channelCfg.Discord.ChannelID = body.ChannelID
		os.Setenv("DISCORD_CHANNEL_ID", body.ChannelID)
	}
	if body.WebhookURL != "" {
		channelCfg.Discord.WebhookURL = body.WebhookURL
	}
	channelCfg.Discord.Enabled = channelCfg.Discord.BotToken != ""
	channelCfgMu.Unlock()

	// Test the token
	if body.BotToken != "" {
		status := testDiscordToken(body.BotToken)
		channelCfgMu.Lock()
		channelCfg.Discord.Status = status
		channelCfgMu.Unlock()
	}

	// Persist to .env
	persistChannelEnv("DISCORD_BOT_TOKEN", channelCfg.Discord.BotToken)
	persistChannelEnv("DISCORD_GUILD_ID", channelCfg.Discord.GuildID)
	persistChannelEnv("DISCORD_CHANNEL_ID", channelCfg.Discord.ChannelID)

	channelCfgMu.RLock()
	defer channelCfgMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"status":  channelCfg.Discord.Status,
		"enabled": channelCfg.Discord.Enabled,
	})
}

// POST /api/channels/telegram — configure Telegram
func handleConfigureTelegram(w http.ResponseWriter, r *http.Request) {
	var body struct {
		BotToken      string `json:"botToken"`
		ChatID        string `json:"chatId"`
		WebhookSecret string `json:"webhookSecret"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	channelCfgMu.Lock()
	if body.BotToken != "" {
		channelCfg.Telegram.BotToken = body.BotToken
		os.Setenv("TELEGRAM_BOT_TOKEN", body.BotToken)
	}
	if body.ChatID != "" {
		channelCfg.Telegram.ChatID = body.ChatID
		os.Setenv("TELEGRAM_CHAT_ID", body.ChatID)
	}
	if body.WebhookSecret != "" {
		channelCfg.Telegram.WebhookSecret = body.WebhookSecret
		os.Setenv("TELEGRAM_WEBHOOK_SECRET", body.WebhookSecret)
	}
	channelCfg.Telegram.Enabled = channelCfg.Telegram.BotToken != ""
	channelCfgMu.Unlock()

	// Test the token
	if body.BotToken != "" {
		status := testTelegramToken(body.BotToken)
		channelCfgMu.Lock()
		channelCfg.Telegram.Status = status
		channelCfgMu.Unlock()
	}

	persistChannelEnv("TELEGRAM_BOT_TOKEN", channelCfg.Telegram.BotToken)
	persistChannelEnv("TELEGRAM_CHAT_ID", channelCfg.Telegram.ChatID)
	persistChannelEnv("TELEGRAM_WEBHOOK_SECRET", channelCfg.Telegram.WebhookSecret)

	channelCfgMu.RLock()
	defer channelCfgMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"status":  channelCfg.Telegram.Status,
		"enabled": channelCfg.Telegram.Enabled,
	})
}

// POST /api/channels/slack — configure Slack
func handleConfigureSlack(w http.ResponseWriter, r *http.Request) {
	var body struct {
		BotToken  string `json:"botToken"`
		AppID     string `json:"appId"`
		ChannelID string `json:"channelId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	channelCfgMu.Lock()
	if body.BotToken != "" {
		channelCfg.Slack.BotToken = body.BotToken
		os.Setenv("SLACK_BOT_TOKEN", body.BotToken)
	}
	if body.AppID != "" {
		channelCfg.Slack.AppID = body.AppID
	}
	if body.ChannelID != "" {
		channelCfg.Slack.ChannelID = body.ChannelID
	}
	channelCfg.Slack.Enabled = channelCfg.Slack.BotToken != ""
	channelCfgMu.Unlock()

	persistChannelEnv("SLACK_BOT_TOKEN", channelCfg.Slack.BotToken)

	channelCfgMu.RLock()
	defer channelCfgMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"status":  channelCfg.Slack.Status,
		"enabled": channelCfg.Slack.Enabled,
	})
}

// POST /api/channels/{channel}/test — test a channel connection
func handleTestChannel(w http.ResponseWriter, r *http.Request) {
	channel := r.PathValue("channel")
	channelCfgMu.RLock()
	defer channelCfgMu.RUnlock()

	switch channel {
	case "discord":
		if channelCfg.Discord.BotToken == "" {
			writeJSON(w, http.StatusOK, map[string]any{"ok": false, "error": "No Discord bot token configured"})
			return
		}
		status := testDiscordToken(channelCfg.Discord.BotToken)
		writeJSON(w, http.StatusOK, map[string]any{"ok": status == "connected", "status": status})

	case "telegram":
		if channelCfg.Telegram.BotToken == "" {
			writeJSON(w, http.StatusOK, map[string]any{"ok": false, "error": "No Telegram bot token configured"})
			return
		}
		status := testTelegramToken(channelCfg.Telegram.BotToken)
		writeJSON(w, http.StatusOK, map[string]any{"ok": status == "connected", "status": status})

	case "slack":
		if channelCfg.Slack.BotToken == "" {
			writeJSON(w, http.StatusOK, map[string]any{"ok": false, "error": "No Slack bot token configured"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "status": "connected"})

	default:
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "Unknown channel: " + channel})
	}
}

// POST /api/channels/discord/webhook — receive Discord webhook events
func handleDiscordWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	// Discord URL verification
	if t, ok := payload["type"].(float64); ok && int(t) == 1 {
		writeJSON(w, http.StatusOK, map[string]any{"type": 1})
		return
	}

	// Store as OpenClaw event
	openclawMu.Lock()
	openclawEvents = append(openclawEvents, openclawEvent{
		ID:        fmt.Sprintf("evt-%d", time.Now().UnixMilli()),
		Type:      "discord.message",
		Source:    "discord",
		Data:      payload,
		Timestamp: time.Now(),
	})
	if len(openclawEvents) > 500 {
		openclawEvents = openclawEvents[len(openclawEvents)-500:]
	}
	openclawMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// POST /api/channels/telegram/webhook — receive Telegram webhook events
func handleTelegramWebhook(w http.ResponseWriter, r *http.Request) {
	channelCfgMu.RLock()
	secret := channelCfg.Telegram.WebhookSecret
	channelCfgMu.RUnlock()

	// Validate secret
	if secret != "" {
		headerSecret := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
		if headerSecret != secret {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	// Store as event
	openclawMu.Lock()
	openclawEvents = append(openclawEvents, openclawEvent{
		ID:        fmt.Sprintf("evt-%d", time.Now().UnixMilli()),
		Type:      "telegram.message",
		Source:    "telegram",
		Data:      payload,
		Timestamp: time.Now(),
	})
	if len(openclawEvents) > 500 {
		openclawEvents = openclawEvents[len(openclawEvents)-500:]
	}
	openclawMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ---- Helpers ----

func testDiscordToken(token string) string {
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", "https://discord.com/api/v10/users/@me", nil)
	if err != nil {
		return "error"
	}
	req.Header.Set("Authorization", "Bot "+token)
	resp, err := client.Do(req)
	if err != nil {
		return "error"
	}
	defer resp.Body.Close()
	if resp.StatusCode == 200 {
		return "connected"
	}
	return "error"
}

func testTelegramToken(token string) string {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(fmt.Sprintf("https://api.telegram.org/bot%s/getMe", token))
	if err != nil {
		return "error"
	}
	defer resp.Body.Close()
	if resp.StatusCode == 200 {
		var result map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
			if ok, _ := result["ok"].(bool); ok {
				return "connected"
			}
		}
	}
	return "error"
}

func persistChannelEnv(key, value string) {
	if value == "" {
		return
	}
	envPaths := []string{".env", "../../.env"}
	for _, envPath := range envPaths {
		if _, err := os.Stat(envPath); err == nil {
			content, err := os.ReadFile(envPath)
			if err != nil {
				continue
			}
			lines := strings.Split(string(content), "\n")
			found := false
			for i, line := range lines {
				if strings.HasPrefix(line, key+"=") {
					lines[i] = fmt.Sprintf("%s=%s", key, value)
					found = true
					break
				}
			}
			if !found {
				lines = append(lines, fmt.Sprintf("%s=%s", key, value))
			}
			os.WriteFile(envPath, []byte(strings.Join(lines, "\n")), 0600)
			return
		}
	}
}
