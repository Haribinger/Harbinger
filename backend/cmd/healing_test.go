package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// setupHealingMux creates a test mux with healing routes (no auth middleware).
func setupHealingMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/healing/events", handleListHealingEvents)
	mux.HandleFunc("GET /api/healing/events/{id}", handleGetHealingEvent)
	mux.HandleFunc("GET /api/healing/stats", handleGetHealingStats)
	mux.HandleFunc("GET /api/healing/status", handleGetHealingStatus)
	mux.HandleFunc("POST /api/healing/start", handleStartHealingMonitor)
	mux.HandleFunc("POST /api/healing/stop", handleStopHealingMonitor)
	mux.HandleFunc("GET /api/healing/config", handleGetHealingConfig)
	mux.HandleFunc("POST /api/healing/config", handleUpdateHealingConfig)
	return mux
}

func TestHealingEvents_Empty(t *testing.T) {
	mux := setupHealingMux()
	req := httptest.NewRequest("GET", "/api/healing/events", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if body["ok"] != true {
		t.Fatal("expected ok=true")
	}
	events, ok := body["events"]
	if !ok {
		t.Fatal("missing 'events' field")
	}
	// Should be null or empty array when no events exist.
	if events != nil {
		arr, ok := events.([]interface{})
		if !ok {
			t.Fatal("'events' is not an array")
		}
		_ = arr // empty is fine
	}
}

func TestHealingStats(t *testing.T) {
	mux := setupHealingMux()
	req := httptest.NewRequest("GET", "/api/healing/stats", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if body["ok"] != true {
		t.Fatal("expected ok=true")
	}
	stats, ok := body["stats"].(map[string]interface{})
	if !ok {
		t.Fatal("missing or invalid 'stats' field")
	}
	if _, exists := stats["total_events"]; !exists {
		t.Fatal("stats missing 'total_events'")
	}
	if _, exists := stats["monitor_running"]; !exists {
		t.Fatal("stats missing 'monitor_running'")
	}
}

func TestHealingStatus(t *testing.T) {
	mux := setupHealingMux()
	req := httptest.NewRequest("GET", "/api/healing/status", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if body["ok"] != true {
		t.Fatal("expected ok=true")
	}
	if _, exists := body["running"]; !exists {
		t.Fatal("missing 'running' field")
	}
	cfg, ok := body["config"].(map[string]interface{})
	if !ok {
		t.Fatal("missing or invalid 'config' field")
	}
	if _, exists := cfg["poll_interval_sec"]; !exists {
		t.Fatal("config missing 'poll_interval_sec'")
	}
}

func TestHealingConfig_Get(t *testing.T) {
	mux := setupHealingMux()
	req := httptest.NewRequest("GET", "/api/healing/config", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if body["ok"] != true {
		t.Fatal("expected ok=true")
	}
	cfg, ok := body["config"].(map[string]interface{})
	if !ok {
		t.Fatal("missing 'config'")
	}
	// Verify defaults.
	if cfg["poll_interval_sec"] != float64(15) {
		t.Errorf("expected poll_interval_sec=15, got %v", cfg["poll_interval_sec"])
	}
	if cfg["subtask_timeout_sec"] != float64(600) {
		t.Errorf("expected subtask_timeout_sec=600, got %v", cfg["subtask_timeout_sec"])
	}
	if cfg["stall_threshold_sec"] != float64(120) {
		t.Errorf("expected stall_threshold_sec=120, got %v", cfg["stall_threshold_sec"])
	}
}

func TestHealingConfig_Update(t *testing.T) {
	mux := setupHealingMux()

	payload := `{"poll_interval_sec":30,"subtask_timeout_sec":300,"auto_heal_enabled":true,"llm_diag_enabled":false}`
	req := httptest.NewRequest("POST", "/api/healing/config", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	cfg, ok := body["config"].(map[string]interface{})
	if !ok {
		t.Fatal("missing 'config'")
	}
	if cfg["poll_interval_sec"] != float64(30) {
		t.Errorf("config update failed: expected 30, got %v", cfg["poll_interval_sec"])
	}
	if cfg["subtask_timeout_sec"] != float64(300) {
		t.Errorf("config update failed: expected 300, got %v", cfg["subtask_timeout_sec"])
	}

	// Reset defaults for other tests.
	resetPayload := `{"poll_interval_sec":15,"subtask_timeout_sec":600,"stall_threshold_sec":120,"auto_heal_enabled":true,"llm_diag_enabled":false}`
	resetReq := httptest.NewRequest("POST", "/api/healing/config", strings.NewReader(resetPayload))
	resetReq.Header.Set("Content-Type", "application/json")
	resetW := httptest.NewRecorder()
	mux.ServeHTTP(resetW, resetReq)
}

func TestHealingStartStop(t *testing.T) {
	mux := setupHealingMux()

	// Stop first (may already be running from init).
	stopReq := httptest.NewRequest("POST", "/api/healing/stop", nil)
	stopW := httptest.NewRecorder()
	mux.ServeHTTP(stopW, stopReq)
	if stopW.Code != http.StatusOK {
		t.Fatalf("stop: expected 200, got %d", stopW.Code)
	}

	// Verify stopped.
	statusReq := httptest.NewRequest("GET", "/api/healing/status", nil)
	statusW := httptest.NewRecorder()
	mux.ServeHTTP(statusW, statusReq)
	var statusBody map[string]interface{}
	json.Unmarshal(statusW.Body.Bytes(), &statusBody)
	if statusBody["running"] != false {
		t.Error("expected running=false after stop")
	}

	// Start.
	startReq := httptest.NewRequest("POST", "/api/healing/start", nil)
	startW := httptest.NewRecorder()
	mux.ServeHTTP(startW, startReq)
	if startW.Code != http.StatusOK {
		t.Fatalf("start: expected 200, got %d", startW.Code)
	}

	// Verify running.
	statusReq2 := httptest.NewRequest("GET", "/api/healing/status", nil)
	statusW2 := httptest.NewRecorder()
	mux.ServeHTTP(statusW2, statusReq2)
	var statusBody2 map[string]interface{}
	json.Unmarshal(statusW2.Body.Bytes(), &statusBody2)
	if statusBody2["running"] != true {
		t.Error("expected running=true after start")
	}
}

func TestHealingEvent_NotFound(t *testing.T) {
	mux := setupHealingMux()
	req := httptest.NewRequest("GET", "/api/healing/events/nonexistent_id", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHealingEvents_WithFilters(t *testing.T) {
	mux := setupHealingMux()

	// Test with type filter.
	req := httptest.NewRequest("GET", "/api/healing/events?type=container_restart&limit=5", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["ok"] != true {
		t.Fatal("expected ok=true")
	}
}

func TestAddHealingEvent_AppearsInList(t *testing.T) {
	// Directly add an event and verify it shows up via search (no limit).
	addHealingEvent(HealingEvent{
		ID:            "test_heal_001",
		Type:          HealTypeStallNudge,
		MissionID:     "test_mission",
		TaskID:        "test_task",
		AgentCodename: "PATHFINDER",
		Severity:      "info",
		Title:         "[TEST] Stall nudge test",
		Description:   "Integration test event",
		AutoFixed:     true,
		FixAction:     "nudge",
	})

	mux := setupHealingMux()
	// Use a large limit to ensure we get all events including ours.
	req := httptest.NewRequest("GET", "/api/healing/events?limit=100", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)

	events, _ := body["events"].([]interface{})
	found := false
	for _, e := range events {
		evt, _ := e.(map[string]interface{})
		if evt["id"] == "test_heal_001" {
			found = true
			if evt["type"] != HealTypeStallNudge {
				t.Errorf("expected type=%s, got %v", HealTypeStallNudge, evt["type"])
			}
			if evt["agent_codename"] != "PATHFINDER" {
				t.Errorf("expected agent=PATHFINDER, got %v", evt["agent_codename"])
			}
			break
		}
	}
	if !found {
		t.Error("test event not found in events list")
	}

	// Also verify by direct GET.
	req2 := httptest.NewRequest("GET", "/api/healing/events/test_heal_001", nil)
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 for direct GET, got %d", w2.Code)
	}
}

func TestRuleDiagnose_OOMKilled(t *testing.T) {
	health := &ContainerHealth{
		OOMKilled: true,
		ExitCode:  137,
		Status:    "exited",
	}
	diag := ruleDiagnose(health, "")
	if diag.FixType != "oom" {
		t.Errorf("expected fix_type=oom, got %s", diag.FixType)
	}
	if !diag.AutoFixable {
		t.Error("OOM should be auto-fixable")
	}
	if diag.Confidence < 0.9 {
		t.Errorf("OOM confidence should be >=0.9, got %f", diag.Confidence)
	}
}

func TestRuleDiagnose_Panic(t *testing.T) {
	health := &ContainerHealth{
		ExitCode: 1,
		Status:   "exited",
	}
	diag := ruleDiagnose(health, "goroutine 1:\npanic: runtime error: index out of range")
	if diag.FixType != "restart" {
		t.Errorf("expected fix_type=restart for panic, got %s", diag.FixType)
	}
	if !diag.AutoFixable {
		t.Error("panic should be auto-fixable")
	}
}

func TestRuleDiagnose_UnknownState(t *testing.T) {
	health := &ContainerHealth{
		Status: "paused",
	}
	diag := ruleDiagnose(health, "")
	if diag.FixType != "escalate" {
		t.Errorf("expected fix_type=escalate for unknown state, got %s", diag.FixType)
	}
	if diag.AutoFixable {
		t.Error("unknown state should not be auto-fixable")
	}
}

func TestRecordTaskAction(t *testing.T) {
	RecordTaskAction("test_task_123")

	lastActionTimes.RLock()
	_, exists := lastActionTimes.times["test_task_123"]
	lastActionTimes.RUnlock()

	if !exists {
		t.Error("task action not recorded")
	}

	// Cleanup.
	ClearTaskTracking("test_task_123", "")

	lastActionTimes.RLock()
	_, exists = lastActionTimes.times["test_task_123"]
	lastActionTimes.RUnlock()

	if exists {
		t.Error("task tracking not cleared")
	}
}
