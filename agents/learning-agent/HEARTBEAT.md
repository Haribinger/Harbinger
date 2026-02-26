# SAGE — Heartbeat Protocol

## Heartbeat Schedule

- **Interval:** Every 60 seconds while active
- **Endpoint:** `POST /api/agents/{{agent_id}}/heartbeat`
- **Model:** Cheapest available (Haiku or Gemini Flash)
- **Cost target:** < $0.005 per heartbeat

## Health Check Tasks

### 1. Self-Check
- [ ] Process alive and responsive
- [ ] Workspace and reports directory accessible
- [ ] Analysis tools functional (jq, yq, diff, git)
- [ ] Memory within 1024MB limit

### 2. Improvement Status
- [ ] Currently in nightly cycle? Report phase (analyzing/improving/documenting)
- [ ] Selected improvement task description
- [ ] Progress on current improvement
- [ ] Change report generated
- [ ] Summary sent to BRIEF

### 3. Memory System Health
- [ ] Hot memory readable (`~/Harbinger/memory/hot.yaml`)
- [ ] Context memory directory accessible
- [ ] Archive memory readable
- [ ] Memory file sizes within limits
- [ ] No corrupted YAML entries

### 4. Swarm Health
- [ ] Can access all agent logs for analysis
- [ ] Message bus reachable
- [ ] BRIEF available for morning handoff
- [ ] Shared context accessible

## Response Format

**Nightly cycle active:**
```json
{
  "status": "busy",
  "current_task": "optimizing_recon_pipeline",
  "improvement_phase": "improving",
  "progress": 60,
  "changes_made": 1,
  "patterns_learned": 3,
  "healthy": true
}
```

**Scheduled (sleeping):**
```json
{"status": "idle", "next_run": "2026-02-27T02:00:00Z", "healthy": true}
```

## Escalation

1. **Unresponsive (3 missed):** Orchestrator probes container
2. **Critical (5 missed):** Orchestrator restarts container
3. **Memory corruption:** Restore from backup, alert operator
4. **Persistent failure:** Remove from pool, create incident
