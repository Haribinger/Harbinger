package main

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

// ─── Theme Types ─────────────────────────────────────────────────────────────

type ThemeTokens struct {
	Background       string `json:"background"`
	Surface          string `json:"surface"`
	SurfaceLight     string `json:"surfaceLight"`
	SurfaceDark      string `json:"surfaceDark"`
	TextPrimary      string `json:"textPrimary"`
	TextSecondary    string `json:"textSecondary"`
	Border           string `json:"border"`
	Accent           string `json:"accent"`
	AccentHover      string `json:"accentHover"`
	Danger           string `json:"danger"`
	Success          string `json:"success"`
	Warning          string `json:"warning"`
	Info             string `json:"info"`
	ScrollbarTrack   string `json:"scrollbarTrack"`
	ScrollbarThumb   string `json:"scrollbarThumb"`
	ScrollbarHover   string `json:"scrollbarThumbHover"`
	TerminalBg       string `json:"terminalBg"`
	GlassBg          string `json:"glassBg"`
	GlassBorder      string `json:"glassBorder"`
}

type Theme struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Author      string      `json:"author"`
	Version     string      `json:"version"`
	FontFamily  string      `json:"fontFamily"`
	Tags        []string    `json:"tags"`
	Builtin     bool        `json:"builtin"`
	Tokens      ThemeTokens `json:"tokens"`
	CreatedAt   string      `json:"createdAt"`
	UpdatedAt   string      `json:"updatedAt"`
}

type AgentThemeAssignment struct {
	AgentID string `json:"agentId"`
	ThemeID string `json:"themeId"`
}

type ThemeSchedule struct {
	DayThemeID   string `json:"dayThemeId"`
	NightThemeID string `json:"nightThemeId"`
	DayStart     string `json:"dayStart"`   // "08:00"
	NightStart   string `json:"nightStart"` // "20:00"
	Enabled      bool   `json:"enabled"`
}

var (
	themesMu           sync.RWMutex
	savedThemes        = make(map[string]*Theme)
	agentThemes        = make(map[string]string) // agentId → themeId
	themeSchedule      = ThemeSchedule{DayThemeID: "obsidian-command", NightThemeID: "obsidian-command", DayStart: "08:00", NightStart: "20:00", Enabled: false}
)

// ─── Handlers ────────────────────────────────────────────────────────────────

// GET /api/themes — list all saved themes
func handleGetThemes(w http.ResponseWriter, r *http.Request) {
	themesMu.RLock()
	themes := make([]*Theme, 0, len(savedThemes))
	for _, t := range savedThemes {
		themes = append(themes, t)
	}
	themesMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "themes": themes})
}

// POST /api/themes — save/update a theme
func handleSaveTheme(w http.ResponseWriter, r *http.Request) {
	var theme Theme
	if err := json.NewDecoder(r.Body).Decode(&theme); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	if theme.ID == "" || theme.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "id and name required"})
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	theme.UpdatedAt = now
	if theme.CreatedAt == "" {
		theme.CreatedAt = now
	}
	theme.Builtin = false

	themesMu.Lock()
	savedThemes[theme.ID] = &theme
	themesMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "theme": theme})
}

// DELETE /api/themes/:id — delete a theme
func handleDeleteTheme(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "id required"})
		return
	}
	themesMu.Lock()
	delete(savedThemes, id)
	themesMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// GET /api/themes/agent — get agent theme assignments
func handleGetAgentThemes(w http.ResponseWriter, r *http.Request) {
	themesMu.RLock()
	assignments := make([]AgentThemeAssignment, 0)
	for aid, tid := range agentThemes {
		assignments = append(assignments, AgentThemeAssignment{AgentID: aid, ThemeID: tid})
	}
	themesMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "assignments": assignments})
}

// POST /api/themes/agent — assign theme to agent
func handleSetAgentTheme(w http.ResponseWriter, r *http.Request) {
	var body AgentThemeAssignment
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	themesMu.Lock()
	if body.ThemeID == "" {
		delete(agentThemes, body.AgentID)
	} else {
		agentThemes[body.AgentID] = body.ThemeID
	}
	themesMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// GET /api/themes/schedule — get schedule config
func handleGetThemeSchedule(w http.ResponseWriter, r *http.Request) {
	themesMu.RLock()
	sched := themeSchedule
	themesMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "schedule": sched})
}

// POST /api/themes/schedule — set schedule config
func handleSetThemeSchedule(w http.ResponseWriter, r *http.Request) {
	var body ThemeSchedule
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	themesMu.Lock()
	themeSchedule = body
	themesMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "schedule": body})
}

// POST /api/themes/generate — generate theme from description using AI prompt
func handleGenerateTheme(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Description string `json:"description"`
		BaseThemeID string `json:"baseThemeId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	if body.Description == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "description required"})
		return
	}

	prompt := "Generate a Harbinger command center color theme based on this description: \"" + body.Description + "\". " +
		"Return a JSON object with these exact fields: " +
		"background, surface, surfaceLight, surfaceDark, textPrimary, textSecondary, border, " +
		"accent, accentHover, danger, success, warning, info, " +
		"scrollbarTrack, scrollbarThumb, scrollbarThumbHover, terminalBg, glassBg, glassBorder. " +
		"All values must be valid CSS colors (hex like #1a2b3c or rgba). " +
		"The theme should be dark-mode oriented, visually cohesive, and suitable for a security command center."

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"prompt":      prompt,
		"description": body.Description,
	})
}
