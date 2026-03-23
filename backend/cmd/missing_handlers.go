package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// missing_handlers.go — handlers for frontend API endpoints that were missing
// from route registration. Each returns real data from in-memory stores or
// returns {ok:false, reason:"not_configured"} per no-crash policy.

// ── Auth: /api/auth/me, /api/auth/logout ─────────────────────────────────

func handleAuthMe(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "not authenticated"})
		return
	}
	ctx := r.Context()
	username, _ := ctx.Value("username").(string)
	email, _ := ctx.Value("email").(string)
	role, _ := ctx.Value("role").(string)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"user": map[string]any{
			"user_id":  userID,
			"username": username,
			"email":    email,
			"provider": role,
		},
	})
}

func handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	// JWT is stateless — client should discard the token
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Token invalidated on client side"})
}

// ── Providers: /api/providers/* ───────────────────────────────────────────

var (
	providerConfigs   = make(map[string]providerConfig)
	providerConfigsMu sync.RWMutex
	activeProviderID  string
)

type providerConfig struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Enabled      bool     `json:"enabled"`
	BaseURL      string   `json:"baseUrl,omitempty"`
	DefaultModel string   `json:"defaultModel,omitempty"`
	Models       []string `json:"-"`
}

// knownProviders is the canonical list of AI providers Harbinger supports.
var knownProviders = map[string][]string{
	"ollama":    {"llama3", "codellama", "mistral", "mixtral", "deepseek-coder", "phi3"},
	"lmstudio":  {"local-model"},
	"gpt4all":   {"gpt4all-default"},
	"openai":    {"gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"},
	"anthropic": {"claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"},
	"google":    {"gemini-pro", "gemini-2.0-flash"},
	"mistral":   {"mistral-large", "mistral-medium", "mistral-small"},
	"groq":      {"llama-3.1-70b", "mixtral-8x7b"},
	"deepseek":  {"deepseek-chat", "deepseek-coder"},
}

func handleListProviders(w http.ResponseWriter, r *http.Request) {
	providerConfigsMu.RLock()
	defer providerConfigsMu.RUnlock()
	result := make([]map[string]any, 0, len(knownProviders))
	for id, models := range knownProviders {
		enabled := false
		baseURL := ""
		if pc, ok := providerConfigs[id]; ok {
			enabled = pc.Enabled
			baseURL = pc.BaseURL
		}
		modelList := make([]map[string]string, 0, len(models))
		for _, m := range models {
			modelList = append(modelList, map[string]string{"id": m, "name": m})
		}
		result = append(result, map[string]any{
			"id":      id,
			"name":    strings.ToUpper(id[:1]) + id[1:],
			"enabled": enabled,
			"baseUrl": baseURL,
			"models":  modelList,
		})
	}
	writeJSON(w, http.StatusOK, result)
}

func handleGetProvider(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	models, ok := knownProviders[provider]
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "unknown provider"})
		return
	}
	providerConfigsMu.RLock()
	pc := providerConfigs[provider]
	providerConfigsMu.RUnlock()
	modelList := make([]map[string]string, 0, len(models))
	for _, m := range models {
		modelList = append(modelList, map[string]string{"id": m, "name": m})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":      provider,
		"name":    strings.ToUpper(provider[:1]) + provider[1:],
		"enabled": pc.Enabled,
		"baseUrl": pc.BaseURL,
		"models":  modelList,
	})
}

