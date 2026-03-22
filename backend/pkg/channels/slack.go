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

const slackAPIBase = "https://slack.com/api"

// SlackAdapter bridges Harbinger to Slack via Bot token + Web API.
// Inbound messages arrive through InjectIncoming (called by cmd/ webhook/event handlers);
// outbound messages use chat.postMessage.
type SlackAdapter struct {
	config   AdapterConfig
	client   *http.Client
	incoming chan NativePayload
	botID    string // bot user ID from auth.test
}

// NewSlackAdapter returns a SlackAdapter ready for Connect.
func NewSlackAdapter() *SlackAdapter {
	return &SlackAdapter{
		client:   &http.Client{},
		incoming: make(chan NativePayload, 100),
	}
}

func (s *SlackAdapter) Name() string { return "slack" }

// Connect validates the bot token by calling auth.test.
func (s *SlackAdapter) Connect(ctx context.Context, cfg AdapterConfig) error {
	if cfg.BotToken == "" {
		return fmt.Errorf("slack: bot_token is required")
	}
	s.config = cfg

	botID, err := s.authTest(ctx)
	if err != nil {
		return fmt.Errorf("slack: connect: %w", err)
	}
	s.botID = botID
	return nil
}

// Send delivers a ROAR message to a Slack channel via chat.postMessage.
// The channel is resolved from msg.Context["channel_id"] or the adapter's configured ChannelID.
// If msg.Context["thread_ts"] is set, the message is posted as a thread reply.
func (s *SlackAdapter) Send(ctx context.Context, msg roar.ROARMessage) error {
	channel := s.config.ChannelID
	if ch, ok := msg.Context["channel_id"].(string); ok && ch != "" {
		channel = ch
	}
	if channel == "" {
		return fmt.Errorf("slack: no channel_id available for send")
	}

	text := formatROARContent(msg)

	body := map[string]string{
		"channel": channel,
		"text":    text,
	}
	if ts, ok := msg.Context["thread_ts"].(string); ok && ts != "" {
		body["thread_ts"] = ts
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("slack: marshal chat.postMessage: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, slackAPIBase+"/chat.postMessage", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("slack: build send request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Authorization", "Bearer "+s.config.BotToken)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("slack: send: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("slack: decode chat.postMessage response: %w", err)
	}
	if !result.OK {
		return fmt.Errorf("slack: chat.postMessage: %s", result.Error)
	}
	return nil
}

// Listen returns the inbound message channel. Messages arrive via InjectIncoming.
func (s *SlackAdapter) Listen() <-chan NativePayload {
	return s.incoming
}

// Disconnect closes the incoming channel.
func (s *SlackAdapter) Disconnect(_ context.Context) error {
	close(s.incoming)
	return nil
}

// HealthCheck pings Slack's auth.test to confirm the token is still valid.
func (s *SlackAdapter) HealthCheck(ctx context.Context) error {
	if s.config.BotToken == "" {
		return fmt.Errorf("slack: not connected")
	}
	_, err := s.authTest(ctx)
	return err
}

// InjectIncoming pushes an event-received message into the adapter's incoming channel.
func (s *SlackAdapter) InjectIncoming(payload NativePayload) {
	select {
	case s.incoming <- payload:
	default:
		// buffer full — drop to avoid blocking the event handler
	}
}

// SlackSessionID derives a deterministic session ID from Slack channel and thread context.
// Threaded: "slack:thread:{channel_id}:{thread_ts}", channel-level: "slack:ch:{channel_id}".
func SlackSessionID(channelID, threadTS string) string {
	if channelID == "" {
		return "slack:unknown"
	}
	if threadTS != "" {
		return "slack:thread:" + channelID + ":" + threadTS
	}
	return "slack:ch:" + channelID
}

// authTest calls Slack's auth.test and returns the bot user ID.
func (s *SlackAdapter) authTest(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, slackAPIBase+"/auth.test", nil)
	if err != nil {
		return "", fmt.Errorf("slack: build auth.test request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.config.BotToken)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("slack: auth.test: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("slack: auth.test failed (status %d): %s", resp.StatusCode, body)
	}

	var result struct {
		OK     bool   `json:"ok"`
		UserID string `json:"user_id"`
		Error  string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("slack: decode auth.test: %w", err)
	}
	if !result.OK {
		return "", fmt.Errorf("slack: auth.test: %s", result.Error)
	}
	return result.UserID, nil
}
