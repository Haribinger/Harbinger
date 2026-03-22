package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// setupPhase1Mux registers Phase 1 routes without auth middleware for testing.
func setupPhase1Mux() *http.ServeMux {
	mux := http.NewServeMux()

	// Executor routes
	mux.HandleFunc("POST /api/exec/spawn", handleSpawnExecution)
	mux.HandleFunc("POST /api/exec/{id}/run", handleExecCommand)
	mux.HandleFunc("POST /api/exec/{id}/stop", handleStopExecution)
	mux.HandleFunc("DELETE /api/exec/{id}", handleRemoveExecution)

	// Pipeline routes
	mux.HandleFunc("POST /api/pipelines", handleCreatePipeline)
	mux.HandleFunc("GET /api/pipelines", handleListPipelines)
	mux.HandleFunc("GET /api/pipelines/{id}", handleGetPipeline)
	mux.HandleFunc("POST /api/pipelines/{id}/tasks", handleAddPipelineTask)
	mux.HandleFunc("GET /api/pipelines/{id}/tasks", handleListPipelineTasks)

	// Vector memory routes
	mux.HandleFunc("POST /api/memory/store", handleStoreMemory)
	mux.HandleFunc("POST /api/memory/search", handleSearchMemory)
	mux.HandleFunc("DELETE /api/memory/{id}", handleDeleteMemory)
	mux.HandleFunc("GET /api/memory/agent/{agent_id}", handleListAgentMemories)

	// Observability routes
	mux.HandleFunc("POST /api/observability/trace", handleRecordTrace)
	mux.HandleFunc("GET /api/observability/traces", handleListTraces)
	mux.HandleFunc("GET /api/observability/stats", handleObservabilityStats)

	return mux
}

// parseJSON decodes a recorder body into a map. Fails the test on error.
func parseJSON(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatalf("response is not valid JSON: %v — body: %s", err, w.Body.String())
	}
	return m
}

// ---------------------------------------------------------------------------
// Executor — graceful degradation when Docker is unavailable
// ---------------------------------------------------------------------------

