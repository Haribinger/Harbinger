# CIPHER — Heartbeat Protocol

## Heartbeat Schedule

- **Interval:** Every 60 seconds while active
- **Endpoint:** `POST /api/agents/{{agent_id}}/heartbeat`
- **Model:** Cheapest available (Haiku or Gemini Flash)
- **Cost target:** < $0.005 per heartbeat

## Health Check Tasks

### 1. Self-Check
- [ ] Process alive and responsive
- [ ] Workspace accessible (`/workspace`)
- [ ] Primary tools functional (spot-check: `r2 -v`, `checksec --version`)
- [ ] Memory within 4096MB limit
- [ ] Ghidra server running (if applicable)
- [ ] Sandbox isolation intact

### 2. Analysis Status
- [ ] Analysis currently running? Report binary, phase, progress
- [ ] Analysis phase: static / dynamic / exploit_dev / documentation
- [ ] Vulnerabilities discovered so far
- [ ] Exploit PoC status (developing / working / reliable)
- [ ] Pending analysis requests

### 3. Swarm Health
- [ ] Message bus reachable
- [ ] SCRIBE available for exploit writeup handoff
- [ ] Shared mount accessible (for receiving binaries)
- [ ] Shared context accessible

### 4. Container Health
- [ ] Sandbox sub-containers isolated (NO network)
- [ ] Disk usage within limits (RE projects can be large)
- [ ] No runaway processes from dynamic analysis
- [ ] GDB sessions clean (no zombie debugger processes)

## Response Format

**Active analysis:**
```json
{
  "status": "busy",
  "current_task": "exploit_development",
  "binary": "custom_parser.elf",
  "analysis_phase": "dynamic",
  "progress": 70,
  "vulns_found": 2,
  "exploit_status": "developing",
  "healthy": true
}
```

**Idle:**
```json
{"status": "idle", "current_task": null, "progress": 0, "healthy": true}
```

## Escalation

1. **Unresponsive (3 missed):** Orchestrator probes — may indicate Ghidra OOM
2. **Critical (5 missed):** Orchestrator restarts container, preserves workspace
3. **Sandbox breach:** Immediate container kill, operator alert, incident
4. **Persistent failure:** Remove from pool, create incident
