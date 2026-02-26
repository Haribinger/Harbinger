package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"sync"
	"time"
)

// ============================================================================
// CODE HEALTH — Metrics storage + dashboard API
// ============================================================================

// HealthMetric is a single day's scan results.
type HealthMetric struct {
	Date         string `json:"date"`
	AnyTypes     int    `json:"any_types"`
	ConsoleLogs  int    `json:"console_logs"`
	TestCoverage int    `json:"test_coverage"`
	DepsOutdated int    `json:"deps_outdated"`
	Conventions  int    `json:"conventions"`
	Score        int    `json:"score"`
}

// HealthIssue is a specific finding from a scan.
type HealthIssue struct {
	File     string `json:"file"`
	Line     int    `json:"line"`
	Message  string `json:"message"`
	Severity string `json:"severity"` // critical, high, medium, low
	Date     string `json:"date"`
}

// CurrentHealth is the latest health snapshot with trends.
type CurrentHealth struct {
	Latest       *HealthMetric `json:"latest"`
	Previous     *HealthMetric `json:"previous"`
	Score        int           `json:"score"`
	RecentIssues []HealthIssue `json:"recent_issues"`
}

// In-memory store for health metrics (backed by DB when available).
var healthStore = struct {
	sync.RWMutex
	metrics []HealthMetric
	issues  []HealthIssue
}{
	metrics: []HealthMetric{},
	issues:  []HealthIssue{},
}

// handleHealthHistory returns metrics over a time range.
// GET /api/health/code?range=week|month|quarter
func handleHealthHistory(w http.ResponseWriter, r *http.Request) {
	rangeParam := r.URL.Query().Get("range")
	if rangeParam == "" {
		rangeParam = "month"
	}

	var cutoff time.Time
	now := time.Now()
	switch rangeParam {
	case "week":
		cutoff = now.AddDate(0, 0, -7)
	case "quarter":
		cutoff = now.AddDate(0, -3, 0)
	default: // month
		cutoff = now.AddDate(0, -1, 0)
	}
	cutoffStr := cutoff.Format("2006-01-02")

	// Try DB first
	if dbAvailable() {
		metrics, err := dbLoadHealthHistory(cutoffStr)
		if err == nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"ok":      true,
				"range":   rangeParam,
				"metrics": metrics,
			})
			return
		}
		log.Printf("[CodeHealth] DB load failed, falling back to memory: %v", err)
	}

	// Fallback to in-memory
	healthStore.RLock()
	defer healthStore.RUnlock()

	filtered := []HealthMetric{}
	for _, m := range healthStore.metrics {
		if m.Date >= cutoffStr {
			filtered = append(filtered, m)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"range":   rangeParam,
		"metrics": filtered,
	})
}

// handleCurrentHealth returns the latest snapshot with score and trends.
// GET /api/health/current
func handleCurrentHealth(w http.ResponseWriter, r *http.Request) {
	current := CurrentHealth{
		Score:        0,
		RecentIssues: []HealthIssue{},
	}

	// Try DB first
	if dbAvailable() {
		metrics, err := dbLoadHealthHistory("2000-01-01")
		if err == nil && len(metrics) > 0 {
			sort.Slice(metrics, func(i, j int) bool { return metrics[i].Date > metrics[j].Date })
			current.Latest = &metrics[0]
			current.Score = metrics[0].Score
			if len(metrics) > 1 {
				current.Previous = &metrics[1]
			}
		}
	} else {
		healthStore.RLock()
		if len(healthStore.metrics) > 0 {
			latest := healthStore.metrics[len(healthStore.metrics)-1]
			current.Latest = &latest
			current.Score = latest.Score
			if len(healthStore.metrics) > 1 {
				prev := healthStore.metrics[len(healthStore.metrics)-2]
				current.Previous = &prev
			}
		}
		healthStore.RUnlock()
	}

	// Recent issues (last 10)
	healthStore.RLock()
	issueCount := len(healthStore.issues)
	start := issueCount - 10
	if start < 0 {
		start = 0
	}
	current.RecentIssues = healthStore.issues[start:]
	healthStore.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"current": current,
	})
}

// handleUpdateHealthMetrics stores new metrics from a MAINTAINER scan.
// POST /api/health/code
func handleUpdateHealthMetrics(w http.ResponseWriter, r *http.Request) {
	var metric HealthMetric
	if err := json.NewDecoder(r.Body).Decode(&metric); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if metric.Date == "" {
		metric.Date = time.Now().Format("2006-01-02")
	}

	// Compute score if not provided
	if metric.Score == 0 {
		metric.Score = computeHealthScore(metric)
	}

	// Store in DB
	if dbAvailable() {
		if err := dbStoreHealthMetric(metric); err != nil {
			log.Printf("[CodeHealth] DB store failed: %v", err)
		}
	}

	// Also store in memory
	healthStore.Lock()
	healthStore.metrics = append(healthStore.metrics, metric)
	// Keep 90-day rolling window
	if len(healthStore.metrics) > 90 {
		healthStore.metrics = healthStore.metrics[len(healthStore.metrics)-90:]
	}
	healthStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "metric": metric})
}

// computeHealthScore calculates a 0-100 score from metrics.
func computeHealthScore(m HealthMetric) int {
	score := 100
	score -= m.AnyTypes * 2
	score -= m.ConsoleLogs
	score -= m.DepsOutdated * 3
	score += m.TestCoverage
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return score
}
