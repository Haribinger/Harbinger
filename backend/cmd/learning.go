package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ============================================================================
// LEARNING SYSTEM — Technique scoring, campaign tracking, LOL discovery,
// agent performance metrics, and a heuristic recommendation engine.
//
// All subsystems use in-memory stores with RWMutex guards. No external
// dependencies — everything is stdlib-only.
// ============================================================================

// genLearnID produces a namespaced nanosecond ID to avoid collisions across
// concurrent agents writing results simultaneously.
func genLearnID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

// ============================================================================
// § 1 — TECHNIQUE SCORING
// ============================================================================
//
// Tracks per-technique execution outcomes sourced from live agent runs.
// Success/failure/detection counters drive derived rates that feed the
// recommendation engine later. All rates are recomputed on every write so
// reads are always O(1).

// TechniqueScore is the canonical record for one ATT&CK technique's
// operational history across all agents.
type TechniqueScore struct {
	ID               string   `json:"id"`
	TechniqueID      string   `json:"techniqueId"`      // e.g. "T1105"
	TechniqueName    string   `json:"techniqueName"`
	Platform         string   `json:"platform"`         // windows, linux, macos, cloud
	SuccessCount     int      `json:"successCount"`
	FailureCount     int      `json:"failureCount"`
	DetectionCount   int      `json:"detectionCount"`
	SuccessRate      float64  `json:"successRate"`      // 0.0–1.0, recomputed on write
	DetectionRate    float64  `json:"detectionRate"`    // detections / total runs
	AvgExecutionTime float64  `json:"avgExecutionTime"` // seconds, rolling average
	LastUsed         string   `json:"lastUsed"`
	Tags             []string `json:"tags"`
	Notes            string   `json:"notes"`
}

// techniqueStore holds all scores keyed by TechniqueID (not ID) so lookups
// by MITRE ID are O(1) without a secondary index.
var techniqueStore = struct {
	sync.RWMutex
	scores map[string]*TechniqueScore // key = TechniqueID
}{
	scores: make(map[string]*TechniqueScore),
}

// recomputeTechniqueRates updates derived fields. Must be called under a write
// lock on techniqueStore.
func recomputeTechniqueRates(ts *TechniqueScore) {
	total := ts.SuccessCount + ts.FailureCount
	if total == 0 {
		ts.SuccessRate = 0
		ts.DetectionRate = 0
		return
	}
	ts.SuccessRate = float64(ts.SuccessCount) / float64(total)
	ts.DetectionRate = float64(ts.DetectionCount) / float64(total)
}

// handleListTechniqueScores returns all technique scores with optional filtering.
// GET /api/learning/techniques
//
// Query params:
//
//	platform=windows|linux|macos|cloud
//	minSuccessRate=0.75  (float 0–1)
//	sortBy=success_rate|detection_rate|usage
func handleListTechniqueScores(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	platformFilter := q.Get("platform")
	minRateStr := q.Get("minSuccessRate")
	sortBy := q.Get("sortBy")

	var minRate float64
	if minRateStr != "" {
		if v, err := strconv.ParseFloat(minRateStr, 64); err == nil {
			minRate = v
		}
	}

	techniqueStore.RLock()
	result := make([]*TechniqueScore, 0, len(techniqueStore.scores))
	for _, ts := range techniqueStore.scores {
		if platformFilter != "" && !strings.EqualFold(ts.Platform, platformFilter) {
			continue
		}
		if minRateStr != "" && ts.SuccessRate < minRate {
			continue
		}
		// Return a shallow copy so the caller can't mutate the store through
		// the returned slice pointers.
		cp := *ts
		result = append(result, &cp)
	}
	techniqueStore.RUnlock()

	switch sortBy {
	case "detection_rate":
		sort.Slice(result, func(i, j int) bool {
			return result[i].DetectionRate < result[j].DetectionRate
		})
	case "usage":
		sort.Slice(result, func(i, j int) bool {
			ti := result[i].SuccessCount + result[i].FailureCount
			tj := result[j].SuccessCount + result[j].FailureCount
			return ti > tj
		})
	default: // success_rate
		sort.Slice(result, func(i, j int) bool {
			return result[i].SuccessRate > result[j].SuccessRate
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"items":  result,
		"count":  len(result),
	})
}

// handleGetTechniqueScore returns a single score by TechniqueID path param.
// GET /api/learning/techniques/{id}
func handleGetTechniqueScore(w http.ResponseWriter, r *http.Request) {
	tid := r.PathValue("id")
	if tid == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "technique id required"})
		return
	}

	techniqueStore.RLock()
	ts, ok := techniqueStore.scores[tid]
	var cp TechniqueScore
	if ok {
		cp = *ts
	}
	techniqueStore.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "technique not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "score": cp})
}

