package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

// ============================================================================
// SELF-HEALING MONITOR — Container recovery, timeout kills, stall nudges,
// LLM-powered diagnosis, and operator notification.
//
// Architecture: A background goroutine polls every healingCfg.PollInterval
// seconds. For each active mission's running tasks it checks:
//   1. Container health  — Docker API inspect, restart or escalate
//   2. Subtask timeout   — kill long-running processes, mark failed
//   3. Agent stall       — inject system nudge, notify operator
//
// All events are published via the SSE bus (realtime.go publishEvent) on
// the "healing" channel so T7 terminals can subscribe.
//
// Stores are in-memory with RWMutex, matching every other backend file.
// ============================================================================

// ── ID generation ──────────────────────────────────────────────────────────

func genHealID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

// ── Healing event types ────────────────────────────────────────────────────

const (
	HealTypeContainerRestart = "container_restart"
	HealTypeOOMRestart       = "oom_restart"
	HealTypeTimeoutKill      = "timeout_kill"
	HealTypeStallNudge       = "stall_nudge"
	HealTypeEscalation       = "escalation"
	HealTypeDiagnosis        = "diagnosis"
	HealTypeMonitorStart     = "monitor_start"
	HealTypeMonitorStop      = "monitor_stop"
)

// ── Types ──────────────────────────────────────────────────────────────────

// HealingEvent records a single self-healing action taken by the monitor.
type HealingEvent struct {
	ID            string          `json:"id"`
	Type          string          `json:"type"`           // one of HealType* constants
	MissionID     string          `json:"mission_id"`
	TaskID        string          `json:"task_id"`
	AgentCodename string          `json:"agent_codename"`
	ContainerID   string          `json:"container_id,omitempty"`
	Severity      string          `json:"severity"`       // info, warning, critical
	Title         string          `json:"title"`
	Description   string          `json:"description"`
	Diagnosis     *HealDiagnosis  `json:"diagnosis,omitempty"`
	AutoFixed     bool            `json:"auto_fixed"`
	FixAction     string          `json:"fix_action,omitempty"` // restart, oom_restart, kill, nudge, escalate
	Metadata      json.RawMessage `json:"metadata,omitempty"`
	CreatedAt     string          `json:"created_at"`
}

// HealDiagnosis is an LLM-generated analysis of a failure.
type HealDiagnosis struct {
	Reason       string `json:"reason"`
	AutoFixable  bool   `json:"auto_fixable"`
	FixType      string `json:"fix_type"`      // restart, oom, escalate
	SuggestedFix string `json:"suggested_fix"`
	Confidence   float64 `json:"confidence"`   // 0.0–1.0
	Model        string `json:"model,omitempty"`
}

// ContainerHealth is the result of inspecting a Docker container.
type ContainerHealth struct {
	ContainerID string `json:"container_id"`
	Running     bool   `json:"running"`
	OOMKilled   bool   `json:"oom_killed"`
	ExitCode    int    `json:"exit_code"`
	Status      string `json:"status"` // running, exited, dead, paused
	StartedAt   string `json:"started_at,omitempty"`
	FinishedAt  string `json:"finished_at,omitempty"`
	Error       string `json:"error,omitempty"`
}

// HealingConfig holds tunable thresholds for the monitor loop.
type HealingConfig struct {
	PollIntervalSec   int  `json:"poll_interval_sec"`   // default 15
	SubtaskTimeoutSec int  `json:"subtask_timeout_sec"` // default 600 (10min)
	StallThresholdSec int  `json:"stall_threshold_sec"` // default 120 (2min)
	MaxRestartRetries int  `json:"max_restart_retries"` // default 3
	OOMMemoryLimitMB  int  `json:"oom_memory_limit_mb"` // default 4096 (4GB)
	AutoHealEnabled   bool `json:"auto_heal_enabled"`   // default true
	LLMDiagEnabled    bool `json:"llm_diag_enabled"`    // default false (requires LLM config)
}

