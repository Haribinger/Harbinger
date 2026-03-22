package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/Haribinger/Harbinger/backend/pkg/roar"
)

// Agent-to-agent message bus and cross-channel coordination

type AgentBusMessage struct {
	ID            string         `json:"id"`
	FromAgent     string         `json:"fromAgent"`
	FromAgentName string         `json:"fromAgentName"`
	ToAgent       string         `json:"toAgent"` // agent ID or "broadcast"
	Type          string         `json:"type"`    // handoff, finding, status, request, context
	Content       string         `json:"content"`
	Data          map[string]any `json:"data,omitempty"`
	Channel       string         `json:"channel,omitempty"`
	Timestamp     time.Time      `json:"timestamp"`
}

type UserChannelContext struct {
	UserID           string            `json:"userId"`
	Username         string            `json:"username"`
	PreferredChannel string            `json:"preferredChannel"`
	ResponseStyle    string            `json:"responseStyle"` // brief, detailed, technical, casual
	LastSeen         map[string]int64  `json:"lastSeen"`
	WatchingAgents   []string          `json:"watchingAgents"`
	RecentTopics     []string          `json:"recentTopics"`
}

type ConversationEntry struct {
	ID        string `json:"id"`
	Channel   string `json:"channel"`
	AgentID   string `json:"agentId,omitempty"`
	AgentName string `json:"agentName,omitempty"`
	UserID    string `json:"userId"`
	Message   string `json:"message"`
	Response  string `json:"response,omitempty"`
	Timestamp int64  `json:"timestamp"`
}

// Shared context that all agents can read
type SharedAgentContext struct {
	ActiveTarget    string            `json:"activeTarget"`
	Findings        []FindingSummary  `json:"findings"`
	AgentStatuses   map[string]any    `json:"agentStatuses"`
	ConversationCnt int               `json:"conversationCount"`
	ActiveChannels  []string          `json:"activeChannels"`
}

type FindingSummary struct {
	Severity string `json:"severity"`
	Count    int    `json:"count"`
}

var (
	agentBus       []AgentBusMessage
	agentBusMu     sync.RWMutex
	userContexts   map[string]*UserChannelContext
	userContextsMu sync.RWMutex
	conversations  []ConversationEntry
	convMu         sync.RWMutex
)

func init() {
	agentBus = make([]AgentBusMessage, 0, 500)
	userContexts = make(map[string]*UserChannelContext)
	conversations = make([]ConversationEntry, 0, 500)
}

