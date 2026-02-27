package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

// ── Types ────────────────────────────────────────────────────────────────────

type ChatMessage struct {
	ID        string                   `json:"id"`
	Role      string                   `json:"role"` // user, assistant, system, tool
	Content   string                   `json:"content"`
	Timestamp string                   `json:"timestamp"`
	AgentID   string                   `json:"agentId,omitempty"`
	ToolCalls []map[string]interface{} `json:"toolCalls,omitempty"`
}

type ChatSession struct {
	ID        string        `json:"id"`
	Title     string        `json:"title"`
	AgentID   string        `json:"agentId,omitempty"`
	Messages  []ChatMessage `json:"messages"`
	CreatedAt string        `json:"createdAt"`
	UpdatedAt string        `json:"updatedAt"`
}

// ── In-memory store ──────────────────────────────────────────────────────────

var chatStore = struct {
	sync.RWMutex
	sessions map[string]*ChatSession
}{sessions: make(map[string]*ChatSession)}

// ── Handlers ─────────────────────────────────────────────────────────────────

// GET /api/chat/sessions — list all sessions (without full messages)
func handleListChatSessions(w http.ResponseWriter, r *http.Request) {
	chatStore.RLock()
	defer chatStore.RUnlock()

	sessions := make([]map[string]interface{}, 0, len(chatStore.sessions))
	for _, s := range chatStore.sessions {
		sessions = append(sessions, map[string]interface{}{
			"id":           s.ID,
			"title":        s.Title,
			"agentId":      s.AgentID,
			"messageCount": len(s.Messages),
			"createdAt":    s.CreatedAt,
			"updatedAt":    s.UpdatedAt,
		})
	}

	// Sort by updatedAt descending
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i]["updatedAt"].(string) > sessions[j]["updatedAt"].(string)
	})

	writeJSON(w, http.StatusOK, sessions)
}

// POST /api/chat/sessions — create a new session
func handleCreateChatSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AgentID string `json:"agentId"`
		Title   string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	session := &ChatSession{
		ID:        fmt.Sprintf("chat-%d", time.Now().UnixMilli()),
		Title:     body.Title,
		AgentID:   body.AgentID,
		Messages:  []ChatMessage{},
		CreatedAt: now,
		UpdatedAt: now,
	}

	if session.Title == "" {
		session.Title = "New Chat"
		if body.AgentID != "" {
			session.Title = fmt.Sprintf("Chat with %s", body.AgentID)
		}
	}

	chatStore.Lock()
	chatStore.sessions[session.ID] = session
	chatStore.Unlock()

	writeJSON(w, http.StatusCreated, session)
}

// GET /api/chat/sessions/{id} — get session with messages
func handleGetChatSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "missing session id"})
		return
	}

	chatStore.RLock()
	session, ok := chatStore.sessions[id]
	chatStore.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	writeJSON(w, http.StatusOK, session)
}

// DELETE /api/chat/sessions/{id} — delete a session
func handleDeleteChatSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "missing session id"})
		return
	}

	chatStore.Lock()
	delete(chatStore.sessions, id)
	chatStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// POST /api/chat/sessions/{id}/clear — clear messages from session
func handleClearChatSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "missing session id"})
		return
	}

	chatStore.Lock()
	session, ok := chatStore.sessions[id]
	if ok {
		session.Messages = []ChatMessage{}
		session.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	chatStore.Unlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// POST /api/chat/message — send message (non-streaming)
func handleChatMessage(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Content   string `json:"content"`
		AgentID   string `json:"agentId"`
		SessionID string `json:"sessionId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	if strings.TrimSpace(body.Content) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "empty message"})
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)

	// Ensure session exists
	chatStore.Lock()
	session, ok := chatStore.sessions[body.SessionID]
	if !ok {
		// Auto-create session
		session = &ChatSession{
			ID:        body.SessionID,
			Title:     "Chat",
			AgentID:   body.AgentID,
			Messages:  []ChatMessage{},
			CreatedAt: now,
			UpdatedAt: now,
		}
		if session.ID == "" {
			session.ID = fmt.Sprintf("chat-%d", time.Now().UnixMilli())
		}
		chatStore.sessions[session.ID] = session
	}

	// Add user message
	userMsg := ChatMessage{
		ID:        fmt.Sprintf("msg-%d", time.Now().UnixNano()),
		Role:      "user",
		Content:   body.Content,
		Timestamp: now,
		AgentID:   body.AgentID,
	}
	session.Messages = append(session.Messages, userMsg)

	// Generate assistant response (echo agent context for now; real LLM proxy can be added)
	agentName := body.AgentID
	if agentName == "" {
		agentName = "HARBINGER"
	}
	responseContent := generateAgentResponse(agentName, body.Content)

	assistantMsg := ChatMessage{
		ID:        fmt.Sprintf("msg-%d", time.Now().UnixNano()+1),
		Role:      "assistant",
		Content:   responseContent,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		AgentID:   body.AgentID,
	}
	session.Messages = append(session.Messages, assistantMsg)
	session.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Cap messages per session
	if len(session.Messages) > 500 {
		session.Messages = session.Messages[len(session.Messages)-500:]
	}

	chatStore.Unlock()

	writeJSON(w, http.StatusOK, assistantMsg)
}

// POST /api/chat/stream — send message with SSE streaming
func handleChatStream(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Content   string `json:"content"`
		AgentID   string `json:"agentId"`
		SessionID string `json:"sessionId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(body.Content) == "" {
		http.Error(w, "empty message", http.StatusBadRequest)
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)

	// Store user message
	chatStore.Lock()
	session, ok := chatStore.sessions[body.SessionID]
	if !ok {
		session = &ChatSession{
			ID:        body.SessionID,
			Title:     "Chat",
			AgentID:   body.AgentID,
			Messages:  []ChatMessage{},
			CreatedAt: now,
			UpdatedAt: now,
		}
		if session.ID == "" {
			session.ID = fmt.Sprintf("chat-%d", time.Now().UnixMilli())
		}
		chatStore.sessions[session.ID] = session
	}

	userMsg := ChatMessage{
		ID:        fmt.Sprintf("msg-%d", time.Now().UnixNano()),
		Role:      "user",
		Content:   body.Content,
		Timestamp: now,
		AgentID:   body.AgentID,
	}
	session.Messages = append(session.Messages, userMsg)
	chatStore.Unlock()

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	// Generate response and stream word-by-word
	agentName := body.AgentID
	if agentName == "" {
		agentName = "HARBINGER"
	}
	fullResponse := generateAgentResponse(agentName, body.Content)
	words := strings.Fields(fullResponse)

	var streamed strings.Builder
	for i, word := range words {
		if i > 0 {
			streamed.WriteString(" ")
		}
		streamed.WriteString(word)

		chunk := word
		if i > 0 {
			chunk = " " + word
		}
		data, _ := json.Marshal(map[string]string{"content": chunk})
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()

		// Simulate token delay (20-50ms per word for natural feel)
		time.Sleep(25 * time.Millisecond)
	}

	// Store the assistant message
	chatStore.Lock()
	session, ok = chatStore.sessions[body.SessionID]
	if ok {
		assistantMsg := ChatMessage{
			ID:        fmt.Sprintf("msg-%d", time.Now().UnixNano()),
			Role:      "assistant",
			Content:   streamed.String(),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			AgentID:   body.AgentID,
		}
		session.Messages = append(session.Messages, assistantMsg)
		session.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

		if len(session.Messages) > 500 {
			session.Messages = session.Messages[len(session.Messages)-500:]
		}
	}
	chatStore.Unlock()

	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
}

// ── Response generation ──────────────────────────────────────────────────────
// Produces context-aware agent responses. When a real LLM proxy (model router)
// is wired up, replace this function body with the model call.