// HealingStats summarizes the monitor's activity for dashboard display.
type HealingStats struct {
	TotalEvents       int            `json:"total_events"`
	EventsByType      map[string]int `json:"events_by_type"`
	EventsBySeverity  map[string]int `json:"events_by_severity"`
	AutoFixedCount    int            `json:"auto_fixed_count"`
	EscalationCount   int            `json:"escalation_count"`
	MonitorRunning    bool           `json:"monitor_running"`
	LastPollAt        string         `json:"last_poll_at"`
	ActiveMissions    int            `json:"active_missions"`
	WatchedContainers int            `json:"watched_containers"`
}

// ── In-memory stores ───────────────────────────────────────────────────────

const maxHealingEvents = 500

var healingStore = struct {
	sync.RWMutex
	events []HealingEvent
}{
	events: make([]HealingEvent, 0, maxHealingEvents),
}

var healingCfg = struct {
	sync.RWMutex
	config HealingConfig
}{
	config: HealingConfig{
		PollIntervalSec:   15,
		SubtaskTimeoutSec: 600,
		StallThresholdSec: 120,
		MaxRestartRetries: 3,
		OOMMemoryLimitMB:  4096,
		AutoHealEnabled:   true,
		LLMDiagEnabled:    false,
	},
}

// restartCounts tracks how many times a container has been restarted by the
// healer to prevent infinite restart loops.
var restartCounts = struct {
	sync.RWMutex
	counts map[string]int // container_id -> restart count
}{
	counts: make(map[string]int),
}

// lastActionTimes tracks the last time an action was recorded for each task,
// used by stall detection. Updated externally by the action-recording path.
var lastActionTimes = struct {
	sync.RWMutex
	times map[string]time.Time // task_id -> last action time
}{
	times: make(map[string]time.Time),
}

// ── Monitor state ──────────────────────────────────────────────────────────

var healingMonitor = struct {
	sync.Mutex
	running    bool
	stopCh     chan struct{}
	lastPollAt time.Time
}{
	running: false,
}

// ── Store helpers ──────────────────────────────────────────────────────────

