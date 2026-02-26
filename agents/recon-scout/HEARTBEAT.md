# PATHFINDER — Heartbeat Protocol

## Heartbeat Schedule

- **Interval:** Every 60 seconds while active
- **Endpoint:** `POST /api/agents/{{agent_id}}/heartbeat`
- **Model:** Cheapest available (Haiku or Gemini Flash)
- **Cost target:** < $0.005 per heartbeat

## Health Check Tasks

### 1. Self-Check
- [ ] Process alive and responsive
- [ ] Workspace accessible (`/workspace` mounted and writable)
- [ ] Primary tools functional (spot-check: `subfinder -version`, `httpx -version`)
- [ ] Memory within 2048MB limit
- [ ] Network accessible (Harbinger API and target networks reachable)
- [ ] Resolvers working (`/workspace/resolvers.txt` valid)

### 2. Scan Status
- [ ] Current scan running? Report tool name and progress
- [ ] Targets scanned vs total count
- [ ] Assets discovered so far
- [ ] Any scan stalled? (no new output in 5 minutes)
- [ ] Queued targets waiting to be scanned
- [ ] Scan output handed off to downstream agents

### 3. Swarm Health
- [ ] Message bus reachable (`/api/agents/broadcast`)
- [ ] BREACH available to receive web targets
- [ ] SPECTER available to receive OSINT leads
- [ ] PHANTOM available to receive cloud assets
- [ ] Shared context accessible (`/api/agents/context`)
- [ ] Pending handoffs processed

### 4. Container Health
- [ ] Sub-containers (parallel scanners) still running
- [ ] Disk usage within limits (scan output can be large)
- [ ] No zombie scan processes
- [ ] DNS resolution working (critical for recon)

## Response Format

**Active scan:**
```json
{
  "status": "busy",
  "current_task": "subdomain_enumeration",
  "target": "target.com",
  "progress": 65,
  "targets_scanned": 3,
  "targets_total": 5,
  "assets_found": 247,
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
  "current_task": "port_scanning",
  "progress": 30,
  "healthy": false,
  "issues": ["DNS resolvers unresponsive", "masscan sub-container crashed"]
}
```

## Escalation

1. **Unresponsive (3 missed):** Orchestrator logs warning, probes container
2. **Critical (5 missed):** Orchestrator restarts container, preserves workspace
3. **Scan stall (10 min):** Orchestrator sends probe, may reassign targets
4. **Persistent failure:** Remove from active pool, notify operator, create incident
