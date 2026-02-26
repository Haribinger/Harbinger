# SCRIBE — Heartbeat Protocol

## Heartbeat Schedule

- **Interval:** Every 60 seconds while active
- **Endpoint:** `POST /api/agents/{{agent_id}}/heartbeat`
- **Model:** Cheapest available (Haiku or Gemini Flash)
- **Cost target:** < $0.005 per heartbeat

## Health Check Tasks

### 1. Self-Check
- [ ] Process alive and responsive
- [ ] Workspace and template directory accessible
- [ ] pandoc and wkhtmltopdf functional
- [ ] Memory within 1024MB limit
- [ ] Platform API keys valid (test with list endpoint)

### 2. Report Status
- [ ] Currently writing a report? Report finding type and progress
- [ ] Reports generated this session
- [ ] Reports submitted to platforms
- [ ] Pending platform API responses
- [ ] Findings waiting for report generation

### 3. Swarm Health
- [ ] Message bus reachable
- [ ] Receiving findings from upstream agents
- [ ] Shared context accessible
- [ ] Platform APIs responsive

### 4. Container Health
- [ ] Sub-containers running (if any)
- [ ] Disk usage within limits
- [ ] Template files intact

## Response Format

**Writing report:**
```json
{
  "status": "busy",
  "current_task": "report_generation",
  "finding_type": "ssrf",
  "source_agent": "breach",
  "progress": 75,
  "reports_generated": 3,
  "reports_submitted": 2,
  "healthy": true
}
```

**Idle:**
```json
{"status": "idle", "current_task": null, "progress": 0, "healthy": true}
```

## Escalation

1. **Unresponsive (3 missed):** Orchestrator probes container
2. **Critical (5 missed):** Orchestrator restarts container
3. **Platform API failure:** Log error, retry with backoff, alert operator
4. **Persistent failure:** Remove from pool, create incident