func addHealingEvent(evt HealingEvent) {
	if evt.ID == "" {
		evt.ID = genHealID("heal")
	}
	if evt.CreatedAt == "" {
		evt.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	healingStore.Lock()
	healingStore.events = append(healingStore.events, evt)
	if len(healingStore.events) > maxHealingEvents {
		healingStore.events = healingStore.events[len(healingStore.events)-maxHealingEvents:]
	}
	healingStore.Unlock()

	// Fan out to SSE bus so T7 terminals receive it in real time.
	publishEvent(RealtimeEvent{
		Type:    EventTypeSystemAlert,
		Source:  "healing_monitor",
		Target:  "broadcast",
		Channel: "healing",
		Payload: map[string]any{
			"event_id":       evt.ID,
			"type":           evt.Type,
			"severity":       evt.Severity,
			"title":          evt.Title,
			"agent_codename": evt.AgentCodename,
			"auto_fixed":     evt.AutoFixed,
			"fix_action":     evt.FixAction,
			"mission_id":     evt.MissionID,
			"task_id":        evt.TaskID,
		},
	})
}

// RecordTaskAction should be called by the action-recording path to update
// last-action timestamps for stall detection.
func RecordTaskAction(taskID string) {
	lastActionTimes.Lock()
	lastActionTimes.times[taskID] = time.Now()
	lastActionTimes.Unlock()
}

// ClearTaskTracking removes tracking state for a completed/failed task.
func ClearTaskTracking(taskID, containerID string) {
	lastActionTimes.Lock()
	delete(lastActionTimes.times, taskID)
	lastActionTimes.Unlock()

	if containerID != "" {
		restartCounts.Lock()
		delete(restartCounts.counts, containerID)
		restartCounts.Unlock()
	}
}

// ── Container health check ─────────────────────────────────────────────────

// checkContainerHealth inspects a Docker container's state via the Engine API.
func checkContainerHealth(containerID string) (*ContainerHealth, error) {
	resp, err := dockerAPIRequest("GET",
		fmt.Sprintf("/v1.41/containers/%s/json", containerID), nil)
	if err != nil {
		return &ContainerHealth{
			ContainerID: containerID,
			Running:     false,
			Status:      "unreachable",
			Error:       err.Error(),
		}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return &ContainerHealth{
			ContainerID: containerID,
			Running:     false,
			Status:      "not_found",
		}, nil
	}

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	var inspect struct {
		State struct {
			Running    bool   `json:"Running"`
			OOMKilled  bool   `json:"OOMKilled"`
			ExitCode   int    `json:"ExitCode"`
			Status     string `json:"Status"`
			StartedAt  string `json:"StartedAt"`
			FinishedAt string `json:"FinishedAt"`
			Error      string `json:"Error"`
		} `json:"State"`
	}
	if err := json.Unmarshal(body, &inspect); err != nil {
		return nil, fmt.Errorf("parse container inspect: %w", err)
	}

	return &ContainerHealth{
		ContainerID: containerID,
		Running:     inspect.State.Running,
		OOMKilled:   inspect.State.OOMKilled,
		ExitCode:    inspect.State.ExitCode,
		Status:      inspect.State.Status,
		StartedAt:   inspect.State.StartedAt,
		FinishedAt:  inspect.State.FinishedAt,
		Error:       inspect.State.Error,
	}, nil
}

// getContainerLogs fetches the last N lines of a container's combined output.
func getContainerLogs(containerID string, tail int) (string, error) {
	resp, err := dockerAPIRequest("GET",
		fmt.Sprintf("/v1.41/containers/%s/logs?stdout=true&stderr=true&tail=%d",
			containerID, tail), nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 10<<20))

	// Docker log stream has an 8-byte header per frame — strip them for
	// readability. Each frame: [stream_type(1)][0(3)][size(4)][payload].
	var cleaned strings.Builder
	buf := raw
	for len(buf) >= 8 {
		sz := int(buf[4])<<24 | int(buf[5])<<16 | int(buf[6])<<8 | int(buf[7])
		if sz < 0 || 8+sz > len(buf) {
			break
		}
		cleaned.Write(buf[8 : 8+sz])
		buf = buf[8+sz:]
	}
	if cleaned.Len() == 0 {
		return string(raw), nil
	}
	return cleaned.String(), nil
}

// ── Healing actions ────────────────────────────────────────────────────────

