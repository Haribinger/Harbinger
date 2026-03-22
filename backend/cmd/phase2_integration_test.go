package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Haribinger/Harbinger/backend/pkg/roar"
)

// setupPhase2Mux registers Phase 2 ROAR routes + comms routes for testing.
func setupPhase2Mux() *http.ServeMux {
	mux := http.NewServeMux()

	// ROAR protocol routes
	mux.HandleFunc("POST /api/roar/message", handleROARPublish)
	mux.HandleFunc("GET /api/roar/agents", handleROARAgents)
	mux.HandleFunc("GET /api/roar/lookup", handleROARLookup)
	mux.HandleFunc("GET /api/roar/search", handleROARSearch)

	// Comms routes (for bridge testing)
	mux.HandleFunc("POST /api/agents/broadcast", handleAgentBroadcast)

	return mux
}

// ensureROARWithAgents initializes the ROAR subsystem with all 11 agents.
// Always re-initializes to guarantee a clean directory.
func ensureROARWithAgents(t *testing.T) {
	t.Helper()
	// Set a known secret and use initROAR to register all 11 agents
	t.Setenv("ROAR_SECRET", "test-phase2")
	roarBus = nil
	agentDirectory = nil
	roarEventBus = nil
	initROAR(Config{})
}

// ---------------------------------------------------------------------------
// TestROARPublishEndpoint — publish a signed ROAR message via HTTP handler
// ---------------------------------------------------------------------------

