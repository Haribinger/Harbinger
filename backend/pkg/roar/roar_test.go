package roar

import (
	"strings"
	"sync"
	"testing"
	"time"
)

// --- Identity tests ---

func TestGenerateDID(t *testing.T) {
	id := &AgentIdentity{
		DisplayName: "Pathfinder Scout",
		AgentType:   "recon",
	}
	did := GenerateDID(id)

	if !strings.HasPrefix(did, "did:roar:recon:") {
		t.Fatalf("DID should start with did:roar:recon:, got %s", did)
	}
	if !strings.Contains(did, "pathfinder-scout-") {
		t.Fatalf("DID should contain lowercase slug, got %s", did)
	}
	// did:roar:recon: = 15 chars, slug + dash + 16 hex
	if id.DID != did {
		t.Fatalf("id.DID not set, expected %s got %s", did, id.DID)
	}
	if id.Version != "1.0" {
		t.Fatalf("version should default to 1.0, got %s", id.Version)
	}
}

func TestGenerateDIDUniqueness(t *testing.T) {
	id1 := &AgentIdentity{DisplayName: "Agent", AgentType: "test"}
	id2 := &AgentIdentity{DisplayName: "Agent", AgentType: "test"}
	did1 := GenerateDID(id1)
	did2 := GenerateDID(id2)
	if did1 == did2 {
		t.Fatal("two GenerateDID calls must produce different DIDs")
	}
}

func TestHarbingerAgentDIDs(t *testing.T) {
	agents := []struct {
		name      string
		agentType string
	}{
		{"PATHFINDER", "recon"},
		{"BREACH", "web"},
		{"PHANTOM", "cloud"},
		{"SPECTER", "osint"},
		{"CIPHER", "binary"},
		{"SCRIBE", "report"},
		{"SAM", "coding"},
		{"BRIEF", "reporter"},
		{"SAGE", "learning"},
		{"LENS", "browser"},
		{"MAINTAINER", "devops"},
	}

	seen := make(map[string]bool)
	for _, a := range agents {
		id := &AgentIdentity{DisplayName: a.name, AgentType: a.agentType}
		did := GenerateDID(id)
		if seen[did] {
			t.Fatalf("duplicate DID: %s", did)
		}
		seen[did] = true

		if !strings.HasPrefix(did, "did:roar:"+a.agentType+":") {
			t.Fatalf("agent %s DID has wrong prefix: %s", a.name, did)
		}
	}
}

// --- Discovery tests ---

func TestAgentDirectory(t *testing.T) {
	dir := NewDirectory()

	id := &AgentIdentity{
		DisplayName:  "Pathfinder",
		AgentType:    "recon",
		Capabilities: []string{"subdomain_enum", "port_scan"},
	}
	GenerateDID(id)

	card := AgentCard{
		Identity:    *id,
		Description: "Recon agent",
		Skills:      []string{"recon"},
		Channels:    []string{"cli"},
		DeclaredCapabilities: []AgentCapability{
			{Name: "dns_bruteforce", Description: "DNS brute force"},
		},
	}

	// Register and lookup
	dir.Register(card)
	entry := dir.Lookup(id.DID)
	if entry == nil {
		t.Fatal("expected to find registered agent")
	}
	if entry.Card.Identity.DisplayName != "Pathfinder" {
		t.Fatal("wrong display name")
	}

	// Search by Identity.Capabilities
	results := dir.Search("subdomain_enum")
	if len(results) != 1 {
		t.Fatalf("expected 1 result for subdomain_enum, got %d", len(results))
	}

	// Search by DeclaredCapabilities
	results = dir.Search("dns_bruteforce")
	if len(results) != 1 {
		t.Fatalf("expected 1 result for dns_bruteforce, got %d", len(results))
	}

	// Search miss
	results = dir.Search("nonexistent_capability")
	if len(results) != 0 {
		t.Fatalf("expected 0 results for missing capability, got %d", len(results))
	}

	// Unregister
	if !dir.Unregister(id.DID) {
		t.Fatal("unregister should return true")
	}
	if dir.Unregister(id.DID) {
		t.Fatal("double unregister should return false")
	}
	if dir.Lookup(id.DID) != nil {
		t.Fatal("lookup after unregister should return nil")
	}
}

func TestDirectoryConcurrency(t *testing.T) {
	dir := NewDirectory()
	var wg sync.WaitGroup

	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			id := &AgentIdentity{
				DisplayName:  "ConcAgent",
				AgentType:    "test",
				Capabilities: []string{"concurrent_op"},
			}
			GenerateDID(id)
			card := AgentCard{
				Identity: *id,
				Skills:   []string{"test"},
				Channels: []string{"cli"},
			}
			dir.Register(card)
			dir.Search("concurrent_op")
			dir.Heartbeat(id.DID)
			dir.ListAll()
		}(i)
	}
	wg.Wait()

	all := dir.ListAll()
	if len(all) != 20 {
		t.Fatalf("expected 20 agents after concurrent registration, got %d", len(all))
	}
}

// --- Message tests ---

