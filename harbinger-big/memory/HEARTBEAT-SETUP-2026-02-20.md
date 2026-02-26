# HEARTBEAT SETUP CONFIRMED

**Date:** 2026-02-20 12:17 PST

---

## ✅ HEARTBEAT CONFIGURED

**Status:** Active and running 24/7

### Configuration

**Schedule:** Every hour on the hour (cron: 0 * * * *)
**Job ID:** 320406e5-2bc3-4fbb-87e5-7a8212c7fcc6
**Session:** Main (Mission Control)
**Model:** Gemini Flash (cheapest) → Haiku (fallback)
**Cost Target:** < $0.01/heartbeat
**Enabled:** ✅ Active

### What It Does

Every hour, the heartbeat:
1. **Quick Health Check** — Sub-agent status, background tasks, cron jobs
2. **Business Metrics Check** — P0/P1 priorities, blockers, security alerts
3. **System Health** — Workspace accessibility, skills integrity, config files
4. **Trading Status** — Cron jobs, profit/loss, API errors (if trading active)
5. **VPS/Red Team Status** — Reachability, subagent response, MCP tools (if VPS active)

### Response Behavior

**If ALL CLEAR:**
```
HEARTBEAT_OK
```
(Exactly this. Nothing else.)

**IF ISSUES FOUND:**
```
[STATUS] ⚠️/🚨
[FINDING] What's wrong
[ACTION] What to do
```
(Only critical issues requiring human intervention.)

---

## Next Run

**Next Heartbeat:** 2026-02-20 13:00 PST (1 hour from now)

**Subsequent Runs:** Every hour
- 14:00 PST
- 15:00 PST
- ...
- Continuing 24/7

---

## Cost Estimate

**Per Heartbeat:** < $0.01 (Gemini Flash is free/cheap)
**Daily Cost:** < $0.24 (24 heartbeats × $0.01)
**Monthly Cost:** < $7.30

**Fallback Protection:** If Gemini Flash hits daily limit, automatically falls back to Haiku.

---

## Monitoring

**To Disable Heartbeat:**
```bash
cron remove 320406e5-2bc3-4fbb-87e5-7a8212c7fcc6
```

**To Check Status:**
```bash
cron list
```

**To Modify Schedule:**
```bash
cron update 320406e5-2bc3-4fbb-87e5-7a8212c7fcc6 --patch '{"schedule": {"expr": "0 */2 * * *"}}'
```

---

## Files Involved

1. **HEARTBEAT.md** — Instructions + scan checklist
   - Location: `/Users/nunu/.openclaw/workspace/HEARTBEAT.md`
   - Purpose: Defines what to check + how to respond

2. **Cron Job** — Automated trigger
   - Job: "heartbeat"
   - ID: `320406e5-2bc3-4fbb-87e5-7a8212c7fcc6`
   - Runtime: Managed by OpenClaw Gateway

---

**✅ Ready for the next step.
