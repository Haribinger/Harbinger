# Detailed Improvement Steps — Harbinger

Step-by-step instructions for quick wins, high-priority focus areas, and medium-priority improvements. Use this as a checklist or handoff for contributors.

---

## Part 1 — Quick Wins (Do First)

### 1.1 Update page count from 18 → 19 everywhere

**Why:** Autonomous Intelligence added a 19th page; docs still say 18.

| Step | Action | File | Exact change |
|------|--------|------|--------------|
| 1 | Open file | `skills/claude-skills/harbinger-website-sync/references/website-sections.md` | — |
| 2 | Find hero badge line | Line ~9 | Change `"11 Agents \| 150+ Tools \| 18 Pages"` → `"11 Agents \| 150+ Tools \| 19 Pages"` |
| 3 | Save | — | — |
| 4 | Open file | `skills/claude-skills/harbinger-website-sync/SKILL.md` | — |
| 5 | Find Pages table line | Line ~57 | Change `(current: 18 pages)` → `(current: 19 pages)` |
| 6 | Save | — | — |
| 7 | Open file | `ARCHITECTURE.md` | — |
| 8 | Find pages mention | Line ~18 | Change `18 Pages` → `19 Pages` in the diagram/table |
| 9 | Save | — | — |
| 10 | Grep for any other "18 pages" or "18 Pages" | `rg -i "18 page" --type-add 'md:*.md' -t md .` | Fix any remaining references |

**Verification:** `rg -i "18 page" .` returns no matches in docs/skills.

---

### 1.2 Fix ROADMAP.md — Backend Files count

**Why:** `autonomous.go` was added; total backend files is 10, not 9.

| Step | Action | File | Exact change |
|------|--------|------|--------------|
| 1 | Open | `docs/ROADMAP.md` | — |
| 2 | Go to "Shipped vs Planned Summary" table | ~line 220 | Find row `\| Backend Files \| 9 \| 0 \| 9 \|` |
| 3 | Replace | Same row | Change to `\| Backend Files \| 10 \| 0 \| 10 \|` |
| 4 | Save | — | — |

**Verification:** Count Go files in `backend/cmd/`: `ls backend/cmd/*.go | wc -l` should be 10.

---

### 1.3 Fix CLAUDE.md — Backend path in directory structure

**Why:** Backend lives at repo root `backend/`, not under `harbinger-tools/`. Build command already uses `cd backend`; tree should match.

| Step | Action | File | Exact change |
|------|--------|------|--------------|
| 1 | Open | `CLAUDE.md` | — |
| 2 | Find "Directory Structure" section | ~lines 53–100 | Locate the block under `harbinger-tools/` |
| 3 | Edit structure | — | Move `backend/` out of `harbinger-tools/`. Result: at root level add `├── backend/` (same level as `agents/`, `harbinger-tools/`), and under `harbinger-tools/` keep only `├── frontend/`. |
| 4 | Optional | — | Add a short note: "Backend lives at repo root; frontend at harbinger-tools/frontend." |

**Exact tree snippet to use (root section):**

```
├── agents/                      # Agent profiles (13 dirs...)
├── backend/                     # Go API server (see Backend Inventory)
│   └── cmd/                      # main.go, autonomous.go, agents.go, ...
├── harbinger-tools/
│   └── frontend/                 # React + Vite + TypeScript UI (19 pages)
```

**Verification:** `cd backend && go build ./cmd/` succeeds from repo root.

---

### 1.4 BugBountyLearningPlan.MD — Commit or discard

**Why:** File is modified (git status); keep working tree clean.

| Step | Action | Command / action |
|------|--------|-------------------|
| 1 | See current diff | `git diff pi-skills/bugbounty/BugBountyLearningPlan.MD` |
| 2a | If you want to keep changes | `git add pi-skills/bugbounty/BugBountyLearningPlan.MD` then `git commit -m "docs: update bug bounty learning plan"` |
| 2b | If you want to discard | `git checkout -- pi-skills/bugbounty/BugBountyLearningPlan.MD` |
| 3 | Confirm clean | `git status` |

---

### 1.5 Run website-sync (after 1.1–1.3)

**Why:** Push doc fixes to website and GitHub so external content matches.

