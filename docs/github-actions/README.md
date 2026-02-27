# Harbinger CI/CD & Automation

All automation for the Harbinger repository: CI builds, PR health checks, nightly maintenance, community welcome, security scanning, and dependency updates.

Live workflows: [`.github/workflows/`](../../.github/workflows/)
Reference copies and docs: this folder (`docs/github-actions/`).

---

## Status badge

```markdown
[![CI](https://github.com/Haribinger/Harbinger/actions/workflows/ci.yml/badge.svg)](https://github.com/Haribinger/Harbinger/actions/workflows/ci.yml)
```

Replace `Haribinger/Harbinger` with your fork's `owner/repo` if different. The badge is already in the main [README](../../README.md).

---

## Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **CI** | `ci.yml` | Push to `main`, PRs, **manual** | Frontend: install, typecheck, lint, build, test. Backend: build, vet, test. Writes a markdown summary. Uploads build artifact on main. |
| **PR Health** | `pr-health.yml` | PR opened/updated, review submitted | MAINTAINER agent health scan, score comment, health labels. Fails on critical (< 30). |
| **Nightly Maintenance** | `maintainer-schedule.yml` | 02:00 UTC daily, **manual** | Scan, auto-remove `console.log`, open fix PR if changes. |
| **Welcome** | `community-welcome.yml` | First PR or first issue | Welcome comment with checklist, `first-contribution` label, auto-categorize issues. |
| **Security Scan** | `security-scan.yml` | Push/PR to `main`, weekly Monday 06:00 UTC | CodeQL (TS + Go), Trivy filesystem scan (CRITICAL, HIGH). |
| **Dependabot** | `dependabot.yml` | Automated schedule | npm weekly, Go modules weekly, Docker monthly, Actions weekly. |

---

## CI features

| Feature | How it works |
|---------|-------------|
| **Concurrency** | `ci-${{ workflow }}-${{ ref }}` with `cancel-in-progress: true`. New push/PR cancels in-progress runs for the same branch. |
| **Manual run** | `workflow_dispatch` — go to **Actions > CI > Run workflow** to trigger without pushing. |
| **Env-driven versions** | `NODE_VERSION`, `GO_VERSION`, `PNPM_VERSION` at the workflow top level. Bump once, all steps follow. |
| **Job names** | "Frontend" and "Backend" in the Actions UI instead of raw job IDs. |
| **CI Summary** | Final `ci-summary` job writes a markdown table to **Job Summary** on every run — pass/fail, commit SHA, run link. |
| **Build artifact** | On `main` pushes, the frontend `dist/` folder is uploaded as `frontend-dist` (7-day retention). |
| **pnpm 10** | All workflows use pnpm 10 to match the repo's `packageManager` field. |
| **Caches** | pnpm store cached via `setup-node` + `cache: 'pnpm'`. Go modules cached via `setup-go` + `cache-dependency-path`. |
| **Timeouts** | Frontend: 15 min. Backend: 10 min. Prevents hung jobs from consuming minutes. |
| **No swallowed failures** | Lint, typecheck, build, and tests must pass. No `|| true`, no `continue-on-error`. |

---

## Running CI locally

Run these from the repo root after `pnpm install --frozen-lockfile`:

### Frontend

```bash
# Type check
cd harbinger-tools/frontend && pnpm exec tsc --noEmit

# Lint
cd harbinger-tools/frontend && pnpm exec eslint . --max-warnings 0

# Build
pnpm build:ui

# Test
pnpm --filter harbinger-frontend test --run
```

### Backend

```bash
# Build
cd backend && go build -o /tmp/harbinger-backend ./cmd/

# Vet
cd backend && go vet ./cmd/...

# Test
cd backend && go test ./cmd/... -count=1
```

### All at once

```bash
# Frontend + Backend in parallel (requires two terminals or backgrounding)
pnpm build:ui & (cd backend && go build -o /tmp/harbinger-backend ./cmd/) & wait
```

---

## PR Health workflow

When a PR is opened or updated:

1. MAINTAINER agent runs `skills/claude-skills/maintainer/scripts/run-maintenance.sh`
2. Extracts health score, `any` type count, `console.log` count
3. Posts (or updates) a **Code Health Report** comment on the PR
4. Applies a label: `health:good` (>= 80), `health:needs-work` (>= 50), `health:critical` (< 50)
5. Fails the check if score < 30

Concurrency: `pr-health-${{ pr_number }}` — only one scan per PR at a time.

---

## Nightly Maintenance workflow

At 02:00 UTC daily (or on manual dispatch):

1. Full checkout with history
2. Run maintenance health scan
3. Auto-fix: remove standalone `console.log()` from non-test TypeScript files
4. If changes exist, create branch `maintainer/nightly-YYYYMMDD`, commit, open PR
5. Upload `maintenance-report.json` as artifact (30-day retention)

---

## Security scanning (planned)

Reference configs in this folder:

| File | Scanner | What it checks |
|------|---------|---------------|
| `security-scan.yml` | CodeQL + Trivy | Static analysis (JS/TS + Go), filesystem vulnerability scan |
| `dependabot.yml` | Dependabot | npm, Go modules, Docker, GitHub Actions version updates |

These are reference copies — copy to `.github/workflows/` and `.github/` respectively to activate.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| **CI fails on `pnpm install`** | Ensure `pnpm-lock.yaml` is committed and in sync with `package.json`. Run `pnpm install` locally and commit the lockfile. |
| **Frontend typecheck fails** | `cd harbinger-tools/frontend && pnpm exec tsc --noEmit` — fix reported errors before pushing. |
| **Frontend lint fails** | `cd harbinger-tools/frontend && pnpm exec eslint . --max-warnings 0` — zero warnings allowed. |
| **Backend build fails** | `cd backend && go build ./cmd/` — check imports and Go version (CI uses 1.24). |
| **Summary job shows "cancelled"** | It only runs when both Frontend and Backend finish (even on failure). If either was cancelled (e.g. by concurrency), the summary won't run. |
| **Old run still in progress** | Concurrency auto-cancels it when a new run starts for the same ref. Check the new run. |
| **PR health score is wrong** | The maintenance script may need `ripgrep` (`sudo apt-get install -y ripgrep` locally). Check `health-report.json` artifact. |
| **Nightly PR not created** | Only created if `console.log` removals change files. Check the "Apply safe fixes" step output. |

---

## Keeping docs in sync

When you change a workflow in `.github/workflows/`:

1. Update the reference copy in `docs/github-actions/` (e.g. `ci.yml`)
2. Update any table or description in this README
3. If adding a new workflow, add it to the Workflows table above

---

**See also:** [CLAUDE.md](../../CLAUDE.md) (CI/CD section) | [CONTRIBUTING.md](../../CONTRIBUTING.md) (dev setup, commit format) | [ROADMAP.md](../ROADMAP.md)