func handleUpdateProvider(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	var body struct {
		APIKey       string `json:"apiKey"`
		BaseURL      string `json:"baseUrl"`
		Enabled      *bool  `json:"enabled"`
		DefaultModel string `json:"defaultModel"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	providerConfigsMu.Lock()
	pc := providerConfigs[provider]
	pc.ID = provider
	pc.Name = strings.ToUpper(provider[:1]) + provider[1:]
	if body.BaseURL != "" {
		pc.BaseURL = body.BaseURL
	}
	if body.Enabled != nil {
		pc.Enabled = *body.Enabled
	}
	if body.DefaultModel != "" {
		pc.DefaultModel = body.DefaultModel
	}
	providerConfigs[provider] = pc
	providerConfigsMu.Unlock()
	writeJSON(w, http.StatusOK, pc)
}

func handleTestProvider(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")

	providerConfigsMu.RLock()
	pc, configured := providerConfigs[provider]
	providerConfigsMu.RUnlock()

	if !configured || !pc.Enabled {
		writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"message": fmt.Sprintf("Provider %s is not configured or not enabled", provider),
		})
		return
	}

	// For providers with a base URL (ollama, lmstudio), probe the endpoint
	if pc.BaseURL != "" {
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get(pc.BaseURL)
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"success": false,
				"message": fmt.Sprintf("Provider %s unreachable at %s: %v", provider, pc.BaseURL, err),
			})
			return
		}
		resp.Body.Close()
		writeJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": fmt.Sprintf("Provider %s reachable at %s (HTTP %d)", provider, pc.BaseURL, resp.StatusCode),
		})
		return
	}

	// Cloud providers (openai, anthropic, etc.) need API keys — we can't test without them
	writeJSON(w, http.StatusOK, map[string]any{
		"success": false,
		"message": fmt.Sprintf("Provider %s has no base URL configured — cloud provider connectivity requires an API key test which is not implemented", provider),
	})
}

func handleGetProviderModels(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	models, ok := knownProviders[provider]
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "unknown provider"})
		return
	}
	result := make([]map[string]string, 0, len(models))
	for _, m := range models {
		result = append(result, map[string]string{"id": m, "name": m})
	}
	writeJSON(w, http.StatusOK, map[string]any{"models": result})
}

func handleSetActiveProvider(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Provider string `json:"provider"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	providerConfigsMu.Lock()
	activeProviderID = body.Provider
	providerConfigsMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "active": body.Provider})
}

// ── Bounty: /api/bounty/programs ──────────────────────────────────────────

var (
	bountyPrograms   []map[string]any
	bountyProgramsMu sync.RWMutex
)

func handleListBountyPrograms(w http.ResponseWriter, r *http.Request) {
	bountyProgramsMu.RLock()
	defer bountyProgramsMu.RUnlock()
	if bountyPrograms == nil {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "programs": []any{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "programs": bountyPrograms})
}

// ── Docker: /api/docker/networks, /api/docker/volumes, images/prune ──────

func handleDockerNetworks(w http.ResponseWriter, r *http.Request) {
	resp, err := dockerAPIRequest("GET", "/v1.41/networks", nil)
	if err != nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	defer resp.Body.Close()
	var networks []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&networks); err != nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	result := make([]map[string]any, 0)
	for _, n := range networks {
		result = append(result, map[string]any{
			"id":     n["Id"],
			"name":   n["Name"],
			"driver": n["Driver"],
		})
	}
	writeJSON(w, http.StatusOK, result)
}

func handleDockerVolumes(w http.ResponseWriter, r *http.Request) {
	resp, err := dockerAPIRequest("GET", "/v1.41/volumes", nil)
	if err != nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	defer resp.Body.Close()
	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	volumes, _ := data["Volumes"].([]any)
	result := make([]map[string]any, 0)
	for _, v := range volumes {
		vol, ok := v.(map[string]any)
		if !ok {
			continue
		}
		result = append(result, map[string]any{
			"name":   vol["Name"],
			"driver": vol["Driver"],
			"size":   0,
		})
	}
	writeJSON(w, http.StatusOK, result)
}

func handleDockerPruneImages(w http.ResponseWriter, r *http.Request) {
	resp, err := dockerAPIRequest("POST", "/v1.41/images/prune", nil)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "docker not available"})
		return
	}
	defer resp.Body.Close()
	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"deleted": 0, "reclaimed": 0})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"deleted":   data["ImagesDeleted"],
		"reclaimed": data["SpaceReclaimed"],
	})
}