// handleRecordTechniqueResult ingests a single execution result for a technique.
// POST /api/learning/techniques/{id}/result
//
// Body: { "success": bool, "detected": bool, "executionTime": float64, "notes": string }
//
// If the technique has never been seen before a new record is bootstrapped;
// the caller must include techniqueName and platform in the body on first write
// because we have no external registry to look them up from.
func handleRecordTechniqueResult(w http.ResponseWriter, r *http.Request) {
	tid := r.PathValue("id")
	if tid == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "technique id required"})
		return
	}

	var input struct {
		Success       bool    `json:"success"`
		Detected      bool    `json:"detected"`
		ExecutionTime float64 `json:"executionTime"`
		Notes         string  `json:"notes"`
		// Bootstrap fields — only used when creating a new record
		TechniqueName string   `json:"techniqueName"`
		Platform      string   `json:"platform"`
		Tags          []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	techniqueStore.Lock()

	ts, exists := techniqueStore.scores[tid]
	if !exists {
		// First time this technique has been recorded — create the record.
		name := input.TechniqueName
		if name == "" {
			name = tid
		}
		platform := input.Platform
		if platform == "" {
			platform = "unknown"
		}
		ts = &TechniqueScore{
			ID:          genLearnID("ts"),
			TechniqueID: tid,
			TechniqueName: name,
			Platform:    platform,
			Tags:        input.Tags,
		}
		techniqueStore.scores[tid] = ts
	}

	// Update counters
	totalBefore := ts.SuccessCount + ts.FailureCount
	if input.Success {
		ts.SuccessCount++
	} else {
		ts.FailureCount++
	}
	if input.Detected {
		ts.DetectionCount++
	}

	// Rolling average for execution time — weight previous average by run count
	// so a single outlier doesn't dominate after many runs.
	if input.ExecutionTime > 0 {
		if totalBefore == 0 {
			ts.AvgExecutionTime = input.ExecutionTime
		} else {
			ts.AvgExecutionTime = (ts.AvgExecutionTime*float64(totalBefore) + input.ExecutionTime) / float64(totalBefore+1)
		}
	}

	if input.Notes != "" {
		ts.Notes = input.Notes
	}
	ts.LastUsed = time.Now().UTC().Format(time.RFC3339)

	recomputeTechniqueRates(ts)
	cp := *ts

	techniqueStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "score": cp})
}

// handleResetTechniqueScore zeroes all counters for a technique without
// deleting the record — useful after an operator changes tooling or evasion
// approach such that historical data is no longer meaningful.
// DELETE /api/learning/techniques/{id}
func handleResetTechniqueScore(w http.ResponseWriter, r *http.Request) {
	tid := r.PathValue("id")
	if tid == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "technique id required"})
		return
	}

	techniqueStore.Lock()
	ts, ok := techniqueStore.scores[tid]
	if !ok {
		techniqueStore.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "technique not found"})
		return
	}

	ts.SuccessCount = 0
	ts.FailureCount = 0
	ts.DetectionCount = 0
	ts.SuccessRate = 0
	ts.DetectionRate = 0
	ts.AvgExecutionTime = 0
	ts.LastUsed = time.Now().UTC().Format(time.RFC3339)
	cp := *ts
	techniqueStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "score": cp})
}

// ============================================================================
// § 2 — CAMPAIGN TRACKING
// ============================================================================
//
// Campaigns represent multi-step operations against a target. Each campaign
// accumulates a timeline of discrete events as agents execute steps, enabling
// post-op analysis and feeding technique scores.

// CampaignEvent records a discrete moment in a campaign's timeline.
type CampaignEvent struct {
	Timestamp   string `json:"timestamp"`
	EventType   string `json:"eventType"`   // step_started, step_completed, step_failed, detection_alert, operator_override, campaign_paused, campaign_resumed
	TechniqueID string `json:"techniqueId"` // may be empty for non-technique events
	Details     string `json:"details"`
}

// CampaignRecord is the root tracking object for a single operation campaign.
type CampaignRecord struct {
	ID               string          `json:"id"`
	Name             string          `json:"name"`
	OperationID      string          `json:"operationId"`
	Status           string          `json:"status"`           // planning, active, paused, completed, failed
	StartedAt        string          `json:"startedAt"`
	CompletedAt      string          `json:"completedAt,omitempty"`
	TechniquesUsed   []string        `json:"techniquesUsed"`
	SuccessfulSteps  int             `json:"successfulSteps"`
	FailedSteps      int             `json:"failedSteps"`
	DetectedSteps    int             `json:"detectedSteps"`
	TotalSteps       int             `json:"totalSteps"`
	ProgressPercent  float64         `json:"progressPercent"`
	Timeline         []CampaignEvent `json:"timeline"`
	Notes            string          `json:"notes"`
}

var campaignStore = struct {
	sync.RWMutex
	records map[string]*CampaignRecord // key = campaign ID
}{
	records: make(map[string]*CampaignRecord),
}

// handleListCampaigns returns campaigns, optionally filtered by status.
// GET /api/learning/campaigns?status=active
func handleListCampaigns(w http.ResponseWriter, r *http.Request) {
	statusFilter := r.URL.Query().Get("status")

	campaignStore.RLock()
	result := make([]CampaignRecord, 0, len(campaignStore.records))
	for _, c := range campaignStore.records {
		if statusFilter != "" && c.Status != statusFilter {
			continue
		}
		result = append(result, *c)
	}
	campaignStore.RUnlock()

	// Newest first by StartedAt string — RFC3339 sorts lexicographically.
	sort.Slice(result, func(i, j int) bool {
		return result[i].StartedAt > result[j].StartedAt
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"items": result,
		"count": len(result),
	})
}

