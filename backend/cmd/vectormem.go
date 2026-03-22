package main

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Haribinger/Harbinger/backend/pkg/vectormem"
)

// memStore is the global semantic memory store.
var memStore *vectormem.Store

// initVectorMem creates the memory store using the global db connection.
// Works in pure in-memory mode when db is nil.
func initVectorMem() {
	memStore = vectormem.NewStore(db)
}

// handleStoreMemory persists a new semantic memory entry.
func handleStoreMemory(w http.ResponseWriter, r *http.Request) {
	if memStore == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req vectormem.StoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if req.Content == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "content is required"})
		return
	}

	id, err := memStore.Store(r.Context(), req)
	if err != nil {
		internalError(w, "store memory", err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "id": id})
}

// handleSearchMemory searches memories by keyword query with optional filters.
func handleSearchMemory(w http.ResponseWriter, r *http.Request) {
	if memStore == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req vectormem.SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	results, err := memStore.Search(r.Context(), req)
	if err != nil {
		internalError(w, "search memory", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": results})
}

// handleDeleteMemory removes a memory entry by ID.
func handleDeleteMemory(w http.ResponseWriter, r *http.Request) {
	if memStore == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "memory id required"})
		return
	}

	if err := memStore.Delete(r.Context(), id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleListAgentMemories returns memories for a specific agent.
func handleListAgentMemories(w http.ResponseWriter, r *http.Request) {
	if memStore == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	agentID := r.PathValue("agent_id")
	if agentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "agent_id required"})
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	results, err := memStore.ListByAgent(r.Context(), agentID, limit)
	if err != nil {
		internalError(w, "list agent memories", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": results})
}
