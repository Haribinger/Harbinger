package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/Haribinger/Harbinger/backend/pkg/embedder"
	"github.com/Haribinger/Harbinger/backend/pkg/memorylayer"
	"github.com/Haribinger/Harbinger/backend/pkg/neo4jclient"
	"github.com/Haribinger/Harbinger/backend/pkg/vectormem"
)

// workingMem is the L1 Redis-backed working memory layer (mission-scoped, ephemeral).
// It is nil when Redis is not available at startup.
var workingMem *memorylayer.WorkingMemory

// summarizer handles compression of tool output and conversation chains.
var summarizer *memorylayer.Summarizer

// embeddingProvider generates vector embeddings for semantic memory search.
var embeddingProvider embedder.Embedder

// initMemoryLayers sets up the L1 working memory (Redis), the embedding provider,
// and the summarizer. Missing infrastructure is tolerated — each layer degrades
// independently rather than preventing startup.
func initMemoryLayers() {
	// Embedder — tries HARBINGER_EMBEDDING_API_KEY then OPENAI_API_KEY, falls back to noop.
	embeddingProvider = embedder.New()

	// L1 Working Memory backed by Redis.
	wm, err := memorylayer.NewWorkingMemory(memorylayer.WorkingMemoryConfig{
		Host: cfg.RedisHost,
		Port: cfg.RedisPort,
	})
	if err != nil {
		log.Printf("[WARN] Redis working memory not available: %v (L1 disabled)", err)
	} else {
		workingMem = wm
		log.Println("[OK] L1 working memory (Redis) connected")
	}

	// Summarizer — always available; uses LLM when configured via env vars.
	summarizer = memorylayer.NewSummarizer(memorylayer.SummarizerConfig{})
	log.Println("[OK] Summarization engine initialized")
}

// ── L1 Working Memory ───────────────────────────────────────────────────────

// handleSetWorkingMemory stores a key-value pair in mission-scoped Redis.
// POST /api/v1/memory/working/set
// Body: {"mission_id":"m1","key":"target","value":"example.com"}
func handleSetWorkingMemory(w http.ResponseWriter, r *http.Request) {
	if workingMem == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req struct {
		MissionID string `json:"mission_id"`
		Key       string `json:"key"`
		Value     string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}
	if req.MissionID == "" || req.Key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "mission_id and key are required"})
		return
	}

	if err := workingMem.Set(r.Context(), req.MissionID, req.Key, req.Value); err != nil {
		internalError(w, "set working memory", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleGetWorkingMemory retrieves a single value from working memory.
// GET /api/v1/memory/working/{mission_id}/{key}
func handleGetWorkingMemory(w http.ResponseWriter, r *http.Request) {
	if workingMem == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	missionID := r.PathValue("mission_id")
	key := r.PathValue("key")
	if missionID == "" || key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "mission_id and key are required"})
		return
	}

	value, err := workingMem.Get(r.Context(), missionID, key)
	if err != nil {
		internalError(w, "get working memory", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "value": value, "found": value != ""})
}

// handleGetAllWorkingMemory returns all key-value pairs in a mission's working memory.
// GET /api/v1/memory/working/{mission_id}
func handleGetAllWorkingMemory(w http.ResponseWriter, r *http.Request) {
	if workingMem == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	missionID := r.PathValue("mission_id")
	if missionID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "mission_id is required"})
		return
	}

	data, err := workingMem.GetAll(r.Context(), missionID)
	if err != nil {
		internalError(w, "get all working memory", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "mission_id": missionID, "data": data})
}

// handleAppendWorkingMemory appends a value to a list key in working memory.
// POST /api/v1/memory/working/append
// Body: {"mission_id":"m1","key":"findings","value":"found XSS at /search?q=..."}
func handleAppendWorkingMemory(w http.ResponseWriter, r *http.Request) {
	if workingMem == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req struct {
		MissionID string `json:"mission_id"`
		Key       string `json:"key"`
		Value     string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}
	if req.MissionID == "" || req.Key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "mission_id and key are required"})
		return
	}

	if err := workingMem.Append(r.Context(), req.MissionID, req.Key, req.Value); err != nil {
		internalError(w, "append working memory", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleClearWorkingMemory removes all working memory for a mission.
// DELETE /api/v1/memory/working/{mission_id}
func handleClearWorkingMemory(w http.ResponseWriter, r *http.Request) {
	if workingMem == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	missionID := r.PathValue("mission_id")
	if missionID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "mission_id is required"})
		return
	}

	if err := workingMem.Clear(r.Context(), missionID); err != nil {
		internalError(w, "clear working memory", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "mission_id": missionID})
}

// ── Summarization ────────────────────────────────────────────────────────────

