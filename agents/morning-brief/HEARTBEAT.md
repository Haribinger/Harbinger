# BRIEF — Heartbeat Protocol

## Heartbeat Schedule

- **Interval:** Every 60 seconds while active
- **Endpoint:** `POST /api/agents/{{agent_id}}/heartbeat`
- **Model:** Cheapest available (Haiku or Gemini Flash)
- **Cost target:** < $0.005 per heartbeat

## Health Check Tasks

### 1. Self-Check
- [ ] Process alive and responsive
- [ ] Workspace and archive directory accessible
- [ ] Browser CDP functional (for web scraping)
- [ ] Memory within 512MB limit

### 2. Brief Status
- [ ] Currently generating brief? Report section progress
- [ ] Brief sections completed (0/4: news, tasks, agents, recommendations)
- [ ] Channels delivered to (0/3: discord, telegram, webchat)
- [ ] Brief archived successfully
- [ ] Next scheduled run time

### 3. Source Health
- [ ] RSS feeds reachable and returning data
- [ ] CVE feed responsive
- [ ] Agent heartbeat endpoints responding
- [ ] Channel webhooks valid (last delivery status)

### 4. Container Health
- [ ] Sub-containers running (scrapers)
- [ ] Disk usage within limits
- [ ] Browser process stable

## Response Format

**Generating brief:**
```json
{
  "status": "busy",
  "current_task": "generating_brief",
  "sections_complete": 2,
  "sections_total": 4,
  "progress": 50,
  "healthy": true
}
```

**Scheduled (waiting):**
```json
{"status": "idle", "next_run": "2026-02-27T08:00:00Z", "healthy": true}
```

## Escalation

1. **Unresponsive (3 missed):** Orchestrator probes container
2. **Critical (5 missed):** Orchestrator restarts container
3. **Channel delivery failure:** Retry with backoff, log error
4. **Persistent failure:** Remove from pool, notify operator