| Step | Action |
|------|--------|
| 1 | Read the skill | `skills/claude-skills/harbinger-website-sync/SKILL.md` |
| 2 | Run audit (if present) | `bash skills/claude-skills/harbinger-website-sync/scripts/audit-features.sh` (if the script exists) |
| 3 | Manually sync | Follow SKILL.md workflow: update README (agents, pages 19, features), CHANGELOG, ARCHITECTURE, then website content, then GitHub (topics, description). Commit and push. |
| 4 | Deploy | If website is on Render, trigger deploy or push to the branch Render watches. |

---

## Part 2 — High Priority

### 2.1 Type safety — Replace `any` with proper types

**Why:** ~142+ `any` usages in frontend; reduces type safety and maintainability.

**Files with `any` (from codebase grep):**  
`orchestrator.ts`, `autonomousStore.ts`, `agents.ts`, `authStore.ts`, `Settings.tsx`, `modelRouterStore.ts`, `codeHealthStore.ts`, `workflowEditorStore.ts`, `agent-runtime.ts`, `BountyHub.tsx`, `WorkflowEditor.tsx`, `MCPManager.tsx`, `BrowserManager.tsx`, `SetupWizard.tsx`, `N8NIntegration.tsx`, `Agents.tsx`, `DockerManager.tsx`, `n8n.ts`, `client.ts`, `bugbounty.ts`, `config.ts`, `CommandCenter.tsx`, `OpenClaw.tsx`, `tool-runner.ts`, `providers.ts`.

**Detailed steps (per file or per area):**

| Step | Action |
|------|--------|
| 1 | Create or extend shared types in `harbinger-tools/frontend/src/types/`. Add interfaces for: API responses (agents, thoughts, workflows, MCP, docker, browser, auth, code health, dashboard), store state shapes, and event payloads. |
| 2 | Pick one API module (e.g. `api/autonomous.ts`). Replace `Promise<any>`, `response.data as any`, and param types with types from `types/`. Export response types from `api/` or `types/`. |
| 3 | Update the corresponding store (e.g. `autonomousStore.ts`). Replace `any` in state and in API call handlers with the new types. |
| 4 | Update the page that uses the store. Replace `any` in props, state, and callbacks. |
| 5 | Run `pnpm build:ui` and fix any new type errors. |
| 6 | Repeat steps 2–5 for: `api/agents.ts` + `agentStore` + Agents page, then `api/client.ts`, `api/bugbounty.ts`, `api/n8n.ts`, `api/providers.ts`, then remaining stores and pages. |
| 7 | Prioritize high-traffic modules: `client.ts`, `agents.ts`, `authStore`, `Settings.tsx`, `WorkflowEditor.tsx`, `BrowserManager.tsx`, `DockerManager.tsx`. |
| 8 | Add a `// eslint-disable-next-line @typescript-eslint/no-explicit-any` only where a type is truly unknown (e.g. third-party JSON) and add a short comment; prefer `unknown` + type guards over `any`. |

**Verification:** `pnpm build:ui` passes; `rg ": any|as any" harbinger-tools/frontend/src` count decreases over time (target 0).

---

### 2.2 Test coverage — Backend and frontend

**Why:** No integration tests for handlers; limited unit tests for stores/flows.

**Backend (integration tests):**

| Step | Action |
|------|--------|
| 1 | Choose test layout: either `backend/cmd/` with `_test.go` files next to handlers, or `backend/test/` / `test/backend/` for integration tests. |
| 2 | Add a test helper: start test server (or use httptest), set up in-memory or test DB if needed, create JWT or auth header helper. |
| 3 | Add first test file, e.g. `backend/cmd/health_test.go`. Test `GET /health` and `GET /api/health` return 200 and expected body shape. |
| 4 | Add tests for autonomous: `POST /api/agents/thoughts`, `GET /api/agents/thoughts` (with filters), `GET /api/agents/swarm`. Use in-memory store or test DB. |
| 5 | Add tests for one auth route (e.g. token validation) and one agents route (e.g. list). Keep tests independent (no shared mutable state). |
| 6 | Run: `cd backend && go test ./cmd/... -v`. Fix any failures. |
| 7 | Add to CI: in `.github/workflows/ci.yml`, ensure `go test ./...` runs for `backend/`. |

**Frontend (unit tests):**

| Step | Action |
|------|--------|
| 1 | Ensure test runner is configured (e.g. Vitest in Vite project). Add `vitest.config.ts` and script in `package.json` if missing. |
| 2 | Add a store test: e.g. `store/autonomousStore.test.ts`. Test initial state, `setFilter`, `fetchThoughts` (mock `api.autonomous.list`). |
| 3 | Add another store test: e.g. `agentStore` or `authStore` (login state, logout). |
| 4 | Add a simple page or component test (e.g. Dashboard stats render, or a button click updates state). Use React Testing Library. |
| 5 | Run tests: `pnpm test` or `pnpm run test`. Add to CI. |

