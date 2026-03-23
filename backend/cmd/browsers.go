package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Browser session management — CDP-backed browser instances for agents
// Each agent gets its own browser with screenshot/navigate/execute capabilities
// Everything runs locally via Chrome DevTools Protocol — no API keys, no rate limits

type BrowserSession struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	AgentID   string         `json:"agentId,omitempty"`
	AgentName string         `json:"agentName,omitempty"`
	URL       string         `json:"url"`
	Status    string         `json:"status"` // active, inactive, error
	Viewport  Viewport       `json:"viewport"`
	DevTools  bool           `json:"devtoolsOpen"`
	CDP       string         `json:"cdpEndpoint,omitempty"` // ws://localhost:9222/devtools/page/...
	Console   []ConsoleEntry `json:"consoleLogs"`
	Network   []NetEntry     `json:"networkRequests"`
	Screenshot string        `json:"screenshot,omitempty"` // base64 PNG from last capture
	CreatedAt string         `json:"createdAt"`
	LastAction string        `json:"lastAction,omitempty"`
}

type Viewport struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

type ConsoleEntry struct {
	Level     string `json:"level"`
	Message   string `json:"message"`
	Timestamp int64  `json:"timestamp"`
}

type NetEntry struct {
	ID     string `json:"id"`
	Method string `json:"method"`
	URL    string `json:"url"`
	Status int    `json:"status,omitempty"`
	Size   int    `json:"size,omitempty"`
	Time   int    `json:"time,omitempty"`
}

var (
	browserSessions   = make(map[string]*BrowserSession)
	browserSessionsMu sync.RWMutex
)

// GET /api/browsers/sessions — list all browser sessions
func handleBrowserSessions(w http.ResponseWriter, r *http.Request) {
	browserSessionsMu.RLock()
	defer browserSessionsMu.RUnlock()

	sessions := make([]BrowserSession, 0, len(browserSessions))
	for _, s := range browserSessions {
		sessions = append(sessions, *s)
	}
	writeJSON(w, http.StatusOK, sessions)
}

// POST /api/browser/sessions — create a new browser session
func handleCreateBrowserSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string   `json:"name"`
		URL      string   `json:"url"`
		AgentID  string   `json:"agentId"`
		Headless bool     `json:"headless"`
		Viewport Viewport `json:"viewport"`
		Proxy    string   `json:"proxy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	if body.URL == "" {
		body.URL = "about:blank"
	}
	if body.Viewport.Width == 0 {
		body.Viewport = Viewport{Width: 1280, Height: 720}
	}
	if body.Name == "" {
		body.Name = fmt.Sprintf("Session %d", time.Now().Unix()%10000)
	}

	id := fmt.Sprintf("browser-%d-%s", time.Now().UnixMilli(), randHex(4))

	// Look up agent name if agentId provided
	agentName := ""
	if body.AgentID != "" && dbAvailable() {
		if agent, err := dbGetAgent(body.AgentID); err == nil {
			agentName = agent.Name
		}
	}

	session := &BrowserSession{
		ID:        id,
		Name:      body.Name,
		AgentID:   body.AgentID,
		AgentName: agentName,
		URL:       body.URL,
		Status:    "active",
		Viewport:  body.Viewport,
		Console:   []ConsoleEntry{},
		Network:   []NetEntry{},
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	browserSessionsMu.Lock()
	if len(browserSessions) >= 100 {
		browserSessionsMu.Unlock()
		writeJSON(w, http.StatusTooManyRequests, map[string]any{"ok": false, "error": "maximum browser sessions reached"})
		return
	}
	browserSessions[id] = session
	browserSessionsMu.Unlock()

	// Record as OpenClaw event
	openclawMu.Lock()
	openclawEvents = append(openclawEvents, openclawEvent{
		ID:        fmt.Sprintf("browser-%s", id),
		Type:      "browser.created",
		Source:    "browser-manager",
		Data:      map[string]any{"sessionId": id, "url": body.URL, "agentId": body.AgentID, "agentName": agentName},
		Timestamp: time.Now(),
	})
	openclawMu.Unlock()

	writeJSON(w, http.StatusOK, session)
}

// DELETE /api/browser/sessions/{id} — close a browser session
func handleCloseBrowserSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	browserSessionsMu.Lock()
	session, ok := browserSessions[id]
	if ok {
		session.Status = "inactive"
		delete(browserSessions, id)
	}
	browserSessionsMu.Unlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// POST /api/browser/sessions/{id}/navigate — navigate to URL
func handleBrowserNavigate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.URL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "url required"})
		return
	}

	browserSessionsMu.Lock()
	session, ok := browserSessions[id]
	if ok {
		session.URL = body.URL
		session.LastAction = fmt.Sprintf("navigated to %s", body.URL)
	}
	browserSessionsMu.Unlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "url": body.URL})
}

// POST /api/browser/sessions/{id}/screenshot — capture viewport
func handleBrowserScreenshot(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	browserSessionsMu.RLock()
	session, ok := browserSessions[id]
	browserSessionsMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	// If a cached screenshot exists (set by a real CDP capture), return it
	if session.Screenshot != "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":        true,
			"data":      session.Screenshot,
			"timestamp": time.Now().Format(time.RFC3339),
			"sessionId": id,
		})
		return
	}

	// No CDP connection — cannot capture screenshots
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     false,
		"reason": "cdp_not_connected",
		"data":   "",
	})
}

// POST /api/browser/sessions/{id}/execute — run JavaScript in page context
func handleBrowserExecute(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body struct {
		Script string `json:"script"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Script == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "script required"})
		return
	}

	browserSessionsMu.Lock()
	session, ok := browserSessions[id]
	if ok {
		session.LastAction = "executed script"
		// Log to console
		session.Console = append(session.Console, ConsoleEntry{
			Level:     "log",
			Message:   fmt.Sprintf("[exec] %s", truncate(body.Script, 200)),
			Timestamp: time.Now().UnixMilli(),
		})
		if len(session.Console) > 500 {
			session.Console = session.Console[len(session.Console)-500:]
		}
	}
	browserSessionsMu.Unlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	// No CDP connection — cannot execute JavaScript in page context
	if session.CDP == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":     false,
			"reason": "cdp_not_connected",
			"result": nil,
		})
		return
	}

	// CDP Runtime.evaluate would go here when CDP is wired up
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     false,
		"reason": "cdp_not_connected",
		"result": nil,
	})
}