func TestExecutorGracefulDegradation(t *testing.T) {
	// Ensure execEngine is nil so handlers degrade gracefully
	execEngine = nil
	mux := setupPhase1Mux()

	handlers := []struct {
		method string
		path   string
		body   any
	}{
		{"POST", "/api/exec/spawn", map[string]any{"name": "test", "image": "alpine"}},
		{"POST", "/api/exec/abc123/run", map[string]any{"command": []string{"ls"}}},
		{"POST", "/api/exec/abc123/stop", nil},
		{"DELETE", "/api/exec/abc123", nil},
	}

	for _, tc := range handlers {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			var bodyReader *bytes.Reader
			if tc.body != nil {
				b, _ := json.Marshal(tc.body)
				bodyReader = bytes.NewReader(b)
			} else {
				bodyReader = bytes.NewReader(nil)
			}

			req := httptest.NewRequest(tc.method, tc.path, bodyReader)
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, req)

			if w.Code != http.StatusServiceUnavailable {
				t.Errorf("expected 503, got %d — body: %s", w.Code, w.Body.String())
			}

			resp := parseJSON(t, w)
			if resp["ok"] != false {
				t.Errorf("expected ok=false, got %v", resp["ok"])
			}
			if resp["reason"] != "not_configured" {
				t.Errorf("expected reason=not_configured, got %v", resp["reason"])
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Pipeline — full CRUD lifecycle
// ---------------------------------------------------------------------------

func TestPipelineEndpoints(t *testing.T) {
	// Initialize pipeline manager in pure in-memory mode (db is nil)
	initPipeline()
	mux := setupPhase1Mux()

	// Step 1: Create a pipeline
	createBody, _ := json.Marshal(map[string]any{
		"name":     "test-recon",
		"agent_id": "pathfinder",
		"input":    "scan example.com",
	})
	req := httptest.NewRequest("POST", "/api/pipelines", bytes.NewReader(createBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("create pipeline: expected 201, got %d — body: %s", w.Code, w.Body.String())
	}

	createResp := parseJSON(t, w)
	if createResp["ok"] != true {
		t.Fatalf("create pipeline: expected ok=true, got %v", createResp["ok"])
	}

	pipelineData, ok := createResp["pipeline"].(map[string]any)
	if !ok {
		t.Fatal("create pipeline: 'pipeline' field is not an object")
	}

	pipelineID, ok := pipelineData["id"].(string)
	if !ok || pipelineID == "" {
		t.Fatal("create pipeline: pipeline.id is missing or empty")
	}

	// Step 2: List pipelines — should have at least 1
	req = httptest.NewRequest("GET", "/api/pipelines", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("list pipelines: expected 200, got %d", w.Code)
	}

	listResp := parseJSON(t, w)
	items, ok := listResp["items"].([]any)
	if !ok {
		t.Fatal("list pipelines: 'items' is not an array")
	}
	if len(items) < 1 {
		t.Errorf("list pipelines: expected at least 1 pipeline, got %d", len(items))
	}

	// Step 3: Add a task to the pipeline
	taskBody, _ := json.Marshal(map[string]any{
		"title":      "Recon",
		"agent_type": "researcher",
	})
	req = httptest.NewRequest("POST", "/api/pipelines/"+pipelineID+"/tasks", bytes.NewReader(taskBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("add task: expected 201, got %d — body: %s", w.Code, w.Body.String())
	}

	taskResp := parseJSON(t, w)
	if taskResp["ok"] != true {
		t.Errorf("add task: expected ok=true, got %v", taskResp["ok"])
	}

	taskData, ok := taskResp["task"].(map[string]any)
	if !ok {
		t.Fatal("add task: 'task' field is not an object")
	}
	if taskData["id"] == nil || taskData["id"] == "" {
		t.Error("add task: task.id is missing or empty")
	}

	// Step 4: List pipeline tasks — should have 1
	req = httptest.NewRequest("GET", "/api/pipelines/"+pipelineID+"/tasks", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("list tasks: expected 200, got %d", w.Code)
	}

	tasksResp := parseJSON(t, w)
	taskItems, ok := tasksResp["items"].([]any)
	if !ok {
		t.Fatal("list tasks: 'items' is not an array")
	}
	if len(taskItems) != 1 {
		t.Errorf("list tasks: expected 1 task, got %d", len(taskItems))
	}
}

// ---------------------------------------------------------------------------
// Vector memory — store and search lifecycle
// ---------------------------------------------------------------------------

func TestVectorMemEndpoints(t *testing.T) {
	// Initialize memory store in pure in-memory mode (db is nil)
	initVectorMem()
	mux := setupPhase1Mux()

	// Step 1: Store a memory entry
	storeBody, _ := json.Marshal(map[string]any{
		"agent_id": "pathfinder",
		"content":  "found open port 443",
		"doc_type": "finding",
	})
	req := httptest.NewRequest("POST", "/api/memory/store", bytes.NewReader(storeBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("store memory: expected 201, got %d — body: %s", w.Code, w.Body.String())
	}

	storeResp := parseJSON(t, w)
	if storeResp["ok"] != true {
		t.Fatalf("store memory: expected ok=true, got %v", storeResp["ok"])
	}
	if storeResp["id"] == nil || storeResp["id"] == "" {
		t.Fatal("store memory: id is missing or empty")
	}

	// Step 2: Search for the stored memory
	searchBody, _ := json.Marshal(map[string]any{
		"query":    "port 443",
		"agent_id": "pathfinder",
		"limit":    5,
	})
	req = httptest.NewRequest("POST", "/api/memory/search", bytes.NewReader(searchBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("search memory: expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	searchResp := parseJSON(t, w)
	if searchResp["ok"] != true {
		t.Fatalf("search memory: expected ok=true, got %v", searchResp["ok"])
	}

	searchItems, ok := searchResp["items"].([]any)
	if !ok {
		t.Fatal("search memory: 'items' is not an array")
	}
	if len(searchItems) == 0 {
		t.Error("search memory: expected at least 1 result, got 0")
	}

	// Verify at least one result contains the expected content
	found := false
	for _, item := range searchItems {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		content, _ := m["content"].(string)
		if content == "found open port 443" {
			found = true
			break
		}
	}
	if !found {
		t.Error("search memory: no result matched expected content 'found open port 443'")
	}
}

// ---------------------------------------------------------------------------
// Observability — trace recording and stats aggregation
// ---------------------------------------------------------------------------

func TestObservabilityEndpoints(t *testing.T) {
	// Reset the trace store to avoid interference from other tests
	traceStore.Lock()
	traceStore.items = make([]LLMTrace, maxTraces)
	traceStore.pos = 0
	traceStore.full = false
	traceStore.Unlock()

	mux := setupPhase1Mux()

	// Step 1: Record a trace
	traceBody, _ := json.Marshal(map[string]any{
		"agent_id":      "pathfinder",
		"provider":      "anthropic",
		"model":         "claude-3",
		"input_tokens":  100,
		"output_tokens": 50,
		"latency_ms":    1200,
		"cost":          0.003,
		"status":        "success",
	})
	req := httptest.NewRequest("POST", "/api/observability/trace", bytes.NewReader(traceBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("record trace: expected 201, got %d — body: %s", w.Code, w.Body.String())
	}

	traceResp := parseJSON(t, w)
	if traceResp["ok"] != true {
		t.Fatalf("record trace: expected ok=true, got %v", traceResp["ok"])
	}
	if traceResp["id"] == nil || traceResp["id"] == "" {
		t.Fatal("record trace: id is missing or empty")
	}

	// Step 2: List traces — verify the recorded trace appears
	req = httptest.NewRequest("GET", "/api/observability/traces?agent_id=pathfinder", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("list traces: expected 200, got %d", w.Code)
	}

	listResp := parseJSON(t, w)
	traceItems, ok := listResp["items"].([]any)
	if !ok {
		t.Fatal("list traces: 'items' is not an array")
	}
	if len(traceItems) < 1 {
		t.Errorf("list traces: expected at least 1 trace, got %d", len(traceItems))
	}

	// Step 3: Get observability stats
	req = httptest.NewRequest("GET", "/api/observability/stats", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("observability stats: expected 200, got %d", w.Code)
	}

	statsResp := parseJSON(t, w)
	if statsResp["ok"] != true {
		t.Fatalf("observability stats: expected ok=true, got %v", statsResp["ok"])
	}

	totalTraces, ok := statsResp["total_traces"].(float64)
	if !ok {
		t.Fatal("observability stats: 'total_traces' is not a number")
	}
	if totalTraces < 1 {
		t.Errorf("observability stats: expected total_traces >= 1, got %v", totalTraces)
	}

	// Verify cost and token aggregation
	totalCost, _ := statsResp["total_cost"].(float64)
	if totalCost < 0.003 {
		t.Errorf("observability stats: expected total_cost >= 0.003, got %v", totalCost)
	}

	totalTokens, _ := statsResp["total_tokens"].(float64)
	if totalTokens < 150 {
		t.Errorf("observability stats: expected total_tokens >= 150, got %v", totalTokens)
	}
}
