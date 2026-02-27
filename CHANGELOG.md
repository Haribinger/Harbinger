## [1.1.0] - 2026-02-26

### Added — Autonomous Intelligence System
- **Autonomous Engine** (`agents/shared/autonomous-engine.js`) — 60-second background thinking loop for every agent
  - 5-dimension analysis: performance, accuracy, cost, automation, collaboration
  - Efficiency formula: `COST_BENEFIT = (TIME_SAVED * FREQUENCY) / (IMPL_COST + RUNNING_COST)`
  - Automation classification: script, skill, workflow, code_change
- **Backend API** (`backend/cmd/autonomous.go`) — 7 endpoints, 14 routes (both `/api/` and `/api/v1/`)
  - `POST /api/agents/thoughts` — agent reports observation/enhancement/proposal/alert
  - `GET /api/agents/thoughts` — list with filters (agent_id, type, status, category, limit)
  - `GET /api/agents/thoughts/{id}` — single thought detail
  - `PATCH /api/agents/thoughts/{id}` — approve, reject, or mark implemented
  - `DELETE /api/agents/thoughts/{id}` — remove thought
  - `GET /api/agents/swarm` — full swarm state for agent self-awareness
  - `GET /api/agents/autonomous/stats` — dashboard summary metrics
- **Database** — `agent_thoughts` table with indexes on agent_id, status, type
- **Frontend Dashboard** (`/autonomous`) — Obsidian Command theme
  - 4 metric cards: Active Thoughts, Pending Proposals, Avg Efficiency, Implemented
  - 3-column grid: Swarm Overview, Thought Log, Enhancement Proposals
  - 2 Recharts: Thoughts Over Time (LineChart), Thoughts by Agent (BarChart)
  - Automation Suggestions panel: categorized by type
  - Approve/reject/implement/delete actions
- **Zustand Store** (`autonomousStore.ts`) — state management with filter persistence
- **API Client** (`autonomous.ts`) — TypeScript interfaces + 7 API methods
- **Orchestrator** — `reportThought()` method + `autonomousThought` event

### Added — Meta-Cognition SOUL.md
- All 11 agent SOUL.md files updated with personalized Meta-Cognition sections:
  - Self-Awareness — what to monitor about their own performance
  - Enhancement Identification — how to spot improvement opportunities
  - Efficiency Tracking — COST_BENEFIT formula, minimum threshold > 1.0
  - Swarm Awareness — how to coordinate with other agents

### Added — Documentation
- **docs/ROADMAP.md** — comprehensive 7-phase roadmap with shipped/planned tracking
- README.md updated: 19 pages, 19 stores, roadmap link, Autonomous Intelligence feature
- Sidebar: Brain icon navigation to `/autonomous`

### Infrastructure
- Page count: 18 → 19 (Autonomous Intelligence)
- Zustand stores: 18 → 19 (autonomousStore)
- API modules: 14 → 15 (autonomous)
- Backend files: 9 → 13 (autonomous.go, codehealth.go, modelrouter.go, oauth.go, themes.go)
- Backend endpoints: 100+ (14 new autonomous routes)

---

## [1.0.0] - 2026-02-25

### Added — Authentication
- **GitHub Device Flow** (`POST /api/auth/github/device/start` + `POST /api/auth/github/device/poll`)
  — No callback URL required. Works behind IIS, NAT, and corporate proxies.
- **GitHub Token auth** (`POST /api/auth/github/token`) — validate a PAT directly
- **Server GH_TOKEN** (`GET /api/auth/github/token/env`) — use `GH_TOKEN` env var for instant local auth
- **Login page redesign** — 3-tab Obsidian Command UI: OAUTH / DEVICE FLOW / TOKEN
  Scanline overlay, gold borders, agent roster strip, AnimatePresence tab transitions
- **authStore** — `startDeviceFlow()`, `pollDeviceFlow()`, `loginWithGHToken()` methods

