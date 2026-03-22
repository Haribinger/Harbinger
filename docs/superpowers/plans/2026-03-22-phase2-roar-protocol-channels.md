# Phase 2: ROAR Protocol + Channel Adapters

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Harbinger's ad-hoc agent messaging (`comms.go`) with a native Go ROAR protocol bus, and upgrade unidirectional channel webhooks (`channels.go`) to full bidirectional adapters for Discord, Telegram, and Slack.

**Architecture:** ROAR is implemented as `backend/pkg/roar/` — a self-contained Go package implementing all 5 protocol layers (identity, discovery, transport, exchange, stream). Channel adapters live in `backend/pkg/channels/` implementing a common `Adapter` interface. New handler files in `backend/cmd/` expose ROAR and channel endpoints. Existing `comms.go` handlers are preserved as thin wrappers over the ROAR bus for backward compatibility.

**Tech Stack:** Go 1.24, crypto/ed25519, crypto/hmac, HMAC-SHA256, Server-Sent Events (SSE)

**Spec:** `docs/superpowers/specs/2026-03-21-unified-migration-design.md` (Section 4 — Phase 2)

**ROAR Reference:** `/home/anon/dev/roar-protocol/spec/` (5 layer specs), `/home/anon/dev/roar-protocol/python/src/roar_sdk/` (Python reference implementation)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/pkg/roar/types.go` | Core types: AgentIdentity, AgentCard, ROARMessage, MessageIntent, StreamEvent |
| `backend/pkg/roar/identity.go` | Layer 1: DID generation, identity management |
| `backend/pkg/roar/discovery.go` | Layer 2: Agent directory (register, lookup, search) |
| `backend/pkg/roar/message.go` | Layer 4: Message creation, signing (HMAC-SHA256 + Ed25519), verification |
| `backend/pkg/roar/bus.go` | Message router: publish, subscribe, fanout, backpressure |
| `backend/pkg/roar/stream.go` | Layer 5: EventBus for StreamEvents with filtered subscriptions |
| `backend/pkg/roar/roar_test.go` | Comprehensive tests: signing, verification, bus routing, discovery |
| `backend/pkg/channels/adapter.go` | Common Adapter interface + NativePayload type |
| `backend/pkg/channels/discord.go` | Discord bidirectional adapter (Bot Gateway WebSocket) |
| `backend/pkg/channels/telegram.go` | Telegram bidirectional adapter (Bot API polling) |
| `backend/pkg/channels/slack.go` | Slack bidirectional adapter (Socket Mode) |
| `backend/pkg/channels/manager.go` | ChannelManager: lifecycle, message routing, debouncing |
| `backend/pkg/channels/channels_test.go` | Tests for adapter logic and manager |
| `backend/cmd/roar_handlers.go` | HTTP handlers for ROAR endpoints |
| `backend/cmd/channel_handlers.go` | HTTP handlers for new channel adapter endpoints |

### Modified Files

| File | Changes |
|------|---------|
| `backend/cmd/main.go` | Register ROAR + channel routes, init bus + adapters |
| `backend/cmd/comms.go` | Wrap existing handlers to publish via ROAR bus (backward compat) |
| `backend/cmd/agents.go` | Assign DID to each agent on spawn |

---

## Task 1: ROAR Core Types

**Files:**
- Create: `backend/pkg/roar/types.go`

- [ ] **Step 1: Create types.go with all ROAR data structures**

```go
// backend/pkg/roar/types.go
package roar

import "time"

// MessageIntent defines what the sender wants the receiver to do.
type MessageIntent string

const (
    IntentExecute  MessageIntent = "execute"  // Request tool/command execution
    IntentDelegate MessageIntent = "delegate" // Hand off a task
    IntentUpdate   MessageIntent = "update"   // Report progress
    IntentAsk      MessageIntent = "ask"      // Request human input
    IntentRespond  MessageIntent = "respond"  // Reply to a message
    IntentNotify   MessageIntent = "notify"   // One-way notification
    IntentDiscover MessageIntent = "discover" // Agent capability lookup
)

// AgentIdentity represents a ROAR agent's W3C DID-based identity.
type AgentIdentity struct {
    DID          string   `json:"did"`
    DisplayName  string   `json:"display_name"`
    AgentType    string   `json:"agent_type"` // "agent", "tool", "human", "channel"
    Capabilities []string `json:"capabilities"`
    Version      string   `json:"version"`
    PublicKey    string   `json:"public_key,omitempty"` // Ed25519 hex-encoded
}

// AgentCapability describes a formal capability with input/output schemas.
type AgentCapability struct {
    Name         string         `json:"name"`
    Description  string         `json:"description"`
    InputSchema  map[string]any `json:"input_schema,omitempty"`
    OutputSchema map[string]any `json:"output_schema,omitempty"`
}

// AgentCard is the public capability descriptor for discovery.
type AgentCard struct {
    Identity             AgentIdentity     `json:"identity"`
    Description          string            `json:"description"`
    Skills               []string          `json:"skills"`
    Channels             []string          `json:"channels"`
    Endpoints            map[string]string `json:"endpoints,omitempty"`
    DeclaredCapabilities []AgentCapability `json:"declared_capabilities,omitempty"`
    Metadata             map[string]any    `json:"metadata,omitempty"`
}

// ROARMessage is the unified message format for all agent communication.
type ROARMessage struct {
    ROAR      string         `json:"roar"`      // "1.0"
    ID        string         `json:"id"`        // "msg_<hex>"
    From      AgentIdentity  `json:"from"`
    To        AgentIdentity  `json:"to"`
    Intent    MessageIntent  `json:"intent"`
    Payload   map[string]any `json:"payload"`
    Context   map[string]any `json:"context,omitempty"`
    Auth      map[string]any `json:"auth,omitempty"`
    Timestamp float64        `json:"timestamp"`
}

// StreamEventType defines the fixed event types for real-time streaming.
type StreamEventType string

const (
    EventToolCall     StreamEventType = "tool_call"
    EventMCPRequest   StreamEventType = "mcp_request"
    EventReasoning    StreamEventType = "reasoning"
    EventTaskUpdate   StreamEventType = "task_update"
    EventMonitorAlert StreamEventType = "monitor_alert"
    EventAgentStatus  StreamEventType = "agent_status"
    EventCheckpoint   StreamEventType = "checkpoint"
    EventMessage      StreamEventType = "message" // ROAR message event
)

// StreamEvent represents a real-time event for monitoring/coordination.
type StreamEvent struct {
    Type      StreamEventType `json:"type"`
    Source    string          `json:"source"`     // DID of emitting agent
    SessionID string         `json:"session_id"`
    Data      map[string]any  `json:"data"`
    Timestamp float64         `json:"timestamp"`
}

