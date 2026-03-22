package channels

import (
	"context"

	"github.com/Haribinger/Harbinger/backend/pkg/roar"
)

// AdapterConfig holds connection credentials and settings for a chat platform adapter.
type AdapterConfig struct {
	BotToken      string            `json:"bot_token"`
	AppToken      string            `json:"app_token"`
	WebhookURL    string            `json:"webhook_url"`
	WebhookSecret string            `json:"webhook_secret"`
	ChannelID     string            `json:"channel_id"`
	GuildID       string            `json:"guild_id"`
	Extra         map[string]string `json:"extra,omitempty"`
}

// NativePayload represents an inbound message from a chat platform,
// normalised into a platform-agnostic shape before conversion to ROAR.
type NativePayload struct {
	ChannelName string         `json:"channel_name"`
	SenderID    string         `json:"sender_id"`
	SessionID   string         `json:"session_id"`
	Content     string         `json:"content"`
	Attachments []Attachment   `json:"attachments,omitempty"`
	Meta        map[string]any `json:"meta,omitempty"`
}

// Attachment is a media or file reference inside a NativePayload.
type Attachment struct {
	Type string `json:"type"` // "image", "video", "audio", "file"
	URL  string `json:"url"`
	Name string `json:"name"`
}

// Adapter is the contract every chat-platform bridge must satisfy.
// Implementations live in sub-packages (e.g. channels/discord, channels/slack).
type Adapter interface {
	// Name returns a stable identifier for the platform (e.g. "discord", "slack").
	Name() string

	// Connect authenticates and opens the connection using the supplied config.
	Connect(ctx context.Context, cfg AdapterConfig) error

	// Send delivers a ROAR message to the platform.
	Send(ctx context.Context, msg roar.ROARMessage) error

	// Listen returns a read-only channel that emits inbound messages.
	// The channel is closed when the adapter disconnects.
	Listen() <-chan NativePayload

	// Disconnect gracefully tears down the platform connection.
	Disconnect(ctx context.Context) error

	// HealthCheck pings the platform API to confirm liveness.
	HealthCheck(ctx context.Context) error
}
