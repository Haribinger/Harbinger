package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
)

// ============================================================================
// SMART MODEL ROUTER — Local-first model selection + complexity classification
// ============================================================================

// ModelRoute maps a complexity tier to a provider/model pair.
type ModelRoute struct {
	TaskType         string `json:"task_type"`
	DefaultProvider  string `json:"default_provider"`
	FallbackProvider string `json:"fallback_provider"`
	Model            string `json:"model"`
	FallbackModel    string `json:"fallback_model"`
	MaxTokens        int    `json:"max_tokens"`
	CostOptimize     bool   `json:"cost_optimize"`
}

// ModelRouterConfig holds the global router settings.
type ModelRouterConfig struct {
	LocalMode        bool   `json:"local_mode"`
	AutoClassify     bool   `json:"auto_classify"`
	DefaultProvider  string `json:"default_provider"`
	CostOptimization bool   `json:"cost_optimization"`
}

// In-memory route table with defaults.
var modelRouter = struct {
	sync.RWMutex
	config ModelRouterConfig
	routes []ModelRoute
}{
	config: ModelRouterConfig{
		LocalMode:        false,
		AutoClassify:     true,
		DefaultProvider:  "ollama",
		CostOptimization: true,
	},
	routes: []ModelRoute{
		{TaskType: "trivial", DefaultProvider: "ollama", Model: "llama3", FallbackProvider: "", FallbackModel: "", MaxTokens: 500, CostOptimize: true},
		{TaskType: "simple", DefaultProvider: "ollama", Model: "llama3", FallbackProvider: "", FallbackModel: "", MaxTokens: 2000, CostOptimize: true},
		{TaskType: "moderate", DefaultProvider: "ollama", Model: "codellama", FallbackProvider: "anthropic", FallbackModel: "claude-sonnet-4-6", MaxTokens: 4000, CostOptimize: true},
		{TaskType: "complex", DefaultProvider: "anthropic", Model: "claude-sonnet-4-6", FallbackProvider: "anthropic", FallbackModel: "claude-opus-4-6", MaxTokens: 8000, CostOptimize: false},
		{TaskType: "massive", DefaultProvider: "anthropic", Model: "claude-opus-4-6", FallbackProvider: "anthropic", FallbackModel: "claude-opus-4-6", MaxTokens: 32000, CostOptimize: false},
	},
}

// handleGetModelRoutes returns the current route table + config.
// GET /api/settings/model-routes
func handleGetModelRoutes(w http.ResponseWriter, r *http.Request) {
	// Try DB first
	if dbAvailable() {
		routes, config, err := dbLoadModelRoutes()
		if err == nil && len(routes) > 0 {
			writeJSON(w, http.StatusOK, map[string]any{
				"ok":     true,
				"config": config,
				"routes": routes,
			})
			return
		}
	}

	// Fallback to in-memory
	modelRouter.RLock()
	defer modelRouter.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"config": modelRouter.config,
		"routes": modelRouter.routes,
	})
}

// handleUpdateModelRoutes updates the route table.
// PUT /api/settings/model-routes
func handleUpdateModelRoutes(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Config *ModelRouterConfig `json:"config,omitempty"`
		Routes []ModelRoute      `json:"routes,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	modelRouter.Lock()
	if body.Config != nil {
		modelRouter.config = *body.Config
	}
	if len(body.Routes) > 0 {
		modelRouter.routes = body.Routes
	}
	modelRouter.Unlock()

	// Persist to DB
	if dbAvailable() {
		modelRouter.RLock()
		if err := dbSaveModelRoutes(modelRouter.routes, modelRouter.config); err != nil {
			log.Printf("[ModelRouter] DB save failed: %v", err)
		}
		modelRouter.RUnlock()
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "model routes updated"})
}

// handleResolveModel classifies a task and returns the recommended model.
// POST /api/model-routes/resolve
func handleResolveModel(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Task    string `json:"task"`
		AgentID string `json:"agent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	complexity := classifyComplexity(body.Task)

	modelRouter.RLock()
	defer modelRouter.RUnlock()

	// Find matching route
	var route *ModelRoute
	for i := range modelRouter.routes {
		if modelRouter.routes[i].TaskType == complexity {
			route = &modelRouter.routes[i]
			break
		}
	}

	if route == nil {
		// Default to first route
		if len(modelRouter.routes) > 0 {
			route = &modelRouter.routes[0]
		} else {
			writeJSON(w, http.StatusOK, map[string]any{
				"ok":         true,
				"complexity": complexity,
				"provider":   "ollama",
				"model":      "llama3",
				"reason":     "no_routes_configured",
			})
			return
		}
	}

	provider := route.DefaultProvider
	model := route.Model

	// Enforce local mode
	if modelRouter.config.LocalMode {
		if provider != "ollama" && provider != "lmstudio" && provider != "gpt4all" {
			provider = "ollama"
			model = "llama3"
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"complexity": complexity,
		"provider":   provider,
		"model":      model,
		"max_tokens": route.MaxTokens,
		"fallback": map[string]string{
			"provider": route.FallbackProvider,
			"model":    route.FallbackModel,
		},
		"local_mode":   modelRouter.config.LocalMode,
		"cost_optimize": route.CostOptimize,
	})
}

// classifyComplexity scores a task string into a complexity tier.
func classifyComplexity(task string) string {
	if task == "" {
		return "simple"
	}

	lower := strings.ToLower(task)
	score := 0

	// Token estimate
	words := strings.Fields(lower)
	tokenEstimate := float64(len(words)) * 1.3
	if tokenEstimate > 500 {
		score += 2
	}
	if tokenEstimate > 2000 {
		score += 2
	}
	if tokenEstimate > 5000 {
		score += 2
	}

	// Reasoning depth
	reasoningWords := []string{"analyze", "explain", "compare", "evaluate", "synthesize"}
	for _, w := range reasoningWords {
		if strings.Contains(lower, w) {
			score += 2
			break
		}
	}

	// Code/security indicators
	codeWords := []string{"code", "function", "class", "implement", "refactor", "debug"}
	for _, w := range codeWords {
		if strings.Contains(lower, w) {
			score += 2
			break
		}
	}
	secWords := []string{"exploit", "vulnerability", "payload", "injection", "bypass"}
	for _, w := range secWords {
		if strings.Contains(lower, w) {
			score += 3
			break
		}
	}

	// Trivial checks
	trivialPrefixes := []string{"hi", "hello", "hey", "thanks", "ok", "yes", "no"}
	firstWord := ""
	if len(words) > 0 {
		firstWord = words[0]
	}
	for _, p := range trivialPrefixes {
		if firstWord == p {
			return "trivial"
		}
	}
	if len(task) < 20 {
		return "trivial"
	}

	// Map score to tier
	switch {
	case score <= 1:
		return "trivial"
	case score <= 3:
		return "simple"
	case score <= 6:
		return "moderate"
	case score <= 9:
		return "complex"
	default:
		return "massive"
	}
}
