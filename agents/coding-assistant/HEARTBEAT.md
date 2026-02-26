# SAM — Heartbeat Protocol

## Heartbeat Schedule

- **Interval:** Every 60 seconds while active
- **Endpoint:** `POST /api/agents/{{agent_id}}/heartbeat`
- **Model:** Cheapest available (Haiku or Gemini Flash)
- **Cost target:** < $0.005 per heartbeat

## Health Check Tasks

### 1. Self-Check
- [ ] Process alive and responsive
- [ ] Workspace accessible
- [ ] Language toolchains functional (node, go, python3, rustc, gcc)
- [ ] Memory within 2048MB limit
- [ ] Git functional

### 2. Dev Status
- [ ] Currently coding? Report project, language, progress
- [ ] Files modified this session
- [ ] Tests passing (last run result)
- [ ] Build status (compiling / passing / failing)
- [ ] Pending code review requests

### 3. Swarm Health
- [ ] Message bus reachable
- [ ] Tool requests from other agents pending
- [ ] Shared mount accessible
- [ ] Browser CDP accessible (for docs)

### 4. Container Health
- [ ] Sub-containers (build, test) running
- [ ] Disk usage within limits
- [ ] No orphaned dev servers

## Response Format

**Active coding:**
```json
{
  "status": "busy",
  "current_task": "building_custom_parser",
  "language": "go",
  "progress": 60,
  "files_modified": 5,
  "tests_passing": true,
  "healthy": true
}
```

## Escalation

1. **Unresponsive (3 missed):** Orchestrator probes container
2. **Critical (5 missed):** Orchestrator restarts container, preserves workspace
3. **Build failure:** Log error, notify requesting agent
4. **Persistent failure:** Remove from pool, create incident
