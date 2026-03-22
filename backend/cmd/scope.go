package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// scope.go — Target scope management for pentesting engagements.
// Stores in-scope assets and exclusions with tags, validation, and bulk import.

type ScopeAsset struct {
	ID        string   `json:"id"`
	Pattern   string   `json:"pattern"`
	Type      string   `json:"type"` // Wildcard, Web App, CIDR, API, Mobile
	Tags      []string `json:"tags"`
	AddedBy   string   `json:"addedBy,omitempty"`
	CreatedAt string   `json:"createdAt"`
}

type ScopeExclusion struct {
	ID        string   `json:"id"`
	Pattern   string   `json:"pattern"`
	Reason    string   `json:"reason"`
	Tags      []string `json:"tags"`
	AddedBy   string   `json:"addedBy,omitempty"`
	CreatedAt string   `json:"createdAt"`
}

var (
	scopeAssets     []ScopeAsset
	scopeExclusions []ScopeExclusion
	scopeMu         sync.RWMutex
)

func init() {
	scopeAssets = make([]ScopeAsset, 0)
	scopeExclusions = make([]ScopeExclusion, 0)
}

// GET /api/scope/assets — list all in-scope assets
func handleListScopeAssets(w http.ResponseWriter, r *http.Request) {
	scopeMu.RLock()
	defer scopeMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "assets": scopeAssets, "count": len(scopeAssets)})
}

// POST /api/scope/assets — add a single in-scope asset
func handleAddScopeAsset(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Pattern string   `json:"pattern"`
		Type    string   `json:"type"`
		Tags    []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	if body.Pattern == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "pattern required"})
		return
	}
	if body.Type == "" {
		body.Type = inferAssetType(body.Pattern)
	}
	userID, _ := getUserIDFromContext(r.Context())
	asset := ScopeAsset{
		ID:        fmt.Sprintf("scope-%d", time.Now().UnixMilli()),
		Pattern:   body.Pattern,
		Type:      body.Type,
		Tags:      body.Tags,
		AddedBy:   userID,
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	scopeMu.Lock()
	scopeAssets = append(scopeAssets, asset)
	scopeMu.Unlock()
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "asset": asset})
}

// DELETE /api/scope/assets/{id} — remove an in-scope asset
func handleDeleteScopeAsset(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	scopeMu.Lock()
	defer scopeMu.Unlock()
	for i, a := range scopeAssets {
		if a.ID == id {
			scopeAssets = append(scopeAssets[:i], scopeAssets[i+1:]...)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "asset not found"})
}

// POST /api/scope/assets/bulk — bulk import assets from text (one pattern per line)
func handleBulkImportScope(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Text   string `json:"text"`
		Target string `json:"target"` // "in-scope" or "exclusion"
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	lines := strings.Split(strings.TrimSpace(body.Text), "\n")
	userID, _ := getUserIDFromContext(r.Context())
	added := 0

	scopeMu.Lock()
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		id := fmt.Sprintf("scope-%d-%d", time.Now().UnixMilli(), added)
		if body.Target == "exclusion" {
			scopeExclusions = append(scopeExclusions, ScopeExclusion{
				ID:        id,
				Pattern:   line,
				Reason:    "Bulk import",
				Tags:      []string{"imported"},
				AddedBy:   userID,
				CreatedAt: time.Now().Format(time.RFC3339),
			})
		} else {
			scopeAssets = append(scopeAssets, ScopeAsset{
				ID:        id,
				Pattern:   line,
				Type:      inferAssetType(line),
				Tags:      []string{"imported"},
				AddedBy:   userID,
				CreatedAt: time.Now().Format(time.RFC3339),
			})
		}
		added++
	}
	scopeMu.Unlock()
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "added": added})
}

// GET /api/scope/exclusions — list all exclusions
func handleListScopeExclusions(w http.ResponseWriter, r *http.Request) {
	scopeMu.RLock()
	defer scopeMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "exclusions": scopeExclusions, "count": len(scopeExclusions)})
}

// POST /api/scope/exclusions — add an exclusion
func handleAddScopeExclusion(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Pattern string   `json:"pattern"`
		Reason  string   `json:"reason"`
		Tags    []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	if body.Pattern == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "pattern required"})
		return
	}
	userID, _ := getUserIDFromContext(r.Context())
	excl := ScopeExclusion{
		ID:        fmt.Sprintf("excl-%d", time.Now().UnixMilli()),
		Pattern:   body.Pattern,
		Reason:    body.Reason,
		Tags:      body.Tags,
		AddedBy:   userID,
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	scopeMu.Lock()
	scopeExclusions = append(scopeExclusions, excl)
	scopeMu.Unlock()
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "exclusion": excl})
}

// DELETE /api/scope/exclusions/{id} — remove an exclusion
func handleDeleteScopeExclusion(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	scopeMu.Lock()
	defer scopeMu.Unlock()
	for i, e := range scopeExclusions {
		if e.ID == id {
			scopeExclusions = append(scopeExclusions[:i], scopeExclusions[i+1:]...)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "exclusion not found"})
}

// GET /api/scope/export — export scope as JSON
func handleExportScope(w http.ResponseWriter, r *http.Request) {
	scopeMu.RLock()
	defer scopeMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"assets":     scopeAssets,
		"exclusions": scopeExclusions,
		"exportedAt": time.Now().Format(time.RFC3339),
	})
}

// inferAssetType guesses the asset type from the pattern string
func inferAssetType(pattern string) string {
	if strings.Contains(pattern, "/") && (strings.Contains(pattern, ".0") || strings.Count(pattern, ".") >= 3) {
		return "CIDR"
	}
	if strings.HasPrefix(pattern, "*.") {
		return "Wildcard"
	}
	if strings.Contains(pattern, "api") || strings.Contains(pattern, "API") {
		return "API"
	}
	if strings.Contains(pattern, "mobile") || strings.Contains(pattern, "app.") {
		return "Mobile"
	}
	return "Web App"
}
