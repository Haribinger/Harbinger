package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

// findings.go — Real-time findings feed for T3 (Findings Feed terminal).
// A Finding is a raw discovery by an agent during a mission. It may later
// be promoted to a Vulnerability (vulns.go) after triage.
//
// SSE streaming: on every new finding, we publish an EventTypeFinding
// to the realtime hub so connected T3 terminals see it instantly.

// Finding represents a single discovery from an agent during a mission.
type Finding struct {
	ID            string            `json:"id"`
	MissionID     string            `json:"missionId,omitempty"`
	TaskID        string            `json:"taskId,omitempty"`
	AgentCodename string            `json:"agentCodename"`
	Severity      string            `json:"severity"` // critical, high, medium, low, info
	Title         string            `json:"title"`
	Host          string            `json:"host"`
	Port          int               `json:"port,omitempty"`
	Endpoint      string            `json:"endpoint,omitempty"`
	Category      string            `json:"category"` // sqli, xss, rce, ssrf, idor, misconfig, info_disclosure, etc.
	Description   string            `json:"description"`
	Evidence      []FindingEvidence `json:"evidence"`
	Tool          string            `json:"tool,omitempty"`          // nuclei, subfinder, sqlmap, etc.
	ToolOutput    string            `json:"toolOutput,omitempty"`    // raw tool output snippet
	CVEID         string            `json:"cveId,omitempty"`
	CVSS          float64           `json:"cvss,omitempty"`
	Confidence    string            `json:"confidence"`              // confirmed, likely, possible, fp
	FalsePositive bool              `json:"falsePositive"`
	FPReason      string            `json:"fpReason,omitempty"`      // why it was marked FP
	Status        string            `json:"status"`                  // new, triaged, promoted, dismissed
	VulnID        string            `json:"vulnId,omitempty"`        // linked vuln ID if promoted
	Tags          []string          `json:"tags,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
	FoundAt       string            `json:"foundAt"`
	UpdatedAt     string            `json:"updatedAt"`
}

// FindingEvidence is a piece of proof attached to a finding.
type FindingEvidence struct {
	ID          string `json:"id"`
	Type        string `json:"type"` // request, response, screenshot, poc, log, code
	Title       string `json:"title"`
	Content     string `json:"content"`
	ContentType string `json:"contentType,omitempty"`
	CreatedAt   string `json:"createdAt"`
}

// FindingExport is the structure returned by the export endpoint.
type FindingExport struct {
	MissionID  string    `json:"missionId"`
	ExportedAt string    `json:"exportedAt"`
	Summary    FindingsSummary `json:"summary"`
	Findings   []Finding `json:"findings"`
}

// FindingsSummary provides severity/status counts for quick overview.
type FindingsSummary struct {
	Total         int            `json:"total"`
	BySeverity    map[string]int `json:"bySeverity"`
	ByCategory    map[string]int `json:"byCategory"`
	ByAgent       map[string]int `json:"byAgent"`
	FalsePositive int            `json:"falsePositive"`
}

var (
	findingCache   []Finding // Read cache — populated from DB on startup, updated on writes
	findingCacheMu sync.RWMutex
)

func init() {
	findingCache = make([]Finding, 0)
}

// loadFindingsFromDB populates the in-memory cache from Postgres.
// Called on startup so the UI shows data immediately.
func loadFindingsFromDB() {
	if !dbAvailable() {
		return
	}
	rows, err := db.Query(`
		SELECT id, COALESCE(mission_id,''), COALESCE(task_id,''), COALESCE(agent_codename,''),
		       severity, title, host, COALESCE(port,0), COALESCE(endpoint,''),
		       COALESCE(category,''), COALESCE(description,''),
		       COALESCE(evidence,'[]'), COALESCE(tool,''), COALESCE(tool_output,''),
		       COALESCE(cve_id,''), COALESCE(cvss,0), COALESCE(confidence,'possible'),
		       COALESCE(false_positive,false), COALESCE(fp_reason,''),
		       COALESCE(status,'new'), COALESCE(vuln_id,''),
		       COALESCE(tags,'[]'), COALESCE(metadata,'{}'),
		       COALESCE(found_at, NOW()), COALESCE(updated_at, NOW())
		FROM findings ORDER BY found_at DESC
	`)
	if err != nil {
		log.Printf("[DB] Failed to load findings: %v", err)
		return
	}
	defer rows.Close()

	var loaded []Finding
	for rows.Next() {
		var f Finding
		var evidenceJSON, tagsJSON, metadataJSON string
		var foundAt, updatedAt time.Time

		err := rows.Scan(
			&f.ID, &f.MissionID, &f.TaskID, &f.AgentCodename,
			&f.Severity, &f.Title, &f.Host, &f.Port, &f.Endpoint,
			&f.Category, &f.Description,
			&evidenceJSON, &f.Tool, &f.ToolOutput,
			&f.CVEID, &f.CVSS, &f.Confidence,
			&f.FalsePositive, &f.FPReason,
			&f.Status, &f.VulnID,
			&tagsJSON, &metadataJSON,
			&foundAt, &updatedAt,
		)
		if err != nil {
			log.Printf("[DB] Finding scan error: %v", err)
			continue
		}
		json.Unmarshal([]byte(evidenceJSON), &f.Evidence)
		json.Unmarshal([]byte(tagsJSON), &f.Tags)
		json.Unmarshal([]byte(metadataJSON), &f.Metadata)
		if f.Evidence == nil {
			f.Evidence = []FindingEvidence{}
		}
		f.FoundAt = foundAt.Format(time.RFC3339)
		f.UpdatedAt = updatedAt.Format(time.RFC3339)
		loaded = append(loaded, f)
	}

	findingCacheMu.Lock()
	findingCache = loaded
	findingCacheMu.Unlock()
	log.Printf("[DB] Loaded %d findings from database", len(loaded))
}

// dbInsertFinding persists a finding to Postgres. Returns error if DB unavailable.
func dbInsertFinding(f *Finding) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	evidenceJSON, _ := json.Marshal(f.Evidence)
	tagsJSON, _ := json.Marshal(f.Tags)
	metadataJSON, _ := json.Marshal(f.Metadata)

	_, err := db.Exec(`
		INSERT INTO findings (id, mission_id, task_id, agent_codename, severity, title, host, port,
		    endpoint, category, description, evidence, tool, tool_output, cve_id, cvss,
		    confidence, false_positive, fp_reason, status, vuln_id, tags, metadata, found_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
	`,
		f.ID, f.MissionID, f.TaskID, f.AgentCodename, f.Severity, f.Title, f.Host, f.Port,
		f.Endpoint, f.Category, f.Description, string(evidenceJSON), f.Tool, f.ToolOutput,
		f.CVEID, f.CVSS, f.Confidence, f.FalsePositive, f.FPReason, f.Status, f.VulnID,
		string(tagsJSON), string(metadataJSON), f.FoundAt, f.UpdatedAt,
	)
	return err
}

// buildFindingsSummary computes counts across severity, category, and agent.
func buildFindingsSummary(findings []Finding) FindingsSummary {
	s := FindingsSummary{
		Total:      len(findings),
		BySeverity: map[string]int{"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
		ByCategory: make(map[string]int),
		ByAgent:    make(map[string]int),
	}
	for _, f := range findings {
		s.BySeverity[f.Severity]++
		if f.Category != "" {
			s.ByCategory[f.Category]++
		}
		if f.AgentCodename != "" {
			s.ByAgent[f.AgentCodename]++
		}
		if f.FalsePositive {
			s.FalsePositive++
		}
	}
	return s
}

// GET /api/findings — list findings with optional filters
func handleListFindings(w http.ResponseWriter, r *http.Request) {
	findingCacheMu.RLock()
	defer findingCacheMu.RUnlock()

	severity := r.URL.Query().Get("severity")
	missionID := r.URL.Query().Get("missionId")
	agent := r.URL.Query().Get("agent")
	status := r.URL.Query().Get("status")
	category := r.URL.Query().Get("category")
	hideFP := r.URL.Query().Get("hideFalsePositives") == "true"

	filtered := make([]Finding, 0)
	for _, f := range findingCache {
		if severity != "" && f.Severity != severity {
			continue
		}
		if missionID != "" && f.MissionID != missionID {
			continue
		}
		if agent != "" && f.AgentCodename != agent {
			continue
		}
		if status != "" && f.Status != status {
			continue
		}
		if category != "" && f.Category != category {
			continue
		}
		if hideFP && f.FalsePositive {
			continue
		}
		filtered = append(filtered, f)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"findings": filtered,
		"count":    len(filtered),
		"total":    len(findingCache),
		"summary":  buildFindingsSummary(filtered),
	})
}

// POST /api/findings — create a new finding (and publish to SSE)
func handleCreateFinding(w http.ResponseWriter, r *http.Request) {
	var body Finding
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	if body.Title == "" || body.Severity == "" || body.Host == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "title, severity, and host required"})
		return
	}

	now := time.Now()
	body.ID = fmt.Sprintf("find-%d", now.UnixMilli())
	body.FoundAt = now.Format(time.RFC3339)
	body.UpdatedAt = now.Format(time.RFC3339)
	if body.Status == "" {
		body.Status = "new"
	}
	if body.Confidence == "" {
		body.Confidence = "possible"
	}
	if body.Evidence == nil {
		body.Evidence = []FindingEvidence{}
	}

	// Persist to Postgres first — cache is secondary
	if err := dbInsertFinding(&body); err != nil {
		log.Printf("[FINDINGS] DB insert failed (caching in-memory only): %v", err)
	}

	findingCacheMu.Lock()
	findingCache = append(findingCache, body)
	findingCacheMu.Unlock()

	// Publish to realtime SSE bus so T3 terminals see it live
	publishEvent(RealtimeEvent{
		ID:      genRTID("finding"),
		Type:    EventTypeFinding,
		Source:  body.AgentCodename,
		Target:  "broadcast",
		Channel: "findings",
		Payload: map[string]any{
			"findingId":     body.ID,
			"title":         body.Title,
			"severity":      body.Severity,
			"host":          body.Host,
			"category":      body.Category,
			"agentCodename": body.AgentCodename,
			"missionId":     body.MissionID,
			"confidence":    body.Confidence,
		},
		Timestamp: now.Format(time.RFC3339),
	})

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "finding": body})
}

// GET /api/findings/{id} — get a single finding
func handleGetFinding(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	findingCacheMu.RLock()
	defer findingCacheMu.RUnlock()
	for _, f := range findingCache {
		if f.ID == id {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "finding": f})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "finding not found"})
}

// PATCH /api/findings/{id} — update a finding
func handleUpdateFinding(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	findingCacheMu.Lock()
	defer findingCacheMu.Unlock()
	for i, f := range findingCache {
		if f.ID == id {
			if v, ok := body["status"].(string); ok {
				findingCache[i].Status = v
			}
			if v, ok := body["severity"].(string); ok {
				findingCache[i].Severity = v
			}
			if v, ok := body["confidence"].(string); ok {
				findingCache[i].Confidence = v
			}
			if v, ok := body["description"].(string); ok {
				findingCache[i].Description = v
			}
			if v, ok := body["category"].(string); ok {
				findingCache[i].Category = v
			}
			if v, ok := body["vulnId"].(string); ok {
				findingCache[i].VulnID = v
				findingCache[i].Status = "promoted"
			}
			findingCache[i].UpdatedAt = time.Now().Format(time.RFC3339)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "finding": findingCache[i]})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "finding not found"})
}

// DELETE /api/findings/{id} — delete a finding
func handleDeleteFinding(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	findingCacheMu.Lock()
	defer findingCacheMu.Unlock()
	for i, f := range findingCache {
		if f.ID == id {
			findingCache = append(findingCache[:i], findingCache[i+1:]...)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "finding not found"})
}

// POST /api/findings/{id}/false-positive — toggle false positive status
func handleToggleFalsePositive(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		FalsePositive bool   `json:"falsePositive"`
		Reason        string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	findingCacheMu.Lock()
	defer findingCacheMu.Unlock()
	for i, f := range findingCache {
		if f.ID == id {
			findingCache[i].FalsePositive = body.FalsePositive
			findingCache[i].FPReason = body.Reason
			if body.FalsePositive {
				findingCache[i].Status = "dismissed"
				findingCache[i].Confidence = "fp"
			} else {
				// Un-marking FP restores to triaged
				findingCache[i].Status = "triaged"
				if findingCache[i].Confidence == "fp" {
					findingCache[i].Confidence = "possible"
				}
			}
			findingCache[i].UpdatedAt = time.Now().Format(time.RFC3339)

			publishEvent(RealtimeEvent{
				ID:      genRTID("fp"),
				Type:    EventTypeFinding,
				Source:  "operator",
				Target:  "broadcast",
				Channel: "findings",
				Payload: map[string]any{
					"findingId":     id,
					"falsePositive": body.FalsePositive,
					"reason":        body.Reason,
					"action":        "false_positive_toggle",
				},
				Timestamp: time.Now().Format(time.RFC3339),
			})

			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "finding": findingCache[i]})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "finding not found"})
}

// POST /api/findings/{id}/evidence — add evidence to a finding
func handleAddFindingEvidence(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body FindingEvidence
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	body.ID = fmt.Sprintf("fev-%d", time.Now().UnixMilli())
	body.CreatedAt = time.Now().Format(time.RFC3339)

	findingCacheMu.Lock()
	defer findingCacheMu.Unlock()
	for i, f := range findingCache {
		if f.ID == id {
			findingCache[i].Evidence = append(findingCache[i].Evidence, body)
			findingCache[i].UpdatedAt = time.Now().Format(time.RFC3339)
			writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "evidence": body})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "finding not found"})
}

// GET /api/findings/export — export findings for report generation
func handleExportFindings(w http.ResponseWriter, r *http.Request) {
	findingCacheMu.RLock()
	defer findingCacheMu.RUnlock()

	missionID := r.URL.Query().Get("missionId")
	format := r.URL.Query().Get("format") // json (default) or csv
	hideFP := r.URL.Query().Get("hideFalsePositives") == "true"

	filtered := make([]Finding, 0)
	for _, f := range findingCache {
		if missionID != "" && f.MissionID != missionID {
			continue
		}
		if hideFP && f.FalsePositive {
			continue
		}
		filtered = append(filtered, f)
	}

	if format == "csv" {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment; filename=findings.csv")
		w.WriteHeader(http.StatusOK)
		// CSV header
		fmt.Fprintln(w, "id,severity,title,host,port,endpoint,category,agent,tool,confidence,false_positive,status,cve_id,cvss,found_at")
		for _, f := range filtered {
			fmt.Fprintf(w, "%s,%s,%s,%s,%d,%s,%s,%s,%s,%s,%t,%s,%s,%.1f,%s\n",
				csvEscape(f.ID), f.Severity, csvEscape(f.Title), csvEscape(f.Host),
				f.Port, csvEscape(f.Endpoint), f.Category, f.AgentCodename,
				f.Tool, f.Confidence, f.FalsePositive, f.Status,
				f.CVEID, f.CVSS, f.FoundAt)
		}
		return
	}

	// Default: JSON export
	export := FindingExport{
		MissionID:  missionID,
		ExportedAt: time.Now().Format(time.RFC3339),
		Summary:    buildFindingsSummary(filtered),
		Findings:   filtered,
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "export": export})
}

// GET /api/findings/stream — SSE endpoint for real-time findings
// Subscribes to the realtime hub filtered to EventTypeFinding events.
func handleFindingsStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "streaming not supported"})
		return
	}

	missionFilter := r.URL.Query().Get("missionId")

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	// Register an SSE client on the "findings" channel
	clientID := genRTID("fstream")
	client := &SSEClient{
		ID:      clientID,
		Channel: "findings",
		Events:  make(chan RealtimeEvent, 64),
		Done:    make(chan struct{}),
	}

	realtimeHub.Lock()
	realtimeHub.clients[clientID] = client
	realtimeHub.Unlock()

	defer func() {
		realtimeHub.Lock()
		delete(realtimeHub.clients, clientID)
		realtimeHub.Unlock()
		close(client.Done)
	}()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case event := <-client.Events:
			if event.Type != EventTypeFinding {
				continue
			}
			// Filter by mission if requested
			if missionFilter != "" {
				if mid, ok := event.Payload["missionId"].(string); ok && mid != missionFilter {
					continue
				}
			}
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

// GET /api/findings/summary — quick severity/category summary
func handleFindingsSummary(w http.ResponseWriter, r *http.Request) {
	findingCacheMu.RLock()
	defer findingCacheMu.RUnlock()

	missionID := r.URL.Query().Get("missionId")

	filtered := findingCache
	if missionID != "" {
		filtered = make([]Finding, 0)
		for _, f := range findingCache {
			if f.MissionID == missionID {
				filtered = append(filtered, f)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"summary": buildFindingsSummary(filtered),
	})
}

// csvEscape wraps values containing commas or quotes for CSV output.
func csvEscape(s string) string {
	if strings.ContainsAny(s, ",\"\n") {
		return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}
