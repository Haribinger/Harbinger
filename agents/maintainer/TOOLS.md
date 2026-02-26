# MAINTAINER — Tools

## Primary Tools

| Tool | Purpose |
|------|---------|
| `harbinger-healthcheck` | Run full codebase health scan |
| `harbinger-maintain` | Execute maintenance cycle with auto-fix |
| `harbinger-bugfix` | Targeted bug fix with rollback |
| `harbinger-scaffold` | Generate new files following conventions |

## System Tools

| Tool | Purpose |
|------|---------|
| `rg` (ripgrep) | Fast codebase search for patterns |
| `git` | Version control, branching, PRs |
| `gh` | GitHub CLI for PR creation and labeling |
| `node` | Run JS analysis scripts |
| `go build` | Verify Go backend compilation |
| `pnpm build:ui` | Verify frontend build |

## Tool Configuration

All tools run in the agent's Docker container with:
- Read-only access to the codebase (bind mount)
- Write access only to `/tmp` and the agent's workspace
- Network access limited to GitHub API and configured channels
- No access to secrets or API keys (injected at runtime only)
