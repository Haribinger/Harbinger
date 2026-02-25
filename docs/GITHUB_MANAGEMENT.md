# GitHub Management Best Practices

## Security Features to Enable
1. Settings → Code security → Enable: Dependabot alerts, security updates, Code scanning (CodeQL), Secret scanning, Push protection

## Recommended GitHub Actions
Copy these from docs/github-actions/ to .github/workflows/:

### security-scan.yml — Runs CodeQL, Trivy, TruffleHog on push/PR/weekly
### ci.yml — pnpm type check, Go build, Docker validation on push/PR
### dependabot.yml — Auto-updates for npm, Go, Docker, Actions weekly

## Sync Script
Use scripts/harbinger-sync.sh to avoid merge conflicts when collaborating.

## Labels to Create
bug (red), feature (green), security (orange), dependencies (blue), premium (gold), community (purple)
