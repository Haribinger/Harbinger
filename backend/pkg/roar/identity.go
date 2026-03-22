package roar

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
)

// GenerateDID creates a decentralized identifier for an agent.
// Format: did:roar:<agent_type>:<slug>-<16-char-hex>
func GenerateDID(id *AgentIdentity) string {
	slug := strings.ToLower(id.DisplayName)
	slug = strings.ReplaceAll(slug, " ", "-")
	if len(slug) > 20 {
		slug = slug[:20]
	}

	randBytes := make([]byte, 8)
	if _, err := rand.Read(randBytes); err != nil {
		panic(fmt.Sprintf("roar: crypto/rand failed: %v", err))
	}
	hexPart := hex.EncodeToString(randBytes)

	did := fmt.Sprintf("did:roar:%s:%s-%s", id.AgentType, slug, hexPart)
	id.DID = did
	if id.Version == "" {
		id.Version = "1.0"
	}
	return did
}

// GenerateKeyPair produces an Ed25519 signing keypair.
// Returns the private key, hex-encoded public key, and any error.
func GenerateKeyPair() (ed25519.PrivateKey, string, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, "", fmt.Errorf("roar: ed25519 keygen failed: %w", err)
	}
	return priv, hex.EncodeToString(pub), nil
}

// NewMessageID returns a unique message identifier: "msg_" + 10 hex chars.
func NewMessageID() string {
	b := make([]byte, 5)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("roar: crypto/rand failed: %v", err))
	}
	return "msg_" + hex.EncodeToString(b)
}
