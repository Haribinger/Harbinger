# {{CODENAME}} — Heartbeat Protocol

> This file defines how the agent checks in, what it monitors, and how it reports health.

## Heartbeat Schedule

- **Interval:** Every 60 seconds while active
- **Endpoint:** `POST /api/agents/{{agent_id}}/heartbeat`
- **Model:** Use cheapest available (Haiku or Gemini Flash)
- **Cost target:** < $0.005 per heartbeat

## Health Check Tasks

### 1. Self-Check
- [ ] Am I still running? (process health)
- [ ] Is my workspace accessible? (`/workspace` mounted and writable)
- [ ] Are my tools functional? (spot-check one primary tool)
- [ ] Is my memory within limits? (check against `memory_mb` in CONFIG.yaml)
- [ ] Is my network accessible? (can I reach the Harbinger API?)

### 2. Task Status
- [ ] Do I have an active task? If yes, report progress (0-100%)
- [ ] Is my current task stalled? (no progress in last 5 minutes)
- [ ] Are there queued tasks waiting for me?
- [ ] Have I produced output that hasn't been handed off yet?

### 3. Swarm Health
- [ ] Can I reach the message bus? (`/api/agents/broadcast`)
- [ ] Are my upstream agents (receives_from) responsive?
- [ ] Are my downstream agents (handoff_to) responsive?
- [ ] Is the shared context accessible? (`/api/agents/context`)

### 4. Container Health
- [ ] Are my sub-containers (if any) still running?
- [ ] Is disk usage within acceptable limits?
- [ ] Are there zombie processes?

## Response Format

**If ALL CLEAR:**
```json
{"status": "active", "current_task": "{{task}}", "progress": 0, "healthy": true}
```

**If IDLE:**
```json
{"status": "idle", "current_task": null, "progress": 0, "healthy": true}
```

**If ISSUES:**
```json
{"status": "error", "current_task": "{{task}}", "progress": 0, "healthy": false, "issues": ["{{issue_1}}"]}
```

## Escalation

1. **Unresponsive (3 missed):** Orchestrator logs warning, attempts health probe
2. **Critical (5 missed):** Orchestrator restarts container, notifies operator
3. **Persistent failure:** Orchestrator removes agent from active pool, creates incident
