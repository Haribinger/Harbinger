# PHANTOM — Heartbeat Protocol

## Heartbeat Schedule

- **Interval:** Every 60 seconds while active
- **Endpoint:** `POST /api/agents/{{agent_id}}/heartbeat`
- **Model:** Cheapest available (Haiku or Gemini Flash)
- **Cost target:** < $0.005 per heartbeat

## Health Check Tasks

### 1. Self-Check
- [ ] Process alive and responsive
- [ ] Workspace accessible (`/workspace` mounted)
- [ ] Credential store intact (`/workspace/.credentials`)
- [ ] Memory within 2048MB limit
- [ ] Proxy chain active and functional (CRITICAL — never operate without proxy)
- [ ] Cloud CLI tools functional (aws, gcloud, az version checks)

### 2. Stealth Status
- [ ] Proxy chain routing correctly (verify exit IP)
- [ ] No unexpected CloudTrail/audit log entries generated
- [ ] API call rate within safe limits
- [ ] No detection alerts triggered (check GuardDuty if accessible)
- [ ] Stealth status: GREEN (safe) / YELLOW (caution) / RED (possible detection)

### 3. Task Status
- [ ] Current enumeration/exploitation running? Report provider and service
- [ ] Services enumerated vs total
- [ ] Findings discovered so far
- [ ] Active cloud sessions and their expiry times
- [ ] Pending credential rotations

### 4. Swarm Health
- [ ] Message bus reachable
- [ ] PATHFINDER feeding cloud assets
- [ ] SCRIBE available for findings
- [ ] Shared context accessible

### 5. Container Health
- [ ] Sub-containers running
- [ ] Disk usage within limits
- [ ] No credential leaks in logs (verify)
- [ ] Proxy chain not degraded

## Response Format

**Active enumeration:**
```json
{
  "status": "busy",
  "current_task": "iam_enumeration",
  "provider": "aws",
  "progress": 40,
  "stealth_status": "green",
  "services_enumerated": 5,
  "findings": 3,
  "healthy": true
}
```

**Stealth warning:**
```json
{
  "status": "busy",
  "current_task": "s3_enumeration",
  "stealth_status": "yellow",
  "healthy": true,
  "issues": ["High API call rate detected, throttling recommended"]
}
```

## Escalation

1. **Unresponsive (3 missed):** Orchestrator probes — may indicate proxy failure
2. **Critical (5 missed):** Orchestrator restarts, checks proxy chain first
3. **Stealth RED:** Immediate pause, operator notification, potential engagement abort
4. **Persistent failure:** Remove from pool, secure credentials, create incident