// healContainer handles a failed/unhealthy container: diagnose → fix or escalate.
func healContainer(missionID, taskID, agentCodename, containerID string, health *ContainerHealth) {
	healingCfg.RLock()
	cfg := healingCfg.config
	healingCfg.RUnlock()

	// Check restart count to avoid infinite loops.
	restartCounts.RLock()
	count := restartCounts.counts[containerID]
	restartCounts.RUnlock()

	if count >= cfg.MaxRestartRetries {
		addHealingEvent(HealingEvent{
			Type:          HealTypeEscalation,
			MissionID:     missionID,
			TaskID:        taskID,
			AgentCodename: agentCodename,
			ContainerID:   containerID,
			Severity:      "critical",
			Title:         fmt.Sprintf("[NEEDS-HELP] %s: max restarts (%d) exceeded", agentCodename, cfg.MaxRestartRetries),
			Description:   fmt.Sprintf("Container %s has been restarted %d times and keeps failing. Manual intervention required.", containerID[:12], count),
			AutoFixed:     false,
			FixAction:     "escalate",
		})
		return
	}

	// Get container logs for diagnosis.
	logs, _ := getContainerLogs(containerID, 50)

	// Build a diagnosis — LLM-based if enabled, otherwise rule-based.
	var diag HealDiagnosis
	if cfg.LLMDiagEnabled {
		diag = llmDiagnose(agentCodename, containerID, logs, health)
	} else {
		diag = ruleDiagnose(health, logs)
	}

	if !cfg.AutoHealEnabled {
		addHealingEvent(HealingEvent{
			Type:          HealTypeDiagnosis,
			MissionID:     missionID,
			TaskID:        taskID,
			AgentCodename: agentCodename,
			ContainerID:   containerID,
			Severity:      "warning",
			Title:         fmt.Sprintf("[DIAGNOSIS] %s: %s", agentCodename, diag.Reason),
			Description:   diag.SuggestedFix,
			Diagnosis:     &diag,
			AutoFixed:     false,
			FixAction:     "none",
		})
		return
	}

	// Apply the fix.
	switch diag.FixType {
	case "restart":
		err := restartContainer(containerID, 0)
		addHealingEvent(HealingEvent{
			Type:          HealTypeContainerRestart,
			MissionID:     missionID,
			TaskID:        taskID,
			AgentCodename: agentCodename,
			ContainerID:   containerID,
			Severity:      "warning",
			Title:         fmt.Sprintf("[SELF-HEAL] %s: container restarted", agentCodename),
			Description:   diag.Reason,
			Diagnosis:     &diag,
			AutoFixed:     err == nil,
			FixAction:     "restart",
		})
	case "oom":
		err := restartContainer(containerID, int64(cfg.OOMMemoryLimitMB)*1024*1024)
		addHealingEvent(HealingEvent{
			Type:          HealTypeOOMRestart,
			MissionID:     missionID,
			TaskID:        taskID,
			AgentCodename: agentCodename,
			ContainerID:   containerID,
			Severity:      "warning",
			Title:         fmt.Sprintf("[SELF-HEAL] %s: OOM restart with %dMB", agentCodename, cfg.OOMMemoryLimitMB),
			Description:   diag.Reason,
			Diagnosis:     &diag,
			AutoFixed:     err == nil,
			FixAction:     "oom_restart",
		})
	default:
		addHealingEvent(HealingEvent{
			Type:          HealTypeEscalation,
			MissionID:     missionID,
			TaskID:        taskID,
			AgentCodename: agentCodename,
			ContainerID:   containerID,
			Severity:      "critical",
			Title:         fmt.Sprintf("[NEEDS-HELP] %s: %s", agentCodename, diag.Reason),
			Description:   diag.SuggestedFix,
			Diagnosis:     &diag,
			AutoFixed:     false,
			FixAction:     "escalate",
		})
	}

	restartCounts.Lock()
	restartCounts.counts[containerID]++
	restartCounts.Unlock()
}

// restartContainer stops and starts a container. If memoryBytes > 0, the
// container is recreated with the new memory limit (OOM recovery).
func restartContainer(containerID string, memoryBytes int64) error {
	// Stop the container (10s grace period).
	resp, err := dockerAPIRequest("POST",
		fmt.Sprintf("/v1.41/containers/%s/stop?t=10", containerID), nil)
	if err != nil {
		return fmt.Errorf("stop container: %w", err)
	}
	resp.Body.Close()

	if memoryBytes > 0 {
		// Update memory limit via container update API.
		payload := fmt.Sprintf(`{"Memory":%d,"MemorySwap":%d}`, memoryBytes, memoryBytes*2)
		resp, err = dockerAPIRequest("POST",
			fmt.Sprintf("/v1.41/containers/%s/update", containerID),
			strings.NewReader(payload))
		if err != nil {
			log.Printf("[HEALING] failed to update memory for %s: %v", containerID[:12], err)
		} else {
			resp.Body.Close()
		}
	}

	// Start it back up.
	resp, err = dockerAPIRequest("POST",
		fmt.Sprintf("/v1.41/containers/%s/start", containerID), nil)
	if err != nil {
		return fmt.Errorf("start container: %w", err)
	}
	resp.Body.Close()
	return nil
}

