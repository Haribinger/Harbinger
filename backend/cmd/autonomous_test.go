package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func setupAutonomousTestMux() *http.ServeMux {
	mux := http.NewServeMux()
	// Register autonomous routes without auth middleware for testing
	mux.HandleFunc("POST /api/agents/thoughts", handleCreateThought)
	mux.HandleFunc("GET /api/agents/thoughts", handleListThoughts)
	mux.HandleFunc("GET /api/agents/swarm", handleSwarmState)
	mux.HandleFunc("GET /api/agents/autonomous/stats", handleAutonomousStats)
	return mux
}

func TestListThoughts(t *testing.T) {
	mux := setupAutonomousTestMux()

	req := httptest.NewRequest("GET", "/api/agents/thoughts", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("GET /api/agents/thoughts: expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}

	if _, ok := body["thoughts"]; !ok {
		t.Error("response missing 'thoughts' field")
	}
}

func TestCreateThought(t *testing.T) {
	mux := setupAutonomousTestMux()

	thought := map[string]interface{}{
		"agent_id":   "test-agent-001",
		"agent_name": "PATHFINDER",
		"type":       "observation",
		"category":   "performance",
		"title":      "Test thought",
		"content":    "This is a test observation from integration tests",
		"priority":   3,
	}

	body, _ := json.Marshal(thought)
	req := httptest.NewRequest("POST", "/api/agents/thoughts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Errorf("POST /api/agents/thoughts: expected 200 or 201, got %d — body: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}

	if resp["ok"] != true {
		t.Errorf("expected ok=true, got %v", resp["ok"])
	}
}

func TestSwarmState(t *testing.T) {
	mux := setupAutonomousTestMux()

	req := httptest.NewRequest("GET", "/api/agents/swarm", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("GET /api/agents/swarm: expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}

	if _, ok := body["swarm"]; !ok {
		t.Error("response missing 'swarm' field")
	}
}

func TestAutonomousStats(t *testing.T) {
	mux := setupAutonomousTestMux()

	req := httptest.NewRequest("GET", "/api/agents/autonomous/stats", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("GET /api/agents/autonomous/stats: expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}

	if _, ok := body["stats"]; !ok {
		t.Error("response missing 'stats' field")
	}
}

func TestThoughtLifecycle(t *testing.T) {
	mux := setupAutonomousTestMux()

	// Create a thought
	thought := map[string]interface{}{
		"agent_id":   "lifecycle-agent",
		"agent_name": "BREACH",
		"type":       "enhancement",
		"category":   "automation",
		"title":      "Lifecycle test thought",
		"content":    "Testing create → list → filter lifecycle",
		"priority":   5,
	}

	body, _ := json.Marshal(thought)
	req := httptest.NewRequest("POST", "/api/agents/thoughts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("create failed: %d — %s", w.Code, w.Body.String())
	}

	// List with agent_id filter
	req = httptest.NewRequest("GET", "/api/agents/thoughts?agent_id=lifecycle-agent", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("list with filter: expected 200, got %d", w.Code)
	}

	var listResp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("list response is not valid JSON: %v", err)
	}

	thoughts, ok := listResp["thoughts"].([]interface{})
	if !ok {
		t.Fatal("'thoughts' is not an array")
	}

	found := false
	for _, th := range thoughts {
		if m, ok := th.(map[string]interface{}); ok && m["title"] == "Lifecycle test thought" {
			found = true
			break
		}
	}
	if !found {
		t.Error("created thought not found in filtered list")
	}
}
