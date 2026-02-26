---
name: harbinger-website-sync
description: >
  Global skill to sync Harbinger website, documentation, and GitHub repo with the
  latest features, agents, and changes. Updates roadmap, README, CHANGELOG,
  website content, and ensures all docs reflect the current state of the codebase.
  Use when: "update the website", "sync docs", "update roadmap", "refresh README",
  "publish changes", "sync website with code", "update documentation", "push updates",
  "website sync", "docs sync", or any request to keep external-facing content current.
---

# Harbinger Website Sync

Keep the website, docs, and GitHub repo in sync with every code change.

## What This Skill Does

1. **Audit** — Scan the codebase for new features, agents, pages, routes, and skills
2. **Update Docs** — Refresh README.md, CHANGELOG.md, QUICKSTART.md, ARCHITECTURE.md
3. **Update Roadmap** — Mark completed items, add new planned features
4. **Sync Website** — Update harbinger-website (or root Next.js) with latest content
5. **GitHub Sync** — Update repo description, topics, and release notes
6. **Agent Docs** — Ensure all agent profiles have complete documentation

## Audit Checklist

Run `scripts/audit-features.sh` to generate a diff between docs and code.

### What to check:

| Check | How | File |
|-------|-----|------|
| Agent count | `ls agents/ \| grep -v _ \| grep -v shared \| wc -l` | README.md agent roster |
| Page count | `grep "lazy(" src/App.tsx \| wc -l` | README.md pages table |
| Route count | `grep "HandleFunc" backend/cmd/main.go \| wc -l` | ARCHITECTURE.md |
| Store count | `ls src/store/*Store.ts \| wc -l` | README.md project structure |
| Skill count | `ls skills/claude-skills/ \| wc -l` | Website features section |
| MCP plugins | `ls mcp-plugins/ \| wc -l` | Website integrations section |
| Backend files | `ls backend/cmd/*.go \| wc -l` | ARCHITECTURE.md backend table |

### Feature Registry

Each feature needs entries in:
- README.md (features section + pages table)
- CHANGELOG.md (release notes)
- ARCHITECTURE.md (if architectural change)
- Website landing page (if user-facing)
- Sidebar nav (if it's a new page)

## Sync Workflow

```
1. Run audit script
2. Compare feature count vs docs
3. Update README.md
   - Agent roster (current: 11 agents)
   - Pages table (current: 18 pages)
   - Features section
4. Update CHANGELOG.md
   - Add new entries since last sync
5. Update ARCHITECTURE.md
   - Backend files table
   - Agent diagram
   - Database schema
6. Update website
   - Features grid
   - Agent showcase
   - Roadmap status
7. Update GitHub repo
   - Topics: offensive-security, ai-agents, mcp, bug-bounty, etc.
   - Description matches README first line
8. Commit and push
```

## Scripts

- `scripts/audit-features.sh` — Compare codebase state vs documentation
- `scripts/sync-readme.sh` — Auto-update README counts and tables

## References

- [sync-checklist.md](references/sync-checklist.md) — Full sync checklist
- [website-sections.md](references/website-sections.md) — Website section map