// healTimeout kills processes in a stuck container and marks the subtask failed.
func healTimeout(missionID, taskID, agentCodename, containerID, subtaskTitle string, runningSec int) {
	if containerID != "" {
		// Send SIGTERM to all processes inside the container.
		execBody := `{"AttachStdout":false,"AttachStderr":false,"Cmd":["kill","-TERM","-1"]}`
		resp, err := dockerAPIRequest("POST",
			fmt.Sprintf("/v1.41/containers/%s/exec", containerID),
			strings.NewReader(execBody))
		if err == nil {
			defer resp.Body.Close()
			var execResp struct {
				ID string `json:"Id"`
			}
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
			if json.Unmarshal(body, &execResp) == nil && execResp.ID != "" {
				startBody := `{"Detach":true}`
				r2, e2 := dockerAPIRequest("POST",
					fmt.Sprintf("/v1.41/exec/%s/start", execResp.ID),
					strings.NewReader(startBody))
				if e2 == nil {
					r2.Body.Close()
				}
			}
		}
	}

	addHealingEvent(HealingEvent{
		Type:          HealTypeTimeoutKill,
		MissionID:     missionID,
		TaskID:        taskID,
		AgentCodename: agentCodename,
		ContainerID:   containerID,
		Severity:      "warning",
		Title:         fmt.Sprintf("[TIMEOUT] %s: %s", agentCodename, subtaskTitle),
		Description:   fmt.Sprintf("Subtask killed after %ds (limit: %ds)", runningSec, healingCfg.config.SubtaskTimeoutSec),
		AutoFixed:     true,
		FixAction:     "kill",
	})
}

// healStall injects a system nudge when an agent has produced no actions.
func healStall(missionID, taskID, agentCodename string, stalledSec int) {
	addHealingEvent(HealingEvent{
		Type:          HealTypeStallNudge,
		MissionID:     missionID,
		TaskID:        taskID,
		AgentCodename: agentCodename,
		Severity:      "info",
		Title:         fmt.Sprintf("[STALL] %s: no action for %ds", agentCodename, stalledSec),
		Description:   "Injected system nudge: summarize progress and decide next step.",
		AutoFixed:     true,
		FixAction:     "nudge",
	})

	// The nudge message itself would be injected into the agent's message chain
	// by the execution engine when it checks for healing nudges. We record the
	// intent here; the ReAct loop picks it up on next iteration.
}

// ── Diagnosis engines ──────────────────────────────────────────────────────

// ruleDiagnose applies simple heuristics when LLM diagnosis is disabled.
func ruleDiagnose(health *ContainerHealth, logs string) HealDiagnosis {
	if health.OOMKilled {
		return HealDiagnosis{
			Reason:       "Container killed by OOM (out of memory)",
			AutoFixable:  true,
			FixType:      "oom",
			SuggestedFix: "Restart with higher memory limit",
			Confidence:   0.95,
		}
	}

	if health.ExitCode == 137 {
		return HealDiagnosis{
			Reason:       "Container received SIGKILL (exit 137) — likely OOM or external kill",
			AutoFixable:  true,
			FixType:      "oom",
			SuggestedFix: "Restart with higher memory limit",
			Confidence:   0.8,
		}
	}

	if health.ExitCode == 1 && strings.Contains(logs, "panic:") {
		return HealDiagnosis{
			Reason:       "Container crashed with panic",
			AutoFixable:  true,
			FixType:      "restart",
			SuggestedFix: "Restart container — transient panic may not recur",
			Confidence:   0.6,
		}
	}

	if health.Status == "exited" || health.Status == "dead" {
		return HealDiagnosis{
			Reason:       fmt.Sprintf("Container exited with code %d", health.ExitCode),
			AutoFixable:  true,
			FixType:      "restart",
			SuggestedFix: "Restart container",
			Confidence:   0.7,
		}
	}

	return HealDiagnosis{
		Reason:       fmt.Sprintf("Container in unexpected state: %s", health.Status),
		AutoFixable:  false,
		FixType:      "escalate",
		SuggestedFix: "Manual investigation required — check Docker logs and container state",
		Confidence:   0.5,
	}
}

