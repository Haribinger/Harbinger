# AGENTS.md - Sub-Agent Registry (Updated)

**Last Updated:** 2026-02-20 15:15 PST

---

## 🤖 Sub-Agent Roster

Your team of specialist sub-agents. Know who to call, when to call them, and what they do.

---

## ✅ Active Agents (4)

### 🧠 Research Agent
**Skill:** `deep-research-pro`
**Location:** Local workspace
**Model:** Haiku (primary) → Gemini Flash (fallback)
**Use For:** Market research, competitor analysis, vulnerability intelligence
**Workspace:** None (stateless agent)

**Spawn Command:**
```bash
sessions_spawn(
  task: "Research [topic]. Follow deep-research-pro workflow.",
  label: "research-[slug]",
  model: "haiku"
)
```

---

### 🔒 Security Auditor
**Skill:** `security-audit-toolkit`
**Location:** Local workspace
**Model:** Haiku 4.5
**Use For:** Dependency scanning, secret detection, OWASP analysis
**Workspace:** None (stateless agent)

**Spawn Command:**
```bash
sessions_spawn(
  task: "Audit [path] for security issues.",
  label: "audit-[slug]",
  model: "haiku"
)
```

---

### 📝 Code Reviewer
**Skill:** `pr-review`
**Location:** Local workspace
**Model:** Sonnet (parallel 5 agents)
**Use For:** Pre-PR analysis, finding bugs/performance issues
**Workspace:** None (stateless agent)

**Spawn Command:**
```bash
sessions_spawn(
  task: "Review PR #[number]. Focus: security, bugs, quality.",
  label: "pr-review-[slug]",
  model: "sonnet"
)
```

---

### 🖥️ Security Skill Scanner
**Skill:** `security-skill-scanner`
**Location:** Local workspace
**Model:** Gemini Flash or Haiku
**Use For:** Scanning OpenClaw skills for vulnerabilities
**Workspace:** None (stateless agent)

**Spawn Command:**
```bash
sessions_spawn(
  task: "Scan skill [name] for security issues.",
  label: "skill-scan-[slug]",
  model: "gemini-flash"
)
```

---

### 📊 DASHBOARD MANAGER ✅ NEW
**Workspace:** `/Users/nunu/.openclaw/workspace/agents/dashboard-manager/`
**Status:** ✅ Active (Manual sync ready)
**Model:** Haiku 4.5
**Use For:** Keep Mission Control dashboard synced with workspace data

**Dashboard Location:**
- **Repo:** https://github.com/PWAEngine/studious-rotary.git
- **Tech Stack:** React + Vite + Tailwind CSS
- **State File:** client/src/contexts/AppContext.tsx

**Sync Responsibilities:**
- Priorities from `business/business-priority-list.md`
- Agents from `AGENTS.md`
- Trading state from `agents/trader/TRADE_STATE.md`
- Intel from `SECURITY.md`
- Metrics from workspace files

**Control Commands:**
```bash
"sync dashboard"        → Manual sync workspace → dashboard
"enable dashboard sync" → Enable automatic sync (every 30 min)
"disable dashboard sync" → Disable automatic sync
```

**Spawn Command (Manual Sync):**
```bash
sessions_spawn(
  task: "Sync dashboard with workspace data. Update priorities, agents, trading state. Push to GitHub.",
  label: "dashboard-sync",
  model: "haiku"
)
```

**Workspace Files:**
- SOUL.md - Agent identity + sync rules
- SYNC_CONFIG.md - Sync configuration + status
- DASHBOARD_STATE.md - Current dashboard cache
- SYNC_LOG.md - Sync operation logs

**Latest Sync:** 2026-02-20 15:10 PST (Dashboard updated with real data)

---

## 🟡 Planned Agents (1)

### 🔴 Red Team Agent
**Location:** VPS (Kali Linux, Hostinger)
**Status:** 🟡 Planned
**Model:** Haiku 4.5
**Use For:** Network recon, vulnerability scanning, exploit testing
**Workspace:** VPS isolated workspace

**Spawn Command:** (after setup)
```bash
sessions_spawn(
  task: "Recon authorized target [domain]. Methods: Nmap, service detection.",
  label: "redteam-[slug]",
  model: "haiku",
  node: "vps-hostinger-kali"
)
```

