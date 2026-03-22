package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// agentTypeToDir maps agent type slugs to their profile directory names under agents/.
var agentTypeToDir = map[string]string{
	"recon":             "recon-scout",
	"web":               "web-hacker",
	"cloud":             "cloud-infiltrator",
	"osint":             "osint-detective",
	"binary":            "binary-reverser",
	"report":            "report-writer",
	"coding-assistant":  "coding-assistant",
	"reporter":          "morning-brief",
	"learning-agent":    "learning-agent",
	"browser-agent":     "browser-agent",
	"maintainer":        "maintainer",
	"custom":            "_template",
	"network":           "_template",
	"mobile":            "_template",
	"api":               "_template",
}

// resolveAgentDir finds the absolute path to an agent's profile directory.
func resolveAgentDir(agentType string) string {
	dir, ok := agentTypeToDir[agentType]
	if !ok {
		dir = agentType // fallback: try type as directory name
	}
	return filepath.Join("agents", dir)
}

// readAgentSoul reads SOUL.md from the agent's profile directory.
func readAgentSoul(agentType string) (string, error) {
	soulPath := filepath.Join(resolveAgentDir(agentType), "SOUL.md")
	data, err := os.ReadFile(soulPath)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

// readAgentProfileFile reads any markdown file from the agent's profile directory.
func readAgentProfileFile(agentType, filename string) (string, error) {
	path := filepath.Join(resolveAgentDir(agentType), filename)
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

// hashContent returns a short SHA-256 hash of content for version tracking.
func hashContent(content string) string {
	h := sha256.Sum256([]byte(content))
	return hex.EncodeToString(h[:8])
}

// ============================================================================
// AGENT CRUD HANDLERS
// ============================================================================

func handleListAgents(w http.ResponseWriter, r *http.Request) {
	if dbAvailable() {
		agents, err := dbListAgents()
		if err != nil {
			internalError(w, "failed to list agents", err)
			return
		}
		// Enrich with container status
		agentContainers.RLock()
		for i := range agents {
			if cid, ok := agentContainers.m[agents[i].ID]; ok {
				agents[i].ContainerID = cid
			}
		}
		agentContainers.RUnlock()
		writeJSON(w, http.StatusOK, agents)
		return
	}
	// No DB — return empty list
	writeJSON(w, http.StatusOK, []any{})
}

func handleGetAgentByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}
	agent, err := dbGetAgent(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "agent not found"})
		return
	}
	agentContainers.RLock()
	if cid, ok := agentContainers.m[id]; ok {
		agent.ContainerID = cid
	}
	agentContainers.RUnlock()
	writeJSON(w, http.StatusOK, agent)
}