func generateAgentResponse(agentName, userMessage string) string {
	upper := strings.ToUpper(agentName)
	msg := strings.ToLower(userMessage)

	// Agent-specific responses based on personality
	switch {
	case strings.Contains(upper, "PATHFINDER") || strings.Contains(upper, "RECON"):
		if strings.Contains(msg, "scan") || strings.Contains(msg, "recon") {
			return fmt.Sprintf("[PATHFINDER] Initiating reconnaissance pipeline for target. Running subfinder → dnsx → httpx → naabu → nuclei. Use the Scope Manager to define target boundaries before I begin. Results will populate the Dashboard.")
		}
		return fmt.Sprintf("[PATHFINDER] Ready for reconnaissance operations. I can enumerate subdomains, probe live hosts, scan ports, and run initial vulnerability detection. What target should I focus on?")

	case strings.Contains(upper, "BREACH") || strings.Contains(upper, "WEB"):
		if strings.Contains(msg, "vuln") || strings.Contains(msg, "exploit") || strings.Contains(msg, "xss") || strings.Contains(msg, "sql") {
			return fmt.Sprintf("[BREACH] Analyzing attack vectors. I'll run nuclei (critical/high severity), check for XSS with dalfox, test SQL injection points with sqlmap, and fuzz directories with ffuf. Share the target URLs from PATHFINDER's recon output.")
		}
		return fmt.Sprintf("[BREACH] Web application hacking agent online. I specialize in nuclei scans, XSS detection, SQL injection, directory fuzzing, and API vulnerability assessment. What targets are ready for testing?")

	case strings.Contains(upper, "PHANTOM") || strings.Contains(upper, "CLOUD"):
		return fmt.Sprintf("[PHANTOM] Cloud infiltration agent standing by. I can audit AWS/GCP/Azure configurations using ScoutSuite and Prowler, test IAM policies with Pacu, and identify exposed cloud assets. Which cloud environment should I assess?")

	case strings.Contains(upper, "SPECTER") || strings.Contains(upper, "OSINT"):
		return fmt.Sprintf("[SPECTER] OSINT detective engaged. I can run theHarvester for email/domain enumeration, Sherlock for username profiling, and SpiderFoot for comprehensive intelligence gathering. What entity should I investigate?")

	case strings.Contains(upper, "CIPHER") || strings.Contains(upper, "BINARY"):
		return fmt.Sprintf("[CIPHER] Binary reverse engineering and crypto analysis ready. I can analyze binaries with Ghidra/radare2, audit TLS configurations with testssl.sh, and test JWT implementations. What artifact should I examine?")

	case strings.Contains(upper, "SCRIBE") || strings.Contains(upper, "REPORT"):
		return fmt.Sprintf("[SCRIBE] Report writer activated. I can generate vulnerability reports in Markdown or PDF, create executive summaries, and format findings for bug bounty platforms (HackerOne, Bugcrowd). What findings should I document?")

	case strings.Contains(upper, "SAM") || strings.Contains(upper, "CODING"):
		return fmt.Sprintf("[SAM] Coding assistant ready. I can write exploits, create automation scripts, refactor security tooling, and help with code review. What code task do you need help with?")

	case strings.Contains(upper, "BRIEF") || strings.Contains(upper, "MORNING"):
		return fmt.Sprintf("[BRIEF] Morning briefing ready. I aggregate overnight scan results, new CVE disclosures, scope changes, and agent activity into a concise daily summary. Shall I generate today's brief?")

	case strings.Contains(upper, "SAGE") || strings.Contains(upper, "LEARN"):
		return fmt.Sprintf("[SAGE] Learning agent online. I can explain vulnerabilities, walk through exploitation techniques, provide training resources, and help you understand security concepts. What would you like to learn about?")

	case strings.Contains(upper, "LENS") || strings.Contains(upper, "BROWSER"):
		return fmt.Sprintf("[LENS] Browser automation agent ready. I control headless Chrome via CDP for authenticated testing, JavaScript execution, screenshot capture, and DOM interaction. What web target should I navigate to?")

	case strings.Contains(upper, "MAINTAINER"):
		return fmt.Sprintf("[MAINTAINER] DevOps and code health agent online. I monitor codebase health, run nightly maintenance, track dependency updates, and manage CI/CD pipelines. What maintenance task do you need?")

	default:
		if strings.Contains(msg, "help") || strings.Contains(msg, "what can") {
			return fmt.Sprintf("[%s] I'm part of the Harbinger agent swarm. You can ask me to scan targets, analyze vulnerabilities, generate reports, or automate security workflows. Use the Command Center for multi-agent orchestration.", upper)
		}
		return fmt.Sprintf("[%s] Acknowledged. Processing your request. Use the Command Center to coordinate with other agents or check the Dashboard for current operation status.", upper)
	}
}