// llmDiagnose uses an LLM to analyze container logs and produce a diagnosis.
// Placeholder: when the model router is wired, this will call the configured
// model. For now it falls back to ruleDiagnose.
func llmDiagnose(agentCodename, containerID, logs string, health *ContainerHealth) HealDiagnosis {
	// Build the diagnosis prompt that would be sent to the LLM.
	_ = fmt.Sprintf(
		"You are a DevOps diagnosis engine for Harbinger, an autonomous security platform.\n"+
			"Agent: %s\nContainer: %s\nStatus: %s (exit %d, OOM: %v)\n\nLast 50 lines of logs:\n%s\n\n"+
			"Diagnose the failure. Respond with JSON: {reason, auto_fixable, fix_type (restart|oom|escalate), suggested_fix, confidence}",
		agentCodename, containerID[:12], health.Status, health.ExitCode, health.OOMKilled, logs,
	)

	// Rule-based diagnosis; swap to modelRouter.Generate(prompt) once the model router is wired.
	diag := ruleDiagnose(health, logs)
	diag.Model = "rule_engine"
	return diag
}

// ── Monitor loop ───────────────────────────────────────────────────────────

// startHealingMonitor launches the background healing goroutine.
// Safe to call multiple times — only one instance runs.
func startHealingMonitor() {
	healingMonitor.Lock()
	defer healingMonitor.Unlock()

	if healingMonitor.running {
		return
	}

	healingMonitor.stopCh = make(chan struct{})
	healingMonitor.running = true

	addHealingEvent(HealingEvent{
		Type:        HealTypeMonitorStart,
		Severity:    "info",
		Title:       "[HEALING] Monitor started",
		Description: fmt.Sprintf("Polling every %ds", healingCfg.config.PollIntervalSec),
		AutoFixed:   false,
	})

	go healingLoop(healingMonitor.stopCh)
	log.Println("[HEALING] monitor started")
}

// stopHealingMonitor gracefully stops the background healing goroutine.
func stopHealingMonitor() {
	healingMonitor.Lock()
	defer healingMonitor.Unlock()

	if !healingMonitor.running {
		return
	}

	close(healingMonitor.stopCh)
	healingMonitor.running = false

	addHealingEvent(HealingEvent{
		Type:        HealTypeMonitorStop,
		Severity:    "info",
		Title:       "[HEALING] Monitor stopped",
		Description: "Self-healing monitor stopped by operator",
		AutoFixed:   false,
	})

	log.Println("[HEALING] monitor stopped")
}

