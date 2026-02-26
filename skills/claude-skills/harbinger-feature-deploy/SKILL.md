---
name: harbinger-feature-deploy
description: >
  End-to-end feature deployment pipeline for Harbinger. Orchestrates planning,
  implementation, documentation, git workflow, CLI updates, GitHub releases, and
  website updates. Coordinates between coder (SAM), documenter (SCRIBE), and
  maintainer (MAINTAINER) agents. Use when: "add a feature and deploy it",
  "ship this feature", "implement and document", "full feature pipeline",
  "plan and implement", "add feature with docs", "release a feature",
  "push feature to production", or any request to add, document, and ship a feature.
---

# Harbinger Feature Deploy

Full pipeline: Plan → Implement → Document → Test → Git → Release.

## Pipeline Stages

### Stage 1: Plan
1. Analyze the feature request
2. Identify affected files (backend, frontend, agents, skills)
3. Determine dependencies and breaking changes
4. Generate implementation checklist

### Stage 2: Implement
1. Backend first — Go handlers, DB migrations, route registration
2. Frontend stores — Zustand state management
3. Frontend pages — React components matching Obsidian Command
4. Wire routes in App.tsx and Sidebar.tsx
5. Run `go build -o /dev/null ./cmd/` and `pnpm build:ui` to verify

### Stage 3: Document
1. Update CHANGELOG.md with feature entry
2. Create/update docs/ markdown for the feature
3. Update README.md if feature affects setup or usage
4. Add JSDoc/Go doc comments to public APIs
5. Update agent SKILLS.md if agents gain new capabilities

### Stage 4: Test
1. Run `bash scripts/scan-backend.sh` for backend health
2. Run `pnpm build:ui` for frontend compilation
3. Verify new routes respond with `curl localhost:8080/api/...`
4. Check for type errors, unused imports, console.logs

### Stage 5: Git
1. Stage changed files (specific paths, not `git add .`)
2. Write descriptive commit message following repo conventions
3. Create feature branch if not on one: `feature/{name}`
4. Push with `-u` flag for new branches

### Stage 6: Release (optional, on request)
1. Tag version: `git tag -a v{version} -m "feat: {description}"`
2. Create GitHub release via `gh release create`
3. Update package.json version if applicable
4. Generate release notes from commits since last tag

## Agent Handoff Protocol

| Stage | Primary Agent | Handoff To |
|-------|--------------|------------|
| Plan | MAINTAINER | SAM (coder) |
| Implement | SAM | SCRIBE (docs) |
| Document | SCRIBE | MAINTAINER (review) |
| Test | MAINTAINER | — |
| Git | SAM | — |
| Release | MAINTAINER | SCRIBE (release notes) |

## Scripts

- `scripts/feature-checklist.sh` — Generate implementation checklist for a feature
- `scripts/pre-deploy-check.sh` — Run all verification checks before deploy

## References

- [deploy-workflow.md](references/deploy-workflow.md) — Detailed deploy workflow steps
- [commit-conventions.md](references/commit-conventions.md) — Git commit message format