func handleCreateAgent(w http.ResponseWriter, r *http.Request) {
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}

	var body struct {
		Name         string   `json:"name"`
		Type         string   `json:"type"`
		Description  string   `json:"description"`
		Capabilities []string `json:"capabilities"`
		Config       any      `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}
	if body.Name == "" || body.Type == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "name and type are required"})
		return
	}

	configJSON := "{}"
	if body.Config != nil {
		b, _ := json.Marshal(body.Config)
		configJSON = string(b)
	}

	agent, err := dbCreateAgent(body.Name, body.Type, body.Description, body.Capabilities, configJSON)
	if err != nil {
		internalError(w, "operation failed", err)
		return
	}

	userID, _ := getUserIDFromContext(r.Context())
	dbAddAuditEntry(userID, "agent_created", "agent", agent.ID, map[string]any{"name": body.Name}, r.RemoteAddr)

	writeJSON(w, http.StatusCreated, agent)
}

func handleUpdateAgentByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}

	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if err := dbUpdateAgent(id, body); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "agent updated"})
}

func handleDeleteAgentByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}

	// Stop container if running
	agentContainers.RLock()
	cid, running := agentContainers.m[id]
	agentContainers.RUnlock()
	if running {
		stopAndRemoveContainer(cid)
		agentContainers.Lock()
		delete(agentContainers.m, id)
		agentContainers.Unlock()
	}

	if err := dbDeleteAgent(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	userID, _ := getUserIDFromContext(r.Context())
	dbAddAuditEntry(userID, "agent_deleted", "agent", id, nil, r.RemoteAddr)

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "agent deleted"})
}

func handleAgentHeartbeat(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}
	if err := dbUpdateAgentHeartbeat(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	result := map[string]any{"ok": true}

	// Enrich heartbeat with soul version if agent type is known
	agent, err := dbGetAgent(id)
	if err == nil {
		soul, soulErr := readAgentSoul(agent.Type)
		if soulErr == nil {
			result["soul_version"] = hashContent(soul)
		}
		result["agent_type"] = agent.Type
		result["agent_name"] = agent.Name
		result["status"] = agent.Status
	}

	writeJSON(w, http.StatusOK, result)
}

// handleGetAgentSoul serves the SOUL.md content for an agent.
func handleGetAgentSoul(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}

	agent, err := dbGetAgent(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "agent not found"})
		return
	}

	soul, err := readAgentSoul(agent.Type)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":   true,
			"soul": "",
			"note": "no SOUL.md found for agent type: " + agent.Type,
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"soul":         soul,
		"soul_version": hashContent(soul),
		"agent_type":   agent.Type,
		"agent_name":   agent.Name,
	})
}

// handleGetAgentProfile serves the full agent profile (SOUL, IDENTITY, SKILLS, HEARTBEAT, TOOLS).
func handleGetAgentProfile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}

	agent, err := dbGetAgent(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "agent not found"})
		return
	}

	profileFiles := []string{"SOUL.md", "IDENTITY.md", "SKILLS.md", "HEARTBEAT.md", "TOOLS.md", "CONFIG.yaml"}
	profile := map[string]any{
		"ok":         true,
		"agent_type": agent.Type,
		"agent_name": agent.Name,
		"agent_dir":  resolveAgentDir(agent.Type),
	}

	for _, f := range profileFiles {
		content, err := readAgentProfileFile(agent.Type, f)
		key := strings.TrimSuffix(strings.TrimSuffix(strings.ToLower(f), ".md"), ".yaml")
		if err != nil {
			profile[key] = nil
		} else {
			profile[key] = content
			profile[key+"_version"] = hashContent(content)
		}
	}

	writeJSON(w, http.StatusOK, profile)
}

// ============================================================================
// AGENT TEMPLATES & CLONE
// ============================================================================

// Agent templates — the 6 defaults serve as starting points for custom agents.
var agentTemplates = []map[string]any{
	{
		"id": "template-recon", "name": "PATHFINDER", "type": "recon",
		"description":  "Recon Scout — subdomain discovery, port scanning, asset enumeration, service fingerprinting",
		"capabilities": []string{"subfinder", "httpx", "naabu", "shef", "ceye", "dnsx"},
		"config":       map[string]any{"docker_image": "harbinger/recon-agent:latest", "memory_mb": 512, "cpu_count": 1},
		"color":        "#3b82f6",
	},
	{
		"id": "template-web", "name": "BREACH", "type": "web",
		"description":  "Web Hacker — XSS, SQLi, SSRF, IDOR, API exploitation, WAF evasion, nuclei templates",
		"capabilities": []string{"nuclei", "sqlmap", "dalfox", "ffuf", "recx", "httpx"},
		"config":       map[string]any{"docker_image": "harbinger/web-agent:latest", "memory_mb": 1024, "cpu_count": 2},
		"color":        "#ef4444",
	},
	{
		"id": "template-cloud", "name": "PHANTOM", "type": "cloud",
		"description":  "Cloud Infiltrator — AWS/Azure/GCP misconfiguration detection, S3 audit, IAM analysis",
		"capabilities": []string{"ScoutSuite", "Prowler", "Pacu", "cloudfox"},
		"config":       map[string]any{"docker_image": "harbinger/cloud-agent:latest", "memory_mb": 512, "cpu_count": 1},
		"color":        "#a855f7",
	},
	{
		"id": "template-osint", "name": "SPECTER", "type": "osint",
		"description":  "OSINT Detective — email enum, person lookup, credential leak detection, social media recon",
		"capabilities": []string{"theHarvester", "Sherlock", "SpiderFoot", "holehe"},
		"config":       map[string]any{"docker_image": "harbinger/osint-agent:latest", "memory_mb": 512, "cpu_count": 1},
		"color":        "#06b6d4",
	},
	{
		"id": "template-binary", "name": "CIPHER", "type": "binary",
		"description":  "Binary Reverse Engineer — binary analysis, exploit development, firmware extraction",
		"capabilities": []string{"Ghidra", "radare2", "pwntools", "binwalk"},
		"config":       map[string]any{"docker_image": "harbinger/binary-agent:latest", "memory_mb": 2048, "cpu_count": 2},
		"color":        "#f97316",
	},
	{
		"id": "template-report", "name": "SCRIBE", "type": "report",
		"description":  "Report Writer — CVSS scoring, PoC writing, platform-specific reports (HackerOne, Bugcrowd)",
		"capabilities": []string{"markdown", "pdf", "platform-apis", "cvss-calculator"},
		"config":       map[string]any{"docker_image": "harbinger/report-agent:latest", "memory_mb": 256, "cpu_count": 1},
		"color":        "#22c55e",
	},
}

func handleGetAgentTemplates(w http.ResponseWriter, r *http.Request) {
	// Return templates + any user-created agents marked as templates
	templates := make([]map[string]any, len(agentTemplates))
	copy(templates, agentTemplates)

	// Add custom agent types that users can define
	customTypes := []map[string]any{
		{
			"id": "template-custom", "name": "Custom Agent", "type": "custom",
			"description":  "Blank slate — configure everything from scratch",
			"capabilities": []string{},
			"config":       map[string]any{"docker_image": "", "memory_mb": 512, "cpu_count": 1},
			"color":        "#6366f1",
		},
		{
			"id": "template-network", "name": "Network Agent", "type": "network",
			"description":  "Network penetration testing — lateral movement, pivoting, protocol exploitation",
			"capabilities": []string{"nmap", "masscan", "responder", "impacket"},
			"config":       map[string]any{"docker_image": "harbinger/network-agent:latest", "memory_mb": 1024, "cpu_count": 1},
			"color":        "#14b8a6",
		},
		{
			"id": "template-mobile", "name": "Mobile Agent", "type": "mobile",
			"description":  "Mobile application security testing — APK/IPA analysis, API interception",
			"capabilities": []string{"frida", "objection", "apktool", "jadx"},
			"config":       map[string]any{"docker_image": "harbinger/mobile-agent:latest", "memory_mb": 1024, "cpu_count": 1},
			"color":        "#ec4899",
		},
		{
			"id": "template-api", "name": "API Agent", "type": "api",
			"description":  "API security testing — REST/GraphQL/gRPC fuzzing, auth bypass, rate limiting",
			"capabilities": []string{"postman", "restler", "graphql-cop", "arjun"},
			"config":       map[string]any{"docker_image": "harbinger/api-agent:latest", "memory_mb": 512, "cpu_count": 1},
			"color":        "#84cc16",
		},
		{
			"id": "template-coding", "name": "SAM", "type": "coding-assistant",
			"description":  "Samantha — Senior software engineer and coding specialist. Multi-language code generation, review, debugging, refactoring, and documentation. Can spawn sub-agents for specific tasks.",
			"capabilities": []string{"code-generation", "code-review", "debugging", "refactoring", "documentation", "eslint", "prettier", "typescript", "gofmt", "black", "pylint"},
			"config":       map[string]any{"docker_image": "harbinger/coding-agent:latest", "memory_mb": 2048, "cpu_count": 2},
			"color":        "#6366f1",
			"personality":  "You are Samantha, a senior software engineer and coding specialist. You speak in clear, precise technical language. You understand multiple programming languages and frameworks deeply. You write clean, maintainable code with comments explaining 'why' not 'what'. You're patient and thorough in code reviews. You always consider edge cases and security implications.",
		},
		{
			"id": "template-reporter", "name": "BRIEF", "type": "reporter",
			"description":  "Morning Brief — Automated daily reporting agent. Generates visual morning reports with news, content ideas, task summaries, and agent recommendations. Runs on schedule.",
			"capabilities": []string{"web-scraping", "rss-fetching", "task-management", "content-generation", "markdown", "multi-channel-notify"},
			"config":       map[string]any{"docker_image": "harbinger/reporter-agent:latest", "memory_mb": 512, "cpu_count": 1, "schedule": "0 8 * * *"},
			"color":        "#f0c040",
			"personality":  "You are Morning Brief, a concise reporting agent. You deliver visual, well-structured morning reports. You summarize the latest news, suggest content ideas, track tasks, and recommend which agents can help today. You speak in crisp, direct language with clear section headers.",
		},
		{
			"id": "template-learning", "name": "SAGE", "type": "learning",
			"description":  "Self-improving learning agent — Analyzes workflows for optimization, completes surprise improvements overnight, documents changes, and maintains a 3-layer memory system.",
			"capabilities": []string{"workflow-analysis", "code-optimization", "documentation", "memory-management", "self-improvement"},
			"config":       map[string]any{"docker_image": "harbinger/learning-agent:latest", "memory_mb": 1024, "cpu_count": 1, "schedule": "0 2 * * *"},
			"color":        "#10b981",
			"personality":  "You are SAGE, the self-improving learning agent. You work quietly and autonomously, analyzing patterns, fixing bottlenecks, and making the system better every day. You document everything you do with clear diffs and explanations. You ask before making high-impact changes.",
		},
		{
			"id": "template-browser", "name": "LENS", "type": "browser-agent",
			"description":  "Browser automation agent — Visual web interaction via CDP. Navigates, screenshots, clicks, types, and inspects pages. Every action is visible in the dashboard.",
			"capabilities": []string{"navigate", "screenshot", "execute-js", "click", "type", "network-log", "console-log", "element-inspect"},
			"config":       map[string]any{"docker_image": "harbinger/browser-agent:latest", "memory_mb": 1024, "cpu_count": 1},
			"color":        "#06b6d4",
		},
		{
			"id": "template-maintainer", "name": "MAINTAINER", "type": "maintainer",
			"description":  "Code Quality Specialist — Nightly health scans, safe auto-fixes, convention enforcement, dependency audits, health scoring, and PR creation. Runs at 02:00 UTC.",
			"capabilities": []string{"code-health-scanning", "dependency-management", "convention-enforcement", "safe-fix-application", "pr-creation", "smart-model-routing"},
			"config": map[string]any{
				"docker_image": "harbinger/maintainer-agent:latest",
				"memory_mb":    1024,
				"cpu_count":    2,
				"schedule":     "0 2 * * *",
				"model_routing": map[string]any{
					"default_provider":  "ollama",
					"fallback_provider": "anthropic",
					"cost_optimization": true,
				},
			},
			"color":       "#10b981",
			"personality": "You are MAINTAINER, the code quality specialist in the Harbinger platform. You run nightly scans to detect any types, console.logs, outdated dependencies, and convention violations. You apply safe auto-fixes with rollback capability, compute health scores, and create PRs. You never modify business logic or test expectations. Safety first — every change has a rollback path.",
		},
	}

	templates = append(templates, customTypes...)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"templates": templates,
		"count":     len(templates),
	})
}

func handleCloneAgent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "name is required"})
		return
	}

	// Get source agent
	source, err := dbGetAgent(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "source agent not found"})
		return
	}

	// Create clone
	clone, err := dbCreateAgent(body.Name, source.Type, source.Description, source.Capabilities, source.Config)
	if err != nil {
		internalError(w, "operation failed", err)
		return
	}

	userID, _ := getUserIDFromContext(r.Context())
	dbAddAuditEntry(userID, "agent_cloned", "agent", clone.ID, map[string]any{
		"source_id": id, "clone_name": body.Name,
	}, r.RemoteAddr)

	writeJSON(w, http.StatusCreated, clone)
}

// ============================================================================
// AGENT SPAWN / STOP — Real Docker Container Management
// ============================================================================

func handleSpawnAgent(w http.ResponseWriter, r *http.Request) {
	agentID := r.PathValue("id")
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}

	agent, err := dbGetAgent(agentID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "agent not found"})
		return
	}

	// Check if already running
	agentContainers.RLock()
	existingCID, alreadyRunning := agentContainers.m[agentID]
	agentContainers.RUnlock()
	if alreadyRunning {
		writeJSON(w, http.StatusConflict, map[string]any{
			"ok": false, "error": "agent already running", "container_id": existingCID,
		})
		return
	}

	if !dockerAvailable() {
		// Fallback: just update status in DB without a real container
		dbUpdateAgent(agentID, map[string]any{"status": "running"})
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"message": "agent marked as running (Docker unavailable — no container spawned)",
			"agent":   agent,
		})
		return
	}

	// Determine Docker image from agent config
	var agentConfig map[string]any
	json.Unmarshal([]byte(agent.Config), &agentConfig)
	image := "harbinger/" + agent.Type + "-agent:latest"
	if cfgImage, ok := agentConfig["docker_image"].(string); ok && cfgImage != "" {
		image = cfgImage
	}

	// Load agent soul for container injection
	soul, _ := readAgentSoul(agent.Type)
	soulVersion := ""
	if soul != "" {
		soulVersion = hashContent(soul)
	}

	// Create the container
	containerName := fmt.Sprintf("harbinger-%s-%s", agent.Type, agentID[:8])
	envVars := []string{
		"AGENT_ID=" + agentID,
		"AGENT_NAME=" + agent.Name,
		"AGENT_TYPE=" + agent.Type,
		"HARBINGER_API=http://backend:8080",
	}
	if soul != "" {
		envVars = append(envVars, "AGENT_SOUL_VERSION="+soulVersion)
		// Truncate soul to 4KB for env var safety
		soulForEnv := soul
		if len(soulForEnv) > 4096 {
			soulForEnv = soulForEnv[:4096]
		}
		envVars = append(envVars, "AGENT_SOUL="+soulForEnv)
	}
	containerConfig := map[string]any{
		"Image":    image,
		"Hostname": containerName,
		"Env":      envVars,
		"Labels": map[string]string{
			"harbinger.agent.id":   agentID,
			"harbinger.agent.name": agent.Name,
			"harbinger.agent.type": agent.Type,
			"harbinger.managed":    "true",
		},
		"HostConfig": map[string]any{
			"NetworkMode":    cfg.DockerNetwork,
			"Memory":         int64(512 * 1024 * 1024), // 512MB limit
			"NanoCpus":       int64(1000000000),         // 1 CPU
			"AutoRemove":     false,
			"SecurityOpt":    []string{"no-new-privileges"},
			"ReadonlyRootfs": true,
			"CapDrop":        []string{"ALL"},
			"CapAdd":         []string{"NET_RAW"},
			"PidsLimit":      int64(256),
			"Tmpfs":          map[string]string{"/tmp": "rw,noexec,nosuid,size=64m"},
		},
	}

	configJSON, _ := json.Marshal(containerConfig)
	createResp, err := dockerAPIRequest("POST",
		fmt.Sprintf("/v1.41/containers/create?name=%s", containerName),
		bytes.NewReader(configJSON))
	if err != nil {
		internalError(w, "failed to create container", err)
		return
	}
	defer createResp.Body.Close()

	if createResp.StatusCode != http.StatusCreated && createResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(createResp.Body, 10<<20)) // 10MB limit
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"ok": false, "error": "Docker create failed: " + string(body),
		})
		return
	}

	var createResult struct {
		ID string `json:"Id"`
	}
	json.NewDecoder(createResp.Body).Decode(&createResult)

	// Start the container
	startResp, err := dockerAPIRequest("POST",
		fmt.Sprintf("/v1.41/containers/%s/start", createResult.ID), nil)
	if err != nil {
		internalError(w, "failed to start container", err)
		return
	}
	defer startResp.Body.Close()

	if startResp.StatusCode != http.StatusNoContent && startResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(startResp.Body, 10<<20)) // 10MB limit
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"ok": false, "error": "Docker start failed: " + string(body),
		})
		return
	}

	// Track the container
	agentContainers.Lock()
	agentContainers.m[agentID] = createResult.ID
	agentContainers.Unlock()

	// Update DB status
	dbUpdateAgent(agentID, map[string]any{"status": "running"})

	userID, _ := getUserIDFromContext(r.Context())
	dbAddAuditEntry(userID, "agent_spawned", "agent", agentID, map[string]any{
		"container_id": createResult.ID, "image": image,
	}, r.RemoteAddr)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"container_id": createResult.ID,
		"image":        image,
		"agent":        agent,
	})
}

func handleStopAgent(w http.ResponseWriter, r *http.Request) {
	agentID := r.PathValue("id")

	agentContainers.RLock()
	cid, running := agentContainers.m[agentID]
	agentContainers.RUnlock()

	if running && dockerAvailable() {
		if err := stopAndRemoveContainer(cid); err != nil {
			log.Printf("[Agent] Failed to stop container %s: %v", cid, err)
		}
		agentContainers.Lock()
		delete(agentContainers.m, agentID)
		agentContainers.Unlock()
	}

	if dbAvailable() {
		dbUpdateAgent(agentID, map[string]any{"status": "idle"})
	}

	userID, _ := getUserIDFromContext(r.Context())
	dbAddAuditEntry(userID, "agent_stopped", "agent", agentID, nil, r.RemoteAddr)

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "agent stopped"})
}

func handleAgentStatus(w http.ResponseWriter, r *http.Request) {
	agentID := r.PathValue("id")

	status := map[string]any{
		"agent_id":  agentID,
		"container": nil,
		"running":   false,
	}

	agentContainers.RLock()
	cid, running := agentContainers.m[agentID]
	agentContainers.RUnlock()

	status["running"] = running

	if running && dockerAvailable() {
		// Inspect the container for live stats
		resp, err := dockerAPIRequest("GET", fmt.Sprintf("/v1.41/containers/%s/json", cid), nil)
		if err == nil {
			defer resp.Body.Close()
			var inspect map[string]any
			json.NewDecoder(resp.Body).Decode(&inspect)
			inspectImage := ""
			if cfgMap, ok := inspect["Config"].(map[string]any); ok {
				if img, ok := cfgMap["Image"].(string); ok {
					inspectImage = img
				}
			}
			status["container"] = map[string]any{
				"id":     cid,
				"state":  inspect["State"],
				"name":   inspect["Name"],
				"image":  inspectImage,
			}
		}
	}

	if dbAvailable() {
		agent, err := dbGetAgent(agentID)
		if err == nil {
			status["agent"] = agent
		}
	}

	writeJSON(w, http.StatusOK, status)
}

func handleAgentLogs(w http.ResponseWriter, r *http.Request) {
	agentID := r.PathValue("id")

	agentContainers.RLock()
	cid, running := agentContainers.m[agentID]
	agentContainers.RUnlock()

	if !running {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "agent not running"})
		return
	}

	if !dockerAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "Docker not available"})
		return
	}

	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "200"
	}

	endpoint := fmt.Sprintf("/v1.41/containers/%s/logs?stdout=true&stderr=true&tail=%s&timestamps=true", cid, tail)
	resp, err := dockerAPIRequest("GET", endpoint, nil)
	if err != nil {
		internalError(w, "operation failed", err)
		return
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(io.LimitReader(resp.Body, 10<<20)) // 10MB limit
	// Docker log stream has 8-byte header per frame; strip for plain text
	cleaned := stripDockerLogHeaders(data)
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	w.Write(cleaned)
}

// stripDockerLogHeaders removes the 8-byte Docker log stream header from each frame.
func stripDockerLogHeaders(data []byte) []byte {
	var out []byte
	for len(data) >= 8 {
		// byte 0: stream type (1=stdout, 2=stderr)
		// bytes 4-7: frame size (big-endian uint32)
		size := int(data[4])<<24 | int(data[5])<<16 | int(data[6])<<8 | int(data[7])
		data = data[8:]
		if size > len(data) {
			size = len(data)
		}
		out = append(out, data[:size]...)
		data = data[size:]
	}
	if len(out) == 0 {
		return data // Not Docker-formatted; return raw
	}
	return out
}

// ============================================================================
// ENHANCED DOCKER CLIENT
// ============================================================================

func stopAndRemoveContainer(containerID string) error {
	if !dockerAvailable() {
		return fmt.Errorf("Docker not available")
	}

	// Stop with 10s timeout
	resp, err := dockerAPIRequest("POST",
		fmt.Sprintf("/v1.41/containers/%s/stop?t=10", containerID), nil)
	if err != nil {
		return err
	}
	resp.Body.Close()

	// Remove
	resp2, err := dockerAPIRequest("DELETE",
		fmt.Sprintf("/v1.41/containers/%s?force=true&v=true", containerID), nil)
	if err != nil {
		return err
	}
	resp2.Body.Close()
	return nil
}

// handleDockerContainerStats returns live resource usage for a container.
func handleDockerContainerStats(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	// Validate container ID is hex-only to prevent path traversal
	if matched, _ := regexp.MatchString(`^[a-f0-9]+$`, id); !matched {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid container ID"})
		return
	}
	if !dockerAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	resp, err := dockerAPIRequest("GET",
		fmt.Sprintf("/v1.41/containers/%s/stats?stream=false", id), nil)
	if err != nil {
		internalError(w, "operation failed", err)
		return
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 10<<20)) // 10MB limit
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// handleDockerContainerInspect returns full container metadata.
func handleDockerContainerInspect(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	// Validate container ID is hex-only to prevent path traversal
	if matched, _ := regexp.MatchString(`^[a-f0-9]+$`, id); !matched {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid container ID"})
		return
	}
	if !dockerAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	resp, err := dockerAPIRequest("GET",
		fmt.Sprintf("/v1.41/containers/%s/json", id), nil)
	if err != nil {
		internalError(w, "operation failed", err)
		return
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 10<<20)) // 10MB limit
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// handleDockerPullImage pulls a Docker image by reference.
func handleDockerPullImage(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Image string `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Image == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "image field required"})
		return
	}

	// Validate image name against allowed patterns
	allowedPrefix := getEnv("DOCKER_IMAGE_PREFIX", "harbinger/")
	if !strings.HasPrefix(body.Image, allowedPrefix) && !strings.HasPrefix(body.Image, "docker.io/"+allowedPrefix) {
		writeJSON(w, http.StatusForbidden, map[string]any{
			"ok":    false,
			"error": fmt.Sprintf("image must start with %q", allowedPrefix),
		})
		return
	}

	if !dockerAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	resp, err := dockerAPIRequest("POST",
		fmt.Sprintf("/v1.41/images/create?fromImage=%s", url.QueryEscape(body.Image)), nil)
	if err != nil {
		internalError(w, "operation failed", err)
		return
	}
	defer resp.Body.Close()

	// Stream the pull progress back
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 10<<20)) // 10MB limit
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "output": string(data)})
}