// POST /api/agents/broadcast — agent-to-agent message bus
func handleAgentBroadcast(w http.ResponseWriter, r *http.Request) {
	var msg AgentBusMessage
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	if msg.ID == "" {
		msg.ID = fmt.Sprintf("amsg-%d", time.Now().UnixMilli())
	}
	if msg.Timestamp.IsZero() {
		msg.Timestamp = time.Now()
	}

	agentBusMu.Lock()
	agentBus = append(agentBus, msg)
	if len(agentBus) > 500 {
		agentBus = agentBus[len(agentBus)-500:]
	}
	agentBusMu.Unlock()

	// Also record as an OpenClaw event for the event feed
	openclawMu.Lock()
	openclawEvents = append(openclawEvents, openclawEvent{
		ID:        msg.ID,
		Type:      "agent." + msg.Type,
		Source:    msg.FromAgentName,
		Data:      map[string]any{"to": msg.ToAgent, "content": msg.Content, "data": msg.Data},
		Timestamp: msg.Timestamp,
	})
	if len(openclawEvents) > 500 {
		openclawEvents = openclawEvents[len(openclawEvents)-500:]
	}
	openclawMu.Unlock()

	// Bridge to ROAR bus
	if roarBus != nil {
		from := roar.AgentIdentity{DID: "did:roar:agent:" + msg.FromAgent}
		to := roar.AgentIdentity{DID: "did:roar:agent:" + msg.ToAgent}
		intent := roar.IntentNotify
		switch msg.Type {
		case "handoff":
			intent = roar.IntentDelegate
		case "request":
			intent = roar.IntentAsk
		case "finding":
			intent = roar.IntentUpdate
		case "status":
			intent = roar.IntentUpdate
		case "context":
			intent = roar.IntentNotify
		}
		roarMsg := roar.NewMessage(from, to, intent, map[string]any{
			"content":     msg.Content,
			"data":        msg.Data,
			"channel":     msg.Channel,
			"legacy_type": msg.Type,
		})
		// Sign with ROAR secret so the bus accepts the message
		secret := os.Getenv("ROAR_SECRET")
		if secret == "" {
			secret = "harbinger-roar-default"
		}
		if err := roarMsg.Sign(secret); err == nil {
			roarBus.Publish(roarMsg)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": msg.ID})
}

// GET /api/agents/messages — get messages for an agent (query: agentId)
func handleGetAgentMessages(w http.ResponseWriter, r *http.Request) {
	agentID := r.URL.Query().Get("agentId")

	agentBusMu.RLock()
	defer agentBusMu.RUnlock()

	var filtered []AgentBusMessage
	for _, m := range agentBus {
		if agentID == "" || m.ToAgent == agentID || m.ToAgent == "broadcast" || m.FromAgent == agentID {
			filtered = append(filtered, m)
		}
	}

	if filtered == nil {
		filtered = []AgentBusMessage{}
	}

	// Return last 100
	if len(filtered) > 100 {
		filtered = filtered[len(filtered)-100:]
	}

	writeJSON(w, http.StatusOK, filtered)
}

// GET /api/agents/context — shared context for all agents
func handleGetSharedContext(w http.ResponseWriter, r *http.Request) {
	// Build shared context from current state
	ctx := SharedAgentContext{
		Findings:      []FindingSummary{},
		AgentStatuses: make(map[string]any),
		ActiveChannels: []string{},
	}

	// Get active channels
	channelCfgMu.RLock()
	if channelCfg.Discord.Enabled {
		ctx.ActiveChannels = append(ctx.ActiveChannels, "discord")
	}
	if channelCfg.Telegram.Enabled {
		ctx.ActiveChannels = append(ctx.ActiveChannels, "telegram")
	}
	if channelCfg.Slack.Enabled {
		ctx.ActiveChannels = append(ctx.ActiveChannels, "slack")
	}
	channelCfgMu.RUnlock()
	ctx.ActiveChannels = append(ctx.ActiveChannels, "webchat")

	// Get agent statuses from DB
	if dbAvailable() {
		if agents, err := dbListAgents(); err == nil {
			for _, a := range agents {
				ctx.AgentStatuses[a.Name] = map[string]any{
					"id":     a.ID,
					"status": a.Status,
					"type":   a.Type,
				}
			}
		}
	}

	// Conversation count
	convMu.RLock()
	ctx.ConversationCnt = len(conversations)
	convMu.RUnlock()

	// Recent findings from agent bus
	agentBusMu.RLock()
	findingCounts := map[string]int{}
	for _, m := range agentBus {
		if m.Type == "finding" {
			sev, _ := m.Data["severity"].(string)
			if sev == "" {
				sev = "info"
			}
			findingCounts[sev]++
		}
	}
	agentBusMu.RUnlock()
	for sev, count := range findingCounts {
		ctx.Findings = append(ctx.Findings, FindingSummary{Severity: sev, Count: count})
	}

	writeJSON(w, http.StatusOK, ctx)
}

// POST /api/channels/user-context — update user context
func handleUpdateUserContext(w http.ResponseWriter, r *http.Request) {
	var body UserChannelContext
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	if body.UserID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "userId required"})
		return
	}

	userContextsMu.Lock()
	existing, ok := userContexts[body.UserID]
	if ok {
		// Merge updates
		if body.Username != "" {
			existing.Username = body.Username
		}
		if body.PreferredChannel != "" {
			existing.PreferredChannel = body.PreferredChannel
		}
		if body.ResponseStyle != "" {
			existing.ResponseStyle = body.ResponseStyle
		}
		if body.LastSeen != nil {
			for k, v := range body.LastSeen {
				existing.LastSeen[k] = v
			}
		}
		if len(body.WatchingAgents) > 0 {
			existing.WatchingAgents = body.WatchingAgents
		}
		if len(body.RecentTopics) > 0 {
			existing.RecentTopics = body.RecentTopics
		}
	} else {
		if body.LastSeen == nil {
			body.LastSeen = make(map[string]int64)
		}
		userContexts[body.UserID] = &body
	}
	userContextsMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// GET /api/channels/user-context — get user context