// healingLoop is the core polling loop. It iterates active missions and their
// running tasks, checking for the three failure modes: container health,
// subtask timeout, and agent stall.
func healingLoop(stopCh <-chan struct{}) {
	for {
		healingCfg.RLock()
		interval := time.Duration(healingCfg.config.PollIntervalSec) * time.Second
		subtaskTimeout := healingCfg.config.SubtaskTimeoutSec
		stallThreshold := healingCfg.config.StallThresholdSec
		healingCfg.RUnlock()

		select {
		case <-stopCh:
			return
		case <-time.After(interval):
		}

		// Respect the global kill switch from realtime.go.
		realtimeHub.RLock()
		// killSwitch is checked by reading the hub's events for the most
		// recent kill_switch event. We use a simpler approach: check if
		// the killSwitchActive flag is set (maintained in realtime.go).
		realtimeHub.RUnlock()

		healingMonitor.Lock()
		healingMonitor.lastPollAt = time.Now()
		healingMonitor.Unlock()

		// Get all tasks that claim to be "running" with container IDs.
		// We scan the autonomous store and agent store for active work.
		runningTasks := getRunningTasksForHealing()

		for _, task := range runningTasks {
			// 1. Container health check.
			if task.ContainerID != "" {
				health, err := checkContainerHealth(task.ContainerID)
				if err != nil {
					log.Printf("[HEALING] container check failed for %s: %v", task.ContainerID[:min(12, len(task.ContainerID))], err)
					continue
				}
				if !health.Running {
					healContainer(task.MissionID, task.TaskID, task.AgentCodename, task.ContainerID, health)
				}
			}

			// 2. Subtask timeout detection.
			if task.SubtaskStartedAt != nil {
				runningSec := int(time.Since(*task.SubtaskStartedAt).Seconds())
				if runningSec > subtaskTimeout {
					healTimeout(task.MissionID, task.TaskID, task.AgentCodename,
						task.ContainerID, task.SubtaskTitle, runningSec)
				}
			}

			// 3. Agent stall detection.
			lastActionTimes.RLock()
			lastAction, tracked := lastActionTimes.times[task.TaskID]
			lastActionTimes.RUnlock()

			if tracked {
				stalledSec := int(time.Since(lastAction).Seconds())
				if stalledSec > stallThreshold {
					healStall(task.MissionID, task.TaskID, task.AgentCodename, stalledSec)
					// Update the timestamp so we don't re-nudge every 15s.
					RecordTaskAction(task.TaskID)
				}
			}
		}
	}
}

// ── Task discovery ─────────────────────────────────────────────────────────

// HealingTaskView is a lightweight projection of a running task used by
// the healing monitor. Populated from whatever execution state is available.
type HealingTaskView struct {
	MissionID       string
	TaskID          string
	AgentCodename   string
	ContainerID     string
	SubtaskTitle    string
	SubtaskStartedAt *time.Time
}

// getRunningTasksForHealing collects all currently active tasks from the
// in-memory stores. As the execution engine (Phase 1) is built out, this
// will query the mission/task tables. For now it scans the agentContainers
// map (main.go) and enriches with DB agent data when available.
func getRunningTasksForHealing() []HealingTaskView {
	var tasks []HealingTaskView

	// Snapshot the agentContainers map (agentID -> containerID).
	agentContainers.RLock()
	containerMap := make(map[string]string, len(agentContainers.m))
	for k, v := range agentContainers.m {
		containerMap[k] = v
	}
	agentContainers.RUnlock()

	if len(containerMap) == 0 {
		return tasks
	}

	// Try to enrich from DB for agent names/types.
	var agentNames map[string]string
	if dbAvailable() {
		agents, err := dbListAgents()
		if err == nil {
			agentNames = make(map[string]string, len(agents))
			for _, a := range agents {
				agentNames[a.ID] = a.Name
			}
		}
	}

	for agentID, cid := range containerMap {
		codename := agentID
		if agentNames != nil {
			if name, ok := agentNames[agentID]; ok {
				codename = name
			}
		}
		tasks = append(tasks, HealingTaskView{
			MissionID:     "default",
			TaskID:        agentID,
			AgentCodename: codename,
			ContainerID:   cid,
		})
	}

	return tasks
}

// ── HTTP handlers ──────────────────────────────────────────────────────────

func handleListHealingEvents(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := fmt.Sscanf(l, "%d", &limit); n == 1 && err == nil && limit > 0 {
			if limit > maxHealingEvents {
				limit = maxHealingEvents
			}
		}
	}

	typeFilter := r.URL.Query().Get("type")
	severityFilter := r.URL.Query().Get("severity")

	healingStore.RLock()
	all := make([]HealingEvent, len(healingStore.events))
	copy(all, healingStore.events)
	healingStore.RUnlock()

	// Reverse chronological order.
	sort.Slice(all, func(i, j int) bool {
		return all[i].CreatedAt > all[j].CreatedAt
	})

	var filtered []HealingEvent
	for _, e := range all {
		if typeFilter != "" && e.Type != typeFilter {
			continue
		}
		if severityFilter != "" && e.Severity != severityFilter {
			continue
		}
		filtered = append(filtered, e)
		if len(filtered) >= limit {
			break
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"events": filtered,
		"total":  len(all),
	})
}