**Verification:** `go test ./...` passes in backend; `pnpm test` passes in frontend; CI runs both.

---

### 2.3 Agent skills — Expand with real tool wrappers

**Why:** Skills are playbooks; many need concrete scripts or wrappers that call real tools.

| Step | Action |
|------|--------|
| 1 | List current skills: `skills/recon/`, `skills/web/`, `skills/cloud/`, etc. Open each `SKILL.md` and `references/` and note "script" or "tool" gaps. |
| 2 | Pick one category (e.g. recon). Add or extend a script under `skills/recon/scripts/` that: accepts target (e.g. domain), runs subfinder/httpx (or via HexStrike MCP), returns structured output (JSON or markdown). Document in SKILL.md. |
| 3 | Pick web: add a small wrapper for nuclei or ffuf (or call via MCP) under `skills/web/scripts/`. Same pattern: input (URL, template?), output (findings). |
| 4 | Update agent CONFIG.yaml or SOUL.md where needed so agents reference the new scripts. |
| 5 | Document in `docs/SKILLS_INVENTORY.md` and in the skill’s SKILL.md (inputs, outputs, deps). |
| 6 | Repeat for other categories (cloud, osint, binary-re, reporting) as priority allows. |

**Verification:** Each new script is runnable (or callable by an agent) and documented.

---

### 2.4 MCP plugins — New or improved servers

**Why:** MCP is the main way agents get tools; more plugins = more capability.

| Step | Action |
|------|--------|
| 1 | Review existing: `mcp-plugins/hexstrike-ai/`, `pentagi/`, `redteam/`, `mcp-ui/`, `visualizers/`. Read one plugin’s README and tool list. |
| 2 | Decide scope: new plugin (e.g. for a specific scanner or API) or extend an existing one (e.g. add tools to hexstrike). |
| 3 | If new: copy `mcp-plugins/` structure from an existing plugin. Implement a minimal server (e.g. FastMCP or Node MCP SDK) with 2–3 tools (e.g. scan, status, export). |
| 4 | Add Dockerfile if the plugin runs in Docker. Register in Harbinger (MCP manager config or docs) so it can be enabled. |
| 5 | Document: add to TOOLS.md or docs, list tools and env vars. |
| 6 | If extending: add new tools to existing server, version and changelog. |

**Verification:** Plugin starts; tools appear in MCP manager; at least one tool is callable from the UI or an agent.

---

### 2.5 Workflow templates — Pre-built pipelines

**Why:** Users need ready-made workflows instead of building from scratch.

| Step | Action |
|------|--------|
| 1 | List workflow JSON location (e.g. under `workflows/` or frontend public/templates). Check how Workflow Editor imports/exports. |
| 2 | Create a template: "Recon → Web scan". Nodes: trigger (manual or schedule), recon agent/tool (subdomain enum), web agent/tool (nuclei or httpx), output. Save as JSON. |
| 3 | Create a second template: "Finding → Report" (e.g. vuln input → SCRIBE → export). Save as JSON. |
| 4 | Add a "Templates" or "Load template" flow in the Workflow Editor UI: list templates by name, load into editor on selection. |
| 5 | Document templates in README or docs (names, purpose, required agents/tools). |

**Verification:** User can open editor, pick a template, and see a valid graph; template can be run (or clearly marked as example).

---

## Part 3 — Medium Priority

### 3.1 Error handling — No empty catches; add boundaries

**Why:** Empty `.catch(() => {})` hides failures; no React error boundaries for crash containment.

| Step | Action |
|------|--------|
| 1 | Grep for empty catch: `rg "\.catch\s*\(\s*()\s*=>\s*\{\s*\}\s*\)" harbinger-tools/frontend/src` (or similar). Replace each with: at least `console.error` or a toast/store error state, or both. Prefer user-visible message for user-triggered actions. |
| 2 | Add a global React error boundary: create `components/ErrorBoundary.tsx` that catches render errors, shows a fallback UI (message + retry), and optionally reports to a log or store. Wrap the main app or layout in it. |
| 3 | Optionally add route-level error boundaries for heavy pages (WorkflowEditor, Settings, BrowserManager) so one page crash doesn’t take down the whole app. |
| 4 | Backend: ensure handlers never return 500 for "not configured"; return `{ "ok": false, "reason": "not_configured" }` and 200 or 4xx as per CLAUDE.md. |

