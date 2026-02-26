# BREACH — Heartbeat Protocol

## Heartbeat Schedule

- **Interval:** Every 60 seconds while active
- **Endpoint:** `POST /api/agents/{{agent_id}}/heartbeat`
- **Model:** Cheapest available (Haiku or Gemini Flash)
- **Cost target:** < $0.005 per heartbeat

## Health Check Tasks

### 1. Self-Check
- [ ] Process alive and responsive
- [ ] Workspace accessible (`/workspace` and `/workspace/wordlists`)
- [ ] Primary tools functional (spot-check: `nuclei -version`, `sqlmap --version`)
- [ ] Memory within 4096MB limit
- [ ] Network accessible (targets and Harbinger API reachable)
- [ ] Nuclei templates up to date
- [ ] Wordlists accessible and intact

### 2. Test Status
- [ ] Test currently running? Report tool, target, progress
- [ ] Targets tested vs total count
- [ ] Vulnerabilities found by severity (critical/high/medium/low/info)
- [ ] Any test stalled? (no output in 5 minutes)
- [ ] Pending targets from PATHFINDER
- [ ] Findings handed off to SCRIBE

### 3. Swarm Health
- [ ] Message bus reachable (`/api/agents/broadcast`)
- [ ] PATHFINDER feeding targets (last received timestamp)
- [ ] SCRIBE available for report handoff
- [ ] Shared context accessible

### 4. Container Health
- [ ] Sub-containers (parallel scanners) running
- [ ] Disk usage within limits
- [ ] No zombie processes from crashed tools
- [ ] Caido proxy accessible

## Response Format

**Active testing:**
```json
{
  "status": "busy",
  "current_task": "xss_testing",
  "target": "https://target.com/search",
  "progress": 45,
  "vulns_found": {"critical": 0, "high": 1, "medium": 3, "low": 2, "info": 5},
  "targets_tested": 12,
  "targets_total": 30,
  "healthy": true
}
```

**Idle:**
```json
{"status": "idle", "current_task": null, "progress": 0, "healthy": true}
```

**Issues:**
```json
{
  "status": "error",
  "current_task": "sqli_testing",
  "progress": 60,
  "healthy": false,
  "issues": ["sqlmap crashed on target X", "nuclei templates outdated 7 days"]
}
```

## Escalation

1. **Unresponsive (3 missed):** Orchestrator logs warning, probes container
2. **Critical (5 missed):** Orchestrator restarts container, preserves findings
3. **Tool crash:** Log error, attempt restart, notify operator if persistent
4. **Persistent failure:** Remove from active pool, create incident
