package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ============================================================================
// REALTIME — SSE event bus, agent live status, command streaming, operator
//            session management, and global kill switch.
//
// Architecture note: SSE is used instead of WebSockets so we stay on stdlib
// with zero external dependencies. The hub fans out typed events to connected
// clients filtered by channel subscription. Each subsystem publishes via
// publishEvent(), which both buffers the event (ring, max 1000) and pushes
// it to every matching SSEClient immediately.
// ============================================================================

// genRTID returns a nanosecond-precision prefixed ID. Cheap, collision-free
// within a single process — sufficient for in-memory stores.
func genRTID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

// ── Event types ──────────────────────────────────────────────────────────────

// Valid RealtimeEvent.Type values — used by clients to filter subscriptions.
const (
	EventTypeAgentStatus    = "agent_status"
	EventTypeCommandOutput  = "command_output"
	EventTypeImplantCallback = "implant_callback"
	EventTypeChainProgress  = "chain_progress"
	EventTypeOperatorAction = "operator_action"
	EventTypeSystemAlert    = "system_alert"
	EventTypeFinding        = "finding"

	// v2 execution engine events — published by FastAPI sidecar, fanned out
	// by Go SSE hub to all connected clients. These power the Agent Watch
	// terminal (T2) and Mission Control (T1) dashboards.
	EventTypeMissionUpdate  = "mission_update"   // mission lifecycle changes
	EventTypeTaskUpdate     = "task_update"       // task status in DAG
	EventTypeSubTaskUpdate  = "subtask_update"    // subtask within a task
	EventTypeActionUpdate   = "action_update"     // individual tool call status
	EventTypeToolOutput     = "tool_output"       // streaming stdout/stderr from Docker exec
	EventTypeReactIteration = "react_iteration"   // ReAct loop step: thought + action
)

// RealtimeEvent is the canonical envelope for every SSE message in the platform.
// Payload carries event-specific data; consumers should type-assert on Type.
type RealtimeEvent struct {
	ID        string         `json:"id"`
	Type      string         `json:"type"`      // one of EventType* constants
	Source    string         `json:"source"`    // agent ID, implant ID, or "system"
	Target    string         `json:"target"`    // agent ID, operator ID, or "broadcast"
	Channel   string         `json:"channel"`   // logical channel for client filtering
	Payload   map[string]any `json:"payload"`
	Timestamp string         `json:"timestamp"`
}

// ── SSE client ───────────────────────────────────────────────────────────────

// SSEClient represents one active EventSource connection.
// Events is a buffered channel; Drop policy: skip if full (non-blocking send).
type SSEClient struct {
	ID      string
	UserID  string
	Channel string          // empty string = receive all channels
	Events  chan RealtimeEvent
	Done    chan struct{}
}

// ── Hub ──────────────────────────────────────────────────────────────────────

// realtimeHub is the central in-memory state for SSE fan-out and event buffering.
var realtimeHub = struct {
	sync.RWMutex
	clients map[string]*SSEClient
	// Ring buffer: we append and trim to maxEventBuffer length.
	events []RealtimeEvent
}{
	clients: make(map[string]*SSEClient),
	events:  make([]RealtimeEvent, 0, maxEventBuffer),
}

// maxEventBuffer caps how many events the hub keeps in memory for late-joiners.
const maxEventBuffer = 1000