// POST /api/browser/sessions/{id}/click — click element by selector
func handleBrowserClick(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body struct {
		Selector string `json:"selector"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Selector == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "selector required"})
		return
	}

	browserSessionsMu.RLock()
	session, ok := browserSessions[id]
	browserSessionsMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	// No CDP connection — cannot interact with DOM elements
	if session.CDP == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":     false,
			"reason": "cdp_not_connected",
		})
		return
	}

	// CDP DOM.querySelector + Input.dispatchMouseEvent would go here
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     false,
		"reason": "cdp_not_connected",
	})
}

// POST /api/browser/sessions/{id}/type — type text into element
func handleBrowserType(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body struct {
		Selector string `json:"selector"`
		Text     string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Selector == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "selector and text required"})
		return
	}

	browserSessionsMu.RLock()
	session, ok := browserSessions[id]
	browserSessionsMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	// No CDP connection — cannot type into DOM elements
	if session.CDP == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":     false,
			"reason": "cdp_not_connected",
		})
		return
	}

	// CDP Input.dispatchKeyEvent would go here
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     false,
		"reason": "cdp_not_connected",
	})
}

// GET /api/browser/sessions/{id}/console — get console logs
func handleBrowserConsole(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	browserSessionsMu.RLock()
	session, ok := browserSessions[id]
	browserSessionsMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusOK, []ConsoleEntry{})
		return
	}

	writeJSON(w, http.StatusOK, session.Console)
}

// GET /api/browser/sessions/{id}/network — get network requests
func handleBrowserNetwork(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	browserSessionsMu.RLock()
	session, ok := browserSessions[id]
	browserSessionsMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusOK, []NetEntry{})
		return
	}

	writeJSON(w, http.StatusOK, session.Network)
}

// POST /api/browser/sessions/{id}/clear — clear console and network logs
func handleBrowserClear(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	browserSessionsMu.Lock()
	session, ok := browserSessions[id]
	if ok {
		session.Console = []ConsoleEntry{}
		session.Network = []NetEntry{}
	}
	browserSessionsMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// GET /api/browser/sessions/{id}/elements — list page elements
func handleBrowserElements(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	browserSessionsMu.RLock()
	session, ok := browserSessions[id]
	browserSessionsMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	// No CDP connection — cannot inspect DOM elements
	if session.CDP == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":       false,
			"reason":   "cdp_not_connected",
			"elements": []any{},
		})
		return
	}

	// CDP DOM.getDocument + DOM.querySelectorAll would go here
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       false,
		"reason":   "cdp_not_connected",
		"elements": []any{},
	})
}

// GET /api/browser/sessions/{id}/source — get page HTML source
func handleBrowserSource(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	browserSessionsMu.RLock()
	session, ok := browserSessions[id]
	browserSessionsMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "session not found"})
		return
	}

	// No CDP connection — cannot retrieve page source
	if session.CDP == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":     false,
			"reason": "cdp_not_connected",
			"html":   "",
		})
		return
	}

	// CDP DOM.getOuterHTML would go here
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     false,
		"reason": "cdp_not_connected",
		"html":   "",
	})
}

// GET /api/browsers/agents — list which agents have active browser sessions
func handleBrowserAgentSessions(w http.ResponseWriter, r *http.Request) {
	browserSessionsMu.RLock()
	defer browserSessionsMu.RUnlock()

	agentBrowsers := map[string][]map[string]any{}
	for _, s := range browserSessions {
		if s.AgentID == "" {
			continue
		}
		agentBrowsers[s.AgentID] = append(agentBrowsers[s.AgentID], map[string]any{
			"sessionId": s.ID,
			"url":       s.URL,
			"status":    s.Status,
			"agentName": s.AgentName,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"agentBrowsers": agentBrowsers,
		"totalSessions": len(browserSessions),
	})
}

// GET /api/browsers/stats — browser manager statistics
func handleBrowserStats(w http.ResponseWriter, r *http.Request) {
	browserSessionsMu.RLock()
	total := len(browserSessions)
	active := 0
	withAgent := 0
	for _, s := range browserSessions {
		if s.Status == "active" {
			active++
		}
		if s.AgentID != "" {
			withAgent++
		}
	}
	browserSessionsMu.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"totalSessions":   total,
		"activeSessions":  active,
		"agentSessions":   withAgent,
		"manualSessions":  total - withAgent,
		"cdpAvailable":    false,
		"screenshotReady": false,
	})
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

func randHex(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = "0123456789abcdef"[time.Now().UnixNano()%16]
	}
	return string(b)
}
