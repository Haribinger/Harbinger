# HEARTBEAT.md - Hourly Check-in

**Purpose:** Periodic health check for Mission Control. Run every hour, 24/7.

---

## Heartbeat Tasks

When this heartbeat triggers, perform a quick scan:

### 1. Quick Health Check

- [ ] Any sub-agents stuck or unresponsive?
- [ ] Any background tasks running too long?
- [ ] Any cron jobs failed or disabled?
- [ ] Any workspace file corruption risk?

### 2. Business Metrics Check

- [ ] Any P0/P1 priorities overdue?
- [ ] Any blockers requiring attention in business/bottlenecks.md?
- [ ] Any security alerts from recent scans?

### 3. System Health

- [ ] Workspace accessible?
- [ ] Skills intact (check skills/ directory)?
- [ ] Configuration files valid (SOUL.md, MEMORY.md, AGENTS.md)?

### 4. VPS/Red Team Status (if active)

- [ ] VPS reachable?
- [ ] Red team subagent responsive?
- [ ] Any MCP tool errors?

### 5. Bug Bounty Status

- [ ] Any bug bounty alerts from recent scans?
- [ ] Any new targets look good to hunt on in .bounty-targets-data do python3 target_dice.py --sync
      then python3 target_dice.py -l 5
- [ ] is there a new target to hunt that is not highly tested on and maybe vulnerable?

---

## Response Rules

**If ALL CLEAR:**

- Respond with exactly: `HEARTBEAT_OK`
- Nothing else. No explanation. No additional text.

**IF ISSUES FOUND:**

- Respond with brief summary of what needs attention
- Use [STATUS] → [FINDING] → [ACTION] format
- Prioritize: P0 > P1 > P2
- Only alert critical issues requiring human intervention

---

## Examples

**Normal (no issues):**

```
HEARTBEAT_OK
```

**Issues found:**

```
[STATUS] ⚠️ Issues Detected
[FINDING] Hunter validation interviews overdue by 2 days
[ACTION] Recommend starting interviews - 5/10 completed
```

```
[STATUS] 🚨 Critical
[FINDING] Trading cycle cron job disabled unexpectedly
[ACTION] User action required to re-enable
```

---

## Notes

- **Model to use:** Gemini Flash (cheapest) or Haiku (fallback)
- **Cost target:** < $0.01/heartbeat
- **Frequency:** Every hour (0 \* \* \* \*)
- **Duration:** Keep scan under 30 seconds

---
