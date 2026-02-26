---
name: harbinger-maintain
description: >
  Maintain and update the Harbinger offensive security platform.
  Handles dependency updates, code cleanup, convention enforcement,
  consistency checks, and project hygiene. Identifies stale directories,
  duplicate definitions, and drift between frontend and backend.
  Use when: "update dependencies", "clean up the code", "check conventions",
  "maintenance", "update packages", "tidy up", "enforce patterns",
  "check consistency", "monthly maintenance", or any project upkeep request.
---

# Harbinger Maintain

Keep the Harbinger codebase clean, current, and consistent.

## Available Tools

| Script | Purpose |
|--------|---------|
| `scripts/dep-check.sh` | Check outdated dependencies and vulnerabilities |
| `scripts/cleanup.sh` | Find stale files, orphan dirs, large files, duplicates |

## Workflows

### Quick Dependency Check
```bash
bash skills/claude-skills/harbinger-maintain/scripts/dep-check.sh
```

### Full Cleanup Scan
```bash
bash skills/claude-skills/harbinger-maintain/scripts/cleanup.sh
```

### Full Maintenance Cycle

Follow the checklist in [update-checklist.md](references/update-checklist.md):

1. Run dep-check script
2. Update safe packages (patch/minor)
3. Review major version updates
4. Run build verification (tsc, pnpm build:ui, go build)
5. Run cleanup script
6. Enforce conventions from [conventions.md](references/conventions.md)

### Convention Enforcement

Read [conventions.md](references/conventions.md) for the definitive list. Key checks:

- **Design system**: All colors from Obsidian Command palette
- **Type safety**: No new `any` types, proper error narrowing
- **Store pattern**: Persist middleware, `harbinger-` prefix, callback state updates
- **API pattern**: Response normalization, apiClient usage
- **Backend pattern**: No-Crash Policy, `dbAvailable()` checks, `[Module]` log prefixes
- **File naming**: Pages PascalCase, stores camelCase+Store, API camelCase

### Stale Code Removal

Before removing anything:
1. Grep for all references to the target
2. Check git blame for context on why it exists
3. Verify it's not used by a lazy-loaded or dynamically imported module
4. Remove and build-check