### Added — Agent System
- **6 canonical Harbinger agents** pre-seeded in agentStore with full system prompts:
  - PATHFINDER (recon) — subfinder, httpx, naabu, dnsx, katana, gau workflow
  - BREACH (web) — nuclei → sqlmap → dalfox → ffuf → recx chain with WAF evasion
  - PHANTOM (cloud) — AWS/Azure/GCP audit, IAM escalation, metadata SSRF
  - SPECTER (osint) — theHarvester, Sherlock, HaveIBeenPwned, Google dorks, GitHub recon
  - CIPHER (binary-re) — Ghidra, radare2, pwntools, ROP chain development
  - SCRIBE (reporting) — CVSS scoring, HackerOne/Bugcrowd/Intigriti report templates
- **Agent personalities** — detailed system prompts with tool chains, decision rules, output format

### Added — Dashboard
- **Full command center rewrite** — OPERATION PHANTOM aesthetic from stitch wireframes
  - Live clock, system status bar with ONLINE indicator
  - Agent roster strip — 6 cards with color-coded status dots and role labels
  - Stats row — active agents, running scans, browser sessions, live workflows
  - 3-column layout: Activity Feed / Quick Ops / Service Health
  - Service health panel — Backend, PostgreSQL, Redis, Neo4j, HexStrike, PentAGI, MCP-UI, RedTeam
  - Quick Ops grid — RECON SCAN, SPAWN AGENT, WEB ATTACK, OSINT SWEEP, DOCKER ENV, WRITE REPORT
  - Bounty Hub strip — platform breakdown, sync button
  - Auto-refresh every 30 seconds with manual refresh button

### Added — Infrastructure
- **pnpm workspace** — `harbinger-tools/frontend` added to `pnpm-workspace.yaml` so `pnpm build:ui` resolves correctly
- **Docker Compose env passthrough** — backend now receives `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `APP_URL`, `GITHUB_REDIRECT_URL`, `GH_TOKEN`
- **Frontend Docker ARG** — `VITE_API_URL` defaults to empty string (relative URLs → nginx proxy)

### Fixed
- **pnpm version** — Dockerfile now installs `pnpm@10` (was `pnpm@9`; project requires pnpm 10.x)
- **pnpm workspace resolution** — `pnpm build:ui` was silently matching no packages (workspace only listed `frontend`, not `harbinger-tools/frontend`)
- **VITE_API_URL baked wrong** — Dockerfile ARG previously defaulted to `http://localhost:8080/api/v1`, breaking all API calls in Docker
- **IIS callback conflict** — Device Flow tab added as primary auth path for Windows users with IIS on port 80
- **Backend Config.GitHubToken** — `GH_TOKEN` env var now loaded into config struct

### Changed — Design System
- **Sidebar** — full Obsidian Command redesign:
  - Logo: `Cpu` icon with gold border (removed purple/indigo gradient)
  - Active nav: gold left border + `#f0c040/12` background (was `indigo-600/20`)
  - Nav labels: uppercase monospace `JetBrains Mono/Fira Code`
  - Version stamp at bottom when expanded
- **All indigo/purple** → replaced with `#f0c040` gold per CLAUDE.md design rules
- **Agents page** — Spawn Agent button and Activate button use gold theme

## [Unreleased]
### Added
- SET (Social Engineering Toolkit) — social engineering and phishing for BREACH agent
- BeEF (Browser Exploitation Framework) — browser hooking for BREACH agent
- Bettercap — network MITM and recon for PHANTOM and PATHFINDER
- Evil-WinRM — Windows post-exploitation for PHANTOM agent
- Gowitness — visual recon screenshots powering the attack surface graph for PATHFINDER

## [0.9.1] - 2025-02-25

### Added
- Caido proxy integration (replaces Burp Suite) with GraphQL API
- 12 Go security tools from 1hehaq: shef, idor-mcp, recx, roq, ceye, faviqon, ppmap, pdsi, conquer, dorq, xssmap, jsus
- MCPwn MCP security auditing integration
- IDOR MCP server plugin with Dockerfile
- Go tools build script (build-all.sh)
- Caido frontend component with setup wizard

### Removed
- Old Mandiant Harbinger subfolder (fully absorbed into main architecture)

### Changed
- Updated tool inventory with Caido, Go tools, MCPwn
