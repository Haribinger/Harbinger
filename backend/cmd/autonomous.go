package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"
)

// ============================================================================
// AUTONOMOUS INTELLIGENCE — Agent thinking loop, swarm awareness, efficiency
// ============================================================================

// AgentThought represents a single observation, enhancement, or proposal
// from an agent's autonomous thinking loop.
type AgentThought struct {
	ID         string           `json:"id"`
	AgentID    string           `json:"agent_id"`
	AgentName  string           `json:"agent_name"`
	Type       string           `json:"type"`     // observation, enhancement, proposal, alert
	Category   string           `json:"category"` // performance, accuracy, cost, automation, collaboration
	Title      string           `json:"title"`
	Content    string           `json:"content"`
	Priority   int              `json:"priority"` // 1-5, 5=critical
	Status     string           `json:"status"`   // pending, approved, rejected, implemented
	Efficiency *EfficiencyScore `json:"efficiency,omitempty"`
	Data       json.RawMessage  `json:"data,omitempty"`
	CreatedAt  int64            `json:"created_at"`
}

// EfficiencyScore quantifies the cost-benefit of an automation proposal.
// COST_BENEFIT = (TIME_SAVED * FREQUENCY) / (IMPL_COST + RUNNING_COST)
type EfficiencyScore struct {
	TimeSaved        float64 `json:"time_saved"`         // hours saved per execution
	Frequency        float64 `json:"frequency"`          // executions per week
	ImplementCost    float64 `json:"implementation_cost"` // hours to implement
	RunningCost      float64 `json:"running_cost"`       // hours per week to maintain
	CostBenefit      float64 `json:"cost_benefit"`       // computed ratio
	AutomationType   string  `json:"automation_type"`    // script, skill, workflow, code_change
}

// SwarmState provides full system context for agent self-awareness.
type SwarmState struct {
	Agents           []SwarmAgentStatus `json:"agents"`
	ActiveThoughts   int                `json:"active_thoughts"`
	PendingProposals int                `json:"pending_proposals"`
	SystemHealth     string             `json:"system_health"` // healthy, degraded, critical
	Timestamp        int64              `json:"timestamp"`
}

// SwarmAgentStatus is a lightweight view of an agent within the swarm.
type SwarmAgentStatus struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Status      string `json:"status"`
	CurrentTask string `json:"current_task,omitempty"`
	ThoughtCount int   `json:"thought_count"`
}

// AutonomousStats summarizes the autonomous system for dashboard cards.
type AutonomousStats struct {
	TotalThoughts      int     `json:"total_thoughts"`
	ActiveThoughts     int     `json:"active_thoughts"`
	PendingProposals   int     `json:"pending_proposals"`
	ImplementedCount   int     `json:"implemented_count"`
	AvgEfficiency      float64 `json:"avg_efficiency"`
	AutomationsByType  map[string]int `json:"automations_by_type"`
	ThoughtsByAgent    map[string]int `json:"thoughts_by_agent"`
	ThoughtsByCategory map[string]int `json:"thoughts_by_category"`
}

// In-memory store for autonomous thoughts (backed by DB when available).
var autonomousStore = struct {
	sync.RWMutex
	thoughts []AgentThought
	counter  int
}{
	thoughts: []AgentThought{},
	counter:  0,
}

// generateThoughtID produces a sequential ID with timestamp prefix.
func generateThoughtID() string {
	autonomousStore.counter++
	return "thought-" + strconv.FormatInt(time.Now().UnixMilli(), 36) + "-" + strconv.Itoa(autonomousStore.counter)
}

// ── Handlers ────────────────────────────────────────────────────────────────

