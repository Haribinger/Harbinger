# Full Testing Guide — Fix Everything, Find All Bugs

Use this guide to systematically verify the Harbinger stack, catch regressions, and track down bugs. Run the **Pre-flight** and **Automated** sections regularly; use **Manual**, **Security**, and **Bug-finding** when preparing a release or after big changes.

---

## Quick reference

| Goal | Command or section |
|------|--------------------|
| One-shot build check | `bash skills/claude-skills/harbinger-bugfix/scripts/build-check.sh` |
| Frontend type + lint + build + test | [Automated — Frontend](#frontend-vite--typescript) |
| Backend build + vet + test | [Automated — Backend](#backend-go) |
| Run all frontend tests with coverage | `cd harbinger-tools/frontend && pnpm test:coverage` |
| Full health scan (types, placeholders, consistency) | [Health scans](#2-health-scans) |
| Security-focused testing | [Security testing](#4-security-testing) |
| API endpoint smoke test | [API verification](#5-api-endpoint-verification) |
| Docker stack verification | [Docker testing](#6-docker--infrastructure-testing) |
| "Something's broken" | [Debug workflow](#8-debug-workflow) |
| Write a new test | [Writing tests](#10-writing-new-tests) |
| Known error patterns | [common-errors.md](../skills/claude-skills/harbinger-bugfix/references/common-errors.md) |
| CI pipeline details | [CI/CD pipeline](#12-cicd-pipeline-reference) |

---

## 0. Pre-flight

Run from **repo root**. Ensures environment is ready before tests.

```bash
# 1. Install frontend dependencies
pnpm install --frozen-lockfile

# 2. Install backend dependencies
cd backend && go mod tidy && go mod download && cd ..

# 3. Verify toolchain versions
node --version    # Must be >= 20.x
go version        # Must be >= 1.24
pnpm --version    # Must be >= 9.x

# 4. Ports free (optional; skip if using Docker only)
# lsof -i :8080 | grep LISTEN   # Backend
# lsof -i :3000 | grep LISTEN   # Vite dev server
# lsof -i :5432 | grep LISTEN   # PostgreSQL
# lsof -i :6379 | grep LISTEN   # Redis

# 5. Env (optional; backend works with in-memory defaults)
# cp .env.example .env && $EDITOR .env
```

### Environment-specific notes

| Platform | Notes |
|----------|-------|
| WSL2 | Docker Desktop must have WSL integration enabled. Use `wsl --shutdown` to reset if ports are stale. |
| macOS | Use `lsof -ti :8080 \| xargs kill` to free ports (no `fuser`). |
| Docker-only | Skip port checks; containers handle their own networking. |
| CI (GitHub Actions) | Pre-flight is handled by workflow steps — just push and let CI run. |

---

## 1. Automated tests & builds

These match what CI runs. Fix any failure before pushing.

### Frontend (Vite + TypeScript)

| Step | Command | What it catches | Fix if it fails |
|------|---------|-----------------|-----------------|
| Type check | `cd harbinger-tools/frontend && npx tsc --noEmit` | Type errors, missing imports, interface mismatches | Add/fix types; see [common-errors.md](../skills/claude-skills/harbinger-bugfix/references/common-errors.md) |
| Lint | `cd harbinger-tools/frontend && pnpm exec eslint . --max-warnings 0` | Code style, unused vars, hook violations | Fix or disable with justification comment; never use `--max-warnings -1` |
| Build | `pnpm build:ui` | Import resolution, asset bundling, tree-shaking errors | Resolve missing deps (`pnpm install`), fix import/type errors |
| Unit tests | `pnpm --filter harbinger-frontend test` | Logic regressions in stores, API modules, utilities | Fix or add tests in `src/**/*.test.ts(x)` |
| Tests + coverage | `cd harbinger-tools/frontend && pnpm test:coverage` | Same as above, with V8 coverage report | Check `coverage/` directory for HTML report |

**One-liner (from root):**

```bash
cd harbinger-tools/frontend && npx tsc --noEmit && pnpm exec eslint . --max-warnings 0 && cd ../.. && pnpm build:ui && pnpm --filter harbinger-frontend test
```

### Backend (Go)

| Step | Command | What it catches | Fix if it fails |
|------|---------|-----------------|-----------------|
| Build | `cd backend && go build -o /tmp/harbinger-backend ./cmd/` | Compile errors, undefined symbols, type mismatches | Fix compile errors; all files in `cmd/` must be `package main` |
| Vet | `cd backend && go vet ./cmd/...` | Suspicious constructs, printf format mismatches, unreachable code | Fix vet warnings — they often indicate real bugs |
| Tests | `cd backend && go test ./cmd/... -count=1 -timeout 120s` | Handler logic regressions, response format issues | Add or fix `_test.go` files |

**One-liner (from root):**

```bash
cd backend && go build -o /tmp/harbinger-backend ./cmd/ && go vet ./cmd/... && go test ./cmd/... -count=1 -timeout 120s && cd ..
```

### Full build check script

```bash
bash skills/claude-skills/harbinger-bugfix/scripts/build-check.sh
```

Runs three stages: TypeScript typecheck, Vite build, Go build. Prints PASS/FAIL per stage. Does **not** run lint or unit tests — use the commands above for those.

### Templates (Pi extension)

```bash
cd templates/.pi/extensions/env-sanitizer && npx tsc --noEmit
```

Type-check only — no runtime test for the env-sanitizer extension in this repo.

---

## 2. Health scans

Broader codebase checks (types, placeholders, consistency). Run from **repo root**.

### Scan commands

```bash
# Types / any usage (frontend)
bash skills/claude-skills/harbinger-healthcheck/scripts/scan-types.sh /home/anon/Harbinger

# Backend patterns (unchecked errors, hardcoded values, SQL injection risks)
bash skills/claude-skills/harbinger-healthcheck/scripts/scan-backend.sh /home/anon/Harbinger

# Cross-file consistency (provider models, API routes, store parity)
bash skills/claude-skills/harbinger-healthcheck/scripts/scan-consistency.sh /home/anon/Harbinger

# Placeholders, TODOs, stub files, broken refs
bash skills/claude-skills/harbinger-healthcheck/scripts/scan-placeholders.sh /home/anon/Harbinger
```

### What each scan checks

| Scan | Checks | Severity guide |
|------|--------|----------------|
| **scan-types.sh** | `any` types, `console.*` statements, `@ts-ignore`/`@ts-expect-error`, empty catch blocks, hardcoded `localhost:PORT`, TODO/FIXME markers | `any` in API boundary = high; in internal util = medium; `console.log` in prod = medium |
| **scan-backend.sh** | Unchecked error returns, hardcoded addresses, SQL injection patterns (`fmt.Sprintf` + SQL), sensitive data in logs, TODO markers, file/function complexity | SQL injection pattern = critical; unchecked error = high; hardcoded address = medium |
| **scan-consistency.sh** | `PROVIDER_MODELS` definition parity, `API_BASE` usage, localStorage key consistency, frontend vs backend route parity, off-brand hex colors, unused store exports | Route mismatch = high; color violation = low; unused export = low |
| **scan-placeholders.sh** | 26 placeholder text patterns, missing SKILL.md files, unreferenced scripts, required directory presence, empty/stub files, non-executable scripts | Missing directory = critical; stub endpoint = high; TODO = low |

### Interpreting results

Triage by severity: **critical** (blocks release) > **high** (fix before next PR) > **medium** (fix this sprint) > **low** (track in backlog).

Cross-reference with:
- [known-patterns.md](../skills/claude-skills/harbinger-healthcheck/references/known-patterns.md) — Intentional patterns that should NOT be flagged
- [fix-prompts.md](../skills/claude-skills/harbinger-healthcheck/references/fix-prompts.md) — Copy-paste prompts for fixing each issue category

### Maintenance score

The MAINTAINER agent calculates a codebase health score:

```bash
bash skills/claude-skills/maintainer/scripts/run-maintenance.sh
```

**Score formula:** `100 - (any_types * 2) - console_logs - (deps_outdated * 3) + test_coverage`

- Score >= 80: healthy
- Score >= 50: needs work
- Score < 50: critical
- Score < 30: **blocks PR merge** (enforced by `pr-health.yml`)

---

## 3. Manual verification (critical flows)

With the app running (`pnpm dev` + backend, or `docker compose up`), verify these flows. For each flow, check the browser console and Network tab for errors.

### Core flows (must work)

| # | Flow | Route | What to check |
|---|------|-------|----------------|
| 1 | **Login** | `/login` | OAuth, Device Flow, Token tab; no 401 loop; successful redirect to dashboard |
| 2 | **Dashboard** | `/` | Loads without blank panels; agent strip populates; Quick Ops buttons work; service health indicators show status |
| 3 | **Agents** | `/agents` | Agent list loads (or uses SEED_ROSTER fallback); create, spawn, stop lifecycle works; status badges update; no console errors |
| 4 | **Command Center** | `/command-center` | Workspace opens; chat tab sends messages and receives responses; terminal/logs tabs functional |
| 5 | **Chat** | `/chat` | Agent selector populates; message send works; response appears (or graceful "no backend" fallback) |
| 6 | **Settings** | `/settings` | Providers tab: add/remove/test providers; Channels tab: configure Discord/Telegram/Slack; Secrets tab: add/remove secrets; save persists without 500 |
| 7 | **Setup Wizard** | `/setup` | All 5 steps complete without error; configuration persists |

### Secondary flows (should work)

| # | Flow | Route | What to check |
|---|------|-------|----------------|
| 8 | **Autonomous** | `/autonomous` | Thinking loop dashboard loads; efficiency scores display; thought CRUD works; swarm state populates |
| 9 | **Workflows** | `/workflows` | Workflow list loads; clicking a workflow opens the editor |
| 10 | **Workflow Editor** | `/workflow-editor` | Node palette renders; drag-to-add; connections between nodes; save/load; variable interpolation preview |
| 11 | **MCP Manager** | `/mcp` | MCP server list loads; status indicators; connect/disconnect lifecycle |
| 12 | **Docker Manager** | `/docker` | Container list from Docker API; start/stop; logs viewer |
| 13 | **Browser Manager** | `/browser` | CDP session creation; navigate to URL; screenshot capture; DevTools tabs (console, network, screenshot, actions) |
| 14 | **Skills Hub** | `/skills` | 14 skill categories load; skill detail view; execution interface |
| 15 | **Bounty Hub** | `/bounty-hub` | Bug bounty program list; program details |
| 16 | **Scope Manager** | `/scope` | Target scope definitions load; add/edit/delete scopes |

### Specialized flows (verify when changing related code)

| # | Flow | Route | What to check |
|---|------|-------|----------------|
| 17 | **Vuln Deep Dive** | `/vuln-deep-dive` | Vulnerability data loads; analysis panels render |
| 18 | **Remediation** | `/remediation` | Fix tracking dashboard; status transitions |
| 19 | **Red Team** | `/red-team` | Red team operations interface; attack scenario management |
| 20 | **Code Health** | `/code-health` | Health metrics display; scan results |
| 21 | **OpenClaw** | `/openclaw` | Gateway status; event stream; command routing |
| 22 | **Pentest Dashboard** | `/pentest-dashboard` | Metrics cards; attack paths visualization; credential store |
| 23 | **CVE Monitor** | `/cve-monitor` | CISA KEV feed loads; scope auto-matching; severity filters |

### Flow verification checklist

For each flow you test, verify:

- [ ] Page loads without white screen or uncaught errors
- [ ] No 4xx/5xx errors in Network tab (except expected 404s for unconfigured features)
- [ ] No red errors in browser console (except known patterns — see [known-patterns.md](../skills/claude-skills/harbinger-healthcheck/references/known-patterns.md))
- [ ] Zustand state persists across page refresh (check `localStorage` for `harbinger-*` keys)
- [ ] Loading states show (not indefinite spinners)
- [ ] Error states show meaningful messages (not "undefined" or blank)
- [ ] Dark theme is consistent — no white flashes, no off-palette colors

If something fails: note the exact action, error message, and layer (frontend vs backend). Then follow [Debug workflow](#8-debug-workflow).

---

## 4. Security testing

Harbinger is a security tool — its own codebase must meet security standards.

### Input validation

| Check | How to test | Expected |
|-------|-------------|----------|
| XSS in agent names | Create agent with name `<script>alert(1)</script>` | Name rendered as text, not executed |
| XSS in chat messages | Send `<img onerror=alert(1) src=x>` in chat | Rendered as text or sanitized |
| SQL injection in search | Search for `'; DROP TABLE agents; --` | No SQL error; query treated as literal string |
| Path traversal in file ops | Request `GET /api/files/../../etc/passwd` | 400 or 404, not file contents |
| Oversized request body | POST a 50MB JSON body to any endpoint | 413 or graceful rejection, not OOM |

### Authentication & authorization

| Check | How to test | Expected |
|-------|-------------|----------|
| Expired token | Set a past-date token in localStorage | Redirect to `/login`, no 401 loop |
| Missing token | Clear all `harbinger-*` keys, navigate to `/agents` | Redirect to `/login` |
| Invalid token format | Set `harbinger-token` to `"garbage"` | Redirect to `/login` |
| CORS | `curl -H "Origin: http://evil.com" http://localhost:8080/api/agents` | No `Access-Control-Allow-Origin: http://evil.com` header |

### Secrets handling

| Check | How to test | Expected |
|-------|-------------|----------|
| No secrets in logs | Run backend with `LOG_LEVEL=debug`, configure API keys | API keys never appear in stdout |
| No secrets in error responses | Trigger a provider auth failure | Error message says "authentication failed", not the actual key |
| .env not in git | `git ls-files .env` | Empty output |
| No hardcoded credentials | `grep -r "sk-" --include="*.ts" --include="*.go" harbinger-tools/ backend/` | No real API keys (only placeholder patterns) |

### Dependency audit

```bash
# Frontend
cd harbinger-tools/frontend && pnpm audit

# Backend
cd backend && go list -m -json all | go run golang.org/x/vuln/cmd/govulncheck@latest ./cmd/...

# Full dependency check
bash skills/claude-skills/harbinger-maintain/scripts/dep-check.sh
```

---

## 5. API endpoint verification

The backend serves 100+ routes. Test critical endpoints directly.

### Health endpoints (no auth required)

```bash
# All three must return 200 with JSON containing "checks" array
curl -s http://localhost:8080/health | jq .
curl -s http://localhost:8080/api/health | jq .
curl -s http://localhost:8080/api/v1/health | jq .
```

Expected response shape:

```json
{
  "status": "ok",
  "checks": [
    { "id": "...", "name": "...", "status": "..." }
  ]
}
```

### Core CRUD endpoints

```bash
# Agents — list
curl -s http://localhost:8080/api/agents | jq '.agents | length'

# Agents — create
curl -s -X POST http://localhost:8080/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"test-agent","type":"recon-scout"}' | jq .

# Autonomous — list thoughts
curl -s http://localhost:8080/api/agents/thoughts | jq '.thoughts | length'

# Autonomous — swarm state
curl -s http://localhost:8080/api/agents/swarm | jq .swarm

# Autonomous — stats
curl -s http://localhost:8080/api/agents/autonomous/stats | jq .stats

# Skills — list
curl -s http://localhost:8080/api/skills | jq .

# Dashboard
curl -s http://localhost:8080/api/dashboard | jq .
```

### Dual-prefix verification

Every endpoint must work at both `/api/` and `/api/v1/`. Spot-check:

```bash
# Compare responses — should be identical
diff <(curl -s http://localhost:8080/api/agents) \
     <(curl -s http://localhost:8080/api/v1/agents)
```

### Graceful degradation

When services are unavailable, endpoints must return structured errors (never raw 500):

```bash
# Without PostgreSQL — should return {ok:false, reason:"not_configured"} or equivalent
curl -s http://localhost:8080/api/agents | jq .

# Without Redis
curl -s http://localhost:8080/api/mcp/status | jq .
```

---

## 6. Docker & infrastructure testing

### Full stack startup

```bash
# Build and start all 9 services
docker compose up --build -d

# Wait for health checks to pass (give it 60-90 seconds)
docker compose ps

# Verify service health
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

Expected: all services show "Up" or "Up (healthy)".

### Individual service checks

| Service | Health command | Expected |
|---------|---------------|----------|
| PostgreSQL | `docker compose exec postgres pg_isready` | `/var/run/postgresql:5432 - accepting connections` |
| Redis | `docker compose exec redis redis-cli ping` | `PONG` |
| Neo4j | `curl -s http://localhost:7474` | 200 response |
| Backend | `curl -s http://localhost:8080/api/health` | JSON with `checks` array |
| Frontend | `curl -s http://localhost:3000` | HTML content |

### Container resource checks

```bash
# Check no container is OOM-killed or restarting
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# Check container logs for errors
docker compose logs --tail=50 backend 2>&1 | grep -i "error\|panic\|fatal"
docker compose logs --tail=50 frontend 2>&1 | grep -i "error\|fail"
```

### Network verification

```bash
# Verify containers can reach each other
docker compose exec backend curl -s http://postgres:5432 2>&1 || echo "Expected: connection works"
docker compose exec backend curl -s http://redis:6379 2>&1 || echo "Expected: connection works"
```

### Cleanup

```bash
docker compose down -v    # Stop and remove volumes
docker system prune -f    # Clean dangling images
```

---

## 7. WebSocket testing

The backend serves WebSocket connections for real-time agent communication.

### Connection test

```bash
# Using websocat (install: cargo install websocat)
echo '{"type":"ping"}' | websocat ws://localhost:8080/ws

# Using curl (basic connection test only)
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://localhost:8080/ws
```

### Frontend WebSocket verification

1. Open browser DevTools > Network > WS tab
2. Navigate to Command Center or Chat
3. Verify WebSocket connection establishes (status 101)
4. Send a message — verify the frame appears in WS inspector
5. Check for reconnection on disconnect (close the backend, restart, verify reconnect)

---

## 8. Debug workflow

When something is broken:

### Step 1 — Triage

Identify the layer:

| Symptom | Layer | First action |
|---------|-------|-------------|
| White screen / blank page | Frontend | Browser console for uncaught error |
| Red error in browser console | Frontend | Read the component stack trace |
| Network request returns 4xx/5xx | Backend | Check the endpoint exists and handler logic |
| "Connection refused" | Infrastructure | Verify the service is running (`docker ps` or process check) |
| Build fails | Build system | Read the exact error message and file:line |
| Test fails | Test | Read the assertion failure — expected vs received |

### Step 2 — Reproduce

1. Note the **exact action** that triggers the bug
2. Note the **exact error** (message, file:line, stack trace)
3. Determine if it's **consistent** or **intermittent**

### Step 3 — Diagnose by layer

**Frontend build errors:**

```bash
cd harbinger-tools/frontend && npx tsc --noEmit 2>&1 | head -30
```

Read the error, find the file:line, fix the type.

**Frontend runtime errors:**

1. Open browser DevTools console
2. Look for red errors — note the component stack trace
3. Check if the error is in a component, store, or API module
4. Common causes: undefined property access, missing props, stale state, missing API response field

**State bugs (Zustand):**

1. Check the store file for the relevant action
2. Verify state updates use callback form: `set((s) => ({...s, field: newValue}))`
3. Inspect persisted state: `JSON.parse(localStorage.getItem('harbinger-{name}'))`
4. Reset corrupted state: `localStorage.removeItem('harbinger-{name}')`

**API call failures:**

1. Check browser Network tab for the failing request — note URL, status, response body
2. Verify the endpoint exists in `backend/cmd/main.go` route registration
3. Check Vite proxy config in `harbinger-tools/frontend/vite.config.ts`
4. Test directly: `curl -v http://localhost:8080/api/{endpoint}`

**Backend build errors:**

```bash
cd backend && go build ./cmd/ 2>&1
```

Go errors are explicit — file:line:column with description. All files in `cmd/` must be `package main`.

**Backend runtime errors:**

```bash
cd backend && go run ./cmd/ 2>&1
```

Watch stdout for `[Module]` prefixed log messages. Check for panic stack traces.

**Database issues:**

1. Check PostgreSQL is running: `docker ps | grep postgres`
2. Test connection: `psql -h localhost -U harbinger -d harbinger`
3. Backend degrades gracefully without DB — verify in-memory mode is active

### Step 4 — Fix and verify

After every fix:

1. `cd harbinger-tools/frontend && npx tsc --noEmit` (if frontend change)
2. `cd backend && go build -o /dev/null ./cmd/` (if backend change)
3. `pnpm build:ui` (if frontend change)
4. `pnpm --filter harbinger-frontend test` (if test-covered area)
5. Re-test the specific flow that was broken

See also: [debug-workflow.md](../skills/claude-skills/harbinger-bugfix/references/debug-workflow.md) and [common-errors.md](../skills/claude-skills/harbinger-bugfix/references/common-errors.md).

---

## 9. Test inventory

### Current test coverage

| Layer | File | Tests | What's covered |
|-------|------|-------|----------------|
| Backend | `cmd/health_test.go` | 2 | All 3 health endpoints return 200, correct JSON shape, Content-Type header |
| Backend | `cmd/autonomous_test.go` | 5 | Thought CRUD lifecycle, swarm state, autonomous stats, agent-filtered listing |
| Frontend | `store/__tests__/agentStore.test.ts` | 2 | Initial state shape, `fetchAgents` populates store |
| Frontend | `store/__tests__/autonomousStore.test.ts` | 7 | Initial state, setFilter, fetchThoughts, fetchSwarm, fetchStats, approveThought, deleteThought |

### Coverage gaps (priority order)

**Backend handlers needing tests:**

| File | Priority | Why |
|------|----------|-----|
| `agents.go` | High | Core CRUD — spawn, stop, template, clone are untested |
| `comms.go` | High | Message bus is critical path for agent communication |
| `openclaw.go` | Medium | Gateway routing affects OpenClaw integrations |
| `channels.go` | Medium | Channel config and webhook delivery |
| `browsers.go` | Medium | CDP session lifecycle |
| `pentest.go` | Medium | Attack path and credential store |
| `cve.go` | Low | CISA KEV feed parsing |
| `skills.go` | Low | Skills listing and execution |
| `modelrouter.go` | Low | Provider routing logic |
| `themes.go` | Low | Theme CRUD |

**Frontend stores needing tests:**

| Store | Priority | Why |
|-------|----------|-----|
| `workflowEditorStore` | High | Complex state: nodes, edges, connections, undo/redo |
| `commandCenterStore` | High | Real-time agent orchestration state |
| `settingsStore` | Medium | Provider and channel configuration |
| `browserStore` | Medium | CDP session state management |
| `pentestDashboardStore` | Medium | Attack path and credential state |
| `cveMonitorStore` | Medium | KEV feed and scope matching state |
| `mcpStore` | Low | MCP server connection state |
| `dockerStore` | Low | Container lifecycle state |
| `workflowStore` | Low | Workflow listing state |
| `skillsStore` | Low | Skills catalog state |
| `bugBountyStore` | Low | Bounty program state |
| `bountyHubStore` | Low | Bounty hub state |
| `channelStore` | Low | Channel configuration state |
| `secretsStore` | Low | Secrets management state |
| `setupStore` | Low | Setup wizard state |
| `codeHealthStore` | Low | Code health metrics state |
| `modelRouterStore` | Low | Model routing state |
| `themeStore` | Low | Theme state |

**Frontend components/pages needing tests:** None exist yet. Start with components that have complex logic (WorkflowEditor node handling, BrowserManager DevTools tabs, Dashboard metric calculations).

### Test configuration

**Vitest config** (`harbinger-tools/frontend/vitest.config.ts`):
- Environment: `jsdom`
- Globals: enabled (no need to import `describe`, `it`, `expect`)
- Setup: `src/test/setup.ts` (mocks localStorage and fetch)
- Coverage: V8 provider, includes `src/**/*.{ts,tsx}`, excludes test files
- Pattern: `src/**/*.test.{ts,tsx}`

**Go testing:** Standard `testing` package with `net/http/httptest`. Test files use isolated mux setup functions to register routes without auth middleware.

---

## 10. Writing new tests

### Frontend store test template

Create at `harbinger-tools/frontend/src/store/__tests__/{storeName}.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock API module BEFORE importing the store
vi.mock('../../api/{apiModule}', () => ({
  {apiModule}Api: {
    list: vi.fn().mockResolvedValue([
      { id: '1', name: 'Test Item' },
    ]),
    create: vi.fn().mockResolvedValue({ id: '2', name: 'New Item' }),
    delete: vi.fn().mockResolvedValue({ ok: true }),
  },
}))

// Mock the HTTP client
vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

describe('{StoreName}Store', () => {
  let useStore: typeof import('../{storeName}').use{StoreName}Store

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../{storeName}')
    useStore = mod.use{StoreName}Store
    // Reset to initial state
    useStore.setState(useStore.getInitialState())
  })

  it('has correct initial state', () => {
    const state = useStore.getState()
    expect(state.items).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('fetches items and updates state', async () => {
    await useStore.getState().fetchItems()
    const state = useStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].name).toBe('Test Item')
    expect(state.isLoading).toBe(false)
  })

  it('handles errors gracefully', async () => {
    const { {apiModule}Api } = await import('../../api/{apiModule}')
    vi.mocked({apiModule}Api.list).mockRejectedValueOnce(new Error('Network error'))

    await useStore.getState().fetchItems()
    const state = useStore.getState()
    expect(state.items).toEqual([])
    expect(state.isLoading).toBe(false)
  })
})
```

### Backend handler test template

Create at `backend/cmd/{handler}_test.go`:

```go
package main

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
)

func setup{Handler}TestMux() *http.ServeMux {
    mux := http.NewServeMux()
    // Register routes without auth middleware for isolated testing
    mux.HandleFunc("GET /api/{resource}", handle{Resource}List)
    mux.HandleFunc("POST /api/{resource}", handle{Resource}Create)
    mux.HandleFunc("GET /api/v1/{resource}", handle{Resource}List)
    mux.HandleFunc("POST /api/v1/{resource}", handle{Resource}Create)
    return mux
}

func TestList{Resource}(t *testing.T) {
    mux := setup{Handler}TestMux()
    req := httptest.NewRequest("GET", "/api/{resource}", nil)
    w := httptest.NewRecorder()
    mux.ServeHTTP(w, req)

    if w.Code != http.StatusOK {
        t.Fatalf("expected 200, got %d", w.Code)
    }

    var resp map[string]interface{}
    if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
        t.Fatalf("invalid JSON: %v", err)
    }

    // Verify response shape
    if _, ok := resp["{resource}"]; !ok {
        t.Error("response missing '{resource}' field")
    }
}

func TestCreate{Resource}(t *testing.T) {
    mux := setup{Handler}TestMux()
    body := map[string]interface{}{
        "name": "test-item",
    }
    bodyBytes, _ := json.Marshal(body)

    req := httptest.NewRequest("POST", "/api/{resource}", bytes.NewReader(bodyBytes))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()
    mux.ServeHTTP(w, req)

    if w.Code != http.StatusOK && w.Code != http.StatusCreated {
        t.Fatalf("expected 200 or 201, got %d", w.Code)
    }

    var resp map[string]interface{}
    if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
        t.Fatalf("invalid JSON: %v", err)
    }
}

// Table-driven test for dual-prefix registration
func Test{Resource}DualPrefix(t *testing.T) {
    mux := setup{Handler}TestMux()
    paths := []string{"/api/{resource}", "/api/v1/{resource}"}

    for _, path := range paths {
        t.Run(path, func(t *testing.T) {
            req := httptest.NewRequest("GET", path, nil)
            w := httptest.NewRecorder()
            mux.ServeHTTP(w, req)

            if w.Code != http.StatusOK {
                t.Errorf("GET %s: expected 200, got %d", path, w.Code)
            }
        })
    }
}
```

### Test naming conventions

| Layer | Pattern | Example |
|-------|---------|---------|
| Frontend store | `src/store/__tests__/{name}Store.test.ts` | `agentStore.test.ts` |
| Frontend component | `src/components/__tests__/{Name}.test.tsx` | `AgentCard.test.tsx` |
| Frontend page | `src/pages/__tests__/{Name}.test.tsx` | `Dashboard.test.tsx` |
| Frontend API | `src/api/__tests__/{name}.test.ts` | `agents.test.ts` |
| Backend handler | `cmd/{name}_test.go` | `agents_test.go` |

### Running a single test

```bash
# Frontend — single file
cd harbinger-tools/frontend && npx vitest run src/store/__tests__/agentStore.test.ts

# Frontend — watch mode (re-runs on change)
cd harbinger-tools/frontend && npx vitest src/store/__tests__/agentStore.test.ts

# Frontend — filter by test name
cd harbinger-tools/frontend && npx vitest run -t "fetchAgents"

# Backend — single file
cd backend && go test -v -run TestHealthEndpoints ./cmd/

# Backend — single test function
cd backend && go test -v -run TestThoughtLifecycle ./cmd/
```

---

## 11. Bug-finding checklist

Use this to hunt for issues proactively.

### Frontend

- [ ] **No `any` in new code** — fix or type existing `any` where it causes strict errors
- [ ] **No empty `.catch(() => {})`** — add comment or proper handling (see CLAUDE.md rule 12)
- [ ] **No `console.log` in production code** — maintainer workflow strips them; use proper error state
- [ ] **API calls** — check Network tab for 4xx/5xx; verify endpoint exists in `backend/cmd/main.go`
- [ ] **Stores** — persist keys use `harbinger-*` prefix; state updates use callback form where needed
- [ ] **Lazy routes** — no missing or broken imports that cause white screen
- [ ] **Type assertions** — no unsafe `as any` casts; use proper type narrowing
- [ ] **Error boundaries** — pages wrapped in ErrorBoundary; errors show meaningful UI, not blank page
- [ ] **Loading states** — all async operations show loading indicator; no indefinite spinners
- [ ] **Stale closures** — useEffect deps include all referenced variables; useCallback/useMemo have correct deps
- [ ] **Memory leaks** — subscriptions and timers cleaned up in useEffect return; no orphaned WebSocket connections
- [ ] **React key props** — list renders use stable, unique keys (not array index for mutable lists)

### Backend

- [ ] **Dual route registration** — all new routes under both `/api/` and `/api/v1/`
- [ ] **No-crash policy** — missing DB/config returns `{"ok": false, "reason": "not_configured"}`, never 500
- [ ] **No sensitive data** — error messages and logs never include tokens, keys, or passwords
- [ ] **Request body limits** — large payloads rejected before parsing
- [ ] **Error handling** — every `if err != nil` is checked; no `log + return` double-handling
- [ ] **Docker via socket** — never shell out to `docker` CLI; use `dockerAPIRequest()` HTTP helper
- [ ] **JSON encoding** — all handlers set `Content-Type: application/json`; use `json.NewEncoder(w).Encode()`
- [ ] **Concurrent access** — shared in-memory stores use `sync.RWMutex` correctly (Lock for writes, RLock for reads)
- [ ] **SQL safety** — no `fmt.Sprintf` with user input in SQL queries; use parameterized queries (`$1`, `$2`)
- [ ] **Graceful shutdown** — handlers don't assume DB is available; check `db == nil` before queries

### Infrastructure

- [ ] **Docker Compose** — `docker compose up` brings up all 9 services; health endpoints return 200
- [ ] **Env files** — `.env` not committed; `.env.example` exists and is documented
- [ ] **Port conflicts** — no two services bind to the same port
- [ ] **Volume persistence** — PostgreSQL and Redis data survive `docker compose restart`
- [ ] **Container logs** — no panic/fatal messages in any container

### MCP plugins

- [ ] **hexstrike-ai** — container builds; tools respond to MCP protocol
- [ ] **pentagi** — container builds; depends on backend + redis
- [ ] **redteam** — container builds; depends on backend + neo4j
- [ ] **mcp-ui** — container builds; UI accessible

### Docs and config

- [ ] **README** — agent count, page count, store count match actual codebase
- [ ] **CLAUDE.md** — architecture diagram, directory structure, and inventories are current
- [ ] **CI workflows** — `.github/workflows/` files and `docs/github-actions/` reference copies are in sync
- [ ] **ROADMAP** — shipped features marked as complete; planned features have accurate descriptions

---

## 12. CI/CD pipeline reference

### Workflows

| Workflow | File | Trigger | Timeout | What it does |
|----------|------|---------|---------|-------------|
| **CI** | `ci.yml` | Push to main, PRs, manual | FE: 15min, BE: 10min | Typecheck, lint, build, test (both layers) |
| **PR Health** | `pr-health.yml` | PR opened/updated | — | MAINTAINER scan, health score comment, labels |
| **Nightly Maintainer** | `maintainer-schedule.yml` | Daily 02:00 UTC, manual | — | Auto-strip `console.log`, open fix PR |
| **Community Welcome** | `community-welcome.yml` | First PR/issue | — | Welcome message, auto-label |

### CI pipeline stages (what runs on every push/PR)

```
Frontend job (ubuntu-latest, 15min timeout):
  checkout → pnpm install → tsc --noEmit → eslint → pnpm build:ui → vitest run
  ↓ (on main push only)
  Upload dist/ artifact (7-day retention)

Backend job (ubuntu-latest, 10min timeout):
  checkout → go build → go vet → go test -count=1 -timeout 120s

Summary job (runs after both):
  Aggregate results → Write job summary → Exit 1 if either failed
```

### Versions pinned in CI

| Tool | Version | Set in |
|------|---------|--------|
| Node.js | 20 | `env.NODE_VERSION` |
| Go | 1.24 | `env.GO_VERSION` |
| pnpm | 10 | `env.PNPM_VERSION` |

### PR health thresholds

| Score | Label | CI status |
|-------|-------|-----------|
| >= 80 | `health:good` | Pass |
| >= 50 | `health:needs-work` | Pass |
| >= 30 | `health:critical` | Pass |
| < 30 | `health:critical` | **Fail** (blocks merge) |

### Running CI locally

Replicate the full CI pipeline on your machine:

```bash
# === Frontend (matches build-frontend job) ===
pnpm install --frozen-lockfile
cd harbinger-tools/frontend
npx tsc --noEmit
pnpm exec eslint . --max-warnings 0
cd ../..
pnpm build:ui
pnpm --filter harbinger-frontend test --run --passWithNoTests

# === Backend (matches build-backend job) ===
cd backend
go build -o /tmp/harbinger-backend ./cmd/
go vet ./cmd/...
go test ./cmd/... -count=1 -timeout 120s
cd ..
```

### Reference workflows (not yet active)

These are in `docs/github-actions/` — copy to `.github/workflows/` to activate:

| File | Purpose |
|------|---------|
| `security-scan.yml` | CodeQL (TS + Go) + Trivy filesystem scan (CRITICAL, HIGH severity) |
| `dependabot.yml` | Automated dependency updates: npm weekly, Go weekly, Docker monthly, Actions weekly |

---

## 13. Fix verification loop

After fixing a bug or adding a feature:

1. **Build** — `bash skills/claude-skills/harbinger-bugfix/scripts/build-check.sh`
2. **Tests** — `pnpm --filter harbinger-frontend test` and `cd backend && go test ./cmd/... -count=1`
3. **Lint** — `cd harbinger-tools/frontend && pnpm exec eslint . --max-warnings 0`
4. **Health score** — `bash skills/claude-skills/maintainer/scripts/run-maintenance.sh` (ensure score didn't drop)
5. **Manual** — Re-run the flow that was broken
6. **Commit** — Only when all of the above pass

### Pre-push checklist

```bash
# Run everything in sequence — stop at first failure
cd harbinger-tools/frontend && \
  npx tsc --noEmit && \
  pnpm exec eslint . --max-warnings 0 && \
  cd ../.. && \
  pnpm build:ui && \
  pnpm --filter harbinger-frontend test && \
  cd backend && \
  go build -o /tmp/harbinger-backend ./cmd/ && \
  go vet ./cmd/... && \
  go test ./cmd/... -count=1 -timeout 120s && \
  cd .. && \
  echo "All checks passed"
```

---

## 14. Troubleshooting FAQ

### "pnpm build" fails but "pnpm build:ui" works

`pnpm build` runs the root `package.json` build (Next.js, not the main UI). Always use `pnpm build:ui` for the Vite SPA.

### White screen after navigation

Usually a lazy-import failure. Check browser console for `ChunkLoadError` or `Failed to fetch dynamically imported module`. Fix: verify the page component is exported correctly and the lazy import path matches.

### "Module not found" during build

Missing dependency. Run `pnpm install` in the correct directory. For frontend: `cd harbinger-tools/frontend && pnpm install`.

### Go module errors

`cd backend && go mod tidy && go mod download` resolves most issues.

### Port 8080 already in use

```bash
lsof -i :8080 | grep LISTEN    # Find the PID
kill <PID>                       # Kill the process
```

### Tests pass locally but fail in CI

- Check Node/Go/pnpm versions match CI (Node 20, Go 1.24, pnpm 10)
- CI uses `--frozen-lockfile` — if your `pnpm-lock.yaml` is out of date, CI will fail
- CI uses `--passWithNoTests` — but `--max-warnings 0` is strict

### Health score dropped after my change

Run `bash skills/claude-skills/maintainer/scripts/run-maintenance.sh` to see which metrics changed. Common causes: added `any` types (-2 each), added `console.log` (-1 each), added outdated deps (-3 each).

### `test/` directory — is it for tests?

No. The `test/` directory at repo root is a pi-agent template project (a separate Next.js scaffold). It is **not** related to Harbinger's test suite. Harbinger tests live at:
- `harbinger-tools/frontend/src/store/__tests__/` (frontend)
- `backend/cmd/*_test.go` (backend)

---

## 15. Coverage targets

### Current state

| Layer | Tests | Coverage | Target |
|-------|-------|----------|--------|
| Backend health | 2 tests | 3 endpoints fully covered | Maintain |
| Backend autonomous | 5 tests | CRUD + lifecycle covered | Maintain |
| Backend agents | 0 tests | No coverage | Add table-driven tests for spawn/stop/list/create |
| Backend other handlers | 0 tests | No coverage | Add at least smoke tests per handler file |
| Frontend agentStore | 2 tests | Initial state + fetch | Add error handling, spawn, stop |
| Frontend autonomousStore | 7 tests | Good coverage | Maintain |
| Frontend other stores | 0 tests | No coverage | Add at least initial state + primary action per store |
| Frontend components | 0 tests | No coverage | Add tests for components with complex logic |

### Milestone targets

| Milestone | Description | Metric |
|-----------|-------------|--------|
| **M1** | Every Go handler file has at least one test | `go test ./cmd/...` passes with > 0 tests per `_test.go` |
| **M2** | Every Zustand store has initial state + primary action tests | All 21 stores have `__tests__/` files |
| **M3** | Frontend coverage > 30% | `pnpm test:coverage` reports > 30% |
| **M4** | Backend coverage > 40% | `go test -cover ./cmd/...` reports > 40% |
| **M5** | All critical flows have automated smoke tests | Health, agents, autonomous, settings endpoints tested |

---

## 16. Related docs

| Doc | Purpose |
|-----|--------|
| [debug-workflow.md](../skills/claude-skills/harbinger-bugfix/references/debug-workflow.md) | Step-by-step diagnosis (frontend, backend, DB) |
| [common-errors.md](../skills/claude-skills/harbinger-bugfix/references/common-errors.md) | Known error patterns and fixes |
| [known-patterns.md](../skills/claude-skills/harbinger-healthcheck/references/known-patterns.md) | Intentional patterns (not bugs) |
| [fix-prompts.md](../skills/claude-skills/harbinger-healthcheck/references/fix-prompts.md) | Copy-paste fix prompts per issue category |
| [harbinger-bugfix SKILL](../skills/claude-skills/harbinger-bugfix/SKILL.md) | Bugfix skill and build-check script |
| [harbinger-healthcheck SKILL](../skills/claude-skills/harbinger-healthcheck/SKILL.md) | Health scan workflow and scripts |
| [DETAILED_IMPROVEMENT_STEPS.md](DETAILED_IMPROVEMENT_STEPS.md) | Type safety, tests, skills, MCP, quick wins |
| [github-actions/README.md](github-actions/README.md) | CI workflows and local equivalent commands |
| [CLAUDE.md](../CLAUDE.md) | Project rules, architecture, code patterns |

---

**Last updated:** 2026-02-27