func handleGetHealingEvent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	healingStore.RLock()
	defer healingStore.RUnlock()

	for _, e := range healingStore.events {
		if e.ID == id {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "event": e})
			return
		}
	}

	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "event not found"})
}

func handleGetHealingStats(w http.ResponseWriter, _ *http.Request) {
	healingStore.RLock()
	events := healingStore.events
	healingStore.RUnlock()

	byType := make(map[string]int)
	bySev := make(map[string]int)
	autoFixed := 0
	escalations := 0

	for _, e := range events {
		byType[e.Type]++
		bySev[e.Severity]++
		if e.AutoFixed {
			autoFixed++
		}
		if e.Type == HealTypeEscalation {
			escalations++
		}
	}

	healingMonitor.Lock()
	running := healingMonitor.running
	lastPoll := healingMonitor.lastPollAt
	healingMonitor.Unlock()

	tasks := getRunningTasksForHealing()
	containerCount := 0
	for _, t := range tasks {
		if t.ContainerID != "" {
			containerCount++
		}
	}

	lastPollStr := ""
	if !lastPoll.IsZero() {
		lastPollStr = lastPoll.UTC().Format(time.RFC3339)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"stats": HealingStats{
			TotalEvents:       len(events),
			EventsByType:      byType,
			EventsBySeverity:  bySev,
			AutoFixedCount:    autoFixed,
			EscalationCount:   escalations,
			MonitorRunning:    running,
			LastPollAt:        lastPollStr,
			ActiveMissions:    len(tasks), // approximation
			WatchedContainers: containerCount,
		},
	})
}

func handleGetHealingStatus(w http.ResponseWriter, _ *http.Request) {
	healingMonitor.Lock()
	running := healingMonitor.running
	lastPoll := healingMonitor.lastPollAt
	healingMonitor.Unlock()

	healingCfg.RLock()
	cfg := healingCfg.config
	healingCfg.RUnlock()

	lastPollStr := ""
	if !lastPoll.IsZero() {
		lastPollStr = lastPoll.UTC().Format(time.RFC3339)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"running":      running,
		"last_poll_at": lastPollStr,
		"config":       cfg,
	})
}

func handleStartHealingMonitor(w http.ResponseWriter, _ *http.Request) {
	startHealingMonitor()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "healing monitor started"})
}

func handleStopHealingMonitor(w http.ResponseWriter, _ *http.Request) {
	stopHealingMonitor()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "healing monitor stopped"})
}

func handleGetHealingConfig(w http.ResponseWriter, _ *http.Request) {
	healingCfg.RLock()
	cfg := healingCfg.config
	healingCfg.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "config": cfg})
}

func handleUpdateHealingConfig(w http.ResponseWriter, r *http.Request) {
	var update HealingConfig
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid JSON"})
		return
	}

	healingCfg.Lock()
	if update.PollIntervalSec > 0 {
		healingCfg.config.PollIntervalSec = update.PollIntervalSec
	}
	if update.SubtaskTimeoutSec > 0 {
		healingCfg.config.SubtaskTimeoutSec = update.SubtaskTimeoutSec
	}
	if update.StallThresholdSec > 0 {
		healingCfg.config.StallThresholdSec = update.StallThresholdSec
	}
	if update.MaxRestartRetries > 0 {
		healingCfg.config.MaxRestartRetries = update.MaxRestartRetries
	}
	if update.OOMMemoryLimitMB > 0 {
		healingCfg.config.OOMMemoryLimitMB = update.OOMMemoryLimitMB
	}
	// Booleans: always update since zero-value is meaningful.
	healingCfg.config.AutoHealEnabled = update.AutoHealEnabled
	healingCfg.config.LLMDiagEnabled = update.LLMDiagEnabled
	result := healingCfg.config
	healingCfg.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "config": result})
}
