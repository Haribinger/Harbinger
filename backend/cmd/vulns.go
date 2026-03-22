package main

import (
	"encoding/json"
	"fmt"
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
	vulnStore   []Vulnerability
	vulnStoreMu sync.RWMutex
)

func init() {
	vulnStore = make([]Vulnerability, 0)
}

// GET /api/vulns — list all vulnerabilities
func handleListVulns(w http.ResponseWriter, r *http.Request) {
	vulnStoreMu.RLock()
	defer vulnStoreMu.RUnlock()

	// Filter by severity, status, category if query params present
	severity := r.URL.Query().Get("severity")
	status := r.URL.Query().Get("status")

	filtered := make([]Vulnerability, 0)
	for _, v := range vulnStore {
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
	for _, v := range vulnStore {
		summary[v.Severity]++
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"vulns":   filtered,
		"count":   len(filtered),
		"total":   len(vulnStore),
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

	vulnStoreMu.Lock()
	vulnStore = append(vulnStore, body)
	vulnStoreMu.Unlock()
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "vuln": body})
}

// GET /api/vulns/{id} — get a single vulnerability with all evidence
func handleGetVuln(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	vulnStoreMu.RLock()
	defer vulnStoreMu.RUnlock()
	for _, v := range vulnStore {
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

	vulnStoreMu.Lock()
	defer vulnStoreMu.Unlock()
	for i, v := range vulnStore {
		if v.ID == id {
			if status, ok := body["status"].(string); ok {
				vulnStore[i].Status = status
			}
			if remediation, ok := body["remediation"].(string); ok {
				vulnStore[i].Remediation = remediation
			}
			if description, ok := body["description"].(string); ok {
				vulnStore[i].Description = description
			}
			if impact, ok := body["impact"].(string); ok {
				vulnStore[i].Impact = impact
			}
			vulnStore[i].UpdatedAt = time.Now().Format(time.RFC3339)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "vuln": vulnStore[i]})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "vulnerability not found"})
}

// DELETE /api/vulns/{id} — delete a vulnerability
func handleDeleteVuln(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	vulnStoreMu.Lock()
	defer vulnStoreMu.Unlock()
	for i, v := range vulnStore {
		if v.ID == id {
			vulnStore = append(vulnStore[:i], vulnStore[i+1:]...)
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

	vulnStoreMu.Lock()
	defer vulnStoreMu.Unlock()
	for i, v := range vulnStore {
		if v.ID == id {
			vulnStore[i].Evidence = append(vulnStore[i].Evidence, body)
			vulnStore[i].UpdatedAt = time.Now().Format(time.RFC3339)
			writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "evidence": body})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "vulnerability not found"})
}