// publishEvent stores the event in the ring buffer, then fans out to every
// SSEClient whose channel filter matches. Non-blocking: slow clients are skipped.
func publishEvent(event RealtimeEvent) {
	if event.ID == "" {
		event.ID = genRTID("evt")
	}
	if event.Timestamp == "" {
		event.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	realtimeHub.Lock()
	realtimeHub.events = append(realtimeHub.events, event)
	// Keep the ring bounded — drop the oldest entries when we overflow.
	if len(realtimeHub.events) > maxEventBuffer {
		realtimeHub.events = realtimeHub.events[len(realtimeHub.events)-maxEventBuffer:]
	}
	// Snapshot client list under lock, then fan-out outside it.
	targets := make([]*SSEClient, 0, len(realtimeHub.clients))
	for _, c := range realtimeHub.clients {
		if c.Channel == "" || c.Channel == event.Channel {
			targets = append(targets, c)
		}
	}
	realtimeHub.Unlock()

	for _, c := range targets {
		select {
		case c.Events <- event:
		default:
			// Client is too slow — skip rather than block the publisher.
		}
	}
}

// ── SSE stream handler ────────────────────────────────────────────────────────

// handleSSEStream opens and holds an SSE connection for the caller.
// Authentication: userID is extracted from JWT claims set by authMiddleware.
// For EventSource clients that cannot set Authorization headers, a ?token=
// query parameter is accepted as a fallback and validated server-side.
// Query params:
//   ?channel=  — optional channel filter (empty = all)
//   ?token=    — fallback JWT for EventSource (only used if no userID in context)
//
// The response never returns; the connection is kept alive until the client
// disconnects or the server shuts down.
func handleSSEStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported by this transport", http.StatusInternalServerError)
		return
	}

	channel := r.URL.Query().Get("channel")

	// Primary: extract userID from JWT claims set by authMiddleware.
	userID, _ := r.Context().Value("userID").(string)

	// Fallback: EventSource cannot set headers, so accept ?token= query param.
	if userID == "" {
		if tokenParam := r.URL.Query().Get("token"); tokenParam != "" {
			claims, err := validateJWT(tokenParam)
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "invalid token"})
				return
			}
			userID = claims.UserID
		}
	}

	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "authentication required"})
		return
	}

	client := &SSEClient{
		ID:      genRTID("sse"),
		UserID:  userID,
		Channel: channel,
		// Buffer 64 events per client to absorb bursts without blocking the publisher.
		Events: make(chan RealtimeEvent, 64),
		Done:   make(chan struct{}),
	}

	realtimeHub.Lock()
	realtimeHub.clients[client.ID] = client
	realtimeHub.Unlock()

	defer func() {
		realtimeHub.Lock()
		delete(realtimeHub.clients, client.ID)
		realtimeHub.Unlock()
		close(client.Done)
	}()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	// Nginx: disable proxy buffering so chunks reach the client immediately.
	w.Header().Set("X-Accel-Buffering", "no")

	// Send a synthetic connected event so clients know the stream is live.
	connectEvt := RealtimeEvent{
		ID:        genRTID("evt"),
		Type:      EventTypeSystemAlert,
		Source:    "system",
		Target:    "broadcast",
		Channel:   channel,
		Payload:   map[string]any{"message": "connected", "clientId": client.ID},
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	if data, err := json.Marshal(connectEvt); err == nil {
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	// Keep-alive ticker: SSE connections go silent without periodic writes,
	// which causes proxies and browsers to time them out.
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// SSE comment keeps the TCP connection alive without triggering
			// client-side event handlers.
			fmt.Fprintf(w, ": heartbeat\n\n")
			flusher.Flush()
		case evt, open := <-client.Events:
			if !open {
				return
			}
			data, err := json.Marshal(evt)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

// handleBroadcastEvent accepts a RealtimeEvent from an external caller
// (agent, automation script, C2 callback) and fans it out to all connected clients.
// POST /api/realtime/events
func handleBroadcastEvent(w http.ResponseWriter, r *http.Request) {
	var evt RealtimeEvent
	if err := json.NewDecoder(r.Body).Decode(&evt); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	validTypes := map[string]bool{
		EventTypeAgentStatus:     true,
		EventTypeCommandOutput:   true,
		EventTypeImplantCallback: true,
		EventTypeChainProgress:   true,
		EventTypeOperatorAction:  true,
		EventTypeSystemAlert:     true,
		EventTypeFinding:         true,
		// v2 execution engine events
		EventTypeMissionUpdate:  true,
		EventTypeTaskUpdate:     true,
		EventTypeSubTaskUpdate:  true,
		EventTypeActionUpdate:   true,
		EventTypeToolOutput:     true,
		EventTypeReactIteration: true,
	}
	if !validTypes[evt.Type] {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":    false,
			"error": "invalid event type",
		})
		return
	}

	if evt.Payload == nil {
		evt.Payload = map[string]any{}
	}

	publishEvent(evt)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": evt.ID})
}