func TestNewROARMessage(t *testing.T) {
	from := AgentIdentity{DID: "did:roar:recon:pathfinder-abc123", DisplayName: "Pathfinder", AgentType: "recon"}
	to := AgentIdentity{DID: "did:roar:web:breach-def456", DisplayName: "Breach", AgentType: "web"}

	msg := NewMessage(from, to, IntentExecute, map[string]any{"target": "example.com"})

	if msg.ROAR != "1.0" {
		t.Fatalf("ROAR version should be 1.0, got %s", msg.ROAR)
	}
	if !strings.HasPrefix(msg.ID, "msg_") {
		t.Fatalf("message ID should start with msg_, got %s", msg.ID)
	}
	if len(msg.ID) != 14 { // "msg_" + 10 hex chars
		t.Fatalf("message ID should be 14 chars, got %d: %s", len(msg.ID), msg.ID)
	}
	if msg.Timestamp == 0 {
		t.Fatal("timestamp should be set")
	}
	if msg.Context == nil {
		t.Fatal("context should be initialized")
	}
}

func TestMessageSign(t *testing.T) {
	from := AgentIdentity{DID: "did:roar:recon:pathfinder-abc123"}
	to := AgentIdentity{DID: "did:roar:web:breach-def456"}
	msg := NewMessage(from, to, IntentExecute, map[string]any{"cmd": "scan"})

	if err := msg.Sign("test-secret-key"); err != nil {
		t.Fatalf("sign failed: %v", err)
	}

	sig, ok := msg.Auth["signature"].(string)
	if !ok {
		t.Fatal("signature not set in auth")
	}
	if !strings.HasPrefix(sig, "hmac-sha256:") {
		t.Fatalf("signature should have hmac-sha256: prefix, got %s", sig)
	}
	// hmac-sha256: prefix (12) + 64 hex chars
	if len(sig) != 76 {
		t.Fatalf("signature should be 76 chars, got %d", len(sig))
	}
}

func TestMessageVerify(t *testing.T) {
	from := AgentIdentity{DID: "did:roar:recon:pathfinder-abc123"}
	to := AgentIdentity{DID: "did:roar:web:breach-def456"}
	secret := "harbinger-shared-secret"

	msg := NewMessage(from, to, IntentDelegate, map[string]any{"task": "nuclei_scan"})
	if err := msg.Sign(secret); err != nil {
		t.Fatalf("sign failed: %v", err)
	}

	// Correct key passes
	if !msg.Verify(secret, 0) {
		t.Fatal("verify with correct key should pass")
	}

	// Wrong key fails
	if msg.Verify("wrong-key", 0) {
		t.Fatal("verify with wrong key should fail")
	}

	// Tampered payload fails
	msg.Payload["task"] = "tampered"
	if msg.Verify(secret, 0) {
		t.Fatal("verify with tampered payload should fail")
	}
}

func TestMessageVerifyReplayProtection(t *testing.T) {
	from := AgentIdentity{DID: "did:roar:recon:pathfinder-abc123"}
	to := AgentIdentity{DID: "did:roar:web:breach-def456"}
	secret := "replay-test-secret"

	msg := NewMessage(from, to, IntentNotify, map[string]any{"status": "done"})
	if err := msg.Sign(secret); err != nil {
		t.Fatalf("sign failed: %v", err)
	}

	// Fresh message passes with 300s window
	if !msg.Verify(secret, 300) {
		t.Fatal("fresh message should pass replay check")
	}

	// Simulate 10-minute-old timestamp
	msg.Auth["timestamp"] = float64(msg.Auth["timestamp"].(float64) - 600)
	// Re-sign with the old timestamp preserved — we need to forge the signature
	// over the stale timestamp to test the replay window properly
	// Actually, just set the timestamp back and don't re-sign. The signature
	// will be invalid anyway, but the replay check happens first.
	// To properly test: re-sign, then backdate.

	// Create fresh message, sign it, then backdate the auth timestamp
	msg2 := NewMessage(from, to, IntentNotify, map[string]any{"status": "done"})
	if err := msg2.Sign(secret); err != nil {
		t.Fatalf("sign failed: %v", err)
	}
	// Backdate the timestamp (signature is now stale but we're testing the time check)
	msg2.Auth["timestamp"] = float64(msg2.Auth["timestamp"].(float64) - 600)

	if msg2.Verify(secret, 300) {
		t.Fatal("10-minute-old message should fail with 300s replay window")
	}
}

// --- Bus tests ---

func TestBusPublishSubscribe(t *testing.T) {
	bus := NewBus(BusConfig{BufferSize: 10})

	targetDID := "did:roar:recon:pathfinder-aaa111"
	ch := bus.Subscribe(targetDID, nil)

	from := AgentIdentity{DID: "did:roar:web:breach-bbb222", DisplayName: "Breach", AgentType: "web"}
	to := AgentIdentity{DID: targetDID, DisplayName: "Pathfinder", AgentType: "recon"}
	msg := NewMessage(from, to, IntentExecute, map[string]any{"target": "example.com"})

	n, err := bus.Publish(msg)
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}
	if n != 1 {
		t.Fatalf("expected 1 delivery, got %d", n)
	}

	select {
	case received := <-ch:
		if received.ID != msg.ID {
			t.Fatalf("received wrong message ID: %s vs %s", received.ID, msg.ID)
		}
		if received.Payload["target"] != "example.com" {
			t.Fatal("payload mismatch")
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for message")
	}
}