func handleDockerDeleteImage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	resp, err := dockerAPIRequest("DELETE", "/v1.41/images/"+id, nil)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	resp.Body.Close()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ── MCP: /api/mcp/* (CRUD + tools/resources/prompts) ─────────────────────

var (
	mcpServers   = make(map[string]map[string]any)
	mcpServersMu sync.RWMutex
)

func handleGetMCPServer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	mcpServersMu.RLock()
	s, ok := mcpServers[id]
	mcpServersMu.RUnlock()
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "server not found"})
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func handleCreateMCPServer(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	id := fmt.Sprintf("mcp-%d", time.Now().UnixMilli())
	body["id"] = id
	body["status"] = "disconnected"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	mcpServersMu.Lock()
	mcpServers[id] = body
	mcpServersMu.Unlock()
	writeJSON(w, http.StatusCreated, body)
}

func handleUpdateMCPServer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	mcpServersMu.Lock()
	defer mcpServersMu.Unlock()
	s, ok := mcpServers[id]
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "server not found"})
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	for k, v := range body {
		s[k] = v
	}
	mcpServers[id] = s
	writeJSON(w, http.StatusOK, s)
}

func handleDeleteMCPServer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	mcpServersMu.Lock()
	delete(mcpServers, id)
	mcpServersMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func handleMCPConnectByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	mcpServersMu.Lock()
	if s, ok := mcpServers[id]; ok {
		s["status"] = "connected"
		mcpServers[id] = s
	}
	mcpServersMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func handleMCPDisconnectByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	mcpServersMu.Lock()
	if s, ok := mcpServers[id]; ok {
		s["status"] = "disconnected"
		mcpServers[id] = s
	}
	mcpServersMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func handleMCPGetTools(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	mcpServersMu.RLock()
	s, ok := mcpServers[id]
	mcpServersMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "reason": "not_connected", "error": "MCP server not found"})
		return
	}
	status, _ := s["status"].(string)
	if status != "connected" {
		writeJSON(w, http.StatusOK, map[string]any{"ok": false, "reason": "not_connected", "tools": []any{}})
		return
	}
	// When actually connected, would call MCP tools/list — for now return honest empty
	writeJSON(w, http.StatusOK, map[string]any{"ok": false, "reason": "not_connected", "tools": []any{}})
}

func handleMCPGetResources(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	mcpServersMu.RLock()
	s, ok := mcpServers[id]
	mcpServersMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "reason": "not_connected", "error": "MCP server not found"})
		return
	}
	status, _ := s["status"].(string)
	if status != "connected" {
		writeJSON(w, http.StatusOK, map[string]any{"ok": false, "reason": "not_connected", "resources": []any{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": false, "reason": "not_connected", "resources": []any{}})
}

func handleMCPGetPrompts(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	mcpServersMu.RLock()
	s, ok := mcpServers[id]
	mcpServersMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "reason": "not_connected", "error": "MCP server not found"})
		return
	}
	status, _ := s["status"].(string)
	if status != "connected" {
		writeJSON(w, http.StatusOK, map[string]any{"ok": false, "reason": "not_connected", "prompts": []any{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": false, "reason": "not_connected", "prompts": []any{}})
}

func handleMCPCallTool(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured", "content": "", "isError": true})
}

func handleMCPTest(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URL  string `json:"url"`
		Type string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "invalid body"})
		return
	}
	if body.URL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "url required"})
		return
	}

	// Actually probe the MCP server URL
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(body.URL)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"message": fmt.Sprintf("MCP server at %s unreachable: %v", body.URL, err),
		})
		return
	}
	resp.Body.Close()

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": fmt.Sprintf("MCP server at %s reachable (HTTP %d, %s transport)", body.URL, resp.StatusCode, body.Type),
	})
}

func handleMCPBuiltinTools(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []any{})
}

func handleMCPExecBuiltinTool(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured", "output": "", "error": "builtin tools not configured"})
}

// ── Pentest: /api/pentest/crack ──────────────────────────────────────────

var (
	crackJobs   []map[string]any
	crackJobsMu sync.RWMutex
)

func handlePentestStartCrack(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     false,
		"reason": "not_implemented",
		"error":  "Hash cracking requires hashcat/john containers — not yet wired to Docker execution engine",
	})
}

func handlePentestCrackJobs(w http.ResponseWriter, r *http.Request) {
	crackJobsMu.RLock()
	defer crackJobsMu.RUnlock()
	if crackJobs == nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	writeJSON(w, http.StatusOK, crackJobs)
}

// ── Agents: /api/agents/personalities ────────────────────────────────────

var (
	agentPersonalities   []map[string]any
	agentPersonalitiesMu sync.RWMutex
)

func handleGetAgentPersonalities(w http.ResponseWriter, r *http.Request) {
	agentPersonalitiesMu.RLock()
	defer agentPersonalitiesMu.RUnlock()
	if agentPersonalities == nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	writeJSON(w, http.StatusOK, agentPersonalities)
}

func handleCreateAgentPersonality(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	body["id"] = fmt.Sprintf("personality-%d", time.Now().UnixMilli())
	agentPersonalitiesMu.Lock()
	agentPersonalities = append(agentPersonalities, body)
	agentPersonalitiesMu.Unlock()
	writeJSON(w, http.StatusCreated, body)
}

// ── Dashboard: /api/dashboard/quick-actions ──────────────────────────────

func handleDashboardQuickActions(w http.ResponseWriter, r *http.Request) {
	actions := []map[string]string{
		{"id": "spawn-agent", "label": "Spawn Agent", "description": "Start a new agent instance", "icon": "Bot", "route": "/agents", "color": "#f0c040"},
		{"id": "new-scan", "label": "New Scan", "description": "Launch reconnaissance scan", "icon": "Search", "route": "/scope", "color": "#00d4ff"},
		{"id": "view-findings", "label": "View Findings", "description": "Check vulnerability findings", "icon": "AlertTriangle", "route": "/vuln-deep-dive", "color": "#ef4444"},
		{"id": "run-workflow", "label": "Run Workflow", "description": "Execute automation workflow", "icon": "Play", "route": "/workflows", "color": "#22c55e"},
	}
	writeJSON(w, http.StatusOK, actions)
}

// ── Workflows: import, run, executions, clone, export ────────────────────

func handleImportWorkflow(w http.ResponseWriter, r *http.Request) {
	var body struct {
		YAML string `json:"yaml"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
}

func handleRunWorkflow(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     false,
		"reason": "not_implemented",
		"error":  "Workflow execution engine not yet connected — use n8n or prowlrbot-engine scheduler",
	})
}

func handleGetWorkflowExecutions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []any{})
}

func handleCloneWorkflow(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
}

func handleExportWorkflow(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     false,
		"reason": "not_implemented",
		"yaml":   "",
	})
}

// ── Workflows: GET /api/workflows/{id} ───────────────────────────────────

func handleGetWorkflowByID(w http.ResponseWriter, r *http.Request) {
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}
	id := r.PathValue("id")
	workflows, err := dbListWorkflows()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "failed to list workflows"})
		return
	}
	for _, wf := range workflows {
		if wf.ID == id {
			writeJSON(w, http.StatusOK, wf)
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "workflow not found"})
}

// ── Skills: POST /api/skills/{id}/execute ────────────────────────────────

func handleExecuteSkill(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Args   map[string]any `json:"args"`
		Target string         `json:"target"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	_ = id
	_ = body
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     false,
		"reason": "not_implemented",
		"error":  "Skill execution engine not connected — use prowlrbot-engine /api/v2/execute or agent runtime",
	})
}

// ── Agents: GET /api/agents/{id}/config ──────────────────────────────────

func handleGetAgentConfig(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if !dbAvailable() {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":     false,
			"reason": "not_configured",
		})
		return
	}

	agent, err := dbGetAgent(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "agent not found"})
		return
	}

	// Read SOUL.md for the agent's personality/config
	soul, soulErr := readAgentSoul(agent.Type)
	config := map[string]any{
		"agent_type":  agent.Type,
		"agent_name":  agent.Name,
		"status":      agent.Status,
		"description": agent.Description,
	}
	if soulErr == nil {
		config["soul"] = soul
	}

	// Read CONFIG.yaml if it exists
	configYaml, configErr := readAgentProfileFile(agent.Type, "CONFIG.yaml")
	if configErr == nil {
		config["config_yaml"] = configYaml
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"agent_id": id,
		"config":   config,
	})
}

// ── Tools: /api/tools/execute ────────────────────────────────────────────

func handleToolsExecute(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Tool string         `json:"tool"`
		Args map[string]any `json:"args"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	writeJSON(w, http.StatusServiceUnavailable, map[string]any{
		"ok":     false,
		"reason": "not_configured",
		"error":  fmt.Sprintf("Tool %q execution engine not configured — use MCP plugins or agent runtime", body.Tool),
	})
}