// handleListRealtimeEvents returns buffered events from the ring buffer.
// Query params:
//   ?type=   — filter by event type
//   ?limit=  — max events to return (default 100, max 1000)
//
// GET /api/realtime/events
func handleListRealtimeEvents(w http.ResponseWriter, r *http.Request) {
	typeFilter := r.URL.Query().Get("type")
	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if n, err := strconv.Atoi(limitStr); err == nil && n > 0 {
		if n > maxEventBuffer {
			n = maxEventBuffer
		}
		limit = n
	}

	realtimeHub.RLock()
	snapshot := make([]RealtimeEvent, len(realtimeHub.events))
	copy(snapshot, realtimeHub.events)
	realtimeHub.RUnlock()

	// Filter then trim to limit — iterate in reverse so we get the most recent.
	filtered := make([]RealtimeEvent, 0, limit)
	for i := len(snapshot) - 1; i >= 0 && len(filtered) < limit; i-- {
		if typeFilter == "" || snapshot[i].Type == typeFilter {
			filtered = append(filtered, snapshot[i])
		}
	}

	// Reverse back to chronological order for the caller.
	for lo, hi := 0, len(filtered)-1; lo < hi; lo, hi = lo+1, hi-1 {
		filtered[lo], filtered[hi] = filtered[hi], filtered[lo]
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"events": filtered,
		"count":  len(filtered),
	})
}

// ── Agent live status ─────────────────────────────────────────────────────────

// AgentLiveStatus is the real-time view of what an AI agent is doing right now.
// It is updated by agents via heartbeat/status calls and read by the command
// center UI at high polling frequency.
type AgentLiveStatus struct {
	AgentID       string         `json:"agentId"`
	AgentName     string         `json:"agentName"`
	Status        string         `json:"status"`       // idle, executing, waiting, error
	CurrentTask   string         `json:"currentTask"`
	CurrentChain  string         `json:"currentChain"`
	LastHeartbeat string         `json:"lastHeartbeat"`
	Metrics       map[string]any `json:"metrics"`
}

var agentStatusStore = struct {
	sync.RWMutex
	statuses map[string]AgentLiveStatus
}{
	statuses: make(map[string]AgentLiveStatus),
}

// handleGetAgentStatus returns the live status of all known agents.
// GET /api/realtime/agents
func handleGetAgentStatus(w http.ResponseWriter, r *http.Request) {
	agentStatusStore.RLock()
	items := make([]AgentLiveStatus, 0, len(agentStatusStore.statuses))
	for _, s := range agentStatusStore.statuses {
		items = append(items, s)
	}
	agentStatusStore.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "agents": items, "count": len(items)})
}

// handleUpdateAgentStatus lets an agent (or orchestrator) push a full status
// snapshot. Publishes an agent_status event so SSE clients see it immediately.
// PUT /api/realtime/agents/{id}
func handleUpdateAgentStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var status AgentLiveStatus
	if err := json.NewDecoder(r.Body).Decode(&status); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	validStatuses := map[string]bool{"idle": true, "executing": true, "waiting": true, "error": true}
	if status.Status != "" && !validStatuses[status.Status] {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":    false,
			"error": "invalid status — must be one of: idle, executing, waiting, error",
		})
		return
	}

	// Preserve existing fields the caller didn't send.
	agentStatusStore.Lock()
	existing, exists := agentStatusStore.statuses[id]
	if exists {
		if status.AgentID == "" {
			status.AgentID = existing.AgentID
		}
		if status.AgentName == "" {
			status.AgentName = existing.AgentName
		}
		if status.Status == "" {
			status.Status = existing.Status
		}
		if status.Metrics == nil {
			status.Metrics = existing.Metrics
		}
	}

	status.AgentID = id
	if status.Metrics == nil {
		status.Metrics = map[string]any{}
	}
	agentStatusStore.statuses[id] = status
	agentStatusStore.Unlock()

	publishEvent(RealtimeEvent{
		Type:    EventTypeAgentStatus,
		Source:  id,
		Target:  "broadcast",
		Channel: "agents",
		Payload: map[string]any{
			"agentId":   id,
			"agentName": status.AgentName,
			"status":    status.Status,
			"task":      status.CurrentTask,
		},
	})

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "status": status})
}

