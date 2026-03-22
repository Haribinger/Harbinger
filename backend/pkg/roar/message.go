package roar

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// NewMessage constructs a ROAR message with auto-generated ID and timestamp.
func NewMessage(from, to AgentIdentity, intent MessageIntent, payload map[string]any) *ROARMessage {
	return &ROARMessage{
		ROAR:      "1.0",
		ID:        NewMessageID(),
		From:      from,
		To:        to,
		Intent:    intent,
		Payload:   payload,
		Context:   make(map[string]any),
		Timestamp: float64(time.Now().Unix()),
	}
}

// signingBody builds the canonical JSON used for HMAC computation.
// Keys are sorted alphabetically by json.Marshal on a map.
func (m *ROARMessage) signingBody() ([]byte, error) {
	canonical := map[string]any{
		"context":   m.Context,
		"from":      m.From.DID,
		"id":        m.ID,
		"intent":    string(m.Intent),
		"payload":   m.Payload,
		"timestamp": m.Auth["timestamp"],
		"to":        m.To.DID,
	}
	return json.Marshal(canonical)
}

// Sign computes an HMAC-SHA256 signature over the canonical message body.
func (m *ROARMessage) Sign(secret string) error {
	if m.Auth == nil {
		m.Auth = make(map[string]any)
	}
	m.Auth["timestamp"] = float64(time.Now().Unix())

	body, err := m.signingBody()
	if err != nil {
		return fmt.Errorf("roar: signing body failed: %w", err)
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	sig := hex.EncodeToString(mac.Sum(nil))

	m.Auth["signature"] = "hmac-sha256:" + sig
	return nil
}

// Verify checks the HMAC-SHA256 signature and optional replay window.
func (m *ROARMessage) Verify(secret string, maxAgeSec float64) bool {
	if m.Auth == nil {
		return false
	}

	sigRaw, ok := m.Auth["signature"].(string)
	if !ok || !strings.HasPrefix(sigRaw, "hmac-sha256:") {
		return false
	}

	// Replay protection: check timestamp freshness
	if maxAgeSec > 0 {
		ts, ok := m.Auth["timestamp"].(float64)
		if !ok {
			return false
		}
		age := float64(time.Now().Unix()) - ts
		if age < 0 {
			age = -age
		}
		if age > maxAgeSec {
			return false
		}
	}

	// Recompute HMAC over canonical body
	body, err := m.signingBody()
	if err != nil {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := "hmac-sha256:" + hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(sigRaw), []byte(expected))
}
