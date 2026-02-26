# Website Sync Checklist

Run this checklist every time you ship a feature or make significant changes.

## Pre-Sync

- [ ] All builds pass: `go build -o /dev/null ./cmd/` and `pnpm build:ui`
- [ ] Run audit: `bash skills/claude-skills/harbinger-website-sync/scripts/audit-features.sh`
- [ ] Note discrepancies between code and docs

## README.md

- [ ] Agent count matches actual agents/ directories
- [ ] Pages table matches App.tsx lazy imports
- [ ] Route count is accurate
- [ ] Store count is accurate
- [ ] Features section reflects actual capabilities
- [ ] Quick start instructions work end-to-end
- [ ] Badges are current (Go version, React version)

## CHANGELOG.md

- [ ] New features have entries
- [ ] Bug fixes documented
- [ ] Breaking changes called out
- [ ] Date is correct

## ARCHITECTURE.md

- [ ] Backend file table matches backend/cmd/*.go
- [ ] Agent diagram includes all agents
- [ ] Database schema lists all tables
- [ ] Route count matches

## QUICKSTART.md

- [ ] Prerequisites are current
- [ ] Docker compose command works
- [ ] Sign-in methods listed are all functional
- [ ] "What's Next" links are valid

## Website (harbinger-website)

- [ ] Features grid matches actual features
- [ ] Agent showcase includes all agents with correct colors
- [ ] Screenshots are current (if any)
- [ ] Roadmap reflects completed + planned items
- [ ] Download/install instructions work

## GitHub Repo

- [ ] Description is current
- [ ] Topics include: offensive-security, ai-agents, mcp, bug-bounty, red-team, cybersecurity, go, react, docker, typescript
- [ ] Latest release (if tagged) has accurate notes
- [ ] Issue templates are functional

## Agent Profiles

For each agent in agents/:
- [ ] SOUL.md exists and is substantive
- [ ] IDENTITY.md exists
- [ ] SKILLS.md exists
- [ ] CONFIG.yaml exists
- [ ] Type registered in backend/cmd/agents.go
- [ ] Type in agentTypeToDir map
- [ ] Color in agentStore.ts typeToColor
- [ ] Icon in Dashboard.tsx TYPE_ICON

## Post-Sync

- [ ] Commit with descriptive message
- [ ] Push to main (or PR if team)
- [ ] Verify website deployment (if applicable)