---

## 🎯 Spawning Guidelines

### When to Spawn
- **Research:** Market data, competitors, vulnerability trends → `deep-research-pro`
- **Security Audit:** Code scanning, dependency checks, secrets detection, bug bounty recon → `security-audit-toolkit`
- **Code Review:** Before PR submission, code quality checks → `pr-review`
- **Skill Scan:** Scan OpenClaw skills for vulnerabilities → `security-skill-scanner`
- **Frontend UI:** Build RedClaw/HiveMind UI components, landing pages → `frontend-design`
- **Payments:** Implement Stripe subscriptions for RedClaw/HiveMind → `stripe-best-practices`
- **New Skill:** Create a new OpenClaw skill for a repeating task → `skill-creator`
- **New Agent:** Design a new sub-agent spec → `agent-development`
- **Automation:** Build triggers/webhooks for bug bounty or onboarding → `automation-workflows`
- **Dashboard Sync:** Keep workspace data in sync with dashboard UI - STATEFUL

### Model Selection
- **Gemini Flash:** Routine tasks, health checks, cost-sensitive ops
- **Haiku:** Analysis, research, code work, trading cycles
- **Sonnet:** Parallel agents (PR review) or complex reasoning

### Cleanup Rules
- `cleanup: "keep"` (default) — Preserve for future reference
- `cleanup: "delete"` — One-off task, cleanup after report

---

## 🔒 Workspace Isolation Rules

**Mission Control Principle:**
- Every sub-agent has its own workspace
- Never let sub-agents write to root workspace
- DASHBOARD MANAGER stays in `agents/dashboard-manager/` STRICTLY
- Other agents are stateless (no persistent workspace)

**Violations:**
- If a sub-agent needs external info → Ask Mission Control
- Never let DASHBOARD MANAGER access root workspace files

---

## 📊 Quick Reference

| Agent | Type | Location | Cost | Status | Priority |
|-------|------|----------|------|--------|----------|
| 🧠 Research | Stateless | Local | Low | ✅ Active | High |
| 🔒 Security Auditor | Stateless | Local | Low | ✅ Active | High |
| 📝 Code Reviewer | Stateless | Local (5x Sonnet) | Medium | ✅ Active | High |
| 🖥️ Security Scanner | Stateless | Local | Low (Flash) | ✅ Active | Medium |
| 🎨 Frontend Designer | Stateless | Local | Low | ✅ Active | High |
| 💳 Stripe Integrator | Stateless | Local | Low | ✅ Active | Medium |
| 🛠️ Skill Creator | Stateless | Local | Low | ✅ Active | Medium |
| 📊 DASHBOARD MANAGER | Stateful | `agents/dashboard-manager/` | Low | ✅ Active | High |
| 🔴 Red Team | Stateful | VPS | TBD | 🟡 Planned | P1 |

---

## 🎯 Current Priority: Bug Bounty Product Launch

**Phase 1: Product Validation** (NOW)
- [ ] Interview 10 bug bounty hunters for market validation
- [ ] Start hunter outreach with DM scripts
- [ ] Complete skill suite security audit
- [ ] Get GitHub access for code audit

**Phase 2: Build Phase**
- [ ] Fork AgentsUi → RedClaw repo
- [ ] Add Agent Zero as brain submodule
- [ ] Build Recon agent (subfinder, httpx, nuclei)
- [ ] Build Program manager component

**Phase 3: Launch Phase**
- [ ] Complete core features
- [ ] Beta testing with hunters
- [ ] Launch landing page
- [ ] Onboard first 100 users

---

## 📋 Roadmap

### Week 1-2 (NOW)
- Market validation interviews
- Hunter outreach + DM scripts
- Skill suite security audit
- GitHub access setup

### Week 3-4
- Fork AgentsUi → RedClaw
- Add Agent Zero submodule
- Design product architecture

### Week 5-8
- Build Recon agent
- Build Program manager
- Develop core features

### Week 9+
- Beta testing
- Launch landing page
- First 100 users onboarding

---

**Last Updated:** 2026-02-21 22:15 EST
**Next Update:** After market validation interviews complete