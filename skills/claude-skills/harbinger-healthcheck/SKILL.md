---
name: harbinger-healthcheck
description: >
  Full codebase health scan for the Harbinger offensive security platform.
  Scans TypeScript and Go code for type safety issues, console.log leaks,
  any-type abuse, hardcoded values, API inconsistencies, design system
  violations, and cross-file consistency problems. Generates a categorized
  health report with severity ratings and copy-paste fix prompts.
  Use when: "check the code", "health check", "scan for bugs", "code quality",
  "find issues", "type check", "audit the codebase", "what needs fixing",
  "generate a health report", or any request to analyze code quality.
---

# Harbinger Healthcheck

Automated codebase health scanning with actionable fix prompts.

## Project Layout

```
harbinger-tools/frontend/src/    — React/TypeScript SPA (primary UI)
backend/cmd/                     — Go API server (9 files)
```

Build: `pnpm build:ui` (frontend), `cd backend && go build ./cmd/` (backend)

## Workflow

1. Run scan scripts to collect raw findings
2. Read results and filter out known intentional patterns (see [known-patterns.md](references/known-patterns.md))
3. Categorize findings by severity
4. Generate health report with fix prompts from [fix-prompts.md](references/fix-prompts.md)

## Step 1: Run Scans

Run all 4 scan scripts. Execute from project root:

```bash
bash skills/claude-skills/harbinger-healthcheck/scripts/scan-types.sh /home/anon/Harbinger
bash skills/claude-skills/harbinger-healthcheck/scripts/scan-backend.sh /home/anon/Harbinger
bash skills/claude-skills/harbinger-healthcheck/scripts/scan-consistency.sh /home/anon/Harbinger
bash skills/claude-skills/harbinger-healthcheck/scripts/scan-placeholders.sh /home/anon/Harbinger
```

The placeholder scanner (`scan-placeholders.sh`) checks for:
- Placeholder text (TODO, FIXME, Lorem ipsum, dummy, WIP, "not yet implemented")
- Broken file references in skill SKILL.md files
- Missing project directories
- Empty/stub files (<3 lines)
- Non-executable scripts
- Bad shebangs

If scripts fail (permissions, missing rg), fall back to manual Grep/Glob searches for the same patterns.

## Step 2: Classify Findings

### Severity Levels

| Level | Meaning | Examples |
|-------|---------|---------|
| CRITICAL | Security risk or data loss | SQL injection, exposed secrets, unchecked auth |
| HIGH | Type safety / runtime risk | `any` types in data flow, swallowed errors in user actions |
| MEDIUM | Maintenance burden | Console.logs, duplicated patterns, hardcoded values |
| LOW | Style / convention | Off-brand colors, missing comments, relaxed linting |

### Known False Positives

Before reporting, check [known-patterns.md](references/known-patterns.md) — these are intentional:
- In-memory fallback (`if db == nil`)
- Empty API_BASE (proxy handles it)
- ErrorBoundary console.error
- Optional catch blocks with comments
- SEED_ROSTER fallback in Dashboard

## Step 3: Generate Report

Use this format:

```markdown
# Harbinger Health Report
**Date:** {date}
**Scanned:** {file_count} files ({frontend_count} TS/TSX, {backend_count} Go)

## Summary
| Severity | Count |
|----------|-------|
| CRITICAL | {n}   |
| HIGH     | {n}   |
| MEDIUM   | {n}   |
| LOW      | {n}   |

## CRITICAL Issues
{list with file:line, description, and fix prompt}

## HIGH Issues
{list}

## MEDIUM Issues
{list}

## LOW Issues
{list}

## Recommended Fix Order
1. {highest priority fix with prompt}
2. {next}
3. {next}
```

## Step 4: Generate Fix Prompts

For each issue, generate a copy-paste prompt the user can give to Claude Code.
Templates are in [fix-prompts.md](references/fix-prompts.md). Customize each with:
- The actual file path
- The specific line numbers
- The specific issue found

Format each prompt as a fenced code block the user can copy directly.

## Quick Single-File Check

For checking a single file instead of the whole project:

1. Read the target file
2. Check for: `any` types, console statements, hardcoded values, empty catches, off-brand colors
3. Report findings with fix prompts
4. Skip the scan scripts — just use Grep/Read directly