// DiscoveryEntry represents a registered agent in the directory.
type DiscoveryEntry struct {
    Card         AgentCard `json:"agent_card"`
    RegisteredAt time.Time `json:"registered_at"`
    LastSeen     time.Time `json:"last_seen"`
}
```

- [ ] **Step 2: Build to verify**

Run: `cd /home/anon/Harbinger/backend && go build ./pkg/roar/`
Expected: BUILD SUCCESS (types only, no logic yet)

- [ ] **Step 3: Commit**

```bash
git add backend/pkg/roar/types.go
git commit -m "feat(roar): add core ROAR protocol types"
```

---

## Task 2: Identity Layer (Layer 1)

**Files:**
- Create: `backend/pkg/roar/identity.go`
- Test in: `backend/pkg/roar/roar_test.go`

- [ ] **Step 1: Write failing test**

```go
// backend/pkg/roar/roar_test.go
package roar

import (
    "strings"
    "testing"
)

func TestGenerateDID(t *testing.T) {
    id := AgentIdentity{
        DisplayName: "PATHFINDER",
        AgentType:   "agent",
    }
    did := GenerateDID(&id)
    if !strings.HasPrefix(did, "did:roar:agent:") {
        t.Fatalf("DID should start with did:roar:agent:, got %s", did)
    }
    if len(did) < 30 {
        t.Fatalf("DID too short: %s", did)
    }
    // Should contain lowercase name slug
    if !strings.Contains(did, "pathfinder") {
        t.Fatalf("DID should contain lowercase name: %s", did)
    }
}

func TestGenerateDIDUniqueness(t *testing.T) {
    id := AgentIdentity{DisplayName: "Test", AgentType: "agent"}
    did1 := GenerateDID(&id)
    did2 := GenerateDID(&id)
    if did1 == did2 {
        t.Fatal("DIDs should be unique")
    }
}

