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

const telegramAPIBase = "https://api.telegram.org"

// maxTelegramMessage is Telegram's per-message character limit.
const maxTelegramMessage = 4000

// TelegramAdapter bridges Harbinger to Telegram via Bot API.
// Inbound messages arrive through InjectIncoming (called by cmd/ webhook handlers);
// outbound messages are sent via sendMessage.
type TelegramAdapter struct {
	config   AdapterConfig
	client   *http.Client
	incoming chan NativePayload
	botName  string
}

// NewTelegramAdapter returns a TelegramAdapter ready for Connect.
func NewTelegramAdapter() *TelegramAdapter {
	return &TelegramAdapter{
		client:   &http.Client{},
		incoming: make(chan NativePayload, 100),
	}
}

func (t *TelegramAdapter) Name() string { return "telegram" }

// Connect validates the bot token by calling getMe.
func (t *TelegramAdapter) Connect(ctx context.Context, cfg AdapterConfig) error {
	if cfg.BotToken == "" {
		return fmt.Errorf("telegram: bot_token is required")
	}
	t.config = cfg

	me, err := t.getMe(ctx)
	if err != nil {
		return fmt.Errorf("telegram: connect: %w", err)
	}
	t.botName = me
	return nil
}

// Send delivers a ROAR message to a Telegram chat. The chat_id is resolved from
// msg.To metadata ("chat_id" key) or falls back to the adapter's configured ChannelID.
// Messages exceeding 4000 chars are chunked.
func (t *TelegramAdapter) Send(ctx context.Context, msg roar.ROARMessage) error {
	chatID := t.config.ChannelID
	if toChat, ok := msg.Context["chat_id"].(string); ok && toChat != "" {
		chatID = toChat
	}
	if chatID == "" {
		return fmt.Errorf("telegram: no chat_id available for send")
	}

	text := formatROARContent(msg)
	chunks := chunkText(text, maxTelegramMessage)

	for _, chunk := range chunks {
		if err := t.sendMessage(ctx, chatID, chunk); err != nil {
			return err
		}
	}
	return nil
}

// Listen returns the inbound message channel. Messages arrive via InjectIncoming.
func (t *TelegramAdapter) Listen() <-chan NativePayload {
	return t.incoming
}

// Disconnect closes the incoming channel.
func (t *TelegramAdapter) Disconnect(_ context.Context) error {
	close(t.incoming)
	return nil
}

// HealthCheck pings Telegram's getMe endpoint.
func (t *TelegramAdapter) HealthCheck(ctx context.Context) error {
	if t.config.BotToken == "" {
		return fmt.Errorf("telegram: not connected")
	}
	_, err := t.getMe(ctx)
	return err
}

// InjectIncoming pushes a webhook-received message into the adapter's incoming channel.
func (t *TelegramAdapter) InjectIncoming(payload NativePayload) {
	select {
	case t.incoming <- payload:
	default:
		// buffer full — drop to avoid blocking the webhook handler
	}
}

// TelegramSessionID derives a deterministic session ID from a Telegram chat ID.
func TelegramSessionID(chatID string) string {
	if chatID == "" {
		return "telegram:unknown"
	}
	return "telegram:" + chatID
}

// getMe calls the Telegram getMe endpoint and returns the bot username.
func (t *TelegramAdapter) getMe(ctx context.Context) (string, error) {
	url := telegramAPIBase + "/bot" + t.config.BotToken + "/getMe"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("telegram: build getMe request: %w", err)
	}

	resp, err := t.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("telegram: getMe: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("telegram: getMe failed (status %d): %s", resp.StatusCode, body)
	}

	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			Username string `json:"username"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("telegram: decode getMe: %w", err)
	}
	if !result.OK {
		return "", fmt.Errorf("telegram: getMe returned ok=false")
	}
	return result.Result.Username, nil
}

// sendMessage posts a single message to a Telegram chat.
func (t *TelegramAdapter) sendMessage(ctx context.Context, chatID, text string) error {
	url := telegramAPIBase + "/bot" + t.config.BotToken + "/sendMessage"

	payload, err := json.Marshal(map[string]string{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "HTML",
	})
	if err != nil {
		return fmt.Errorf("telegram: marshal sendMessage: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("telegram: build sendMessage request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("telegram: sendMessage: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telegram: sendMessage failed (status %d): %s", resp.StatusCode, body)
	}
	return nil
}

// chunkText splits text into slices of at most maxLen characters,
// breaking at the last newline within the limit when possible.
func chunkText(text string, maxLen int) []string {
	if len(text) <= maxLen {
		return []string{text}
	}
	var chunks []string
	for len(text) > 0 {
		if len(text) <= maxLen {
			chunks = append(chunks, text)
			break
		}
		cut := maxLen
		// Try to break at a newline
		for i := maxLen - 1; i > maxLen/2; i-- {
			if text[i] == '\n' {
				cut = i + 1
				break
			}
		}
		chunks = append(chunks, text[:cut])
		text = text[cut:]
	}
	return chunks
}