// handleCreateThought stores a new thought from an agent's thinking loop.
// POST /api/agents/thoughts
func handleCreateThought(w http.ResponseWriter, r *http.Request) {
	var thought AgentThought
	if err := json.NewDecoder(r.Body).Decode(&thought); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if thought.AgentID == "" || thought.Title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "agent_id and title required"})
		return
	}

	// Set defaults
	autonomousStore.Lock()
	thought.ID = generateThoughtID()
	if thought.Status == "" {
		thought.Status = "pending"
	}
	if thought.Priority == 0 {
		thought.Priority = 3
	}
	if thought.CreatedAt == 0 {
		thought.CreatedAt = time.Now().Unix()
	}
	// Compute cost-benefit if efficiency data provided
	if thought.Efficiency != nil && thought.Efficiency.ImplementCost+thought.Efficiency.RunningCost > 0 {
		thought.Efficiency.CostBenefit = (thought.Efficiency.TimeSaved * thought.Efficiency.Frequency) /
			(thought.Efficiency.ImplementCost + thought.Efficiency.RunningCost)
	}

	autonomousStore.thoughts = append(autonomousStore.thoughts, thought)
	// Cap at 1000 thoughts in memory
	if len(autonomousStore.thoughts) > 1000 {
		autonomousStore.thoughts = autonomousStore.thoughts[len(autonomousStore.thoughts)-1000:]
	}
	autonomousStore.Unlock()

	// Persist to DB if available
	if dbAvailable() {
		if err := dbStoreThought(thought); err != nil {
			log.Printf("[Autonomous] DB store failed: %v", err)
		}
	}

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "thought": thought})
}

// handleListThoughts returns thoughts with optional filters.
// GET /api/agents/thoughts?agent_id=X&type=Y&status=Z&category=C&limit=N
func handleListThoughts(w http.ResponseWriter, r *http.Request) {
	agentFilter := r.URL.Query().Get("agent_id")
	typeFilter := r.URL.Query().Get("type")
	statusFilter := r.URL.Query().Get("status")
	categoryFilter := r.URL.Query().Get("category")
	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if limitStr != "" {
		if n, err := strconv.Atoi(limitStr); err == nil && n > 0 {
			limit = n
		}
	}

	// Try DB first
	if dbAvailable() {
		thoughts, err := dbListThoughts(agentFilter, typeFilter, statusFilter, categoryFilter, limit)
		if err == nil {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "thoughts": thoughts, "count": len(thoughts)})
			return
		}
		log.Printf("[Autonomous] DB list failed, falling back to memory: %v", err)
	}

	// Fallback to in-memory
	autonomousStore.RLock()
	defer autonomousStore.RUnlock()

	filtered := []AgentThought{}
	for _, t := range autonomousStore.thoughts {
		if agentFilter != "" && t.AgentID != agentFilter {
			continue
		}
		if typeFilter != "" && t.Type != typeFilter {
			continue
		}
		if statusFilter != "" && t.Status != statusFilter {
			continue
		}
		if categoryFilter != "" && t.Category != categoryFilter {
			continue
		}
		filtered = append(filtered, t)
	}

	// Sort by created_at descending (newest first)
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt > filtered[j].CreatedAt
	})

	if len(filtered) > limit {
		filtered = filtered[:limit]
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "thoughts": filtered, "count": len(filtered)})
}

// handleGetThought returns a single thought by ID.
// GET /api/agents/thoughts/{id}
func handleGetThought(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "thought id required"})
		return
	}

	// Try DB first
	if dbAvailable() {
		thought, err := dbGetThought(id)
		if err == nil {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "thought": thought})
			return
		}
	}

	// Fallback to in-memory
	autonomousStore.RLock()
	defer autonomousStore.RUnlock()

	for _, t := range autonomousStore.thoughts {
		if t.ID == id {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "thought": t})
			return
		}
	}

	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "thought not found"})
}

// handleUpdateThought patches a thought's status (approve/reject/implement).
// PATCH /api/agents/thoughts/{id}
func handleUpdateThought(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "thought id required"})
		return
	}

	var patch struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	valid := map[string]bool{"pending": true, "approved": true, "rejected": true, "implemented": true}
	if !valid[patch.Status] {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "status must be pending, approved, rejected, or implemented"})
		return
	}

	// Update in DB
	if dbAvailable() {
		if err := dbUpdateThoughtStatus(id, patch.Status); err != nil {
			log.Printf("[Autonomous] DB update failed: %v", err)
		}
	}

	// Update in memory
	autonomousStore.Lock()
	for i, t := range autonomousStore.thoughts {
		if t.ID == id {
			autonomousStore.thoughts[i].Status = patch.Status
			autonomousStore.Unlock()
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "thought": autonomousStore.thoughts[i]})
			return
		}
	}
	autonomousStore.Unlock()

	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "thought not found"})
}

