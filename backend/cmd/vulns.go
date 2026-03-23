package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// vulns.go — Vulnerability database for findings, evidence, and remediation tracking.
// Powers VulnDeepDive, RemediationTracker, and PentestDashboard pages.

type Vulnerability struct {
	ID          string            `json:"id"`
	Title       string            `json:"title"`
	Severity    string            `json:"severity"` // critical, high, medium, low, info
	Status      string            `json:"status"`   // new, triaged, in_progress, remediated, verified, accepted_risk
	CVEID       string            `json:"cveId,omitempty"`
	CVSS        float64           `json:"cvss,omitempty"`
	Target      string            `json:"target"`
	Endpoint    string            `json:"endpoint,omitempty"`
	Category    string            `json:"category"` // sqli, xss, rce, ssrf, idor, auth_bypass, etc.
	Description string            `json:"description"`
	Impact      string            `json:"impact,omitempty"`
	Remediation string            `json:"remediation,omitempty"`
	Evidence    []VulnEvidence     `json:"evidence"`
	AgentID     string            `json:"agentId,omitempty"` // which agent found it
	AgentName   string            `json:"agentName,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	FoundAt     string            `json:"foundAt"`
	UpdatedAt   string            `json:"updatedAt"`
	SLADeadline string            `json:"slaDeadline,omitempty"`
}

type VulnEvidence struct {
	ID          string `json:"id"`
	Type        string `json:"type"` // screenshot, request, response, code, poc, log
	Title       string `json:"title"`
	Content     string `json:"content"`
	ContentType string `json:"contentType,omitempty"` // text/plain, image/png, application/json
	CreatedAt   string `json:"createdAt"`
}

var (
	vulnCache   []Vulnerability
	vulnCacheMu sync.RWMutex
)

func init() {
	vulnCache = make([]Vulnerability, 0)
}

// loadVulnsFromDB populates the in-memory cache from Postgres on startup.
func loadVulnsFromDB() {
	if !dbAvailable() {
		return
	}
	rows, err := db.Query(`
		SELECT id, title, severity, status, COALESCE(cve_id,''), COALESCE(cvss,0),
		       COALESCE(target,''), COALESCE(endpoint,''), COALESCE(category,''),
		       COALESCE(description,''), COALESCE(impact,''), COALESCE(remediation,''),
		       COALESCE(evidence,'[]'), COALESCE(agent_id,''), COALESCE(agent_name,''),
		       COALESCE(tags,'[]'), COALESCE(metadata,'{}'),
		       COALESCE(found_at, NOW()), COALESCE(updated_at, NOW())
		FROM vulnerabilities ORDER BY found_at DESC
	`)
	if err != nil {
		log.Printf("[DB] Failed to load vulns: %v", err)
		return
	}
	defer rows.Close()

	var loaded []Vulnerability
	for rows.Next() {
		var v Vulnerability
		var evidenceJSON, tagsJSON, metadataJSON string
		var foundAt, updatedAt time.Time
		err := rows.Scan(
			&v.ID, &v.Title, &v.Severity, &v.Status, &v.CVEID, &v.CVSS,
			&v.Target, &v.Endpoint, &v.Category, &v.Description, &v.Impact, &v.Remediation,
			&evidenceJSON, &v.AgentID, &v.AgentName,
			&tagsJSON, &metadataJSON, &foundAt, &updatedAt,
		)
		if err != nil {
			log.Printf("[DB] Vuln scan error: %v", err)
			continue
		}
		json.Unmarshal([]byte(evidenceJSON), &v.Evidence)
		json.Unmarshal([]byte(tagsJSON), &v.Tags)
		json.Unmarshal([]byte(metadataJSON), &v.Metadata)
		if v.Evidence == nil {
			v.Evidence = []VulnEvidence{}
		}
		v.FoundAt = foundAt.Format(time.RFC3339)
		v.UpdatedAt = updatedAt.Format(time.RFC3339)
		loaded = append(loaded, v)
	}

	vulnCacheMu.Lock()
	vulnCache = loaded
	vulnCacheMu.Unlock()
	log.Printf("[DB] Loaded %d vulnerabilities from database", len(loaded))
}

func dbInsertVuln(v *Vulnerability) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	evidenceJSON, _ := json.Marshal(v.Evidence)
	tagsJSON, _ := json.Marshal(v.Tags)
	metadataJSON, _ := json.Marshal(v.Metadata)

	_, err := db.Exec(`
		INSERT INTO vulnerabilities (id, title, severity, status, cve_id, cvss, target, endpoint,
		    category, description, impact, remediation, evidence, agent_id, agent_name,
		    tags, metadata, found_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
	`,
		v.ID, v.Title, v.Severity, v.Status, v.CVEID, v.CVSS, v.Target, v.Endpoint,
		v.Category, v.Description, v.Impact, v.Remediation, string(evidenceJSON),
		v.AgentID, v.AgentName, string(tagsJSON), string(metadataJSON), v.FoundAt, v.UpdatedAt,
	)
	return err
}

// GET /api/vulns — list all vulnerabilities
func handleListVulns(w http.ResponseWriter, r *http.Request) {
	vulnCacheMu.RLock()
	defer vulnCacheMu.RUnlock()

	// Filter by severity, status, category if query params present
	severity := r.URL.Query().Get("severity")
	status := r.URL.Query().Get("status")

	filtered := make([]Vulnerability, 0)
	for _, v := range vulnCache {
		if severity != "" && v.Severity != severity {
			continue
		}
		if status != "" && v.Status != status {
			continue
		}
		filtered = append(filtered, v)
	}

	// Build severity summary
	summary := map[string]int{"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
	for _, v := range vulnCache {
		summary[v.Severity]++
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"vulns":   filtered,
		"count":   len(filtered),
		"total":   len(vulnCache),
		"summary": summary,
	})
}

// POST /api/vulns — create a new vulnerability
func handleCreateVuln(w http.ResponseWriter, r *http.Request) {
	var body Vulnerability
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	if body.Title == "" || body.Severity == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "title and severity required"})
		return
	}

	now := time.Now().Format(time.RFC3339)
	body.ID = fmt.Sprintf("vuln-%d", time.Now().UnixMilli())
	body.FoundAt = now
	body.UpdatedAt = now
	if body.Status == "" {
		body.Status = "new"
	}
	if body.Evidence == nil {
		body.Evidence = []VulnEvidence{}
	}

	// Calculate SLA deadline based on severity
	switch body.Severity {
	case "critical":
		body.SLADeadline = time.Now().Add(24 * time.Hour).Format(time.RFC3339)
	case "high":
		body.SLADeadline = time.Now().Add(72 * time.Hour).Format(time.RFC3339)
	case "medium":
		body.SLADeadline = time.Now().Add(7 * 24 * time.Hour).Format(time.RFC3339)
	case "low":
		body.SLADeadline = time.Now().Add(30 * 24 * time.Hour).Format(time.RFC3339)
	}

	// Persist to Postgres first
	if err := dbInsertVuln(&body); err != nil {
		log.Printf("[VULNS] DB insert failed (caching in-memory only): %v", err)
	}

	vulnCacheMu.Lock()
	vulnCache = append(vulnCache, body)
	vulnCacheMu.Unlock()
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "vuln": body})
}

// GET /api/vulns/{id} — get a single vulnerability with all evidence
func handleGetVuln(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	vulnCacheMu.RLock()
	defer vulnCacheMu.RUnlock()
	for _, v := range vulnCache {
		if v.ID == id {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "vuln": v})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "vulnerability not found"})
}

// PATCH /api/vulns/{id} — update vulnerability (status, remediation, etc.)
func handleUpdateVuln(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	vulnCacheMu.Lock()
	defer vulnCacheMu.Unlock()
	for i, v := range vulnCache {
		if v.ID == id {
			if status, ok := body["status"].(string); ok {
				vulnCache[i].Status = status
			}
			if remediation, ok := body["remediation"].(string); ok {
				vulnCache[i].Remediation = remediation
			}
			if description, ok := body["description"].(string); ok {
				vulnCache[i].Description = description
			}
			if impact, ok := body["impact"].(string); ok {
				vulnCache[i].Impact = impact
			}
			vulnCache[i].UpdatedAt = time.Now().Format(time.RFC3339)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "vuln": vulnCache[i]})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "vulnerability not found"})
}

// DELETE /api/vulns/{id} — delete a vulnerability
func handleDeleteVuln(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	vulnCacheMu.Lock()
	defer vulnCacheMu.Unlock()
	for i, v := range vulnCache {
		if v.ID == id {
			vulnCache = append(vulnCache[:i], vulnCache[i+1:]...)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "vulnerability not found"})
}

// POST /api/vulns/{id}/evidence — add evidence to a vulnerability
func handleAddEvidence(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body VulnEvidence
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	body.ID = fmt.Sprintf("ev-%d", time.Now().UnixMilli())
	body.CreatedAt = time.Now().Format(time.RFC3339)

	vulnCacheMu.Lock()
	defer vulnCacheMu.Unlock()
	for i, v := range vulnCache {
		if v.ID == id {
			vulnCache[i].Evidence = append(vulnCache[i].Evidence, body)
			vulnCache[i].UpdatedAt = time.Now().Format(time.RFC3339)
			writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "evidence": body})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "vulnerability not found"})
}
