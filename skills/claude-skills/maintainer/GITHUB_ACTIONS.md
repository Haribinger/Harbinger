---
name: GitHub Actions Deep Skill
description: >
  Complete reference for all Harbinger CI/CD workflows, patterns,
  troubleshooting, and extension points.
agent: MAINTAINER
category: maintainer
---

# GitHub Actions — Deep Skill Reference

## Architecture

```
.github/workflows/
├── ci.yml                   # Build + test on push/PR
├── pr-health.yml            # Health score on PRs
├── maintainer-schedule.yml  # Nightly auto-fix
└── community-welcome.yml    # First-time contributor greeting
```

All workflows share these conventions:
- **Concurrency groups** cancel redundant runs
- **Explicit permissions** (least privilege per workflow)
- **Timeout limits** prevent runaway jobs
- **Step summaries** via `$GITHUB_STEP_SUMMARY`
- **Artifact uploads** for reports and builds

---

## Workflow 1: CI (`ci.yml`)

### Purpose
Build and test both frontend and backend on every push to main and PR.

### Trigger
```yaml
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
  workflow_dispatch:
```

### Jobs

| Job | What it does | Timeout |
|-----|-------------|---------|
| `build-frontend` | pnpm install → tsc → eslint → vite build → vitest | 15m |
| `build-backend` | go build → go vet → go test | 10m |
| `security-scan` | Secret detection, .env file check | 5m |
| `ci-summary` | Aggregate results, write markdown summary | — |

### Key Design Decisions

**Lint tolerance**: ESLint runs without `--max-warnings 0` because the codebase
has ~142 pre-existing `any` type warnings. The lint step:
- Fails on ESLint errors (exit code 2)
- Reports warnings but does NOT fail on them (exit code 1)
- Counts are logged for tracking

**Security scan**: Checks for:
- AWS access keys (`AKIA...`)
- API secret keys (`sk-...`)
- Hardcoded passwords in source
- `.env` files in tracked files

**Summary job**: Uses `needs: [all-jobs]` with `if: always()` to run even
when upstream jobs fail. Reports pass/fail per job.

### Caching
- **pnpm**: Cached via `actions/setup-node` cache option
- **Go modules**: Cached via `actions/setup-go` with `cache-dependency-path`

### Artifacts
- `frontend-dist` — uploaded on main branch pushes (7 day retention)

---

## Workflow 2: PR Health Check (`pr-health.yml`)

### Purpose
Run MAINTAINER agent health scans on every PR, post a score comment,
apply labels, and gate merges on critical scores.

### Trigger
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
```

### How It Works

1. Checks out full history (`fetch-depth: 0`)
2. Installs ripgrep (required by maintenance script)
3. Runs `run-maintenance.sh` capturing only stdout (JSON)
4. Parses score and individual metrics from JSON
5. Posts/updates a PR comment with health report
6. Applies `health:*` label based on score tier
7. Fails the check if score < 30

### Score Tiers & Labels

| Score | Label | Status |
|-------|-------|--------|
| 80-100 | `health:good` | HEALTHY |
| 60-79 | `health:fair` | NEEDS WORK |
| 30-59 | `health:needs-work` | WARNING |
| 0-29 | `health:critical` | CRITICAL (blocks merge) |

### Comment Behavior
- First run: creates new comment
- Subsequent runs: finds and updates existing comment (no spam)
- Comment includes score bar, metric table, and raw JSON in details

### Permissions
Requires `contents: write`, `pull-requests: write`, `issues: write` for
commenting, labeling, and label creation.

---

## Workflow 3: Nightly Maintenance (`maintainer-schedule.yml`)

### Purpose
Automated nightly code quality improvement cycle.

### Trigger
```yaml
on:
  schedule: [{ cron: '0 2 * * *' }]
  workflow_dispatch:
```

### How It Works

1. Full checkout with `GITHUB_TOKEN` for push access
2. Run health scan → save report
3. Apply safe fixes:
   - Remove standalone `console.log()` from TS/TSX files
   - Skip test files, console.error/warn/info
4. If fixes were applied:
   - Create branch `maintainer/nightly-YYYYMMDD`
   - Commit and push
   - Open PR with auto-fix label
5. Upload maintenance report artifact

### Safe Fix Rules
- Only removes `console.log` on standalone lines
- Preserves `console.error`, `console.warn`, `console.info`
- Skips `*.test.*` and `*.spec.*` files
- Skips `node_modules/` and `dist/`

### Git Identity
```
MAINTAINER Agent <maintainer@harbinger.local>
```

---

## Workflow 4: Community Welcome (`community-welcome.yml`)

### Purpose
Auto-greet first-time PR authors and auto-label new issues.

### Trigger
```yaml
on:
  pull_request_target: { types: [opened] }
  issues: { types: [opened] }