// handleDeleteThought removes a thought.
// DELETE /api/agents/thoughts/{id}
func handleDeleteThought(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "thought id required"})
		return
	}

	// Delete from DB
	if dbAvailable() {
		if err := dbDeleteThought(id); err != nil {
			log.Printf("[Autonomous] DB delete failed: %v", err)
		}
	}

	// Delete from memory
	autonomousStore.Lock()
	for i, t := range autonomousStore.thoughts {
		if t.ID == id {
			autonomousStore.thoughts = append(autonomousStore.thoughts[:i], autonomousStore.thoughts[i+1:]...)
			autonomousStore.Unlock()
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		}
	}
	autonomousStore.Unlock()

	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "thought not found"})
}

// handleSwarmState returns full system context for agent self-awareness.
// GET /api/agents/swarm
func handleSwarmState(w http.ResponseWriter, r *http.Request) {
	// Build agent status list from existing agents store
	agentStatuses := []SwarmAgentStatus{}

	// Count thoughts per agent
	autonomousStore.RLock()
	thoughtCounts := map[string]int{}
	pendingCount := 0
	activeCount := 0
	for _, t := range autonomousStore.thoughts {
		thoughtCounts[t.AgentID]++
		if t.Status == "pending" {
			pendingCount++
		}
		if t.Status == "pending" || t.Status == "approved" {
			activeCount++
		}
	}
	autonomousStore.RUnlock()

	// Pull agents from DB or in-memory store
	if dbAvailable() {
		agents, err := dbListAgents()
		if err == nil {
			for _, a := range agents {
				agentStatuses = append(agentStatuses, SwarmAgentStatus{
					ID:           a.ID,
					Name:         a.Name,
					Type:         a.Type,
					Status:       a.Status,
					ThoughtCount: thoughtCounts[a.ID],
				})
			}
		}
	}

	// Determine system health
	health := "healthy"
	if pendingCount > 20 {
		health = "degraded"
	}
	if pendingCount > 50 {
		health = "critical"
	}

	state := SwarmState{
		Agents:           agentStatuses,
		ActiveThoughts:   activeCount,
		PendingProposals: pendingCount,
		SystemHealth:     health,
		Timestamp:        time.Now().Unix(),
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "swarm": state})
}

// handleAutonomousStats returns summary metrics for the dashboard.
// GET /api/agents/autonomous/stats
func handleAutonomousStats(w http.ResponseWriter, r *http.Request) {
	// Try DB first
	if dbAvailable() {
		stats, err := dbGetThoughtStats()
		if err == nil {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "stats": stats})
			return
		}
		log.Printf("[Autonomous] DB stats failed, falling back to memory: %v", err)
	}

	// Compute from memory
	autonomousStore.RLock()
	defer autonomousStore.RUnlock()

	stats := AutonomousStats{
		AutomationsByType:  map[string]int{},
		ThoughtsByAgent:    map[string]int{},
		ThoughtsByCategory: map[string]int{},
	}

	var totalEfficiency float64
	var efficiencyCount int

	for _, t := range autonomousStore.thoughts {
		stats.TotalThoughts++
		if t.Status == "pending" || t.Status == "approved" {
			stats.ActiveThoughts++
		}
		if t.Status == "pending" && t.Type == "proposal" {
			stats.PendingProposals++
		}
		if t.Status == "implemented" {
			stats.ImplementedCount++
		}
		if t.Efficiency != nil && t.Efficiency.CostBenefit > 0 {
			totalEfficiency += t.Efficiency.CostBenefit
			efficiencyCount++
			stats.AutomationsByType[t.Efficiency.AutomationType]++
		}

		agentKey := t.AgentName
		if agentKey == "" {
			agentKey = t.AgentID
		}
		stats.ThoughtsByAgent[agentKey]++
		if t.Category != "" {
			stats.ThoughtsByCategory[t.Category]++
		}
	}

	if efficiencyCount > 0 {
		stats.AvgEfficiency = totalEfficiency / float64(efficiencyCount)
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "stats": stats})
}