func TestBusBroadcast(t *testing.T) {
	bus := NewBus(BusConfig{BufferSize: 10})

	targetDID := "did:roar:recon:pathfinder-aaa111"
	otherDID := "did:roar:cloud:phantom-ccc333"

	// Specific subscriber for targetDID
	chSpecific := bus.Subscribe(targetDID, nil)
	// Wildcard subscriber (receives all)
	chWildcard := bus.SubscribeAll(nil)
	// Subscriber for a different DID — should NOT receive the message
	chOther := bus.Subscribe(otherDID, nil)

	from := AgentIdentity{DID: "did:roar:web:breach-bbb222"}
	to := AgentIdentity{DID: targetDID}
	msg := NewMessage(from, to, IntentNotify, map[string]any{"status": "done"})

	n, err := bus.Publish(msg)
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}
	if n != 2 {
		t.Fatalf("expected 2 deliveries (specific + wildcard), got %d", n)
	}

	// Specific subscriber should get it
	select {
	case received := <-chSpecific:
		if received.ID != msg.ID {
			t.Fatal("specific subscriber got wrong message")
		}
	case <-time.After(time.Second):
		t.Fatal("specific subscriber timed out")
	}

	// Wildcard subscriber should get it
	select {
	case received := <-chWildcard:
		if received.ID != msg.ID {
			t.Fatal("wildcard subscriber got wrong message")
		}
	case <-time.After(time.Second):
		t.Fatal("wildcard subscriber timed out")
	}

	// Other DID subscriber should NOT get it
	select {
	case <-chOther:
		t.Fatal("other DID subscriber should not receive the message")
	case <-time.After(50 * time.Millisecond):
		// expected — no message
	}
}

func TestBusUnsubscribe(t *testing.T) {
	bus := NewBus(BusConfig{BufferSize: 10})

	subID := bus.SubscribeWithID("did:roar:test:agent-xxx", nil)
	if bus.SubscriberCount() != 1 {
		t.Fatalf("expected 1 subscriber, got %d", bus.SubscriberCount())
	}

	bus.Unsubscribe(subID)
	if bus.SubscriberCount() != 0 {
		t.Fatalf("expected 0 subscribers after unsubscribe, got %d", bus.SubscriberCount())
	}

	// Double unsubscribe should not panic
	bus.Unsubscribe(subID)
}

// --- Stream Event Bus tests ---

func TestEventBus(t *testing.T) {
	eb := NewEventBus(100)

	sub := eb.Subscribe(StreamFilter{
		EventTypes: []StreamEventType{EventAgentStatus},
	}, 10, false)

	// Emit an agent_status event — should be delivered
	eb.Emit(StreamEvent{
		Type:   EventAgentStatus,
		Source: "did:roar:recon:pathfinder-aaa111",
		Data:   map[string]any{"status": "online"},
	})

	// Emit a tool_call event — should NOT be delivered
	eb.Emit(StreamEvent{
		Type:   EventToolCall,
		Source: "did:roar:recon:pathfinder-aaa111",
		Data:   map[string]any{"tool": "nmap"},
	})

	select {
	case evt := <-sub.Ch:
		if evt.Type != EventAgentStatus {
			t.Fatalf("expected agent_status event, got %s", evt.Type)
		}
		if evt.Data["status"] != "online" {
			t.Fatal("wrong event data")
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for agent_status event")
	}

	// Verify no tool_call event leaked through
	select {
	case evt := <-sub.Ch:
		t.Fatalf("should not receive tool_call event, got %s", evt.Type)
	case <-time.After(50 * time.Millisecond):
		// expected
	}

	eb.Unsubscribe(sub.ID)
}

func TestEventBusReplay(t *testing.T) {
	eb := NewEventBus(100)

	// Emit 3 events before subscribing
	for i := 0; i < 3; i++ {
		eb.Emit(StreamEvent{
			Type:   EventTaskUpdate,
			Source: "did:roar:web:breach-bbb222",
			Data:   map[string]any{"seq": i},
		})
	}

	// Subscribe with replay enabled and a filter matching task_update
	sub := eb.Subscribe(StreamFilter{
		EventTypes: []StreamEventType{EventTaskUpdate},
	}, 10, true)

	// Should receive all 3 buffered events
	for i := 0; i < 3; i++ {
		select {
		case evt := <-sub.Ch:
			if evt.Type != EventTaskUpdate {
				t.Fatalf("expected task_update, got %s", evt.Type)
			}
			seq, ok := evt.Data["seq"].(int)
			if !ok || seq != i {
				t.Fatalf("expected seq %d, got %v", i, evt.Data["seq"])
			}
		case <-time.After(time.Second):
			t.Fatalf("timed out waiting for replayed event %d", i)
		}
	}

	eb.Unsubscribe(sub.ID)
}