// handleDockerDeleteContainer removes a stopped container.
func handleDockerDeleteContainer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	// Validate container ID is hex-only to prevent path traversal
	if matched, _ := regexp.MatchString(`^[a-f0-9]+$`, id); !matched {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid container ID"})
		return
	}
	if !dockerAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	resp, err := dockerAPIRequest("DELETE",
		fmt.Sprintf("/v1.41/containers/%s?force=true&v=true", id), nil)
	if err != nil {
		internalError(w, "operation failed", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusOK {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "container removed"})
		return
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 10<<20)) // 10MB limit
	writeJSON(w, resp.StatusCode, map[string]any{"ok": false, "error": string(body)})
}

// ============================================================================
// JOBS HANDLERS
// ============================================================================

func handleListJobs(w http.ResponseWriter, r *http.Request) {
	if !dbAvailable() {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	agentID := r.URL.Query().Get("agent_id")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	jobs, err := dbListJobs(agentID, limit)
	if err != nil {
		internalError(w, "operation failed", err)
		return
	}
	writeJSON(w, http.StatusOK, jobs)
}

func handleCreateJob(w http.ResponseWriter, r *http.Request) {
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}
	var body struct {
		AgentID string         `json:"agent_id"`
		Name    string         `json:"name"`
		Type    string         `json:"type"`
		Params  map[string]any `json:"parameters"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	if body.Name == "" || body.Type == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "name and type required"})
		return
	}
	userID, _ := getUserIDFromContext(r.Context())
	job, err := dbCreateJob(body.AgentID, body.Name, body.Type, body.Params, userID)
	if err != nil {
		internalError(w, "operation failed", err)
		return
	}
	writeJSON(w, http.StatusCreated, job)
}

func handleUpdateJob(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}
	var body struct {
		Status string         `json:"status"`
		Result map[string]any `json:"result"`
		Error  string         `json:"error"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	if err := dbUpdateJobStatus(id, body.Status, body.Result, body.Error); err != nil {
		internalError(w, "operation failed", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ============================================================================
// WORKFLOW HANDLERS
// ============================================================================

func handleListWorkflows(w http.ResponseWriter, r *http.Request) {
	if !dbAvailable() {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	workflows, err := dbListWorkflows()
	if err != nil {
		internalError(w, "operation failed", err)
		return
	}
	writeJSON(w, http.StatusOK, workflows)
}

func handleCreateWorkflowAPI(w http.ResponseWriter, r *http.Request) {
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}
	var body struct {
		Name        string         `json:"name"`
		Description string         `json:"description"`
		Definition  map[string]any `json:"definition"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	if body.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "name required"})
		return
	}
	userID, _ := getUserIDFromContext(r.Context())
	wf, err := dbCreateWorkflow(body.Name, body.Description, body.Definition, userID)
	if err != nil {
		internalError(w, "operation failed", err)
		return
	}
	writeJSON(w, http.StatusCreated, wf)
}

func handleUpdateWorkflowAPI(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	if err := dbUpdateWorkflow(id, body); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func handleDeleteWorkflowAPI(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !dbAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "database not available"})
		return
	}
	if err := dbDeleteWorkflow(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	userID, _ := getUserIDFromContext(r.Context())
	dbAddAuditEntry(userID, "workflow_deleted", "workflow", id, nil, r.RemoteAddr)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// Ensure unused imports don't cause compile errors
