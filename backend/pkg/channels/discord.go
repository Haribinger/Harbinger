package channels

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/Haribinger/Harbinger/backend/pkg/roar"
)

const discordAPIBase = "https://discord.com/api/v10"

// DiscordAdapter bridges Harbinger to Discord via bot token + webhooks.
// Inbound messages arrive through InjectIncoming (called by cmd/ webhook handlers);
// outbound messages are sent via the configured webhook URL.
type DiscordAdapter struct {
	config   AdapterConfig
	client   *http.Client
	incoming chan NativePayload
	botUser  string // bot username resolved from /users/@me
}

// NewDiscordAdapter returns a DiscordAdapter ready for Connect.
func NewDiscordAdapter() *DiscordAdapter {
	return &DiscordAdapter{
		client:   &http.Client{},
		incoming: make(chan NativePayload, 100),
	}
}

func (d *DiscordAdapter) Name() string { return "discord" }

// Connect validates the bot token by calling GET /users/@me and stores the bot username.
func (d *DiscordAdapter) Connect(ctx context.Context, cfg AdapterConfig) error {
	if cfg.BotToken == "" {
		return fmt.Errorf("discord: bot_token is required")
	}
	d.config = cfg

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, discordAPIBase+"/users/@me", nil)
	if err != nil {
		return fmt.Errorf("discord: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bot "+cfg.BotToken)

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("discord: connect: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("discord: auth failed (status %d): %s", resp.StatusCode, body)
	}

	var me struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&me); err != nil {
		return fmt.Errorf("discord: decode /users/@me: %w", err)
	}
	d.botUser = me.Username
	return nil
}

// Send delivers a ROAR message to Discord via the configured webhook URL.
func (d *DiscordAdapter) Send(ctx context.Context, msg roar.ROARMessage) error {
	if d.config.WebhookURL == "" {
		return fmt.Errorf("discord: webhook_url not configured")
	}

	text := formatROARContent(msg)

	payload, err := json.Marshal(map[string]string{"content": text})
	if err != nil {
		return fmt.Errorf("discord: marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.config.WebhookURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("discord: build send request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("discord: send: %w", err)
	}
	defer resp.Body.Close()

	// Discord webhooks return 204 on success, but some return 200
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("discord: send failed (status %d): %s", resp.StatusCode, body)
	}
	return nil
}

// Listen returns the inbound message channel. Messages arrive via InjectIncoming.
func (d *DiscordAdapter) Listen() <-chan NativePayload {
	return d.incoming
}

// Disconnect closes the incoming channel.
func (d *DiscordAdapter) Disconnect(_ context.Context) error {
	close(d.incoming)
	return nil
}

// HealthCheck pings Discord's /users/@me to confirm the bot token is still valid.
func (d *DiscordAdapter) HealthCheck(ctx context.Context) error {
	if d.config.BotToken == "" {
		return fmt.Errorf("discord: not connected")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, discordAPIBase+"/users/@me", nil)
	if err != nil {
		return fmt.Errorf("discord: health build request: %w", err)
	}
	req.Header.Set("Authorization", "Bot "+d.config.BotToken)

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("discord: health check: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("discord: health check failed (status %d)", resp.StatusCode)
	}
	return nil
}

// InjectIncoming pushes a webhook-received message into the adapter's incoming channel.
// Called by the cmd/ webhook handler — non-blocking if the buffer is full (drops the message).
func (d *DiscordAdapter) InjectIncoming(payload NativePayload) {
	select {
	case d.incoming <- payload:
	default:
		// buffer full — drop to avoid blocking the webhook handler
	}
}

// DiscordSessionID derives a deterministic session ID from Discord message metadata.
// Guild messages: "discord:ch:{channel_id}", DMs: "discord:dm:{user_id}".
func DiscordSessionID(meta map[string]any) string {
	if guildID, ok := meta["guild_id"].(string); ok && guildID != "" {
		if channelID, ok := meta["channel_id"].(string); ok {
			return "discord:ch:" + channelID
		}
	}
	if userID, ok := meta["user_id"].(string); ok {
		return "discord:dm:" + userID
	}
	// fallback: use channel_id if present
	if channelID, ok := meta["channel_id"].(string); ok {
		return "discord:ch:" + channelID
	}
	return "discord:unknown"
}

// formatROARContent extracts displayable text from a ROARMessage payload.
func formatROARContent(msg roar.ROARMessage) string {
	if content, ok := msg.Payload["content"].(string); ok && content != "" {
		return content
	}
	// Fall back to JSON representation of the payload
	b, err := json.Marshal(msg.Payload)
	if err != nil {
		return fmt.Sprintf("[%s → %s] %s", msg.From.DisplayName, msg.To.DisplayName, msg.Intent)
	}
	return string(b)
}