// handleSummarize compresses tool output or freeform text using the summarizer.
// POST /api/v1/memory/summarize
// Body: {"text":"...","tool_name":"nuclei"}
func handleSummarize(w http.ResponseWriter, r *http.Request) {
	if summarizer == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req struct {
		Text     string `json:"text"`
		ToolName string `json:"tool_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}
	if req.Text == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "text is required"})
		return
	}

	result, err := summarizer.SummarizeOutput(r.Context(), req.Text, req.ToolName)
	if err != nil {
		internalError(w, "summarize output", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"summary":    result,
		"tool_name":  req.ToolName,
		"original":   len(req.Text),
		"compressed": len(result),
	})
}

// ── Memory Dashboard ─────────────────────────────────────────────────────────

// handleMemoryDashboard returns aggregate stats for all available memory layers:
//   - L1: Redis working memory (WorkingMemory.Stats)
//   - L2: Summarization engine (config info)
//   - L3: Vector/semantic memory (in-memory entry count)
//   - L4: Knowledge graph (Neo4j node/rel counts)
//   - L5: Embedding provider (dimension info)
//
// GET /api/v1/memory/dashboard
func handleMemoryDashboard(w http.ResponseWriter, r *http.Request) {
	layers := make(map[string]any)

	// L1 — Redis working memory
	if workingMem != nil {
		stats, err := workingMem.Stats(r.Context())
		if err != nil {
			stats["error"] = err.Error()
		}
		layers["L1"] = map[string]any{
			"name":      "Working Memory (Redis)",
			"available": true,
			"stats":     stats,
		}
	} else {
		layers["L1"] = map[string]any{"name": "Working Memory (Redis)", "available": false}
	}

	// L2 — Summarizer
	if summarizer != nil {
		layers["L2"] = map[string]any{
			"name":      "Summarization Engine",
			"available": true,
			"stats": map[string]any{
				"result_limit": summarizer.ResultLimit,
				"chain_limit":  summarizer.ChainLimit,
				"llm_enabled":  summarizer.LLMEndpoint != "" && summarizer.LLMModel != "",
			},
		}
	} else {
		layers["L2"] = map[string]any{"name": "Summarization Engine", "available": false}
	}

	// L3 — Semantic/vector memory (in-memory store, count by searching with a large limit)
	if memStore != nil {
		all, err := memStore.Search(r.Context(), vectormem.SearchRequest{Limit: 1000000})
		count := 0
		if err == nil {
			count = len(all)
		}
		layers["L3"] = map[string]any{
			"name":      "Semantic Memory (Vector)",
			"available": true,
			"stats":     map[string]any{"total_entries": count},
		}
	} else {
		layers["L3"] = map[string]any{"name": "Semantic Memory (Vector)", "available": false}
	}

	// L4 — Knowledge graph (Neo4j)
	if graphClient != nil {
		graphStats, err := neo4jclient.GetStats(r.Context(), graphClient)
		if err != nil {
			layers["L4"] = map[string]any{
				"name":      "Knowledge Graph (Neo4j)",
				"available": true,
				"stats":     map[string]any{"error": err.Error()},
			}
		} else {
			layers["L4"] = map[string]any{
				"name":      "Knowledge Graph (Neo4j)",
				"available": true,
				"stats":     graphStats,
			}
		}
	} else {
		layers["L4"] = map[string]any{"name": "Knowledge Graph (Neo4j)", "available": false}
	}

	// L5 — Embedding provider
	if embeddingProvider != nil {
		layers["L5"] = map[string]any{
			"name":      "Embedding Provider",
			"available": true,
			"stats":     map[string]any{"dimension": embeddingProvider.Dimension()},
		}
	} else {
		layers["L5"] = map[string]any{"name": "Embedding Provider", "available": false}
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "layers": layers})
}

// ── Unified Memory Search ────────────────────────────────────────────────────

// handleUnifiedMemorySearch searches across all requested memory layers and merges results.
// POST /api/v1/memory/search-all
// Body: {"query":"apache struts","mission_id":"m1","agent_id":"BREACH","layers":["L1","L3","L4"],"limit":20}
func handleUnifiedMemorySearch(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Query     string   `json:"query"`
		MissionID string   `json:"mission_id"`
		AgentID   string   `json:"agent_id"`
		Layers    []string `json:"layers"`
		Limit     int      `json:"limit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}
	if req.Query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "query is required"})
		return
	}
	if req.Limit <= 0 {
		req.Limit = 20
	}

	// Build layer set. Default to all when omitted.
	layerSet := make(map[string]bool)
	if len(req.Layers) == 0 {
		layerSet["L1"] = true
		layerSet["L3"] = true
		layerSet["L4"] = true
	} else {
		for _, l := range req.Layers {
			layerSet[l] = true
		}
	}

	results := make(map[string]any)

	// L1 — scan all working memory keys for the mission and filter by query.
	if layerSet["L1"] && workingMem != nil && req.MissionID != "" {
		data, err := workingMem.GetAll(r.Context(), req.MissionID)
		if err == nil {
			var matches []map[string]any
			for k, v := range data {
				if containsCI(v, req.Query) || containsCI(k, req.Query) {
					matches = append(matches, map[string]any{"key": k, "value": v})
				}
			}
			results["L1"] = map[string]any{"items": matches, "source": "working_memory"}
		}
	}

	// L3 — keyword search in semantic memory.
	if layerSet["L3"] && memStore != nil {
		items, err := memStore.Search(r.Context(), vectormem.SearchRequest{
			Query:   req.Query,
			AgentID: req.AgentID,
			Limit:   req.Limit,
		})
		if err == nil {
			results["L3"] = map[string]any{"items": items, "source": "semantic_memory"}
		}
	}

	// L4 — knowledge graph full-text search.
	if layerSet["L4"] && graphClient != nil {
		nodes, err := neo4jclient.SearchNodes(r.Context(), graphClient, req.Query, "", req.Limit)
		if err == nil {
			results["L4"] = map[string]any{"items": nodes, "source": "knowledge_graph"}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"query":   req.Query,
		"results": results,
	})
}

// ── internal helpers ─────────────────────────────────────────────────────────

// containsCI performs a case-insensitive ASCII substring search without allocating
// a lowercased copy of the haystack. Used only for working memory key/value filtering.
func containsCI(s, substr string) bool {
	if substr == "" {
		return true
	}
	sl := len(s)
	subl := len(substr)
	if subl > sl {
		return false
	}
	for i := 0; i <= sl-subl; i++ {
		match := true
		for j := 0; j < subl; j++ {
			cs := s[i+j]
			cp := substr[j]
			if cs >= 'A' && cs <= 'Z' {
				cs += 'a' - 'A'
			}
			if cp >= 'A' && cp <= 'Z' {
				cp += 'a' - 'A'
			}
			if cs != cp {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}
