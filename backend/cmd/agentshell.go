package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Haribinger/Harbinger/backend/pkg/executor"
)

// ============================================================================
// AGENT SHELL — Interactive shell sessions into agent Docker containers.
//
// Lets operators attach to a running agent's container, stream stdout/stderr
// via SSE, and inject manual commands. Each session is tracked with a terminal
// log ring buffer that persists to the DB when available.
//
// This is the backend for "harbinger agent attach PATHFINDER" (T5 terminal).
// ============================================================================

// ── Types ───────────────────────────────────────────────────────────────────

// ShellSession represents an active interactive shell attached to an agent container.
type ShellSession struct {
	ID          string `json:"id"`
	AgentID     string `json:"agent_id"`
	AgentName   string `json:"agent_name"` // codename like PATHFINDER
	ContainerID string `json:"container_id"`
	UserID      string `json:"user_id"`
	Status      string `json:"status"` // active, closed
	CreatedAt   string `json:"created_at"`
	LastCommand string `json:"last_command,omitempty"`
	CommandCount int   `json:"command_count"`
}

// TerminalLogEntry records a single command + output pair.
type TerminalLogEntry struct {
	ID        string `json:"id"`
	SessionID string `json:"session_id"`
	Stream    string `json:"stream"`  // "stdin", "stdout", "stderr"
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

// ── In-memory stores ────────────────────────────────────────────────────────

var shellSessions = struct {
	sync.RWMutex
	m map[string]*ShellSession
}{m: make(map[string]*ShellSession)}

// Per-session terminal log ring buffer (max 500 entries per session).
var shellLogs = struct {
	sync.RWMutex
	m map[string][]TerminalLogEntry // sessionID -> entries
}{m: make(map[string][]TerminalLogEntry)}

const maxShellLogEntries = 500

// ── Agent codename → container resolution ───────────────────────────────────

// resolveAgentContainer finds the Docker container ID for an agent, accepting
// either an agent ID or a codename (case-insensitive).
func resolveAgentContainer(agentRef string) (agentID, agentName, containerID string, err error) {
	upper := strings.ToUpper(agentRef)

	// Codename map: PATHFINDER → recon-scout, BREACH → web-hacker, etc.
	codenameToDir := map[string]string{
		"PATHFINDER": "recon-scout",
		"BREACH":     "web-hacker",
		"PHANTOM":    "cloud-infiltrator",
		"SPECTER":    "osint-detective",
		"CIPHER":     "binary-reverser",
		"SCRIBE":     "report-writer",
		"SAM":        "coding-assistant",
		"BRIEF":      "morning-brief",
		"SAGE":       "learning-agent",
		"LENS":       "browser-agent",
		"MAINTAINER": "maintainer",
	}

	// Try codename first
	if dir, ok := codenameToDir[upper]; ok {
		agentName = upper
		agentID = dir
	} else {
		// Try as direct agent ID
		agentID = agentRef
		// Reverse lookup for display name
		for name, d := range codenameToDir {
			if d == agentRef {
				agentName = name
				break
			}
		}
		if agentName == "" {
			agentName = agentRef
		}
	}

	// Look up the running container for this agent
	agentContainers.RLock()
	cid, ok := agentContainers.m[agentID]
	agentContainers.RUnlock()

	if !ok || cid == "" {
		return "", "", "", fmt.Errorf("no running container for agent %s (%s)", agentName, agentID)
	}

	return agentID, agentName, cid, nil
}

// ── Shell log helpers ───────────────────────────────────────────────────────

func appendShellLog(sessionID, stream, content string) {
	entry := TerminalLogEntry{
		ID:        genRTID("log"),
		SessionID: sessionID,
		Stream:    stream,
		Content:   content,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
	}

	shellLogs.Lock()
	logs := shellLogs.m[sessionID]
	logs = append(logs, entry)
	if len(logs) > maxShellLogEntries {
		logs = logs[len(logs)-maxShellLogEntries:]
	}
	shellLogs.m[sessionID] = logs
	shellLogs.Unlock()

	// Persist to DB if available
	if dbAvailable() {
		dbStoreTerminalLog(entry)
	}
}

func dbStoreTerminalLog(entry TerminalLogEntry) {
	if db == nil {
		return
	}
	_, err := db.Exec(`
		INSERT INTO terminal_logs (stream, content, container_id, mission_id, task_id)
		VALUES ($1, $2, $3, 0, NULL)
	`, entry.Stream, entry.Content, entry.SessionID)
	if err != nil {
		log.Printf("[ShellLog] DB insert failed: %v", err)
	}
}

// ── Handlers ────────────────────────────────────────────────────────────────

// handleShellAttach creates a new shell session for an agent.
// POST /api/shell/attach
// Body: {"agent": "PATHFINDER"} or {"agent": "recon-scout"}
func handleShellAttach(w http.ResponseWriter, r *http.Request) {
	if execEngine == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req struct {
		Agent string `json:"agent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if req.Agent == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "agent is required"})
		return
	}

	agentID, agentName, containerID, err := resolveAgentContainer(req.Agent)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	userID, _ := getUserIDFromContext(r.Context())

	session := &ShellSession{
		ID:          genRTID("shell"),
		AgentID:     agentID,
		AgentName:   agentName,
		ContainerID: containerID,
		UserID:      userID,
		Status:      "active",
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
	}

	shellSessions.Lock()
	shellSessions.m[session.ID] = session
	shellSessions.Unlock()

	// Initialize log buffer
	shellLogs.Lock()
	shellLogs.m[session.ID] = make([]TerminalLogEntry, 0, 64)
	shellLogs.Unlock()

	// Publish attach event
	publishEvent(RealtimeEvent{
		Type:    EventTypeOperatorAction,
		Source:  userID,
		Target:  agentID,
		Channel: "shell",
		Payload: map[string]any{
			"action":     "shell_attach",
			"session_id": session.ID,
			"agent":      agentName,
		},
	})

	log.Printf("[Shell] Session %s attached to %s (container %s)", session.ID, agentName, containerID[:12])

	writeJSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"session": session,
	})
}

// handleShellExec runs a command in the agent's container and streams output via SSE.
// POST /api/shell/{id}/exec
// Body: {"command": "nuclei -u https://example.com"}
func handleShellExec(w http.ResponseWriter, r *http.Request) {
	if execEngine == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	sessionID := r.PathValue("id")

	shellSessions.RLock()
	session, ok := shellSessions.m[sessionID]
	shellSessions.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	if session.Status != "active" {
		writeJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": "session is closed"})
		return
	}

	var req struct {
		Command string `json:"command"`
		Workdir string `json:"workdir"`
		Timeout int    `json:"timeout"` // seconds, 0 = default 300s
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if req.Command == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "command is required"})
		return
	}

	timeout := time.Duration(req.Timeout) * time.Second
	if timeout <= 0 || timeout > 20*time.Minute {
		timeout = 5 * time.Minute
	}

	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()

	// Log the command as stdin
	appendShellLog(sessionID, "stdin", req.Command)

	// Update session state
	shellSessions.Lock()
	session.LastCommand = req.Command
	session.CommandCount++
	shellSessions.Unlock()

	workdir := req.Workdir
	if workdir == "" {
		workdir = "/work"
	}

	// Start streaming exec
	chunks, execID, err := execEngine.ExecStream(ctx, session.ContainerID, executor.ExecRequest{
		Command: []string{"sh", "-c", req.Command},
		WorkDir: workdir,
	})
	if err != nil {
		internalError(w, "shell exec", err)
		return
	}

	// Set SSE headers
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "streaming not supported"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	// Stream chunks as SSE events
	for chunk := range chunks {
		appendShellLog(sessionID, chunk.Stream, chunk.Data)

		// Publish to realtime hub so T2 (Agent Watch) can see it
		publishEvent(RealtimeEvent{
			Type:    EventTypeCommandOutput,
			Source:  session.AgentID,
			Target:  "broadcast",
			Channel: "shell:" + sessionID,
			Payload: map[string]any{
				"session_id": sessionID,
				"stream":     chunk.Stream,
				"data":       chunk.Data,
			},
		})

		data, _ := json.Marshal(map[string]any{
			"stream": chunk.Stream,
			"data":   chunk.Data,
			"ts":     chunk.Timestamp.Format(time.RFC3339Nano),
		})
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	// Get exit code
	exitCode := -1
	if execID != "" {
		code, err := execEngine.ExecInspect(ctx, execID)
		if err == nil {
			exitCode = code
		}
	}

	// Send completion event
	doneData, _ := json.Marshal(map[string]any{
		"type":      "done",
		"exit_code": exitCode,
	})
	fmt.Fprintf(w, "data: %s\n\n", doneData)
	flusher.Flush()
}

// handleShellStream opens a read-only SSE connection for a session's output.
// GET /api/shell/{id}/stream
// Useful for secondary terminals watching the same session.
func handleShellStream(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")

	shellSessions.RLock()
	session, ok := shellSessions.m[sessionID]
	shellSessions.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "streaming not supported"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	// Subscribe to the realtime hub for this session's channel
	client := &SSEClient{
		ID:      genRTID("shellwatch"),
		UserID:  session.UserID,
		Channel: "shell:" + sessionID,
		Events:  make(chan RealtimeEvent, 64),
		Done:    make(chan struct{}),
	}

	realtimeHub.Lock()
	realtimeHub.clients[client.ID] = client
	realtimeHub.Unlock()

	defer func() {
		realtimeHub.Lock()
		delete(realtimeHub.clients, client.ID)
		realtimeHub.Unlock()
	}()

	// Replay recent logs first
	shellLogs.RLock()
	logs := shellLogs.m[sessionID]
	shellLogs.RUnlock()

	for _, entry := range logs {
		data, _ := json.Marshal(map[string]any{
			"stream": entry.Stream,
			"data":   entry.Content,
			"ts":     entry.Timestamp,
			"replay": true,
		})
		fmt.Fprintf(w, "data: %s\n\n", data)
	}
	flusher.Flush()

	// Stream live events
	for {
		select {
		case event := <-client.Events:
			data, _ := json.Marshal(event.Payload)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		case <-r.Context().Done():
			return
		case <-client.Done:
			return
		}
	}
}

// handleListShellSessions returns all active shell sessions.
// GET /api/shell/sessions
func handleListShellSessions(w http.ResponseWriter, r *http.Request) {
	shellSessions.RLock()
	sessions := make([]*ShellSession, 0, len(shellSessions.m))
	for _, s := range shellSessions.m {
		sessions = append(sessions, s)
	}
	shellSessions.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "sessions": sessions})
}

// handleGetShellSession returns a single session with its recent log.
// GET /api/shell/{id}
func handleGetShellSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")

	shellSessions.RLock()
	session, ok := shellSessions.m[sessionID]
	shellSessions.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	shellLogs.RLock()
	logs := shellLogs.m[sessionID]
	shellLogs.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"session": session,
		"logs":    logs,
	})
}

// handleCloseShellSession closes a shell session.
// DELETE /api/shell/{id}
func handleCloseShellSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")

	shellSessions.Lock()
	session, ok := shellSessions.m[sessionID]
	if ok {
		session.Status = "closed"
	}
	shellSessions.Unlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	userID, _ := getUserIDFromContext(r.Context())
	publishEvent(RealtimeEvent{
		Type:    EventTypeOperatorAction,
		Source:  userID,
		Target:  session.AgentID,
		Channel: "shell",
		Payload: map[string]any{
			"action":     "shell_close",
			"session_id": sessionID,
			"agent":      session.AgentName,
		},
	})

	log.Printf("[Shell] Session %s closed (%s, %d commands)", sessionID, session.AgentName, session.CommandCount)

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "session closed"})
}

// handleShellHistory returns the terminal log for a session.
// GET /api/shell/{id}/history
func handleShellHistory(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")

	shellLogs.RLock()
	logs, ok := shellLogs.m[sessionID]
	shellLogs.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "logs": logs})
}
