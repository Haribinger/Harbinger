package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

// LLMTrace records a single LLM API call for observability.
type LLMTrace struct {
	ID           string         `json:"id"`
	AgentID      string         `json:"agent_id"`
	Provider     string         `json:"provider"`
	Model        string         `json:"model"`
	InputTokens  int            `json:"input_tokens"`
	OutputTokens int            `json:"output_tokens"`
	LatencyMs    int64          `json:"latency_ms"`
	Cost         float64        `json:"cost"`
	Status       string         `json:"status"`
	Error        string         `json:"error,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
}

// traceStore is a ring buffer holding the last maxTraces entries.
var traceStore = struct {
	sync.RWMutex
	items []LLMTrace
	pos   int  // next write position (ring buffer index)
	full  bool // whether we've wrapped around at least once
}{items: make([]LLMTrace, maxTraces)}

const maxTraces = 10000

// handleRecordTrace accepts a new LLM trace and appends it to the ring buffer.
func handleRecordTrace(w http.ResponseWriter, r *http.Request) {
	var t LLMTrace
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	// Generate ID if not provided
	if t.ID == "" {
		b := make([]byte, 8)
		rand.Read(b)
		t.ID = "trace-" + hex.EncodeToString(b)
	}

	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now()
	}
	if t.Status == "" {
		t.Status = "success"
	}

	traceStore.Lock()
	traceStore.items[traceStore.pos] = t
	traceStore.pos = (traceStore.pos + 1) % maxTraces
	if traceStore.pos == 0 {
		traceStore.full = true
	}
	traceStore.Unlock()

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "id": t.ID})
}

// handleListTraces returns traces filtered by optional agent_id and provider query params.
// Returns newest first, capped at 100.
func handleListTraces(w http.ResponseWriter, r *http.Request) {
	agentFilter := r.URL.Query().Get("agent_id")
	providerFilter := r.URL.Query().Get("provider")

	traceStore.RLock()
	// Collect all valid entries in insertion order
	var all []LLMTrace
	if traceStore.full {
		// Ring buffer has wrapped — read from pos..end then 0..pos-1
		for i := traceStore.pos; i < maxTraces; i++ {
			all = append(all, traceStore.items[i])
		}
		for i := 0; i < traceStore.pos; i++ {
			all = append(all, traceStore.items[i])
		}
	} else {
		all = append(all, traceStore.items[:traceStore.pos]...)
	}
	traceStore.RUnlock()

	// Filter and reverse (newest first)
	var filtered []LLMTrace
	for i := len(all) - 1; i >= 0; i-- {
		t := all[i]
		if agentFilter != "" && t.AgentID != agentFilter {
			continue
		}
		if providerFilter != "" && t.Provider != providerFilter {
			continue
		}
		filtered = append(filtered, t)
		if len(filtered) >= 100 {
			break
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": filtered})
}

// handleObservabilityStats computes aggregate statistics across all recorded traces.
func handleObservabilityStats(w http.ResponseWriter, r *http.Request) {
	traceStore.RLock()
	var all []LLMTrace
	if traceStore.full {
		all = make([]LLMTrace, maxTraces)
		copy(all, traceStore.items[:])
	} else {
		all = make([]LLMTrace, traceStore.pos)
		copy(all, traceStore.items[:traceStore.pos])
	}
	traceStore.RUnlock()

	var (
		totalCost    float64
		totalTokens  int
		totalLatency int64
		successCount int
		errorCount   int
		byProvider   = make(map[string]map[string]any)
		byAgent      = make(map[string]map[string]any)
	)

	for _, t := range all {
		totalCost += t.Cost
		totalTokens += t.InputTokens + t.OutputTokens
		totalLatency += t.LatencyMs

		if t.Status == "error" {
			errorCount++
		} else {
			successCount++
		}

		// Aggregate by provider
		if _, ok := byProvider[t.Provider]; !ok {
			byProvider[t.Provider] = map[string]any{"count": 0, "cost": 0.0, "tokens": 0}
		}
		bp := byProvider[t.Provider]
		bp["count"] = bp["count"].(int) + 1
		bp["cost"] = bp["cost"].(float64) + t.Cost
		bp["tokens"] = bp["tokens"].(int) + t.InputTokens + t.OutputTokens

		// Aggregate by agent
		if t.AgentID != "" {
			if _, ok := byAgent[t.AgentID]; !ok {
				byAgent[t.AgentID] = map[string]any{"count": 0, "cost": 0.0, "tokens": 0}
			}
			ba := byAgent[t.AgentID]
			ba["count"] = ba["count"].(int) + 1
			ba["cost"] = ba["cost"].(float64) + t.Cost
			ba["tokens"] = ba["tokens"].(int) + t.InputTokens + t.OutputTokens
		}
	}

	var avgLatency float64
	if len(all) > 0 {
		avgLatency = float64(totalLatency) / float64(len(all))
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"total_traces":  len(all),
		"total_cost":    totalCost,
		"total_tokens":  totalTokens,
		"avg_latency":   avgLatency,
		"success_count": successCount,
		"error_count":   errorCount,
		"by_provider":   byProvider,
		"by_agent":      byAgent,
	})
}
