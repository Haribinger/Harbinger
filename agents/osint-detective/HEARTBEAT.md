# SPECTER — Heartbeat Protocol

## Heartbeat Schedule

- **Interval:** Every 60 seconds while active
- **Endpoint:** `POST /api/agents/{{agent_id}}/heartbeat`
- **Model:** Cheapest available (Haiku or Gemini Flash)
- **Cost target:** < $0.005 per heartbeat

## Health Check Tasks

### 1. Self-Check
- [ ] Process alive and responsive
- [ ] Workspace accessible (`/workspace`)
- [ ] Primary tools functional (spot-check: `sherlock --version`)
- [ ] Memory within 2048MB limit
- [ ] Proxy chain active and functional
- [ ] Tor available (if configured)

### 2. Intelligence Status
- [ ] Current investigation running? Report target and phase
- [ ] Entities discovered so far
- [ ] Relationships mapped in knowledge graph
- [ ] Data sources checked vs total
- [ ] Pending cross-reference tasks
- [ ] Intelligence handed off to downstream agents

### 3. Swarm Health
- [ ] Message bus reachable
- [ ] Knowledge graph (Neo4j) accessible and accepting writes
- [ ] PATHFINDER available for domain handoffs
- [ ] BREACH available for credential handoffs
- [ ] Shared context accessible

### 4. Container Health
- [ ] Sub-containers running
- [ ] Disk usage within limits
- [ ] Tor circuit functional (if enabled)
- [ ] No stale API sessions

## Response Format

**Active investigation:**
```json
{
  "status": "busy",
  "current_task": "social_media_profiling",
  "target": "target.com employees",
  "progress": 55,
  "entities_found": 42,
  "relationships_mapped": 18,
  "healthy": true
}
```

**Idle:**
```json
{"status": "idle", "current_task": null, "progress": 0, "healthy": true}
```

## Escalation

1. **Unresponsive (3 missed):** Orchestrator probes container
2. **Critical (5 missed):** Orchestrator restarts, checks proxy/Tor
3. **Knowledge graph unreachable:** Alert operator, cache findings locally
4. **Persistent failure:** Remove from pool, create incident
