---
name: harbinger-bugfix
description: >
  Diagnose and fix bugs in the Harbinger offensive security platform.
  Handles TypeScript compilation errors, Go build failures, runtime crashes,
  state management bugs, API failures, CORS issues, and database connection
  problems. Provides root cause analysis and generates targeted fixes.
  Use when: "fix this error", "build is failing", "page is blank",
  "API returns 404", "state not updating", "debug this", "something broke",
  "type error", "runtime error", "CORS error", or any bug report.
---

# Harbinger Bugfix

Diagnose and fix bugs across the Harbinger stack.

## Quick Start

**Build failing?** Run the build check script:
```bash
bash skills/claude-skills/harbinger-bugfix/scripts/build-check.sh
```

**Know the error?** Check [common-errors.md](references/common-errors.md) for known patterns.

**Need a full debug session?** Follow [debug-workflow.md](references/debug-workflow.md).

## Diagnosis Workflow

1. **Get the error** — exact message, file, line number
2. **Identify the layer** — frontend (TS), backend (Go), or infra (Docker/DB)
3. **Check common patterns** — see [common-errors.md](references/common-errors.md)
4. **Read the source** — always read the file before suggesting a fix
5. **Trace the root cause** — follow imports, check types, verify API contracts
6. **Fix and verify** — make the change, then build-check

## Build Verification Commands

```bash
# TypeScript only (fast)
cd harbinger-tools/frontend && npx tsc --noEmit

# Full frontend build
pnpm build:ui

# Go backend
cd backend && go build -o /dev/null ./cmd/
```

## Fix Rules

- Never use `any` to silence a type error — find the correct type
- Never use `@ts-ignore` — fix the underlying issue
- Never catch and swallow errors silently in user-facing code
- Follow the No-Crash Policy: return `{ok:false, reason:"..."}`, never raw 500
- Test after fixing: build-check at minimum
- If a fix touches multiple files, verify all of them compile

## Error Prompt Template

When reporting a fix to the user, format as:

```markdown
**Error:** {exact error message}
**Root cause:** {why it happens}
**Fix:** {what was changed}
**Files modified:** {list}
**Verified:** {build-check result}
```
