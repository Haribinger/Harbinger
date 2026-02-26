# LENS — Heartbeat Protocol

## Heartbeat Schedule

- **Interval:** Every 60 seconds while active
- **Endpoint:** `POST /api/agents/{{agent_id}}/heartbeat`
- **Model:** Cheapest available (Haiku or Gemini Flash)
- **Cost target:** < $0.005 per heartbeat

## Health Check Tasks

### 1. Self-Check
- [ ] Process alive and responsive
- [ ] Workspace accessible (`/workspace/screenshots` writable)
- [ ] Memory within 1024MB limit

### 2. Browser Health
- [ ] Chrome process running
- [ ] CDP endpoint responsive (port 9222)
- [ ] Browser sessions manageable (not too many open tabs)
- [ ] Viewport rendering correctly
- [ ] No browser crashes or GPU errors

### 3. Session Status
- [ ] Active browser sessions count
- [ ] Current page URL and title
- [ ] Screenshots taken this session
- [ ] Network requests captured
- [ ] Console errors logged
- [ ] Pending interaction tasks

### 4. Swarm Health
- [ ] Message bus reachable
- [ ] BREACH available to receive authenticated sessions
- [ ] SCRIBE available to receive visual evidence
- [ ] Shared mount accessible (for screenshot sharing)

### 5. Container Health
- [ ] Chrome sub-processes under control
- [ ] Disk usage within limits (screenshots can be large)
- [ ] No memory leaks from browser
- [ ] Proxy chain functional (if configured)

## Response Format

**Active browsing:**
```json
{
  "status": "busy",
  "current_task": "authentication_flow",
  "current_url": "https://target.com/login",
  "sessions_active": 2,
  "screenshots_taken": 8,
  "progress": 60,
  "healthy": true
}
```

**Idle:**
```json
{"status": "idle", "sessions_active": 0, "healthy": true}
```

**Browser issues:**
```json
{
  "status": "error",
  "current_task": "screenshot",
  "healthy": false,
  "issues": ["Chrome process crashed", "CDP endpoint unresponsive"]
}
```

## Escalation

1. **Unresponsive (3 missed):** Orchestrator probes — may indicate Chrome crash
2. **Critical (5 missed):** Orchestrator restarts container and Chrome process
3. **Chrome crash:** Auto-restart Chrome, preserve session cookies if possible
4. **Persistent failure:** Remove from pool, create incident