// handleRealtimeAgentHeartbeat is a lightweight ping from an agent process —
// updates LastHeartbeat in the in-memory live-status store without requiring a
// full status body. Status defaults to "idle" on first heartbeat so the UI
// shows the agent is alive.
//
// This is distinct from handleAgentHeartbeat in agents.go, which persists to
// the database. This handler is for the low-latency, SSE-coupled status view.
// POST /api/realtime/agents/{id}/heartbeat
func handleRealtimeAgentHeartbeat(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// Optional body lets agents include metric snapshots with their ping.
	var body struct {
		AgentName string         `json:"agentName"`
		Status    string         `json:"status"`
		Metrics   map[string]any `json:"metrics"`
	}
	// Decode is best-effort — heartbeat is valid even with an empty body.
	json.NewDecoder(r.Body).Decode(&body) //nolint:errcheck — intentional; body is optional

	now := time.Now().UTC().Format(time.RFC3339)

	agentStatusStore.Lock()
	existing, exists := agentStatusStore.statuses[id]
	if !exists {
		existing = AgentLiveStatus{
			AgentID: id,
			Status:  "idle",
			Metrics: map[string]any{},
		}
	}

	existing.LastHeartbeat = now
	if body.AgentName != "" {
		existing.AgentName = body.AgentName
	}
	if body.Status != "" {
		existing.Status = body.Status
	}
	if body.Metrics != nil {
		existing.Metrics = body.Metrics
	}
	agentStatusStore.statuses[id] = existing
	agentStatusStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "timestamp": now})
}

// ── Command streaming ─────────────────────────────────────────────────────────

// CommandStream tracks output from a single command sent to an implant.
// Output grows incrementally as the implant sends chunks back — callers append
// via handleAppendCommandOutput and read the full buffer via handleGetCommandStream.
type CommandStream struct {
	ID          string `json:"id"`
	ImplantID   string `json:"implantId"`
	Command     string `json:"command"`
	Status      string `json:"status"`      // queued, executing, completed, failed
	Output      string `json:"output"`
	StartedAt   string `json:"startedAt"`
	CompletedAt string `json:"completedAt,omitempty"`
}

var commandStreamStore = struct {
	sync.RWMutex
	streams map[string]CommandStream
}{
	streams: make(map[string]CommandStream),
}

// handleCreateCommandStream queues a new command for an implant.
// Publishes a command_output event so any SSE client watching the implant's
// channel sees the new task immediately.
// POST /api/realtime/streams
func handleCreateCommandStream(w http.ResponseWriter, r *http.Request) {
	var stream CommandStream
	if err := json.NewDecoder(r.Body).Decode(&stream); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if strings.TrimSpace(stream.ImplantID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "implantId is required"})
		return
	}
	if strings.TrimSpace(stream.Command) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "command is required"})
		return
	}

	stream.ID = genRTID("stream")
	stream.Status = "queued"
	stream.StartedAt = time.Now().UTC().Format(time.RFC3339)
	stream.Output = ""

	commandStreamStore.Lock()
	commandStreamStore.streams[stream.ID] = stream
	commandStreamStore.Unlock()

	publishEvent(RealtimeEvent{
		Type:    EventTypeCommandOutput,
		Source:  "system",
		Target:  stream.ImplantID,
		Channel: "c2",
		Payload: map[string]any{
			"streamId":  stream.ID,
			"implantId": stream.ImplantID,
			"command":   stream.Command,
			"status":    stream.Status,
		},
	})

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "stream": stream})
}

// handleGetCommandStream returns the current state and full output buffer for
// a stream. Polling-friendly — clients that can't use SSE can poll this.
// GET /api/realtime/streams/{id}
func handleGetCommandStream(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	commandStreamStore.RLock()
	stream, ok := commandStreamStore.streams[id]
	commandStreamStore.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "stream not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "stream": stream})
}