**Verification:** No empty catch in frontend; one main error boundary in place; backend uses graceful degradation.

---

### 3.2 Docker templates — Agent-specific containers

**Why:** Each agent type should have a repeatable container config with tools pre-installed.

| Step | Action |
|------|--------|
| 1 | List agents that run in Docker (from backend or docs). For each, note required tools (e.g. PATHFINDER: subfinder, httpx; BREACH: nuclei, ffuf). |
| 2 | Create a Dockerfile (or docker-compose service) per agent type, or one Dockerfile with build-args for agent type. Install only the tools that agent needs. |
| 3 | Document in `agents/<name>/` (e.g. DOCKER.md or in CONFIG.yaml) image name, env vars, and how Harbinger starts it. |
| 4 | Wire backend/orchestrator to use these images when spawning agents (if not already). |
| 5 | Test: build image, run container, confirm tools are on PATH and executable. |

**Verification:** Each agent type has a defined image; spawn uses it successfully.

---

### 3.3 Knowledge graph — Neo4j entity/relation API

**Why:** Roadmap calls for full Neo4j knowledge graph (entity/relation CRUD, query API).

| Step | Action |
|------|--------|
| 1 | Confirm Neo4j is in docker-compose and backend has a client (or add driver). |
| 2 | Design a minimal schema: e.g. nodes (Target, Finding, Agent, Scan), relations (FOUND_BY, BELONGS_TO, etc.). Document in docs. |
| 3 | Add backend endpoints: e.g. `POST /api/v1/knowledge/entities`, `GET /api/v1/knowledge/entities`, `POST /api/v1/knowledge/relations`, plus a query endpoint (Cypher or structured query). |
| 4 | Use in-memory or Neo4j; if Neo4j unavailable, return `not_configured`. |
| 5 | Add a simple frontend view or integrate into an existing page (e.g. Vuln Deep Dive or Dashboard) to show a few entities/relations. |
| 6 | Optionally: have one agent (e.g. PATHFINDER or SCRIBE) write findings into the graph. |

**Verification:** Entities and relations can be created and read via API; UI or at least one flow uses the graph.

---

### 3.4 Browser automation — Playwright-style sequences

**Why:** Authenticated testing and multi-step flows need repeatable browser sequences.

| Step | Action |
|------|--------|
| 1 | Check current browser stack: CDP in backend, BrowserManager in frontend. Decide whether to add Playwright as a library or keep CDP and add a "sequence" layer. |
| 2 | Define a sequence format: e.g. JSON array of steps (navigate, click, type, wait, screenshot). Store under `workflows/` or a dedicated `browser-sequences/` dir. |
| 3 | Implement a runner (backend or frontend): parse sequence, send CDP or Playwright commands in order, collect screenshots/logs. |
| 4 | Add one example sequence: e.g. "Login to HackerOne" (navigate, fill credentials, submit, wait for dashboard). Document how to run it. |
| 5 | Expose in UI: list sequences, run button, show results (screenshots, success/fail). |

**Verification:** At least one sequence runs end-to-end and results are visible.

---

## Part 4 — Summary Checklist

Use this as a quick checklist.

- [ ] **1.1** Page count 19 in website-sections.md, SKILL.md, ARCHITECTURE.md
- [ ] **1.2** ROADMAP.md Backend Files 10
- [ ] **1.3** CLAUDE.md backend path at repo root
- [ ] **1.4** BugBountyLearningPlan.MD committed or reverted
- [ ] **1.5** Website-sync run after doc fixes
- [ ] **2.1** Type safety: types in place, `any` reduced (target 0 in new code)
- [ ] **2.2** Backend integration tests + frontend unit tests in CI
- [ ] **2.3** At least one skill category extended with real script
- [ ] **2.4** At least one new or extended MCP plugin
- [ ] **2.5** At least 2 workflow templates + load-from-template in UI
- [ ] **3.1** No empty catches; error boundary in place
- [ ] **3.2** Docker templates for agent types
- [ ] **3.3** Neo4j CRUD/query API + minimal UI or integration
- [ ] **3.4** One browser sequence format + runner + example

---

**Doc version:** 1.0  
**Last updated:** 2026-02-26  
**See also:** [ROADMAP.md](ROADMAP.md), [CLAUDE.md](../CLAUDE.md), [CONTRIBUTING.md](../CONTRIBUTING.md)
