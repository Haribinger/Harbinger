package main

import (
	"bytes"
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
	// Cap max sessions at 1000
	if len(chatStore.sessions) >= 1000 {
		// Evict oldest session
		var oldestID string
		var oldestTime string
		for id, s := range chatStore.sessions {
			if oldestID == "" || s.CreatedAt < oldestTime {
				oldestTime = s.CreatedAt
				oldestID = id
			}
		}
		if oldestID != "" {
			delete(chatStore.sessions, oldestID)
		}
	}
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
		// Cap max sessions at 1000
		if len(chatStore.sessions) >= 1000 {
			var oldestID string
			var oldestTime string
			for id, s := range chatStore.sessions {
				if oldestID == "" || s.CreatedAt < oldestTime {
					oldestTime = s.CreatedAt
					oldestID = id
				}
			}
			if oldestID != "" {
				delete(chatStore.sessions, oldestID)
			}
		}
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
		// Cap max sessions at 1000
		if len(chatStore.sessions) >= 1000 {
			var oldestID string
			var oldestTime string
			for id, s := range chatStore.sessions {
				if oldestID == "" || s.CreatedAt < oldestTime {
					oldestTime = s.CreatedAt
					oldestID = id
				}
			}
			if oldestID != "" {
				delete(chatStore.sessions, oldestID)
			}
		}
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

		// Pacing delay between SSE chunks to match typical LLM token-streaming cadence
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
// generateAgentResponse tries to call a real LLM via the configured provider
// (Ollama by default, or any provider configured via model router).
// Falls back to a capability summary if no LLM is reachable.

func generateAgentResponse(agentName, userMessage string) string {
	upper := strings.ToUpper(agentName)

	// Try real LLM call first
	if resp, err := callLLM(agentName, userMessage); err == nil && resp != "" {
		return fmt.Sprintf("[%s] %s", upper, resp)
	}

	// Fallback: return agent capability summary so the user knows what the agent can do
	return agentFallbackResponse(upper, strings.ToLower(userMessage))
}

// callLLM attempts to generate a response via Ollama (local) or the configured provider.
// Returns empty string and error if no LLM is available — caller should use fallback.
func callLLM(agentName, userMessage string) (string, error) {
	// Resolve model from router
	modelRouter.RLock()
	provider := modelRouter.config.DefaultProvider
	model := "llama3"
	for _, route := range modelRouter.routes {
		if route.TaskType == "simple" {
			provider = route.DefaultProvider
			model = route.Model
			break
		}
	}
	modelRouter.RUnlock()

	// Build system prompt from agent personality
	systemPrompt := fmt.Sprintf("You are %s, a specialized security agent in the Harbinger offensive security platform. Respond concisely and technically. Stay in character.", agentName)

	switch provider {
	case "ollama":
		ollamaURL := getEnv("OLLAMA_URL", "http://localhost:11434")
		return callOllama(ollamaURL, model, systemPrompt, userMessage)
	case "openai":
		apiKey := getEnv("OPENAI_API_KEY", "")
		if apiKey == "" {
			return "", fmt.Errorf("OPENAI_API_KEY not set")
		}
		return callOpenAICompatible("https://api.openai.com/v1", apiKey, model, systemPrompt, userMessage)
	case "anthropic":
		apiKey := getEnv("ANTHROPIC_API_KEY", "")
		if apiKey == "" {
			return "", fmt.Errorf("ANTHROPIC_API_KEY not set")
		}
		return callAnthropic(apiKey, model, systemPrompt, userMessage)
	default:
		return "", fmt.Errorf("provider %s not supported for chat", provider)
	}
}

func callOllama(baseURL, model, systemPrompt, userMessage string) (string, error) {
	reqBody, _ := json.Marshal(map[string]any{
		"model":  model,
		"stream": false,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userMessage},
		},
	})
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Post(baseURL+"/api/chat", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("ollama unreachable: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ollama returned %d", resp.StatusCode)
	}
	var result struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode ollama response: %w", err)
	}
	return result.Message.Content, nil
}

func callOpenAICompatible(baseURL, apiKey, model, systemPrompt, userMessage string) (string, error) {
	reqBody, _ := json.Marshal(map[string]any{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userMessage},
		},
		"max_tokens": 1024,
	})
	req, _ := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("openai unreachable: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openai returned %d", resp.StatusCode)
	}
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode openai response: %w", err)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}
	return result.Choices[0].Message.Content, nil
}

func callAnthropic(apiKey, model, systemPrompt, userMessage string) (string, error) {
	reqBody, _ := json.Marshal(map[string]any{
		"model":      model,
		"max_tokens": 1024,
		"system":     systemPrompt,
		"messages": []map[string]string{
			{"role": "user", "content": userMessage},
		},
	})
	req, _ := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("anthropic unreachable: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("anthropic returned %d", resp.StatusCode)
	}
	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode anthropic response: %w", err)
	}
	if len(result.Content) == 0 {
		return "", fmt.Errorf("no content in response")
	}
	return result.Content[0].Text, nil
}

// agentFallbackResponse returns a capability summary when no LLM is available
func agentFallbackResponse(upper, msg string) string {
	switch {
	case strings.Contains(upper, "PATHFINDER") || strings.Contains(upper, "RECON"):
		return fmt.Sprintf("[PATHFINDER] Ready for reconnaissance. I run subfinder, httpx, naabu, and nuclei. Configure an LLM provider in Settings for intelligent responses, or define a target in the Scope Manager to begin scanning.")
	case strings.Contains(upper, "BREACH") || strings.Contains(upper, "WEB"):
		return fmt.Sprintf("[BREACH] Web hacking agent online. I specialize in nuclei, dalfox, sqlmap, and ffuf. No LLM configured — set one in Settings > Model Router for intelligent analysis.")
	case strings.Contains(upper, "PHANTOM") || strings.Contains(upper, "CLOUD"):
		return fmt.Sprintf("[PHANTOM] Cloud infiltration agent. I audit AWS/GCP/Azure with ScoutSuite and Prowler. Configure an LLM in Settings for intelligent cloud security analysis.")
	case strings.Contains(upper, "SCRIBE") || strings.Contains(upper, "REPORT"):
		return fmt.Sprintf("[SCRIBE] Report writer. I generate vulnerability reports in Markdown/PDF. Configure an LLM in Settings for AI-powered report generation.")
	case strings.Contains(upper, "SAM") || strings.Contains(upper, "CODING"):
		return fmt.Sprintf("[SAM] Coding assistant. Configure an LLM provider (Ollama is free and local) in Settings > Model Router to enable AI-powered code generation and analysis.")
	default:
		return fmt.Sprintf("[%s] Agent online. No LLM provider configured — set one in Settings > Model Router (Ollama is free and runs locally). I can still execute tools via the Command Center.", upper)
	}
}