// handleAppendCommandOutput is called by C2 callbacks (implant or relay) to
// push stdout/stderr chunks into the stream buffer. Each append publishes an
// event so SSE clients receive incremental output without polling.
// POST /api/realtime/streams/{id}/output
func handleAppendCommandOutput(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body struct {
		Output string `json:"output"`
		Status string `json:"status"` // optional — set to completed/failed to close stream
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	commandStreamStore.Lock()
	stream, ok := commandStreamStore.streams[id]
	if !ok {
		commandStreamStore.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "stream not found"})
		return
	}

	stream.Output += body.Output

	if body.Status == "completed" || body.Status == "failed" {
		stream.Status = body.Status
		stream.CompletedAt = time.Now().UTC().Format(time.RFC3339)
	} else if stream.Status == "queued" {
		// First chunk arriving means execution started.
		stream.Status = "executing"
	}

	commandStreamStore.streams[id] = stream
	commandStreamStore.Unlock()

	publishEvent(RealtimeEvent{
		Type:    EventTypeCommandOutput,
		Source:  stream.ImplantID,
		Target:  "broadcast",
		Channel: "c2",
		Payload: map[string]any{
			"streamId":  id,
			"implantId": stream.ImplantID,
			"chunk":     body.Output,
			"status":    stream.Status,
		},
	})

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "status": stream.Status})
}

// handleListCommandStreams returns streams filtered by implant or status.
// Query params:
//   ?implantId= — filter by implant
//   ?status=    — filter by status (queued, executing, completed, failed)
//
// GET /api/realtime/streams
func handleListCommandStreams(w http.ResponseWriter, r *http.Request) {
	implantFilter := r.URL.Query().Get("implantId")
	statusFilter := r.URL.Query().Get("status")

	commandStreamStore.RLock()
	items := make([]CommandStream, 0, len(commandStreamStore.streams))
	for _, s := range commandStreamStore.streams {
		if implantFilter != "" && s.ImplantID != implantFilter {
			continue
		}
		if statusFilter != "" && s.Status != statusFilter {
			continue
		}
		items = append(items, s)
	}
	commandStreamStore.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "streams": items, "count": len(items)})
}

// ── Operator sessions ─────────────────────────────────────────────────────────

// OperatorSession tracks a human operator connected to the platform.
// In a multi-user team engagement, this gives command-center operators
// visibility into who is active, what they're viewing, and what they've done.
type OperatorSession struct {
	ID          string `json:"id"`
	UserID      string `json:"userId"`
	Username    string `json:"username"`
	Role        string `json:"role"`        // admin, operator, observer
	ActiveSince string `json:"activeSince"`
	LastAction  string `json:"lastAction"`
	CurrentView string `json:"currentView"` // route/page the operator is on
}

var operatorStore = struct {
	sync.RWMutex
	sessions map[string]OperatorSession
}{
	sessions: make(map[string]OperatorSession),
}

// handleListOperators returns all active operator sessions.
// GET /api/realtime/operators
func handleListOperators(w http.ResponseWriter, r *http.Request) {
	operatorStore.RLock()
	items := make([]OperatorSession, 0, len(operatorStore.sessions))
	for _, op := range operatorStore.sessions {
		items = append(items, op)
	}
	operatorStore.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "operators": items, "count": len(items)})
}

// handleRegisterOperator creates a new operator session. Called when a user
// authenticates and the frontend establishes its SSE connection.
// Identity and role are derived from JWT claims — callers cannot self-assign.
// POST /api/realtime/operators
func handleRegisterOperator(w http.ResponseWriter, r *http.Request) {
	var op OperatorSession
	if err := json.NewDecoder(r.Body).Decode(&op); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	// Extract identity from JWT claims set by authMiddleware — never trust request body.
	ctxUserID, _ := r.Context().Value("userID").(string)
	ctxUsername, _ := r.Context().Value("username").(string)
	ctxRole, _ := r.Context().Value("role").(string)

	if ctxUserID == "" || ctxUsername == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "authentication required"})
		return
	}

	op.UserID = ctxUserID
	op.Username = ctxUsername

	// Default role to "operator" — only allow "admin" if the JWT claims say so.
	if ctxRole == "admin" {
		op.Role = "admin"
	} else {
		op.Role = "operator"
	}

	now := time.Now().UTC().Format(time.RFC3339)
	op.ID = genRTID("op")
	op.ActiveSince = now
	op.LastAction = now

	operatorStore.Lock()
	operatorStore.sessions[op.ID] = op
	operatorStore.Unlock()

	publishEvent(RealtimeEvent{
		Type:    EventTypeOperatorAction,
		Source:  op.ID,
		Target:  "broadcast",
		Channel: "operators",
		Payload: map[string]any{
			"operatorId": op.ID,
			"username":   op.Username,
			"role":       op.Role,
			"action":     "joined",
		},
	})

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "operator": op})
}