func handleGetUserContext(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "userId query param required"})
		return
	}

	userContextsMu.RLock()
	ctx, ok := userContexts[userID]
	userContextsMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusOK, map[string]any{
			"userId":           userID,
			"preferredChannel": "webchat",
			"responseStyle":    "detailed",
			"lastSeen":         map[string]any{},
			"watchingAgents":   []string{},
		})
		return
	}

	writeJSON(w, http.StatusOK, ctx)
}

// GET /api/channels/conversations — cross-channel conversation history
func handleGetConversations(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("userId")
	channel := r.URL.Query().Get("channel")

	convMu.RLock()
	defer convMu.RUnlock()

	var filtered []ConversationEntry
	for _, c := range conversations {
		if userID != "" && c.UserID != userID {
			continue
		}
		if channel != "" && c.Channel != channel {
			continue
		}
		filtered = append(filtered, c)
	}

	if filtered == nil {
		filtered = []ConversationEntry{}
	}

	// Last 100
	if len(filtered) > 100 {
		filtered = filtered[len(filtered)-100:]
	}

	writeJSON(w, http.StatusOK, filtered)
}

// POST /api/channels/relay — relay a message to a specific channel with agent personality
func handleRelayMessage(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AgentID   string `json:"agentId"`
		AgentName string `json:"agentName"`
		Channel   string `json:"channel"` // discord, telegram, slack
		UserID    string `json:"userId"`
		Message   string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	// Record in conversation history
	convMu.Lock()
	conversations = append(conversations, ConversationEntry{
		ID:        fmt.Sprintf("conv-%d", time.Now().UnixMilli()),
		Channel:   body.Channel,
		AgentID:   body.AgentID,
		AgentName: body.AgentName,
		UserID:    body.UserID,
		Response:  body.Message,
		Timestamp: time.Now().UnixMilli(),
	})
	if len(conversations) > 500 {
		conversations = conversations[len(conversations)-500:]
	}
	convMu.Unlock()

	// Format message for channel
	formatted := formatForChannel(body.AgentName, body.Message, body.Channel)

	// Dispatch to channel
	channelCfgMu.RLock()
	defer channelCfgMu.RUnlock()

	switch body.Channel {
	case "discord":
		if channelCfg.Discord.WebhookURL != "" {
			go sendDiscordWebhook(channelCfg.Discord.WebhookURL, formatted)
		}
	case "telegram":
		if channelCfg.Telegram.BotToken != "" && channelCfg.Telegram.ChatID != "" {
			go sendTelegramMessage(channelCfg.Telegram.BotToken, channelCfg.Telegram.ChatID, formatted)
		}
	case "slack":
		if channelCfg.Slack.WebhookURL != "" {
			go sendSlackWebhook(channelCfg.Slack.WebhookURL, formatted)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "formatted": formatted})
}

// Format message based on channel constraints
func formatForChannel(agentName, message, channel string) string {
	switch channel {
	case "discord":
		msg := fmt.Sprintf("**%s**: %s", agentName, message)
		if len(msg) > 2000 {
			msg = msg[:1997] + "..."
		}
		return msg
	case "telegram":
		return fmt.Sprintf("*%s*\n%s", agentName, message)
	case "slack":
		return fmt.Sprintf("*%s*: %s", agentName, message)
	default:
		return fmt.Sprintf("%s: %s", agentName, message)
	}
}

// Send message via Discord webhook
func sendDiscordWebhook(webhookURL, content string) {
	payload, _ := json.Marshal(map[string]string{"content": content})
	http.Post(webhookURL, "application/json", bytes.NewReader(payload))
}

// Send message via Telegram Bot API
func sendTelegramMessage(token, chatID, text string) {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	payload, _ := json.Marshal(map[string]any{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
	})
	http.Post(apiURL, "application/json", bytes.NewReader(payload))
}

// Send message via Slack webhook
func sendSlackWebhook(webhookURL, text string) {
	payload, _ := json.Marshal(map[string]any{
		"text": text,
		"blocks": []map[string]any{
			{
				"type": "section",
				"text": map[string]string{
					"type": "mrkdwn",
					"text": text,
				},
			},
		},
	})
	http.Post(webhookURL, "application/json", bytes.NewReader(payload))
}
