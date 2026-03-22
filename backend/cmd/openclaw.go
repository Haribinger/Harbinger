package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ---- OpenClaw Integration ----

// Tracks OpenClaw gateway connection state
var (
	openclawMu        sync.RWMutex
	openclawConnected bool
	openclawLastPing  time.Time
	openclawGateway   string // e.g. "http://localhost:3007"
	openclawEvents    []openclawEvent
)

type openclawEvent struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Source    string    `json:"source"`
	Data      any       `json:"data"`
	Timestamp time.Time `json:"timestamp"`
}

type openclawSkillMeta struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Agent       string `json:"agent"`
	File        string `json:"file"`
}

// handleOpenClawStatus returns the current OpenClaw connection state + stats
func handleOpenClawStatus(w http.ResponseWriter, r *http.Request) {
	openclawMu.RLock()
	connected := openclawConnected
	lastPing := openclawLastPing
	gateway := openclawGateway
	eventCount := len(openclawEvents)
	openclawMu.RUnlock()

	// Count running agents
	agentContainers.RLock()
	runningAgents := len(agentContainers.m)
	agentContainers.RUnlock()

	// Get agent count from DB or fallback
	totalAgents := 0
	if dbAvailable() {
		agents, err := dbListAgents()
		if err == nil {
			totalAgents = len(agents)
		}
	}

	// Count skills
	skills := listOpenClawSkills()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"connected":       connected,
		"gateway":         gateway,
		"last_ping":       lastPing,
		"agents_total":    totalAgents,
		"agents_running":  runningAgents,
		"skills_count":    len(skills),
		"events_received": eventCount,
		"features": map[string]bool{
			"voice":            true,
			"multi_agent":      true,
			"webhooks":         true,
			"skills":           true,
			"orchestration":    true,
			"browser_use":      true,
			"visual_feeds":     true,
			"cdp_screenshots":  true,
			"agent_browsers":   true,
			"local_ai":         true,
			"channel_awareness": true,
		},
		"systems": map[string]any{
			"browser_manager": map[string]any{
				"description":   "CDP-powered browser control — every agent has eyes",
				"endpoints":     []string{"/api/browsers/sessions", "/api/browsers/agents", "/api/browsers/stats"},
				"capabilities":  []string{"navigate", "screenshot", "execute_js", "click", "type", "console_logs", "network_inspector"},
				"visual_feeds":  true,
				"no_api_keys":   true,
				"unlimited":     true,
			},
			"visual_workflows": map[string]any{
				"description":   "n8n-style visual workflow editor built natively with @xyflow/react",
				"editor":        "/workflows/editor",
				"node_types":    []string{"tool", "agent", "decision", "trigger", "data_transform"},
			},
			"channel_system": map[string]any{
				"description":   "Cross-channel agent coordination — Discord, Telegram, Slack, WebChat",
				"agent_bus":     "/api/agents/broadcast",
				"shared_context": "/api/agents/context",
				"relay":         "/api/channels/relay",
			},
			"local_ai": map[string]any{
				"description":   "Local-first AI — Ollama, LM Studio, GPT4All — all free, no API keys",
				"providers":     []string{"ollama", "lmstudio", "gpt4all"},
				"ollama_url":    getEnv("OLLAMA_URL", "http://localhost:11434"),
				"lmstudio_url":  getEnv("LMSTUDIO_URL", "http://localhost:1234/v1"),
				"gpt4all_url":   getEnv("GPT4ALL_URL", "http://localhost:4891/v1"),
			},
			"mcp_plugins": map[string]any{
				"hexstrike":  "/mcp/hexstrike",
				"pentagi":    "/mcp/pentagi",
				"redteam":    "/mcp/redteam",
				"mcp_ui":     "/mcp/ui",
			},
		},
		"endpoints": map[string]string{
			"status":          "/api/openclaw/status",
			"webhook":         "/api/openclaw/webhook",
			"command":         "/api/openclaw/command",
			"skills":          "/api/openclaw/skills",
			"connect":         "/api/openclaw/connect",
			"events":          "/api/openclaw/events",
			"browsers":        "/api/browsers/sessions",
			"browser_agents":  "/api/browsers/agents",
			"browser_stats":   "/api/browsers/stats",
			"agent_broadcast": "/api/agents/broadcast",
			"agent_context":   "/api/agents/context",
			"channels":        "/api/channels",
			"relay":           "/api/channels/relay",
		},
	})
}