// handleGetCampaign returns a single campaign record with full timeline.
// GET /api/learning/campaigns/{id}
func handleGetCampaign(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "campaign id required"})
		return
	}

	campaignStore.RLock()
	c, ok := campaignStore.records[id]
	var cp CampaignRecord
	if ok {
		cp = *c
	}
	campaignStore.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "campaign not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "campaign": cp})
}

// handleCreateCampaign instantiates a new campaign record.
// POST /api/learning/campaigns
func handleCreateCampaign(w http.ResponseWriter, r *http.Request) {
	var input CampaignRecord
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if input.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "name is required"})
		return
	}

	input.ID = genLearnID("camp")
	if input.Status == "" {
		input.Status = "planning"
	}
	if input.StartedAt == "" {
		input.StartedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if input.TechniquesUsed == nil {
		input.TechniquesUsed = []string{}
	}
	if input.Timeline == nil {
		input.Timeline = []CampaignEvent{}
	}

	campaignStore.Lock()
	campaignStore.records[input.ID] = &input
	campaignStore.Unlock()

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "campaign": input})
}

// handleUpdateCampaign patches top-level fields on an existing campaign.
// PATCH /api/learning/campaigns/{id}
//
// Only the fields provided in the body are applied; timeline is managed
// through the dedicated event endpoint.
func handleUpdateCampaign(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "campaign id required"})
		return
	}

	var patch struct {
		Name            *string  `json:"name"`
		Status          *string  `json:"status"`
		OperationID     *string  `json:"operationId"`
		Notes           *string  `json:"notes"`
		TotalSteps      *int     `json:"totalSteps"`
		SuccessfulSteps *int     `json:"successfulSteps"`
		FailedSteps     *int     `json:"failedSteps"`
		DetectedSteps   *int     `json:"detectedSteps"`
		TechniquesUsed  []string `json:"techniquesUsed"`
	}
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	campaignStore.Lock()
	c, ok := campaignStore.records[id]
	if !ok {
		campaignStore.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "campaign not found"})
		return
	}

	if patch.Name != nil {
		c.Name = *patch.Name
	}
	if patch.Status != nil {
		c.Status = *patch.Status
		if (*patch.Status == "completed" || *patch.Status == "failed") && c.CompletedAt == "" {
			c.CompletedAt = time.Now().UTC().Format(time.RFC3339)
		}
	}
	if patch.OperationID != nil {
		c.OperationID = *patch.OperationID
	}
	if patch.Notes != nil {
		c.Notes = *patch.Notes
	}
	if patch.TotalSteps != nil {
		c.TotalSteps = *patch.TotalSteps
	}
	if patch.SuccessfulSteps != nil {
		c.SuccessfulSteps = *patch.SuccessfulSteps
	}
	if patch.FailedSteps != nil {
		c.FailedSteps = *patch.FailedSteps
	}
	if patch.DetectedSteps != nil {
		c.DetectedSteps = *patch.DetectedSteps
	}
	if patch.TechniquesUsed != nil {
		c.TechniquesUsed = patch.TechniquesUsed
	}

	// Recompute progress
	if c.TotalSteps > 0 {
		done := c.SuccessfulSteps + c.FailedSteps
		c.ProgressPercent = math.Round((float64(done)/float64(c.TotalSteps))*1000) / 10 // one decimal
	}

	cp := *c
	campaignStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "campaign": cp})
}

// handleAddCampaignEvent appends a timestamped event to the campaign timeline.
// POST /api/learning/campaigns/{id}/events
//
// Recognised eventType values: step_started, step_completed, step_failed,
// detection_alert, operator_override, campaign_paused, campaign_resumed.
// Unknown types are accepted so custom tooling doesn't break on forward
// compatibility.
func handleAddCampaignEvent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "campaign id required"})
		return
	}

	var ev CampaignEvent
	if err := json.NewDecoder(r.Body).Decode(&ev); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}
	if ev.EventType == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "eventType is required"})
		return
	}
	if ev.Timestamp == "" {
		ev.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	campaignStore.Lock()
	c, ok := campaignStore.records[id]
	if !ok {
		campaignStore.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "campaign not found"})
		return
	}

	c.Timeline = append(c.Timeline, ev)

	// Mirror step outcomes into counters so the stats endpoint stays accurate
	// without requiring the caller to manually PATCH those fields.
	switch ev.EventType {
	case "step_completed":
		c.SuccessfulSteps++
	case "step_failed":
		c.FailedSteps++
	case "detection_alert":
		c.DetectedSteps++
	}

	// Update technique list when a technique is referenced in an event
	if ev.TechniqueID != "" {
		found := false
		for _, tid := range c.TechniquesUsed {
			if tid == ev.TechniqueID {
				found = true
				break
			}
		}
		if !found {
			c.TechniquesUsed = append(c.TechniquesUsed, ev.TechniqueID)
		}
	}

	if c.TotalSteps > 0 {
		done := c.SuccessfulSteps + c.FailedSteps
		c.ProgressPercent = math.Round((float64(done)/float64(c.TotalSteps))*1000) / 10
	}

	cp := *c
	campaignStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "campaign": cp, "event": ev})
}