```

### PR Welcome
- Checks if author has <= 1 PR (including current)
- Posts welcome message with onboarding checklist
- Applies `first-contribution` label

### Issue Auto-Labeling
Scans title + body for keywords and applies labels:

| Keywords | Label | Color |
|----------|-------|-------|
| bug, error, crash | `bug` | #ef4444 |
| feature, add, request | `enhancement` | #22c55e |
| agent, pathfinder, breach... | `agents` | #00d4ff |
| mcp, plugin, hexstrike | `mcp` | #a78bfa |
| docker, container | `docker` | #2563eb |
| workflow, n8n | `workflows` | #f97316 |
| ui, frontend, page | `frontend` | #ec4899 |
| api, backend, endpoint | `backend` | #8b5cf6 |
| security, vuln, cve | `security` | #dc2626 |
| docs, documentation | `documentation` | #6b7280 |

All issues also get `triage` label. Labels are auto-created if they don't exist.

### Security Note
Uses `pull_request_target` (not `pull_request`) for fork PRs. This means
the workflow runs with repo permissions — the script doesn't checkout
untrusted code, only uses GitHub API via `github-script`.

---

## Maintenance Script (`run-maintenance.sh`)

### Metrics Scanned

| Metric | How | Per-item | Max |
|--------|-----|----------|-----|
| `any` types | `rg ': any\b'` in TS/TSX | -0.5 | 15 |
| `console.log` | `rg 'console\.log'` in TS/TSX | -1 | 15 |
| Empty catches | `rg 'catch\s*\([^)]*\)\s*\{\s*\}'` | -3 | 15 |
| TODO/FIXME | `rg '\b(TODO\|FIXME\|HACK\|XXX)\b'` | -0.2 | 10 |
| Hardcoded URLs | `rg 'https?://localhost:[0-9]+'` | -2 | 15 |
| Outdated deps | `pnpm outdated` | -0.33 | 10 |
| Convention violations | Hardcoded hex colors | -0.2 | 10 |
| Go vet issues | `go vet ./cmd/...` | -3 | 15 |
| Test coverage | Coverage summary JSON | +coverage% * 0.3 | — |

Deductions are capped per category (max column) to prevent any single
metric from tanking the entire score.

### Output Format (JSON)
```json
{
  "date": "2026-02-28T02:00:00Z",
  "score": 72,
  "metrics": {
    "any_types": 142,
    "console_logs": 5,
    "empty_catches": 0,
    "todo_count": 12,
    "hardcoded_urls": 3,
    "deps_outdated": 8,
    "test_coverage": 0,
    "conventions": 2,
    "go_vet_issues": 0
  },
  "deductions": 28,
  "bonus": 0
}
```

### Critical: `set -uo pipefail` (NOT `-euo`)
The `-e` flag is intentionally omitted. Scan commands like `rg` return
exit code 1 when no matches are found. With `-e`, this kills the script.
Each scan handles its own error via `|| echo 0`.

---

## Troubleshooting

### CI: Lint Fails
**Symptom**: Frontend lint step fails
**Cause**: ESLint found actual errors (not just warnings)
**Fix**: Run `cd harbinger-tools/frontend && pnpm exec eslint .` locally

### Nightly: Script Produces No JSON
**Symptom**: `maintenance-report.json` is empty or invalid
**Cause**: Script stderr mixed with stdout, or `rg` not installed
**Fix**: Script now outputs JSON to stdout only, diagnostics to stderr

### PR Health: Score is 0
**Symptom**: Every PR gets health:critical
**Cause**: Metric extraction failing (grep patterns not matching)
**Fix**: Check JSON structure matches grep patterns

### Nightly: PR Not Created
**Symptom**: Fixes applied but no PR appears
**Cause**: Branch already exists, or GITHUB_TOKEN lacks push permission
**Fix**: Check if `maintainer/nightly-*` branch already exists

### Community: Labels Not Created
**Symptom**: 403 error on label creation
**Cause**: `GITHUB_TOKEN` missing `issues: write` permission
**Fix**: Verify permissions block in workflow

---

## Extension Points

### Adding a New Scan Metric

1. Add scan block in `run-maintenance.sh`:
```bash
MY_METRIC=0
if command -v rg &>/dev/null; then
  MY_METRIC=$(rg -c 'pattern' -g '*.ts' ... 2>/dev/null \
    | awk -F: '{s+=$NF} END {print s+0}' || echo 0)
fi
MY_METRIC=$(safe_int "$MY_METRIC")
```

2. Add to JSON output in the `cat <<EOF` block
3. Add to score formula in the deductions calculation
4. Update metric extraction in `pr-health.yml` scan step
5. Add row to PR comment table in `pr-health.yml`

### Adding a New Safe Fix

1. Add fix block in `maintainer-schedule.yml` under "Apply safe fixes"
2. Use `rg -l` to find files, `sed -i` to apply fix
3. Increment `$FIXED` counter
4. Update PR body to describe what was fixed

### Adding a New Workflow

1. Create `.github/workflows/your-workflow.yml`
2. Set explicit `permissions` (least privilege)
3. Add `concurrency` group to prevent duplicate runs
4. Add `timeout-minutes` to all jobs
5. Upload artifacts if the workflow produces reports
6. Write a `$GITHUB_STEP_SUMMARY` for visibility

### Adding a New Issue Label Rule

In `community-welcome.yml`, add to the `rules` array:
```javascript
{ keywords: ['your', 'keywords'], label: 'your-label' },
```
And add the color to the `colors` object.