// handleOperatorAction logs an action taken by an operator and broadcasts it
// so team members can see concurrent activity in real time. Also updates
// LastAction timestamp and CurrentView on the session record.
// POST /api/realtime/operators/{id}/action
func handleOperatorAction(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body struct {
		Action      string `json:"action"`
		CurrentView string `json:"currentView"`
		Detail      string `json:"detail"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}
	if strings.TrimSpace(body.Action) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "action is required"})
		return
	}

	operatorStore.Lock()
	op, ok := operatorStore.sessions[id]
	if !ok {
		operatorStore.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "operator session not found"})
		return
	}
	op.LastAction = time.Now().UTC().Format(time.RFC3339)
	if body.CurrentView != "" {
		op.CurrentView = body.CurrentView
	}
	operatorStore.sessions[id] = op
	operatorStore.Unlock()

	publishEvent(RealtimeEvent{
		Type:    EventTypeOperatorAction,
		Source:  id,
		Target:  "broadcast",
		Channel: "operators",
		Payload: map[string]any{
			"operatorId": id,
			"username":   op.Username,
			"action":     body.Action,
			"view":       op.CurrentView,
			"detail":     body.Detail,
		},
	})

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleKickOperator removes an operator session and notifies all SSE clients.
// Admin-only in production; access control is enforced at the auth middleware
// layer registered in main.go.
// DELETE /api/realtime/operators/{id}
func handleKickOperator(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	operatorStore.Lock()
	op, ok := operatorStore.sessions[id]
	if !ok {
		operatorStore.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "operator session not found"})
		return
	}
	delete(operatorStore.sessions, id)
	operatorStore.Unlock()

	publishEvent(RealtimeEvent{
		Type:    EventTypeOperatorAction,
		Source:  "system",
		Target:  "broadcast",
		Channel: "operators",
		Payload: map[string]any{
			"operatorId": id,
			"username":   op.Username,
			"action":     "kicked",
		},
	})

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ── Global kill switch ────────────────────────────────────────────────────────

// killSwitchState is the platform-wide emergency stop. When active, all agents
// should cease autonomous operations immediately. The SSE event triggers
// client-side enforcement in the UI and any connected agent processes.
var killSwitchState = struct {
	sync.RWMutex
	active    bool
	activatedAt string
	activatedBy string
}{
	active: false,
}

// handleGetKillSwitch returns the current kill switch state.
// GET /api/realtime/killswitch
func handleGetKillSwitch(w http.ResponseWriter, r *http.Request) {
	killSwitchState.RLock()
	active := killSwitchState.active
	activatedAt := killSwitchState.activatedAt
	activatedBy := killSwitchState.activatedBy
	killSwitchState.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"active":      active,
		"activatedAt": activatedAt,
		"activatedBy": activatedBy,
	})
}

// handleToggleKillSwitch arms or disarms the emergency stop.
// Broadcasts a system_alert to every connected SSE client immediately.
// Route registration uses requireAdmin() so only admin-role JWTs reach here.
// The acting user's identity is taken from JWT context, not the request body.
// POST /api/realtime/killswitch
func handleToggleKillSwitch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Active bool   `json:"active"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	// Extract acting user from JWT context — never trust request body for identity.
	userID, _ := r.Context().Value("userID").(string)

	now := time.Now().UTC().Format(time.RFC3339)

	killSwitchState.Lock()
	killSwitchState.active = body.Active
	if body.Active {
		killSwitchState.activatedAt = now
		killSwitchState.activatedBy = userID
	} else {
		killSwitchState.activatedAt = ""
		killSwitchState.activatedBy = ""
	}
	killSwitchState.Unlock()

	action := "disarmed"
	if body.Active {
		action = "armed"
	}

	// Broadcast to ALL channels — kill switch is platform-wide.
	publishEvent(RealtimeEvent{
		Type:    EventTypeSystemAlert,
		Source:  "system",
		Target:  "broadcast",
		Channel: "", // empty = all channels
		Payload: map[string]any{
			"alert":       "kill_switch",
			"action":      action,
			"active":      body.Active,
			"reason":      body.Reason,
			"activatedBy": userID,
			"timestamp":   now,
		},
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"active": body.Active,
		"action": action,
	})
}