// CampaignStats is the computed analytics view for a single campaign.
type CampaignStats struct {
	CampaignID       string  `json:"campaignId"`
	DurationSeconds  float64 `json:"durationSeconds"`
	SuccessRate      float64 `json:"successRate"`   // successful / (successful + failed)
	DetectionRate    float64 `json:"detectionRate"` // detected steps / total steps
	TechniqueCoverage int    `json:"techniqueCoverage"` // distinct techniques used
	StepBreakdown    map[string]int `json:"stepBreakdown"`
	EventsTotal      int     `json:"eventsTotal"`
}

// handleGetCampaignStats returns derived analytics for a campaign.
// GET /api/learning/campaigns/{id}/stats
func handleGetCampaignStats(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "campaign id required"})
		return
	}

	campaignStore.RLock()
	c, ok := campaignStore.records[id]
	var cp CampaignRecord
	if ok {
		cp = *c
	}
	campaignStore.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "campaign not found"})
		return
	}

	stats := CampaignStats{
		CampaignID:        cp.ID,
		TechniqueCoverage: len(cp.TechniquesUsed),
		EventsTotal:       len(cp.Timeline),
		StepBreakdown: map[string]int{
			"successful": cp.SuccessfulSteps,
			"failed":     cp.FailedSteps,
			"detected":   cp.DetectedSteps,
		},
	}

	// Duration — parse RFC3339 timestamps
	if cp.StartedAt != "" {
		start, err := time.Parse(time.RFC3339, cp.StartedAt)
		if err == nil {
			end := time.Now().UTC()
			if cp.CompletedAt != "" {
				if t, err := time.Parse(time.RFC3339, cp.CompletedAt); err == nil {
					end = t
				}
			}
			stats.DurationSeconds = end.Sub(start).Seconds()
		}
	}

	// Rates
	total := cp.SuccessfulSteps + cp.FailedSteps
	if total > 0 {
		stats.SuccessRate = math.Round((float64(cp.SuccessfulSteps)/float64(total))*1000) / 10
		stats.DetectionRate = math.Round((float64(cp.DetectedSteps)/float64(total))*1000) / 10
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "stats": stats})
}

// ============================================================================
// § 3 — LOL TECHNIQUE DISCOVERY
// ============================================================================
//
// Living-Off-the-Land technique discovery tracks community and agent sourced
// LOL binaries/techniques awaiting operator review before promotion to the
// active technique registry.

// LOLDiscovery is a submission of a new living-off-the-land technique.
type LOLDiscovery struct {
	ID           string   `json:"id"`
	Source       string   `json:"source"`      // lolol.farm, community, agent
	TechniqueID  string   `json:"techniqueId"` // MITRE or custom
	BinaryName   string   `json:"binaryName"`
	Platform     string   `json:"platform"`
	Description  string   `json:"description"`
	Commands     []string `json:"commands"`
	MitreIDs     []string `json:"mitreIds"`
	Status       string   `json:"status"`      // pending_review, approved, rejected
	DiscoveredAt string   `json:"discoveredAt"`
	ReviewedAt   string   `json:"reviewedAt,omitempty"`
	ReviewedBy   string   `json:"reviewedBy,omitempty"`
}

var discoveryStore = struct {
	sync.RWMutex
	items map[string]*LOLDiscovery
}{
	items: make(map[string]*LOLDiscovery),
}

// handleListDiscoveries returns LOL discoveries with optional status/source filters.
// GET /api/learning/discoveries?status=pending_review&source=agent
func handleListDiscoveries(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	statusFilter := q.Get("status")
	sourceFilter := q.Get("source")

	discoveryStore.RLock()
	result := make([]LOLDiscovery, 0, len(discoveryStore.items))
	for _, d := range discoveryStore.items {
		if statusFilter != "" && d.Status != statusFilter {
			continue
		}
		if sourceFilter != "" && !strings.EqualFold(d.Source, sourceFilter) {
			continue
		}
		result = append(result, *d)
	}
	discoveryStore.RUnlock()

	sort.Slice(result, func(i, j int) bool {
		return result[i].DiscoveredAt > result[j].DiscoveredAt
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"items": result,
		"count": len(result),
	})
}

// handleCreateDiscovery submits a new LOL technique for operator review.
// POST /api/learning/discoveries
func handleCreateDiscovery(w http.ResponseWriter, r *http.Request) {
	var input LOLDiscovery
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if input.BinaryName == "" && input.TechniqueID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "binaryName or techniqueId is required"})
		return
	}

	input.ID = genLearnID("lol")
	if input.Status == "" {
		input.Status = "pending_review"
	}
	if input.Source == "" {
		input.Source = "community"
	}
	if input.Platform == "" {
		input.Platform = "unknown"
	}
	input.DiscoveredAt = time.Now().UTC().Format(time.RFC3339)

	if input.Commands == nil {
		input.Commands = []string{}
	}
	if input.MitreIDs == nil {
		input.MitreIDs = []string{}
	}

	discoveryStore.Lock()
	discoveryStore.items[input.ID] = &input
	discoveryStore.Unlock()

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "discovery": input})
}

