#!/usr/bin/env bash
# feature-checklist.sh — Generate implementation checklist for a Harbinger feature
# Usage: bash feature-checklist.sh "Feature Name"

set -euo pipefail

FEATURE_NAME="${1:-New Feature}"
DATE=$(date +%Y-%m-%d)

cat <<EOF
# Feature Checklist: ${FEATURE_NAME}
# Generated: ${DATE}

## Backend
- [ ] New Go handler file in backend/cmd/
- [ ] Route registration in main.go (both /api/ and /api/v1/)
- [ ] Database migration if needed (database.go)
- [ ] Auth middleware on routes
- [ ] Error handling follows No-Crash Policy
- [ ] go build -o /dev/null ./cmd/ passes

## Frontend
- [ ] Types added to types/index.ts
- [ ] API client module in api/
- [ ] Zustand store in store/
- [ ] Page component in pages/
- [ ] Route registered in App.tsx
- [ ] Nav item added to Sidebar.tsx
- [ ] Obsidian Command design system followed
- [ ] pnpm build:ui passes

## Documentation
- [ ] CHANGELOG.md updated
- [ ] Feature docs in docs/
- [ ] Agent SKILLS.md updated if applicable
- [ ] README.md updated if setup changes

## Quality
- [ ] No console.log left in production code
- [ ] No hardcoded API keys or secrets
- [ ] No any types in TypeScript
- [ ] No unused imports
- [ ] Error boundaries on new pages

## Git
- [ ] Feature branch created
- [ ] Commits follow conventional format
- [ ] PR created with description
EOF
