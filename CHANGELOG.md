## [1.2.0] - 2026-02-27

### Added — Chat System
- **Chat backend** (`backend/cmd/chat.go`) — full in-memory chat session and message store
  - `GET /api/chat/sessions` — list sessions (sorted by updatedAt)
  - `POST /api/chat/sessions` — create session with optional agent binding
  - `GET /api/chat/sessions/{id}` — get session with messages
  - `DELETE /api/chat/sessions/{id}` — delete session
  - `POST /api/chat/sessions/{id}/clear` — clear session messages
  - `POST /api/chat/message` — send message (non-streaming)
  - `POST /api/chat/stream` — SSE streaming (word-by-word with natural delay)
  - `generateAgentResponse()` — 11 agent-specific personality responses
  - 14 routes registered (7 endpoints × 2 prefixes)
- **Chat streaming UI** — full rewrite of `/chat` page
  - SSE streaming with `sendMessageStream` (onChunk/onDone/onError)
  - Auto-scroll using messagesEndRef + scrollIntoView
  - Fixed-height layout with min-h-0 and overflow-y-auto
  - Stop button to abort in-flight streams
  - Streaming cursor animation (pulsing gold bar)
  - Terminal-style message blocks (not chat bubbles per design rules)
  - Graceful fallback to non-streaming on error
  - Right panel with context, tools, configuration, session info

### Added — Slack Relay
- **Slack webhook dispatch** in `comms.go` — `sendSlackWebhook()` with Block Kit formatting
- Channel relay now dispatches to Discord, Telegram, AND Slack

### Enhanced — Pentest Dashboard
- **Interactive attack path graph** — draggable nodes, selectable with glow effects
  - NODE_TYPE_CONFIG with color/label per type (host, service, vulnerability, credential, entry, target)
  - MiniMap with node coloring
  - Node detail panel showing connected edges on selection
  - Edge highlighting when node selected
- **5-column metric cards** — added CRACKED metric
- **Tabbed bottom section** — Engagements / Credentials / Cracking
- **CrackJobCard** component with progress bar and tool indicator
- **Enhanced credential table** — hash type, cracked password, tool, duration columns
- **Pentest API** — CrackJobStatus type, credential cracking fields, startCrackJob/getCrackJobs methods

### Enhanced — CVE Monitor
- **Auto-triage** — priority scoring (critical/high/medium/low), agent assignment, action classification
- **Agent scan triggers** — PATHFINDER recon scan and BREACH exploit check per CVE
- **TRIAGE_COLORS** constant for priority badge coloring
- **CVE triage store** — triageResults, triaging state, autoTriage/triggerAgentScan actions

### Fixed — Skill Scripts
- **5 broken scripts** replaced (were copies of recon-full.sh):
  - `network-pivot.sh` — real network pivoting (nmap, proxychains, chisel/ligolo templates)
  - `apk-recon.sh` — APK analysis (apktool, jadx, secrets grep, SSL pinning detection)
  - `web-fuzz.sh` — web fuzzing (ffuf directory/parameter fuzzing, radamsa mutation)
  - `tls-audit.sh` — TLS/crypto audit (testssl.sh, sslscan, openssl, jwt_tool)
  - `email-auth-check.sh` — email auth (SPF/DKIM/DMARC checks, MX enum, spoofability scoring)

### Fixed — Code Quality
- **MCP plugin descriptions** — hexstrike-ai, pentagi, redteam package.json updated from "placeholder"
- **console.error removal** — CommandCenter (3), BrowserManager (1), DockerManager (5), Chat (1) replaced with comments
- Error states used instead of console output

### Enhanced — Chat Page UI
- **Session sidebar** — create, select, delete sessions with agent-keyed history
- **Agent picker** — dropdown selector with status indicators and color-coded avatars
- **Scroll-to-bottom button** — appears when user scrolls up, auto-hides at bottom
- **Empty state** — feature badges (Streaming, Multi-Agent, Session History), Select Agent CTA
- **Channel indicators** — WebChat/Discord/Telegram/Slack status badges in sidebar footer
- **Terminal-style messages** — grouped by sender run, avatar only on first message in a run

### Enhanced — Command Center ChatPanel
- **Message persistence** — chat messages stored in `commandCenterStore.chatMessages` keyed by agentId
- Messages survive tab close/reopen within the same browser session
- Added `addChatMessage`, `getChatMessages`, `clearChatMessages` actions to store

### Enhanced — OpenClaw Channel Sync
- **Real channel status** — OpenClaw page now calls `GET /api/channels` to show Discord/Telegram/Slack as connected/configured/offline based on actual backend config
- WebChat always shows as connected
- Channel status badges dynamically colored (green=connected, gold=configured, red=offline)

### Infrastructure
- Page count: 21 → 23 (Login, Setup Wizard added to matrix)
- Backend files: 15 → 16 (chat.go)
- Backend endpoints: 100+ → 120+ (14 chat routes + pentest/CVE additions)
- ROADMAP.md — full rewrite with target dates, dependencies, success criteria, release targets, backlog
- ROADMAP_TIMELINE.md — Mermaid dependency flowchart and Gantt chart

---

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