// handleOpenClawWebhook receives events from OpenClaw gateway
func handleOpenClawWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1MB limit
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}

	var payload struct {
		Type   string `json:"type"`
		Source string `json:"source"`
		Data   any    `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	evt := openclawEvent{
		ID:        fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		Type:      payload.Type,
		Source:    payload.Source,
		Data:      payload.Data,
		Timestamp: time.Now(),
	}

	openclawMu.Lock()
	openclawEvents = append(openclawEvents, evt)
	// Keep last 500 events
	if len(openclawEvents) > 500 {
		openclawEvents = openclawEvents[len(openclawEvents)-500:]
	}
	openclawMu.Unlock()

	log.Printf("[OpenClaw] Webhook event: %s from %s", payload.Type, payload.Source)

	// Handle specific event types
	switch payload.Type {
	case "agent.spawned":
		log.Printf("[OpenClaw] Agent spawned via OpenClaw")
	case "agent.stopped":
		log.Printf("[OpenClaw] Agent stopped via OpenClaw")
	case "finding.critical":
		log.Printf("[OpenClaw] CRITICAL finding reported via OpenClaw")
	case "workflow.finished":
		log.Printf("[OpenClaw] Workflow completed via OpenClaw")
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"event_id": evt.ID,
		"received": evt.Timestamp,
	})
}

// handleOpenClawCommand receives a natural language command from OpenClaw and routes it
func handleOpenClawCommand(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}

	var cmd struct {
		Command   string `json:"command"`
		AgentID   string `json:"agent_id"`
		Target    string `json:"target"`
		Channel   string `json:"channel"` // voice, telegram, slack, etc.
		SessionID string `json:"session_id"`
	}
	if err := json.Unmarshal(body, &cmd); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	if cmd.Command == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "command is required"})
		return
	}

	log.Printf("[OpenClaw] Command received: %q via %s", cmd.Command, cmd.Channel)

	// Parse command intent and route to appropriate handler
	response := routeOpenClawCommand(cmd.Command, cmd.AgentID, cmd.Target)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"command":  cmd.Command,
		"response": response,
		"channel":  cmd.Channel,
	})
}

// routeOpenClawCommand parses a natural language command and dynamically routes it.
// All agent discovery is done via DB queries — no hardcoded agent names.
func routeOpenClawCommand(command, agentID, target string) map[string]any {
	lower := strings.ToLower(command)

	// Dynamically discover all agents from the database
	var allAgents []DBAgent
	if dbAvailable() {
		if a, err := dbListAgents(); err == nil {
			allAgents = a
		}
	}

	// Status queries
	if containsAny(lower, []string{"status", "show me", "swarm", "dashboard", "how many"}) {
		agents := []map[string]string{}
		for _, a := range allAgents {
			agents = append(agents, map[string]string{
				"id":     a.ID,
				"name":   a.Name,
				"type":   a.Type,
				"status": a.Status,
			})
		}
		// Count running
		running := 0
		agentContainers.RLock()
		running = len(agentContainers.m)
		agentContainers.RUnlock()
		return map[string]any{
			"action":  "status",
			"agents":  agents,
			"running": running,
			"message": fmt.Sprintf("Swarm status: %d agents registered, %d running", len(agents), running),
		}
	}

	// Spawn commands — try to match an agent by name in the command
	if containsAny(lower, []string{"scan", "launch", "deploy", "spawn", "start", "run"}) {
		// Dynamic agent matching: check if any registered agent name appears in the command
		matchedAgent := ""
		matchedAgentID := agentID
		for _, a := range allAgents {
			if strings.Contains(lower, strings.ToLower(a.Name)) {
				matchedAgent = a.Name
				matchedAgentID = a.ID
				break
			}
		}
		msg := fmt.Sprintf("Initiating operation. Target: %s", target)
		if matchedAgent != "" {
			msg = fmt.Sprintf("Deploying %s. Target: %s", matchedAgent, target)
		}
		return map[string]any{
			"action":     "spawn",
			"agent_id":   matchedAgentID,
			"agent_name": matchedAgent,
			"target":     target,
			"message":    msg,
			"endpoint":   fmt.Sprintf("/api/agents/%s/spawn", matchedAgentID),
		}
	}

	// Stop commands
	if containsAny(lower, []string{"stop", "kill", "abort", "standby", "clean up"}) {
		return map[string]any{
			"action":  "stop",
			"message": "Stopping agents...",
		}
	}

	// Report commands
	if containsAny(lower, []string{"report", "write up", "findings", "what did you find"}) {
		return map[string]any{
			"action":  "report",
			"message": "Generating findings report...",
		}
	}

	// Default: pass through
	return map[string]any{
		"action":  "unknown",
		"command": command,
		"message": fmt.Sprintf("Command received: %s — routing to orchestrator", command),
		"agents":  len(allAgents),
	}
}

func containsAny(s string, substrs []string) bool {
	for _, sub := range substrs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

// handleOpenClawSkills returns all available Harbinger skills for OpenClaw
func handleOpenClawSkills(w http.ResponseWriter, r *http.Request) {
	skills := listOpenClawSkills()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"skills": skills,
		"count":  len(skills),
	})
}

// listOpenClawSkills scans the openclaw/skills directory
func listOpenClawSkills() []openclawSkillMeta {
	skillDirs := []string{
		"/app/openclaw/skills",                     // Docker path
		filepath.Join(os.Getenv("HOME"), ".openclaw/skills/harbinger"), // User install path
	}

	// Also check relative to working dir
	if wd, err := os.Getwd(); err == nil {
		skillDirs = append(skillDirs, filepath.Join(wd, "../openclaw/skills"))
		skillDirs = append(skillDirs, filepath.Join(wd, "../../openclaw/skills"))
	}

	var skills []openclawSkillMeta
	seen := map[string]bool{}

	for _, dir := range skillDirs {
		files, err := filepath.Glob(filepath.Join(dir, "*.skill"))
		if err != nil || len(files) == 0 {
			continue
		}
		for _, f := range files {
			base := strings.TrimSuffix(filepath.Base(f), ".skill")
			if seen[base] {
				continue
			}
			seen[base] = true

			meta := openclawSkillMeta{
				ID:   "harbinger-" + base,
				Name: base,
				File: filepath.Base(f),
			}

			// Parse first few lines for description
			content, err := os.ReadFile(f)
			if err == nil {
				lines := strings.Split(string(content), "\n")
				for _, line := range lines {
					line = strings.TrimSpace(line)
					if strings.HasPrefix(line, "> ") {
						meta.Description = strings.TrimPrefix(line, "> ")
						break
					}
				}
				// Extract agent name from title
				for _, line := range lines {
					if strings.Contains(line, "—") {
						parts := strings.SplitN(line, "—", 2)
						if len(parts) == 2 {
							meta.Agent = strings.TrimSpace(parts[1])
						}
						break
					}
				}
			}

			skills = append(skills, meta)
		}
	}

	// Fallback: hardcoded skills if no files found
	if len(skills) == 0 {
		skills = []openclawSkillMeta{
			{ID: "harbinger-recon", Name: "recon", Description: "Reconnaissance operations via PATHFINDER", Agent: "PATHFINDER", File: "recon.skill"},
			{ID: "harbinger-web-scan", Name: "web-scan", Description: "Web vulnerability scanning via BREACH", Agent: "BREACH", File: "web-scan.skill"},
			{ID: "harbinger-cloud-audit", Name: "cloud-audit", Description: "Cloud misconfiguration detection via PHANTOM", Agent: "PHANTOM", File: "cloud-audit.skill"},
			{ID: "harbinger-osint", Name: "osint", Description: "OSINT intelligence gathering via SPECTER", Agent: "SPECTER", File: "osint.skill"},
			{ID: "harbinger-binary-re", Name: "binary-re", Description: "Binary reverse engineering via CIPHER", Agent: "CIPHER", File: "binary-re.skill"},
			{ID: "harbinger-report", Name: "report", Description: "Security report generation via SCRIBE", Agent: "SCRIBE", File: "report.skill"},
			{ID: "harbinger-orchestrate", Name: "orchestrate", Description: "Multi-agent orchestration pipeline", Agent: "COMMANDER", File: "orchestrate.skill"},
			{ID: "harbinger-dashboard", Name: "dashboard", Description: "Dashboard queries and status checks", Agent: "SYSTEM", File: "dashboard.skill"},
		}
	}

	return skills
}

// handleOpenClawConnect registers an OpenClaw gateway connection
func handleOpenClawConnect(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}

	var req struct {
		Gateway string `json:"gateway"`
		Version string `json:"version"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	openclawMu.Lock()
	openclawConnected = true
	openclawLastPing = time.Now()
	if req.Gateway != "" {
		openclawGateway = req.Gateway
	}
	openclawMu.Unlock()

	log.Printf("[OpenClaw] Gateway connected: %s (version %s)", req.Gateway, req.Version)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "OpenClaw gateway registered",
		"harbinger": map[string]string{
			"version": "1.0.0",
			"api":     "/api",
		},
	})
}

// handleOpenClawEvents returns recent webhook events
func handleOpenClawEvents(w http.ResponseWriter, r *http.Request) {
	openclawMu.RLock()
	events := make([]openclawEvent, len(openclawEvents))
	copy(events, openclawEvents)
	openclawMu.RUnlock()

	// Reverse chronological
	for i, j := 0, len(events)-1; i < j; i, j = i+1, j-1 {
		events[i], events[j] = events[j], events[i]
	}

	// Limit to last 100
	if len(events) > 100 {
		events = events[:100]
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"events": events,
		"count":  len(events),
	})
}

// handleOpenClawPing keeps the connection alive
func handleOpenClawPing(w http.ResponseWriter, r *http.Request) {
	openclawMu.Lock()
	openclawConnected = true
	openclawLastPing = time.Now()
	openclawMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"pong": time.Now().Unix(),
	})
}