// handleReviewDiscovery updates the review status of a LOL discovery.
// PATCH /api/learning/discoveries/{id}/review
//
// Body: { "status": "approved"|"rejected", "reviewedBy": "operator_name" }
func handleReviewDiscovery(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "discovery id required"})
		return
	}

	var patch struct {
		Status     string `json:"status"`
		ReviewedBy string `json:"reviewedBy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if patch.Status != "approved" && patch.Status != "rejected" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "status must be 'approved' or 'rejected'"})
		return
	}

	discoveryStore.Lock()
	d, ok := discoveryStore.items[id]
	if !ok {
		discoveryStore.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "discovery not found"})
		return
	}

	d.Status = patch.Status
	d.ReviewedAt = time.Now().UTC().Format(time.RFC3339)
	d.ReviewedBy = patch.ReviewedBy
	cp := *d
	discoveryStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "discovery": cp})
}

// ============================================================================
// § 4 — AGENT PERFORMANCE METRICS
// ============================================================================
//
// Tracks per-agent operational statistics. Each agent's record is updated
// whenever it completes a task so the learning dashboard always reflects
// current capability.

// AgentPerformance is the performance summary for a single agent.
type AgentPerformance struct {
	AgentID               string  `json:"agentId"`
	AgentName             string  `json:"agentName"`
	TotalTasks            int     `json:"totalTasks"`
	SuccessfulTasks       int     `json:"successfulTasks"`
	FailedTasks           int     `json:"failedTasks"`
	AvgTaskDuration       float64 `json:"avgTaskDuration"`  // seconds
	TechniquesKnown       int     `json:"techniquesKnown"` // distinct techniques this agent has used
	MostUsedTechnique     string  `json:"mostUsedTechnique"`
	BestPerformingTechnique string `json:"bestPerformingTechnique"`
	SuccessRate           float64 `json:"successRate"`
	LastUpdated           string  `json:"lastUpdated"`
}

// agentTaskRecord is the internal accounting structure used to compute
// MostUsedTechnique and BestPerformingTechnique without keeping the full
// task history in memory.
type agentTaskRecord struct {
	performance AgentPerformance
	// techniqueUsage: techniqueID → use count
	techniqueUsage map[string]int
	// techniqueSuccess: techniqueID → success count
	techniqueSuccess map[string]int
}

var agentPerfStore = struct {
	sync.RWMutex
	records map[string]*agentTaskRecord // key = agentID
}{
	records: make(map[string]*agentTaskRecord),
}

// handleListAgentPerformance returns performance records for all tracked agents.
// GET /api/learning/agents
func handleListAgentPerformance(w http.ResponseWriter, r *http.Request) {
	agentPerfStore.RLock()
	result := make([]AgentPerformance, 0, len(agentPerfStore.records))
	for _, rec := range agentPerfStore.records {
		result = append(result, rec.performance)
	}
	agentPerfStore.RUnlock()

	sort.Slice(result, func(i, j int) bool {
		return result[i].SuccessRate > result[j].SuccessRate
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"items": result,
		"count": len(result),
	})
}

// handleGetAgentPerformance returns the performance record for a specific agent.
// GET /api/learning/agents/{id}
func handleGetAgentPerformance(w http.ResponseWriter, r *http.Request) {
	agentID := r.PathValue("id")
	if agentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "agent id required"})
		return
	}

	agentPerfStore.RLock()
	rec, ok := agentPerfStore.records[agentID]
	var cp AgentPerformance
	if ok {
		cp = rec.performance
	}
	agentPerfStore.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "agent performance record not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "performance": cp})
}

// handleRecordAgentTask updates an agent's performance record with the outcome
// of a single completed task.
// POST /api/learning/agents/{id}/tasks
//
// Body: { "techniqueId": string, "success": bool, "duration": float64, "detected": bool }
// techniqueId is optional — some tasks are not technique-specific.
func handleRecordAgentTask(w http.ResponseWriter, r *http.Request) {
	agentID := r.PathValue("id")
	if agentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "agent id required"})
		return
	}

	var input struct {
		TechniqueID string  `json:"techniqueId"`
		Success     bool    `json:"success"`
		Duration    float64 `json:"duration"`
		Detected    bool    `json:"detected"`
		AgentName   string  `json:"agentName"` // used on first creation
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	agentPerfStore.Lock()

	rec, exists := agentPerfStore.records[agentID]
	if !exists {
		name := input.AgentName
		if name == "" {
			name = agentID
		}
		rec = &agentTaskRecord{
			performance: AgentPerformance{
				AgentID:   agentID,
				AgentName: name,
			},
			techniqueUsage:   make(map[string]int),
			techniqueSuccess: make(map[string]int),
		}
		agentPerfStore.records[agentID] = rec
	}

	p := &rec.performance

	// Rolling average duration
	if input.Duration > 0 {
		if p.TotalTasks == 0 {
			p.AvgTaskDuration = input.Duration
		} else {
			p.AvgTaskDuration = (p.AvgTaskDuration*float64(p.TotalTasks) + input.Duration) / float64(p.TotalTasks+1)
		}
	}

	p.TotalTasks++
	if input.Success {
		p.SuccessfulTasks++
	} else {
		p.FailedTasks++
	}

	if p.TotalTasks > 0 {
		p.SuccessRate = math.Round((float64(p.SuccessfulTasks)/float64(p.TotalTasks))*1000) / 10
	}

	// Technique accounting
	if input.TechniqueID != "" {
		rec.techniqueUsage[input.TechniqueID]++
		if input.Success {
			rec.techniqueSuccess[input.TechniqueID]++
		}
		p.TechniquesKnown = len(rec.techniqueUsage)

		// Most used = highest usage count
		mostUsed := ""
		mostCount := 0
		for tid, cnt := range rec.techniqueUsage {
			if cnt > mostCount {
				mostCount = cnt
				mostUsed = tid
			}
		}
		p.MostUsedTechnique = mostUsed

		// Best performing = highest success rate (min 2 uses to count)
		best := ""
		bestRate := -1.0
		for tid, successes := range rec.techniqueSuccess {
			uses := rec.techniqueUsage[tid]
			if uses < 2 {
				continue
			}
			rate := float64(successes) / float64(uses)
			if rate > bestRate {
				bestRate = rate
				best = tid
			}
		}
		p.BestPerformingTechnique = best
	}

	p.LastUpdated = time.Now().UTC().Format(time.RFC3339)
	cp := *p

	agentPerfStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "performance": cp})
}

// handleGetLearningDashboard returns a single aggregated view of the entire
// learning system: campaign counts, top techniques, worst detection rates,
// agent rankings, and recent discoveries.
// GET /api/learning/dashboard
func handleGetLearningDashboard(w http.ResponseWriter, r *http.Request) {
	// --- Technique aggregation ---
	techniqueStore.RLock()
	totalTechniques := len(techniqueStore.scores)
	var totalSuccessRateSum float64
	topTechniques := make([]*TechniqueScore, 0, len(techniqueStore.scores))
	highDetection := make([]*TechniqueScore, 0, len(techniqueStore.scores))
	for _, ts := range techniqueStore.scores {
		cp := *ts
		totalSuccessRateSum += ts.SuccessRate
		topTechniques = append(topTechniques, &cp)
		if ts.DetectionRate >= 0.3 {
			highDetection = append(highDetection, &cp)
		}
	}
	techniqueStore.RUnlock()

	avgSuccessRate := 0.0
	if totalTechniques > 0 {
		avgSuccessRate = math.Round((totalSuccessRateSum/float64(totalTechniques))*1000) / 10
	}

	sort.Slice(topTechniques, func(i, j int) bool {
		return topTechniques[i].SuccessRate > topTechniques[j].SuccessRate
	})
	if len(topTechniques) > 5 {
		topTechniques = topTechniques[:5]
	}

	sort.Slice(highDetection, func(i, j int) bool {
		return highDetection[i].DetectionRate > highDetection[j].DetectionRate
	})
	if len(highDetection) > 5 {
		highDetection = highDetection[:5]
	}

	// --- Campaign aggregation ---
	campaignStore.RLock()
	totalCampaigns := len(campaignStore.records)
	activeCampaigns := 0
	completedCampaigns := 0
	for _, c := range campaignStore.records {
		switch c.Status {
		case "active":
			activeCampaigns++
		case "completed":
			completedCampaigns++
		}
	}
	campaignStore.RUnlock()

	// --- Recent discoveries ---
	discoveryStore.RLock()
	recentDisc := make([]LOLDiscovery, 0, len(discoveryStore.items))
	for _, d := range discoveryStore.items {
		recentDisc = append(recentDisc, *d)
	}
	discoveryStore.RUnlock()

	sort.Slice(recentDisc, func(i, j int) bool {
		return recentDisc[i].DiscoveredAt > recentDisc[j].DiscoveredAt
	})
	if len(recentDisc) > 5 {
		recentDisc = recentDisc[:5]
	}

	// --- Agent summary ---
	agentPerfStore.RLock()
	agentCount := len(agentPerfStore.records)
	topAgents := make([]AgentPerformance, 0, agentCount)
	for _, rec := range agentPerfStore.records {
		topAgents = append(topAgents, rec.performance)
	}
	agentPerfStore.RUnlock()

	sort.Slice(topAgents, func(i, j int) bool {
		return topAgents[i].SuccessRate > topAgents[j].SuccessRate
	})
	if len(topAgents) > 5 {
		topAgents = topAgents[:5]
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"dashboard": map[string]any{
			"totalTechniques":    totalTechniques,
			"avgSuccessRate":     avgSuccessRate,
			"totalCampaigns":     totalCampaigns,
			"activeCampaigns":    activeCampaigns,
			"completedCampaigns": completedCampaigns,
			"totalAgents":        agentCount,
			"topTechniques":      topTechniques,
			"worstDetectionRates": highDetection,
			"recentDiscoveries":  recentDisc,
			"topAgents":          topAgents,
		},
	})
}

// ============================================================================
// § 5 — RECOMMENDATION ENGINE
// ============================================================================
//
// Generates recommendations using simple but operationally-grounded heuristics
// derived from live technique scores and campaign history. No ML — just signal
// from what actually worked in the field.

// Recommendation is an operator-facing suggestion produced by the engine.
type Recommendation struct {
	ID          string   `json:"id"`
	Type        string   `json:"type"`        // technique, evasion, chain, timing
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Score       float64  `json:"score"`       // 0–100, higher is more actionable
	BasedOn     string   `json:"basedOn"`     // human-readable rationale source
	TechniqueIDs []string `json:"techniqueIds"`
	Platform    string   `json:"platform"`
	CreatedAt   string   `json:"createdAt"`
}

var recommendationStore = struct {
	sync.RWMutex
	items []Recommendation
}{
	items: []Recommendation{},
}

// handleListRecommendations returns stored recommendations with optional filters.
// GET /api/learning/recommendations?type=technique&platform=linux
func handleListRecommendations(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	typeFilter := q.Get("type")
	platformFilter := q.Get("platform")

	recommendationStore.RLock()
	result := make([]Recommendation, 0, len(recommendationStore.items))
	for _, rec := range recommendationStore.items {
		if typeFilter != "" && rec.Type != typeFilter {
			continue
		}
		if platformFilter != "" && !strings.EqualFold(rec.Platform, platformFilter) {
			continue
		}
		result = append(result, rec)
	}
	recommendationStore.RUnlock()

	// Best score first
	sort.Slice(result, func(i, j int) bool {
		return result[i].Score > result[j].Score
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"items": result,
		"count": len(result),
	})
}

// handleGenerateRecommendations runs the heuristic engine and replaces the
// recommendation store with fresh results (capped at 100).
// POST /api/learning/recommendations/generate
//
// Heuristics applied:
//  1. High-success + low-detection techniques → "technique" recommendation
//  2. Techniques with detection rate ≥ 0.5 → "evasion" recommendation
//  3. Pairs of techniques both with success_rate > 0.7 that appeared in the
//     same campaign → "chain" recommendation
//  4. Techniques never used on a given platform (if scores exist for other
//     platforms) → cross-platform "technique" suggestion
func handleGenerateRecommendations(w http.ResponseWriter, r *http.Request) {
	log.Printf("[Learning] Generating recommendations from current system state")

	now := time.Now().UTC().Format(time.RFC3339)
	generated := make([]Recommendation, 0, 50)

	// --- Snapshot technique scores ---
	techniqueStore.RLock()
	scores := make([]*TechniqueScore, 0, len(techniqueStore.scores))
	for _, ts := range techniqueStore.scores {
		cp := *ts
		scores = append(scores, &cp)
	}
	techniqueStore.RUnlock()

	// Heuristic 1: High success + low detection → recommend the technique
	for _, ts := range scores {
		total := ts.SuccessCount + ts.FailureCount
		if total < 2 {
			// Not enough data to be confident
			continue
		}
		if ts.SuccessRate >= 0.75 && ts.DetectionRate <= 0.15 {
			score := math.Round((ts.SuccessRate*60+((1-ts.DetectionRate)*40))*10) / 10
			generated = append(generated, Recommendation{
				ID:           genLearnID("rec"),
				Type:         "technique",
				Title:        fmt.Sprintf("Prioritise %s (%s)", ts.TechniqueName, ts.TechniqueID),
				Description:  fmt.Sprintf("%s achieves %.0f%% success with only %.0f%% detection across %d executions on %s. Reliable for future campaigns.", ts.TechniqueName, ts.SuccessRate*100, ts.DetectionRate*100, total, ts.Platform),
				Score:        score,
				BasedOn:      fmt.Sprintf("technique %s execution history (%d runs)", ts.TechniqueID, total),
				TechniqueIDs: []string{ts.TechniqueID},
				Platform:     ts.Platform,
				CreatedAt:    now,
			})
		}
	}

	// Heuristic 2: High detection rate → recommend investing in evasion
	for _, ts := range scores {
		total := ts.SuccessCount + ts.FailureCount
		if total < 2 {
			continue
		}
		if ts.DetectionRate >= 0.5 {
			// Score inversely proportional to detection — more detected = more urgent
			score := math.Round(ts.DetectionRate*100*10) / 10
			generated = append(generated, Recommendation{
				ID:           genLearnID("rec"),
				Type:         "evasion",
				Title:        fmt.Sprintf("Harden evasion for %s", ts.TechniqueID),
				Description:  fmt.Sprintf("%s is being detected %.0f%% of the time on %s. Evaluate AMSI bypass, obfuscation, or alternate LOL binaries to reduce signature exposure.", ts.TechniqueName, ts.DetectionRate*100, ts.Platform),
				Score:        score,
				BasedOn:      fmt.Sprintf("detection_rate=%.2f over %d executions", ts.DetectionRate, total),
				TechniqueIDs: []string{ts.TechniqueID},
				Platform:     ts.Platform,
				CreatedAt:    now,
			})
		}
	}

	// Heuristic 3: Technique chains — find pairs that co-appeared in the same
	// campaign with both having success_rate > 0.7
	type pair struct{ a, b string }
	seenPairs := make(map[pair]bool)

	// Build a success-rate lookup
	successRates := make(map[string]float64, len(scores))
	for _, ts := range scores {
		successRates[ts.TechniqueID] = ts.SuccessRate
	}

	campaignStore.RLock()
	for _, c := range campaignStore.records {
		if c.Status != "completed" {
			continue
		}
		// Only consider campaigns that had net positive outcomes
		total := c.SuccessfulSteps + c.FailedSteps
		if total < 2 || float64(c.SuccessfulSteps)/float64(total) < 0.6 {
			continue
		}
		techs := c.TechniquesUsed
		for i := 0; i < len(techs); i++ {
			for j := i + 1; j < len(techs); j++ {
				a, b := techs[i], techs[j]
				if a > b {
					a, b = b, a
				}
				p := pair{a, b}
				if seenPairs[p] {
					continue
				}
				if successRates[a] >= 0.7 && successRates[b] >= 0.7 {
					seenPairs[p] = true
					score := math.Round(((successRates[a]+successRates[b])/2)*80*10) / 10
					generated = append(generated, Recommendation{
						ID:           genLearnID("rec"),
						Type:         "chain",
						Title:        fmt.Sprintf("Proven chain: %s → %s", a, b),
						Description:  fmt.Sprintf("Techniques %s and %s co-appeared in completed campaign \"%s\" and both carry high individual success rates (%.0f%% and %.0f%%). Template this sequence for future ops.", a, b, c.Name, successRates[a]*100, successRates[b]*100),
						Score:        score,
						BasedOn:      fmt.Sprintf("campaign_%s success pattern", c.ID),
						TechniqueIDs: []string{a, b},
						Platform:     "",
						CreatedAt:    now,
					})
				}
			}
		}
	}
	campaignStore.RUnlock()

	// Heuristic 4: Cross-platform gap — technique works well on one platform
	// but has never been tried on another. Surface as low-score exploration hint.
	platformsSeen := make(map[string]map[string]bool) // techniqueID → platforms used
	for _, ts := range scores {
		if _, ok := platformsSeen[ts.TechniqueID]; !ok {
			platformsSeen[ts.TechniqueID] = make(map[string]bool)
		}
		platformsSeen[ts.TechniqueID][strings.ToLower(ts.Platform)] = true
	}

	knownPlatforms := []string{"windows", "linux", "macos", "cloud"}
	for _, ts := range scores {
		if ts.SuccessRate < 0.7 {
			continue
		}
		for _, platform := range knownPlatforms {
			if strings.EqualFold(ts.Platform, platform) {
				continue
			}
			if platformsSeen[ts.TechniqueID][platform] {
				continue
			}
			generated = append(generated, Recommendation{
				ID:           genLearnID("rec"),
				Type:         "technique",
				Title:        fmt.Sprintf("Test %s on %s", ts.TechniqueID, platform),
				Description:  fmt.Sprintf("%s has a %.0f%% success rate on %s but has never been attempted on %s. Cross-platform applicability assessment is recommended.", ts.TechniqueName, ts.SuccessRate*100, ts.Platform, platform),
				Score:        math.Round(ts.SuccessRate * 40 * 10 / 10), // lower urgency
				BasedOn:      fmt.Sprintf("%s platform coverage gap", ts.TechniqueID),
				TechniqueIDs: []string{ts.TechniqueID},
				Platform:     platform,
				CreatedAt:    now,
			})
		}
	}

	// Deduplicate by title (chain heuristic can produce duplicates if data
	// has symmetric references) and cap at 100.
	seen := make(map[string]bool)
	deduped := make([]Recommendation, 0, len(generated))
	for _, rec := range generated {
		if seen[rec.Title] {
			continue
		}
		seen[rec.Title] = true
		deduped = append(deduped, rec)
	}

	// Sort descending by score before capping so the highest-value items survive.
	sort.Slice(deduped, func(i, j int) bool {
		return deduped[i].Score > deduped[j].Score
	})
	if len(deduped) > 100 {
		deduped = deduped[:100]
	}

	recommendationStore.Lock()
	recommendationStore.items = deduped
	recommendationStore.Unlock()

	log.Printf("[Learning] Generated %d recommendations", len(deduped))
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"count": len(deduped),
		"items": deduped,
	})
}

// handleDismissRecommendation removes a recommendation from the store.
// DELETE /api/learning/recommendations/{id}
func handleDismissRecommendation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "recommendation id required"})
		return
	}

	recommendationStore.Lock()
	found := false
	for i, rec := range recommendationStore.items {
		if rec.ID == id {
			recommendationStore.items = append(recommendationStore.items[:i], recommendationStore.items[i+1:]...)
			found = true
			break
		}
	}
	recommendationStore.Unlock()

	if !found {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "recommendation not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