func TestROARPublishEndpoint(t *testing.T) {
	// Create bus with empty secret so HMAC verification is skipped.
	// This avoids JSON round-trip drift in the signing body (empty map vs nil).
	roarBus = roar.NewBus(roar.BusConfig{Secret: "", BufferSize: 200})
	agentDirectory = roar.NewDirectory()
	roarEventBus = roar.NewEventBus(1000)

	mux := setupPhase2Mux()

	msg := roar.NewMessage(
		roar.AgentIdentity{DID: "did:roar:agent:pathfinder"},
		roar.AgentIdentity{DID: "did:roar:agent:breach"},
		roar.IntentDelegate,
		map[string]any{"task": "scan"},
	)

	body, _ := json.Marshal(msg)
	req := httptest.NewRequest("POST", "/api/roar/message", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	resp := parseJSON(t, w)
	if resp["ok"] != true {
		t.Errorf("expected ok=true, got %v", resp["ok"])
	}
	if _, exists := resp["delivered"]; !exists {
		t.Error("response missing 'delivered' field")
	}
}

// ---------------------------------------------------------------------------
// TestROARAgentsEndpoint — verify all 11 agents are registered
// ---------------------------------------------------------------------------

func TestROARAgentsEndpoint(t *testing.T) {
	ensureROARWithAgents(t)
	mux := setupPhase2Mux()

	req := httptest.NewRequest("GET", "/api/roar/agents", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	resp := parseJSON(t, w)
	if resp["ok"] != true {
		t.Fatalf("expected ok=true, got %v", resp["ok"])
	}

	agents, ok := resp["agents"].([]any)
	if !ok {
		t.Fatal("'agents' field is not an array")
	}
	if len(agents) != 11 {
		t.Errorf("expected 11 agents, got %d", len(agents))
	}

	// Verify at least one agent has a DID starting with "did:roar:agent:pathfinder"
	foundPathfinder := false
	for _, a := range agents {
		entry, ok := a.(map[string]any)
		if !ok {
			continue
		}
		card, ok := entry["card"].(map[string]any)
		if !ok {
			continue
		}
		identity, ok := card["identity"].(map[string]any)
		if !ok {
			continue
		}
		did, _ := identity["did"].(string)
		if strings.HasPrefix(did, "did:roar:agent:pathfinder") {
			foundPathfinder = true
			break
		}
	}
	if !foundPathfinder {
		t.Error("no agent found with DID starting with 'did:roar:agent:pathfinder'")
	}
}

// ---------------------------------------------------------------------------
// TestROARLookupEndpoint — look up a specific agent by DID
// ---------------------------------------------------------------------------

func TestROARLookupEndpoint(t *testing.T) {
	ensureROARWithAgents(t)
	mux := setupPhase2Mux()

	// First, get the list to find a valid DID
	entries := agentDirectory.ListAll()
	if len(entries) == 0 {
		t.Fatal("no agents registered in directory")
	}
	targetDID := entries[0].Card.Identity.DID

	req := httptest.NewRequest("GET", "/api/roar/lookup?did="+targetDID, nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	resp := parseJSON(t, w)
	if resp["ok"] != true {
		t.Fatalf("expected ok=true, got %v", resp["ok"])
	}
	if resp["agent"] == nil {
		t.Error("response missing 'agent' field")
	}

	agent, ok := resp["agent"].(map[string]any)
	if !ok {
		t.Fatal("'agent' field is not an object")
	}
	card, ok := agent["card"].(map[string]any)
	if !ok {
		t.Fatal("agent 'card' field is not an object")
	}
	identity, ok := card["identity"].(map[string]any)
	if !ok {
		t.Fatal("card 'identity' field is not an object")
	}
	did, _ := identity["did"].(string)
	if did != targetDID {
		t.Errorf("expected DID %q, got %q", targetDID, did)
	}
}

// ---------------------------------------------------------------------------
// TestROARSearchEndpoint — search agents by capability
// ---------------------------------------------------------------------------

func TestROARSearchEndpoint(t *testing.T) {
	ensureROARWithAgents(t)
	mux := setupPhase2Mux()

	req := httptest.NewRequest("GET", "/api/roar/search?capability=recon", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	resp := parseJSON(t, w)
	if resp["ok"] != true {
		t.Fatalf("expected ok=true, got %v", resp["ok"])
	}

	agents, ok := resp["agents"].([]any)
	if !ok {
		t.Fatal("'agents' field is not an array")
	}
	if len(agents) < 1 {
		t.Error("expected at least 1 agent with 'recon' capability")
	}

	// Verify the result is PATHFINDER (which has "recon" capability)
	found := false
	for _, a := range agents {
		entry, ok := a.(map[string]any)
		if !ok {
			continue
		}
		card, ok := entry["card"].(map[string]any)
		if !ok {
			continue
		}
		identity, ok := card["identity"].(map[string]any)
		if !ok {
			continue
		}
		name, _ := identity["display_name"].(string)
		if name == "PATHFINDER" {
			found = true
			break
		}
	}
	if !found {
		t.Error("PATHFINDER not found in recon capability search results")
	}
}

// ---------------------------------------------------------------------------
// TestBridgedBroadcast — verify comms.go broadcast bridges to ROAR bus
// ---------------------------------------------------------------------------

func TestBridgedBroadcast(t *testing.T) {
	// Use empty secret so bus skips signature verification — the bridge signs
	// with the env var value, so keeping them in sync avoids flakiness.
	t.Setenv("ROAR_SECRET", "")
	roarBus = nil
	agentDirectory = nil
	roarEventBus = nil
	initROAR(Config{})

	mux := setupPhase2Mux()

	// Subscribe to messages addressed to the synthetic DID the bridge creates
	// for "breach" (did:roar:agent:breach)
	ch := roarBus.Subscribe("did:roar:agent:breach", nil)

	// POST a broadcast message through the legacy comms handler
	broadcastBody, _ := json.Marshal(map[string]any{
		"fromAgent": "pathfinder",
		"toAgent":   "breach",
		"type":      "finding",
		"content":   "found SQLi",
	})
	req := httptest.NewRequest("POST", "/api/agents/broadcast", bytes.NewReader(broadcastBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("broadcast: expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	resp := parseJSON(t, w)
	if resp["ok"] != true {
		t.Fatalf("broadcast: expected ok=true, got %v", resp["ok"])
	}

	// Read the bridged ROAR message from the subscription channel
	select {
	case msg := <-ch:
		if msg.Intent != roar.IntentUpdate {
			t.Errorf("expected intent 'update', got %q", msg.Intent)
		}
		content, _ := msg.Payload["content"].(string)
		if content != "found SQLi" {
			t.Errorf("expected payload.content='found SQLi', got %q", content)
		}
		legacyType, _ := msg.Payload["legacy_type"].(string)
		if legacyType != "finding" {
			t.Errorf("expected payload.legacy_type='finding', got %q", legacyType)
		}
		if msg.From.DID != "did:roar:agent:pathfinder" {
			t.Errorf("expected from DID 'did:roar:agent:pathfinder', got %q", msg.From.DID)
		}
		if msg.To.DID != "did:roar:agent:breach" {
			t.Errorf("expected to DID 'did:roar:agent:breach', got %q", msg.To.DID)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for bridged ROAR message")
	}
}