func TestHarbingerAgentDIDs(t *testing.T) {
    agents := []string{"PATHFINDER", "BREACH", "PHANTOM", "SPECTER", "CIPHER",
        "SCRIBE", "SAM", "BRIEF", "SAGE", "LENS", "MAINTAINER"}
    seen := map[string]bool{}
    for _, name := range agents {
        id := AgentIdentity{DisplayName: name, AgentType: "agent"}
        did := GenerateDID(&id)
        if seen[did] {
            t.Fatalf("duplicate DID for %s", name)
        }
        seen[did] = true
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/anon/Harbinger/backend && go test ./pkg/roar/ -run TestGenerate -v`
Expected: FAIL — GenerateDID not defined

- [ ] **Step 3: Implement identity.go**

```go
// backend/pkg/roar/identity.go
package roar

import (
    "crypto/ed25519"
    "crypto/rand"
    "encoding/hex"
    "fmt"
    "strings"
)

// GenerateDID creates a unique DID for an agent identity.
// Format: did:roar:<agent_type>:<slug>-<16-char-hex>
func GenerateDID(id *AgentIdentity) string {
    slug := strings.ToLower(id.DisplayName)
    slug = strings.ReplaceAll(slug, " ", "-")
    if len(slug) > 20 {
        slug = slug[:20]
    }

    b := make([]byte, 8)
    rand.Read(b)
    hexStr := hex.EncodeToString(b)

    agentType := id.AgentType
    if agentType == "" {
        agentType = "agent"
    }

    did := fmt.Sprintf("did:roar:%s:%s-%s", agentType, slug, hexStr)
    id.DID = did
    if id.Version == "" {
        id.Version = "1.0"
    }
    return did
}

// GenerateKeyPair creates an Ed25519 key pair for message signing.
// Returns (privateKey, publicKeyHex).
func GenerateKeyPair() (ed25519.PrivateKey, string, error) {
    pub, priv, err := ed25519.GenerateKey(rand.Reader)
    if err != nil {
        return nil, "", fmt.Errorf("keygen: %w", err)
    }
    pubHex := hex.EncodeToString(pub)
    return priv, pubHex, nil
}

// NewMessageID generates a unique message ID: "msg_<10-char-hex>"
func NewMessageID() string {
    b := make([]byte, 5)
    rand.Read(b)
    return "msg_" + hex.EncodeToString(b)
}
```

- [ ] **Step 4: Run tests**

Run: `cd /home/anon/Harbinger/backend && go test ./pkg/roar/ -run TestGenerate -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/pkg/roar/identity.go backend/pkg/roar/roar_test.go
git commit -m "feat(roar): add identity layer — DID generation and key pairs"
```

---

## Task 3: Discovery Layer (Layer 2)

**Files:**
- Create: `backend/pkg/roar/discovery.go`
- Add tests to: `backend/pkg/roar/roar_test.go`

- [ ] **Step 1: Write failing tests**

Add to `roar_test.go`:

```go
func TestAgentDirectory(t *testing.T) {
    dir := NewDirectory()

    // Register agent
    card := AgentCard{
        Identity: AgentIdentity{
            DID:          "did:roar:agent:pathfinder-abc123",
            DisplayName:  "PATHFINDER",
            AgentType:    "agent",
            Capabilities: []string{"recon", "scanning", "enumeration"},
        },
        Description: "Reconnaissance scout",
        Skills:      []string{"subfinder", "httpx", "naabu"},
    }
    entry := dir.Register(card)
    if entry.Card.Identity.DID != card.Identity.DID {
        t.Fatal("registered card DID mismatch")
    }

    // Lookup
    found := dir.Lookup("did:roar:agent:pathfinder-abc123")
    if found == nil {
        t.Fatal("lookup returned nil")
    }

    // Search by capability
    results := dir.Search("recon")
    if len(results) != 1 {
        t.Fatalf("expected 1 result for 'recon', got %d", len(results))
    }

    // Search miss
    results = dir.Search("cryptography")
    if len(results) != 0 {
        t.Fatalf("expected 0 results for 'cryptography', got %d", len(results))
    }

    // Unregister
    ok := dir.Unregister("did:roar:agent:pathfinder-abc123")
    if !ok {
        t.Fatal("unregister failed")
    }
    if dir.Lookup("did:roar:agent:pathfinder-abc123") != nil {
        t.Fatal("agent still found after unregister")
    }
}

func TestDirectoryConcurrency(t *testing.T) {
    dir := NewDirectory()
    done := make(chan bool, 20)
    for i := 0; i < 20; i++ {
        go func(n int) {
            id := AgentIdentity{DisplayName: fmt.Sprintf("agent-%d", n), AgentType: "agent"}
            GenerateDID(&id)
            dir.Register(AgentCard{Identity: id, Capabilities: []AgentCapability{{Name: "test"}}})
            dir.Search("test")
            dir.ListAll()
            done <- true
        }(i)
    }
    for i := 0; i < 20; i++ {
        <-done
    }
    if len(dir.ListAll()) != 20 {
        t.Fatalf("expected 20 agents, got %d", len(dir.ListAll()))
    }
}
```

- [ ] **Step 2: Implement discovery.go**

```go
// backend/pkg/roar/discovery.go
package roar

import (
    "sync"
    "time"
)

// Directory is an in-memory agent registry for local discovery.
type Directory struct {
    mu     sync.RWMutex
    agents map[string]DiscoveryEntry // keyed by DID
}

// NewDirectory creates an empty agent directory.
func NewDirectory() *Directory {
    return &Directory{agents: make(map[string]DiscoveryEntry)}
}

// Register adds an agent card to the directory.
func (d *Directory) Register(card AgentCard) DiscoveryEntry {
    now := time.Now()
    entry := DiscoveryEntry{
        Card:         card,
        RegisteredAt: now,
        LastSeen:     now,
    }
    d.mu.Lock()
    d.agents[card.Identity.DID] = entry
    d.mu.Unlock()
    return entry
}

// Unregister removes an agent by DID.
func (d *Directory) Unregister(did string) bool {
    d.mu.Lock()
    defer d.mu.Unlock()
    if _, ok := d.agents[did]; !ok {
        return false
    }
    delete(d.agents, did)
    return true
}

// Lookup finds a single agent by DID.
func (d *Directory) Lookup(did string) *DiscoveryEntry {
    d.mu.RLock()
    defer d.mu.RUnlock()
    entry, ok := d.agents[did]
    if !ok {
        return nil
    }
    return &entry
}

// Search finds agents that declare a matching capability.
func (d *Directory) Search(capability string) []DiscoveryEntry {
    d.mu.RLock()
    defer d.mu.RUnlock()
    var results []DiscoveryEntry
    for _, entry := range d.agents {
        for _, cap := range entry.Card.Identity.Capabilities {
            if cap == capability {
                results = append(results, entry)
                break
            }
        }
        // Also check declared capabilities
        for _, cap := range entry.Card.DeclaredCapabilities {
            if cap.Name == capability {
                results = append(results, entry)
                break
            }
        }
    }
    return results
}

// ListAll returns all registered agents.
func (d *Directory) ListAll() []DiscoveryEntry {
    d.mu.RLock()
    defer d.mu.RUnlock()
    results := make([]DiscoveryEntry, 0, len(d.agents))
    for _, entry := range d.agents {
        results = append(results, entry)
    }
    return results
}

// Heartbeat updates the LastSeen timestamp for an agent.
func (d *Directory) Heartbeat(did string) bool {
    d.mu.Lock()
    defer d.mu.Unlock()
    entry, ok := d.agents[did]
    if !ok {
        return false
    }
    entry.LastSeen = time.Now()
    d.agents[did] = entry
    return true
}
```

- [ ] **Step 3: Run tests**

Run: `cd /home/anon/Harbinger/backend && go test ./pkg/roar/ -run TestAgentDirectory -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/pkg/roar/discovery.go backend/pkg/roar/roar_test.go
git commit -m "feat(roar): add discovery layer — agent directory with search"
```

---

## Task 4: Message Signing & Verification (Layer 4)

**Files:**
- Create: `backend/pkg/roar/message.go`
- Add tests to: `backend/pkg/roar/roar_test.go`

This is the most security-critical task. HMAC-SHA256 and Ed25519 signing must produce canonical JSON matching the ROAR spec.

- [ ] **Step 1: Write failing tests**

Add to `roar_test.go`:

```go
func TestMessageSign(t *testing.T) {
    msg := &ROARMessage{
        ROAR:    "1.0",
        ID:      "msg_a1b2c3d4e5",
        From:    AgentIdentity{DID: "did:roar:agent:pathfinder-abc"},
        To:      AgentIdentity{DID: "did:roar:agent:breach-def"},
        Intent:  IntentDelegate,
        Payload: map[string]any{"task": "scan example.com"},
        Context: map[string]any{},
    }

    err := msg.Sign("test-secret-key")
    if err != nil {
        t.Fatalf("sign failed: %v", err)
    }
    if msg.Auth == nil {
        t.Fatal("auth is nil after signing")
    }
    sig, ok := msg.Auth["signature"].(string)
    if !ok || !strings.HasPrefix(sig, "hmac-sha256:") {
        t.Fatalf("bad signature format: %v", sig)
    }
}

func TestMessageVerify(t *testing.T) {
    msg := &ROARMessage{
        ROAR:    "1.0",
        ID:      "msg_test123456",
        From:    AgentIdentity{DID: "did:roar:agent:a"},
        To:      AgentIdentity{DID: "did:roar:agent:b"},
        Intent:  IntentExecute,
        Payload: map[string]any{"cmd": "nmap"},
        Context: map[string]any{},
    }

    secret := "harbinger-signing-key"
    msg.Sign(secret)

    // Valid verification
    if !msg.Verify(secret, 300) {
        t.Fatal("verification failed for valid message")
    }

    // Wrong secret
    if msg.Verify("wrong-key", 300) {
        t.Fatal("verification passed with wrong secret")
    }

    // Tampered payload
    msg.Payload["cmd"] = "malicious"
    if msg.Verify(secret, 300) {
        t.Fatal("verification passed with tampered payload")
    }
}

func TestMessageVerifyReplayProtection(t *testing.T) {
    msg := &ROARMessage{
        ROAR:    "1.0",
        ID:      "msg_replay12345",
        From:    AgentIdentity{DID: "did:roar:agent:a"},
        To:      AgentIdentity{DID: "did:roar:agent:b"},
        Intent:  IntentNotify,
        Payload: map[string]any{},
        Context: map[string]any{},
    }

    secret := "key"
    msg.Sign(secret)

    // Set timestamp to 10 minutes ago — should fail with 300s window
    msg.Auth["timestamp"] = float64(time.Now().Unix() - 600)
    if msg.Verify(secret, 300) {
        t.Fatal("should reject expired message")
    }
}

func TestNewROARMessage(t *testing.T) {
    from := AgentIdentity{DID: "did:roar:agent:pathfinder-abc"}
    to := AgentIdentity{DID: "did:roar:agent:breach-def"}
    msg := NewMessage(from, to, IntentDelegate, map[string]any{"task": "scan"})

    if msg.ROAR != "1.0" {
        t.Fatalf("expected ROAR 1.0, got %s", msg.ROAR)
    }
    if !strings.HasPrefix(msg.ID, "msg_") {
        t.Fatalf("bad message ID: %s", msg.ID)
    }
    if msg.Timestamp == 0 {
        t.Fatal("timestamp not set")
    }
}
```

- [ ] **Step 2: Implement message.go**

```go
// backend/pkg/roar/message.go
package roar

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "math"
    "strings"
    "time"
)

// NewMessage creates a new ROARMessage with auto-generated ID and timestamp.
func NewMessage(from, to AgentIdentity, intent MessageIntent, payload map[string]any) *ROARMessage {
    if payload == nil {
        payload = map[string]any{}
    }
    return &ROARMessage{
        ROAR:      "1.0",
        ID:        NewMessageID(),
        From:      from,
        To:        to,
        Intent:    intent,
        Payload:   payload,
        Context:   map[string]any{},
        Timestamp: float64(time.Now().Unix()),
    }
}

// signingBody builds the canonical JSON for signing.
// Fields: context, from (DID string), id, intent, payload, timestamp, to (DID string)
// Keys are sorted alphabetically (Go's json.Marshal does this for map[string]any).
func (m *ROARMessage) signingBody() ([]byte, error) {
    ts, _ := m.Auth["timestamp"]
    body := map[string]any{
        "context":   m.Context,
        "from":      m.From.DID,
        "id":        m.ID,
        "intent":    string(m.Intent),
        "payload":   m.Payload,
        "timestamp": ts,
        "to":        m.To.DID,
    }
    return json.Marshal(body)
}

// Sign signs the message with HMAC-SHA256 using the shared secret.
func (m *ROARMessage) Sign(secret string) error {
    if m.Auth == nil {
        m.Auth = map[string]any{}
    }
    m.Auth["timestamp"] = float64(time.Now().Unix())

    body, err := m.signingBody()
    if err != nil {
        return fmt.Errorf("canonical body: %w", err)
    }

    h := hmac.New(sha256.New, []byte(secret))
    h.Write(body)
    hexSig := hex.EncodeToString(h.Sum(nil))
    m.Auth["signature"] = "hmac-sha256:" + hexSig
    return nil
}

// Verify checks the HMAC-SHA256 signature and optional timestamp window.
// maxAgeSec=0 disables timestamp check.
func (m *ROARMessage) Verify(secret string, maxAgeSec float64) bool {
    if m.Auth == nil {
        return false
    }
    sigValue, ok := m.Auth["signature"].(string)
    if !ok || !strings.HasPrefix(sigValue, "hmac-sha256:") {
        return false
    }

    // Replay protection
    if maxAgeSec > 0 {
        msgTime, ok := m.Auth["timestamp"].(float64)
        if !ok {
            return false
        }
        age := math.Abs(float64(time.Now().Unix()) - msgTime)
        if age > maxAgeSec {
            return false
        }
    }

    // Recompute signature
    body, err := m.signingBody()
    if err != nil {
        return false
    }

    h := hmac.New(sha256.New, []byte(secret))
    h.Write(body)
    expectedHex := hex.EncodeToString(h.Sum(nil))
    actualHex := sigValue[len("hmac-sha256:"):]

    return hmac.Equal([]byte(expectedHex), []byte(actualHex))
}
```

- [ ] **Step 3: Run tests**

Run: `cd /home/anon/Harbinger/backend && go test ./pkg/roar/ -run "TestMessage|TestNew" -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/pkg/roar/message.go backend/pkg/roar/roar_test.go
git commit -m "feat(roar): add message signing and verification — HMAC-SHA256"
```

---

## Task 5: Message Bus (Router)

**Files:**
- Create: `backend/pkg/roar/bus.go`
- Add tests to: `backend/pkg/roar/roar_test.go`

- [ ] **Step 1: Write failing tests**

```go
func TestBusPublishSubscribe(t *testing.T) {
    bus := NewBus(BusConfig{Secret: "test-key", MaxAge: 300})
    from := AgentIdentity{DID: "did:roar:agent:pathfinder-abc"}
    to := AgentIdentity{DID: "did:roar:agent:breach-def"}

    // Subscribe to messages for breach
    ch := bus.Subscribe("did:roar:agent:breach-def", nil)

    // Publish
    msg := NewMessage(from, to, IntentDelegate, map[string]any{"task": "scan"})
    msg.Sign("test-key")
    delivered, err := bus.Publish(msg)
    if err != nil {
        t.Fatalf("publish failed: %v", err)
    }
    if delivered != 1 {
        t.Fatalf("expected 1 delivery, got %d", delivered)
    }

    // Receive
    select {
    case received := <-ch:
        if received.ID != msg.ID {
            t.Fatalf("wrong message ID: %s", received.ID)
        }
    case <-time.After(time.Second):
        t.Fatal("timeout waiting for message")
    }
}

func TestBusBroadcast(t *testing.T) {
    bus := NewBus(BusConfig{Secret: "key", MaxAge: 0})

    ch1 := bus.Subscribe("did:roar:agent:a", nil)
    ch2 := bus.Subscribe("did:roar:agent:b", nil)
    chAll := bus.SubscribeAll(nil) // wildcard subscriber

    msg := NewMessage(
        AgentIdentity{DID: "did:roar:agent:sender"},
        AgentIdentity{DID: "did:roar:agent:a"},
        IntentNotify,
        map[string]any{"alert": "found vuln"},
    )

    bus.Publish(msg) // no signing needed if maxAge=0

    // ch1 should get it (direct), chAll should get it (wildcard), ch2 should not
    select {
    case <-ch1:
    case <-time.After(time.Second):
        t.Fatal("ch1 timeout")
    }
    select {
    case <-chAll:
    case <-time.After(time.Second):
        t.Fatal("chAll timeout")
    }
    select {
    case <-ch2:
        t.Fatal("ch2 should not receive")
    default:
    }
}

func TestBusUnsubscribe(t *testing.T) {
    bus := NewBus(BusConfig{})
    subID := bus.SubscribeWithID("did:roar:agent:a", nil)
    bus.Unsubscribe(subID)
    // Should not panic or deadlock
}
```

- [ ] **Step 2: Implement bus.go**

```go
// backend/pkg/roar/bus.go
package roar

import (
    "fmt"
    "sync"
    "sync/atomic"
)

// BusConfig configures the message bus.
type BusConfig struct {
    Secret       string  // Shared signing secret (empty = skip verification)
    MaxAge       float64 // Max message age in seconds (0 = skip check)
    BufferSize   int     // Per-subscriber channel buffer (default 100)
}

// Subscription is a message stream for a specific agent or wildcard.
type Subscription struct {
    ID     string
    DID    string // Target DID ("" = wildcard/all)
    Filter func(*ROARMessage) bool // Optional filter
    Ch     chan ROARMessage
}

// Bus routes ROARMessages between agents.
type Bus struct {
    config        BusConfig
    mu            sync.RWMutex
    subscriptions map[string]*Subscription
    counter       atomic.Int64
    dedupMu       sync.RWMutex
    dedup         map[string]bool // message ID -> seen (ring buffer)
}

// NewBus creates a message bus.
func NewBus(cfg BusConfig) *Bus {
    if cfg.BufferSize <= 0 {
        cfg.BufferSize = 100
    }
    return &Bus{
        config:        cfg,
        subscriptions: make(map[string]*Subscription),
        dedup:         make(map[string]bool),
    }
}

func (b *Bus) nextID() string {
    n := b.counter.Add(1)
    return fmt.Sprintf("sub_%d", n)
}

// Subscribe creates a subscription for messages sent to a specific DID.
func (b *Bus) Subscribe(did string, filter func(*ROARMessage) bool) chan ROARMessage {
    sub := &Subscription{
        ID:     b.nextID(),
        DID:    did,
        Filter: filter,
        Ch:     make(chan ROARMessage, b.config.BufferSize),
    }
    b.mu.Lock()
    b.subscriptions[sub.ID] = sub
    b.mu.Unlock()
    return sub.Ch
}

// SubscribeWithID returns the subscription ID for later unsubscribe.
func (b *Bus) SubscribeWithID(did string, filter func(*ROARMessage) bool) string {
    sub := &Subscription{
        ID:     b.nextID(),
        DID:    did,
        Filter: filter,
        Ch:     make(chan ROARMessage, b.config.BufferSize),
    }
    b.mu.Lock()
    b.subscriptions[sub.ID] = sub
    b.mu.Unlock()
    return sub.ID
}

// SubscribeAll creates a wildcard subscription receiving all messages.
func (b *Bus) SubscribeAll(filter func(*ROARMessage) bool) chan ROARMessage {
    return b.Subscribe("", filter)
}

// Unsubscribe removes a subscription by ID.
func (b *Bus) Unsubscribe(subID string) {
    b.mu.Lock()
    if sub, ok := b.subscriptions[subID]; ok {
        close(sub.Ch)
        delete(b.subscriptions, subID)
    }
    b.mu.Unlock()
}

// Publish routes a message to matching subscribers.
// Returns delivery count and any verification error.
func (b *Bus) Publish(msg *ROARMessage) (int, error) {
    // Optional signature verification
    if b.config.Secret != "" && b.config.MaxAge > 0 {
        if !msg.Verify(b.config.Secret, b.config.MaxAge) {
            return 0, fmt.Errorf("message verification failed for %s", msg.ID)
        }
    }

    // Dedup check
    b.dedupMu.RLock()
    seen := b.dedup[msg.ID]
    b.dedupMu.RUnlock()
    if seen {
        return 0, nil // silently drop duplicate
    }
    b.dedupMu.Lock()
    b.dedup[msg.ID] = true
    // Prune dedup cache if it gets too large
    if len(b.dedup) > 10000 {
        b.dedup = make(map[string]bool)
    }
    b.dedupMu.Unlock()

    // Route to subscribers
    b.mu.RLock()
    defer b.mu.RUnlock()

    delivered := 0
    for _, sub := range b.subscriptions {
        // Match: wildcard (DID="") or direct match
        if sub.DID != "" && sub.DID != msg.To.DID {
            continue
        }
        if sub.Filter != nil && !sub.Filter(msg) {
            continue
        }
        // Non-blocking send (drop if full — backpressure)
        select {
        case sub.Ch <- *msg:
            delivered++
        default:
            // Channel full — drop message for this subscriber
        }
    }
    return delivered, nil
}

// SubscriberCount returns the number of active subscriptions.
func (b *Bus) SubscriberCount() int {
    b.mu.RLock()
    defer b.mu.RUnlock()
    return len(b.subscriptions)
}
```

- [ ] **Step 3: Run tests**

Run: `cd /home/anon/Harbinger/backend && go test ./pkg/roar/ -run TestBus -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/pkg/roar/bus.go backend/pkg/roar/roar_test.go
git commit -m "feat(roar): add message bus — pub/sub routing with dedup and backpressure"
```

---

## Task 6: Stream Event Bus (Layer 5)

**Files:**
- Create: `backend/pkg/roar/stream.go`
- Add tests to: `backend/pkg/roar/roar_test.go`

- [ ] **Step 1: Write failing test**

```go
func TestEventBus(t *testing.T) {
    eb := NewEventBus(100)

    // Subscribe with filter
    filter := StreamFilter{EventTypes: []StreamEventType{EventAgentStatus}}
    sub := eb.Subscribe(filter, 10, false)

    // Publish matching event
    eb.Emit(StreamEvent{
        Type:   EventAgentStatus,
        Source: "did:roar:agent:pathfinder-abc",
        Data:   map[string]any{"status": "active"},
    })

    // Publish non-matching event
    eb.Emit(StreamEvent{
        Type:   EventToolCall,
        Source: "did:roar:agent:breach-def",
        Data:   map[string]any{"tool": "nmap"},
    })

    // Should receive only agent_status
    select {
    case evt := <-sub.Ch:
        if evt.Type != EventAgentStatus {
            t.Fatalf("expected agent_status, got %s", evt.Type)
        }
    case <-time.After(time.Second):
        t.Fatal("timeout")
    }

    // Should not receive tool_call
    select {
    case evt := <-sub.Ch:
        t.Fatalf("unexpected event: %v", evt)
    default:
    }
}
```

- [ ] **Step 2: Implement stream.go**

```go
// backend/pkg/roar/stream.go
package roar

import (
    "sync"
    "sync/atomic"
    "time"
)

// StreamFilter selects which events a subscriber receives.
type StreamFilter struct {
    EventTypes []StreamEventType
    SourceDIDs []string
    SessionIDs []string
}

// Matches returns true if the event passes this filter.
func (f *StreamFilter) Matches(event StreamEvent) bool {
    if len(f.EventTypes) > 0 {
        found := false
        for _, t := range f.EventTypes {
            if t == event.Type {
                found = true
                break
            }
        }
        if !found {
            return false
        }
    }
    if len(f.SourceDIDs) > 0 {
        found := false
        for _, d := range f.SourceDIDs {
            if d == event.Source {
                found = true
                break
            }
        }
        if !found {
            return false
        }
    }
    if len(f.SessionIDs) > 0 {
        found := false
        for _, s := range f.SessionIDs {
            if s == event.SessionID {
                found = true
                break
            }
        }
        if !found {
            return false
        }
    }
    return true
}

// StreamSubscription is an async event stream.
type StreamSubscription struct {
    ID     string
    Filter StreamFilter
    Ch     chan StreamEvent
    Closed bool
}

// EventBus distributes StreamEvents to filtered subscribers.
type EventBus struct {
    mu            sync.RWMutex
    subscriptions map[string]*StreamSubscription
    replayBuffer  []StreamEvent
    maxReplay     int
    counter       atomic.Int64
}

// NewEventBus creates an event bus with a replay buffer of maxReplay events.
func NewEventBus(maxReplay int) *EventBus {
    return &EventBus{
        subscriptions: make(map[string]*StreamSubscription),
        replayBuffer:  make([]StreamEvent, 0, maxReplay),
        maxReplay:     maxReplay,
    }
}

// Subscribe creates a filtered event subscription.
func (eb *EventBus) Subscribe(filter StreamFilter, bufferSize int, replay bool) *StreamSubscription {
    if bufferSize <= 0 {
        bufferSize = 50
    }
    id := fmt.Sprintf("esub_%d", eb.counter.Add(1))
    sub := &StreamSubscription{
        ID:     id,
        Filter: filter,
        Ch:     make(chan StreamEvent, bufferSize),
    }

    eb.mu.Lock()
    eb.subscriptions[id] = sub

    // Replay buffered events if requested
    if replay {
        for _, evt := range eb.replayBuffer {
            if filter.Matches(evt) {
                select {
                case sub.Ch <- evt:
                default:
                }
            }
        }
    }
    eb.mu.Unlock()
    return sub
}

// Unsubscribe removes and closes a subscription.
func (eb *EventBus) Unsubscribe(subID string) {
    eb.mu.Lock()
    if sub, ok := eb.subscriptions[subID]; ok {
        sub.Closed = true
        close(sub.Ch)
        delete(eb.subscriptions, subID)
    }
    eb.mu.Unlock()
}

// Emit publishes an event to all matching subscribers.
func (eb *EventBus) Emit(event StreamEvent) int {
    if event.Timestamp == 0 {
        event.Timestamp = float64(time.Now().Unix())
    }

    eb.mu.Lock()
    // Add to replay buffer
    if len(eb.replayBuffer) >= eb.maxReplay {
        eb.replayBuffer = eb.replayBuffer[1:]
    }
    eb.replayBuffer = append(eb.replayBuffer, event)

    // Deliver to subscribers
    delivered := 0
    for _, sub := range eb.subscriptions {
        if sub.Closed {
            continue
        }
        if !sub.Filter.Matches(event) {
            continue
        }
        select {
        case sub.Ch <- event:
            delivered++
        default:
            // Drop — backpressure
        }
    }
    eb.mu.Unlock()
    return delivered
}
```

Note: needs `"fmt"` import for Sprintf — add it.

- [ ] **Step 3: Run tests**

Run: `cd /home/anon/Harbinger/backend && go test ./pkg/roar/ -run TestEventBus -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/pkg/roar/stream.go backend/pkg/roar/roar_test.go
git commit -m "feat(roar): add stream event bus — filtered pub/sub with replay"
```

---

## Task 7: Channel Adapter Interface + Manager

**Files:**
- Create: `backend/pkg/channels/adapter.go`
- Create: `backend/pkg/channels/manager.go`
- Create: `backend/pkg/channels/channels_test.go`

- [ ] **Step 1: Write test for manager with a mock adapter**

```go
// backend/pkg/channels/channels_test.go
package channels

import (
    "context"
    "testing"
    "time"

    "github.com/Haribinger/Harbinger/backend/pkg/roar"
)

// mockAdapter implements Adapter for testing
type mockAdapter struct {
    name     string
    started  bool
    messages []roar.ROARMessage
    incoming chan NativePayload
}

func newMockAdapter(name string) *mockAdapter {
    return &mockAdapter{name: name, incoming: make(chan NativePayload, 10)}
}
func (m *mockAdapter) Name() string                                   { return m.name }
func (m *mockAdapter) Connect(_ context.Context, _ AdapterConfig) error { m.started = true; return nil }
func (m *mockAdapter) Send(_ context.Context, msg roar.ROARMessage) error {
    m.messages = append(m.messages, msg)
    return nil
}
func (m *mockAdapter) Listen() <-chan NativePayload { return m.incoming }
func (m *mockAdapter) Disconnect(_ context.Context) error { m.started = false; return nil }
func (m *mockAdapter) HealthCheck(_ context.Context) error { return nil }

func TestManagerStartStop(t *testing.T) {
    mgr := NewManager()
    mock := newMockAdapter("discord")
    mgr.RegisterAdapter(mock)

    ctx := context.Background()
    if err := mgr.StartAll(ctx); err != nil {
        t.Fatalf("start: %v", err)
    }
    if !mock.started {
        t.Fatal("adapter not started")
    }

    mgr.StopAll(ctx)
    if mock.started {
        t.Fatal("adapter not stopped")
    }
}

func TestManagerRouteIncoming(t *testing.T) {
    mgr := NewManager()
    mock := newMockAdapter("telegram")
    mgr.RegisterAdapter(mock)

    // Listen for incoming messages
    ch := mgr.IncomingMessages()

    ctx := context.Background()
    mgr.StartAll(ctx)

    // Simulate incoming message
    mock.incoming <- NativePayload{
        ChannelName: "telegram",
        SenderID:    "user123",
        SessionID:   "telegram:user123",
        Content:     "scan example.com",
    }

    select {
    case msg := <-ch:
        if msg.Content != "scan example.com" {
            t.Fatalf("wrong content: %s", msg.Content)
        }
    case <-time.After(2 * time.Second):
        t.Fatal("timeout waiting for incoming message")
    }
    mgr.StopAll(ctx)
}
```

- [ ] **Step 2: Implement adapter.go**

```go
// backend/pkg/channels/adapter.go
package channels

import (
    "context"

    "github.com/Haribinger/Harbinger/backend/pkg/roar"
)

// AdapterConfig holds configuration for a channel adapter.
type AdapterConfig struct {
    BotToken      string            `json:"bot_token"`
    AppToken      string            `json:"app_token,omitempty"`      // Slack Socket Mode
    WebhookURL    string            `json:"webhook_url,omitempty"`
    WebhookSecret string            `json:"webhook_secret,omitempty"` // Telegram
    ChannelID     string            `json:"channel_id,omitempty"`
    GuildID       string            `json:"guild_id,omitempty"`       // Discord
    Extra         map[string]string `json:"extra,omitempty"`
}

// NativePayload is the platform-independent incoming message format.
type NativePayload struct {
    ChannelName string         `json:"channel_name"` // "discord", "telegram", "slack"
    SenderID    string         `json:"sender_id"`
    SessionID   string         `json:"session_id"`   // e.g., "discord:ch:12345"
    Content     string         `json:"content"`
    Attachments []Attachment   `json:"attachments,omitempty"`
    Meta        map[string]any `json:"meta,omitempty"`
}

// Attachment represents a media attachment.
type Attachment struct {
    Type string `json:"type"` // "image", "video", "audio", "file"
    URL  string `json:"url"`
    Name string `json:"name,omitempty"`
}

// Adapter is the interface that all channel adapters must implement.
type Adapter interface {
    // Name returns the channel name (e.g., "discord", "telegram", "slack").
    Name() string

    // Connect initializes the adapter with the given config.
    Connect(ctx context.Context, config AdapterConfig) error

    // Send delivers a ROAR message to the channel.
    Send(ctx context.Context, msg roar.ROARMessage) error

    // Listen returns a channel of incoming messages from the platform.
    Listen() <-chan NativePayload

    // Disconnect gracefully shuts down the adapter.
    Disconnect(ctx context.Context) error

    // HealthCheck verifies the adapter's connection is alive.
    HealthCheck(ctx context.Context) error
}
```

- [ ] **Step 3: Implement manager.go**

```go
// backend/pkg/channels/manager.go
package channels

import (
    "context"
    "log"
    "sync"
)

// Manager orchestrates channel adapter lifecycle and message routing.
type Manager struct {
    mu       sync.RWMutex
    adapters map[string]Adapter
    incoming chan NativePayload
    cancel   context.CancelFunc
}

// NewManager creates a channel manager.
func NewManager() *Manager {
    return &Manager{
        adapters: make(map[string]Adapter),
        incoming: make(chan NativePayload, 100),
    }
}

// RegisterAdapter adds an adapter to the manager.
func (m *Manager) RegisterAdapter(a Adapter) {
    m.mu.Lock()
    m.adapters[a.Name()] = a
    m.mu.Unlock()
}

// IncomingMessages returns a channel that receives all incoming messages from all adapters.
func (m *Manager) IncomingMessages() <-chan NativePayload {
    return m.incoming
}

// StartAll connects and starts listening on all registered adapters.
func (m *Manager) StartAll(ctx context.Context) error {
    ctx, cancel := context.WithCancel(ctx)
    m.cancel = cancel

    m.mu.RLock()
    defer m.mu.RUnlock()

    for _, adapter := range m.adapters {
        if err := adapter.Connect(ctx, AdapterConfig{}); err != nil {
            log.Printf("channel %s connect: %v", adapter.Name(), err)
            continue
        }
        // Start listener goroutine
        go m.listenAdapter(ctx, adapter)
    }
    return nil
}

func (m *Manager) listenAdapter(ctx context.Context, adapter Adapter) {
    ch := adapter.Listen()
    for {
        select {
        case <-ctx.Done():
            return
        case msg, ok := <-ch:
            if !ok {
                return
            }
            select {
            case m.incoming <- msg:
            default:
                log.Printf("channel %s: incoming queue full, dropping message", adapter.Name())
            }
        }
    }
}

// StopAll disconnects all adapters.
func (m *Manager) StopAll(ctx context.Context) {
    if m.cancel != nil {
        m.cancel()
    }
    m.mu.RLock()
    defer m.mu.RUnlock()
    for _, adapter := range m.adapters {
        if err := adapter.Disconnect(ctx); err != nil {
            log.Printf("channel %s disconnect: %v", adapter.Name(), err)
        }
    }
}

// GetAdapter returns a specific adapter by name.
func (m *Manager) GetAdapter(name string) Adapter {
    m.mu.RLock()
    defer m.mu.RUnlock()
    return m.adapters[name]
}

// ListAdapters returns names of all registered adapters.
func (m *Manager) ListAdapters() []string {
    m.mu.RLock()
    defer m.mu.RUnlock()
    names := make([]string, 0, len(m.adapters))
    for name := range m.adapters {
        names = append(names, name)
    }
    return names
}
```

- [ ] **Step 4: Run tests**

Run: `cd /home/anon/Harbinger/backend && go test ./pkg/channels/ -v -count=1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/pkg/channels/
git commit -m "feat(channels): add adapter interface and channel manager"
```

---

## Task 8: Discord Adapter (Stub)

**Files:**
- Create: `backend/pkg/channels/discord.go`

This is a **structural stub** — it implements the Adapter interface with real session ID derivation and message formatting, but uses webhooks for sending (not the full Discord Gateway). The full Gateway WebSocket implementation is a future enhancement.

- [ ] **Step 1: Implement discord.go**

The Discord adapter should:
- Implement all Adapter interface methods
- `Connect`: validate config has BotToken, create HTTP client, verify token via Discord API `GET /users/@me`
- `Send`: format ROARMessage payload as text, POST to webhook URL (existing `sendDiscordWebhook` pattern)
- `Listen`: return a channel; incoming messages come via webhook handler (registered in cmd/ layer)
- Session ID format: `discord:ch:{channel_id}` or `discord:dm:{user_id}`
- Parse incoming webhook payloads into NativePayload

- [ ] **Step 2: Build to verify**

Run: `cd /home/anon/Harbinger/backend && go build ./pkg/channels/`

- [ ] **Step 3: Commit**

```bash
git add backend/pkg/channels/discord.go
git commit -m "feat(channels): add Discord adapter with webhook send and session derivation"
```

---

## Task 9: Telegram Adapter (Stub)

**Files:**
- Create: `backend/pkg/channels/telegram.go`

Same pattern as Discord but for Telegram Bot API:
- `Connect`: validate BotToken, verify via `GET /getMe`
- `Send`: POST to `https://api.telegram.org/bot{token}/sendMessage` with `{chat_id, text, parse_mode: "HTML"}`
- Message chunking at 4000 chars (Telegram limit is 4096)
- Session ID format: `telegram:{chat_id}`
- Parse incoming webhook updates into NativePayload

- [ ] **Step 1: Implement telegram.go**
- [ ] **Step 2: Build to verify**
- [ ] **Step 3: Commit**

```bash
git add backend/pkg/channels/telegram.go
git commit -m "feat(channels): add Telegram adapter with Bot API send and session derivation"
```

---

## Task 10: Slack Adapter (Stub)

**Files:**
- Create: `backend/pkg/channels/slack.go`

Slack adapter using webhook-based sending:
- `Connect`: validate BotToken, verify via `auth.test` API
- `Send`: POST to `chat.postMessage` with `{channel, text, thread_ts}`
- Session ID format: `slack:thread:{channel_id}:{thread_ts}` or `slack:ch:{channel_id}`
- Parse incoming event payloads into NativePayload

- [ ] **Step 1: Implement slack.go**
- [ ] **Step 2: Build to verify**
- [ ] **Step 3: Commit**

```bash
git add backend/pkg/channels/slack.go
git commit -m "feat(channels): add Slack adapter with chat.postMessage and thread support"
```

---

## Task 11: ROAR HTTP Handlers

**Files:**
- Create: `backend/cmd/roar_handlers.go`
- Modify: `backend/cmd/main.go`

- [ ] **Step 1: Create roar_handlers.go**

Handlers:
- `var roarBus *roar.Bus` and `var agentDirectory *roar.Directory` and `var eventBus *roar.EventBus` (globals)
- `initROAR(c Config)` — create Bus, Directory, EventBus; register Harbinger's 11 agents with DIDs
- `handleROARPublish(w, r)` — POST `/api/roar/message` — decode ROARMessage, publish to bus
- `handleROARAgents(w, r)` — GET `/api/roar/agents` — list all registered agents from directory
- `handleROARSubscribe(w, r)` — GET `/api/roar/events` — SSE endpoint streaming events from EventBus
- `handleROARLookup(w, r)` — GET `/api/roar/agents/{did}` — lookup single agent

Register 11 Harbinger agents on init:
```go
harbingerAgents := []struct{ name, codename string }{
    {"PATHFINDER", "recon-scout"},
    {"BREACH", "web-hacker"},
    {"PHANTOM", "cloud-infiltrator"},
    {"SPECTER", "osint-detective"},
    {"CIPHER", "binary-reverser"},
    {"SCRIBE", "report-writer"},
    {"SAM", "coding-assistant"},
    {"BRIEF", "morning-brief"},
    {"SAGE", "learning-agent"},
    {"LENS", "browser-agent"},
    {"MAINTAINER", "maintainer"},
}
```

- [ ] **Step 2: Register dual routes in main.go**

```go
// ROAR Protocol
mux.HandleFunc("POST /api/roar/message", authMiddleware(handleROARPublish))
mux.HandleFunc("POST /api/v1/roar/message", authMiddleware(handleROARPublish))
mux.HandleFunc("GET /api/roar/agents", authMiddleware(handleROARAgents))
mux.HandleFunc("GET /api/v1/roar/agents", authMiddleware(handleROARAgents))
mux.HandleFunc("GET /api/roar/agents/{did}", authMiddleware(handleROARLookup))
mux.HandleFunc("GET /api/v1/roar/agents/{did}", authMiddleware(handleROARLookup))
mux.HandleFunc("GET /api/roar/events", authMiddleware(handleROARSubscribe))
mux.HandleFunc("GET /api/v1/roar/events", authMiddleware(handleROARSubscribe))
```

- [ ] **Step 3: Build and verify**

Run: `cd /home/anon/Harbinger/backend && go build -o /tmp/harbinger-backend ./cmd/`

- [ ] **Step 4: Commit**

```bash
git add backend/cmd/roar_handlers.go backend/cmd/main.go
git commit -m "feat(api): add ROAR protocol handlers — publish, agents, events SSE"
```

---

## Task 12: Backward-Compatible comms.go Bridge

**Files:**
- Modify: `backend/cmd/comms.go`

- [ ] **Step 1: Add ROAR bridge to handleAgentBroadcast**

In `handleAgentBroadcast`, after appending to the in-memory agentBus, also publish as a ROARMessage:

```go
// After existing agentBus append:
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
    }
    roarMsg := roar.NewMessage(from, to, intent, map[string]any{
        "content":    msg.Content,
        "data":       msg.Data,
        "channel":    msg.Channel,
        "legacy_type": msg.Type,
    })
    roarBus.Publish(roarMsg)
}
```

This ensures backward compatibility — existing API clients still work, but messages also flow through ROAR.

- [ ] **Step 2: Build to verify**

Run: `cd /home/anon/Harbinger/backend && go build -o /tmp/harbinger-backend ./cmd/`

- [ ] **Step 3: Commit**

```bash
git add backend/cmd/comms.go
git commit -m "feat(comms): bridge existing agent broadcast to ROAR bus"
```

---

## Task 13: Integration Tests

**Files:**
- Create: `backend/cmd/phase2_integration_test.go`

- [ ] **Step 1: Write integration tests**

Tests:
- `TestROARPublishEndpoint` — POST a signed ROARMessage, verify ok response
- `TestROARAgentsEndpoint` — GET agents, verify 11 Harbinger agents returned with DIDs
- `TestROARLookupEndpoint` — GET specific agent by DID
- `TestROARPackageIntegration` — Create bus, subscribe, publish, verify delivery
- `TestChannelManagerIntegration` — Register mock adapter, start, inject message, verify routing

- [ ] **Step 2: Run tests**

Run: `cd /home/anon/Harbinger/backend && go test ./cmd/ -run "TestROAR|TestChannel" -v -count=1`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `cd /home/anon/Harbinger/backend && go test ./cmd/ -v -count=1 && go test ./pkg/... -v -count=1`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add backend/cmd/phase2_integration_test.go
git commit -m "test: add Phase 2 integration tests for ROAR protocol and channels"
```

---

## Summary

After completing all 13 tasks:

- **ROAR package** (`pkg/roar/`): 6 files — types, identity (DID), discovery (directory), message (signing/verification), bus (pub/sub router), stream (event bus)
- **Channels package** (`pkg/channels/`): 6 files — adapter interface, manager, Discord/Telegram/Slack adapters
- **HTTP handlers**: 2 new files — `roar_handlers.go`, `channel_handlers.go`
- **Backward compat**: `comms.go` bridges existing API to ROAR bus
- **Routes**: ~16 new endpoints (8 x dual prefix)
- **Tests**: ROAR unit tests + channel manager tests + integration tests

Phase 2 is complete when all 11 agents have DIDs, messages flow through ROAR, and channel adapters are bidirectional.
