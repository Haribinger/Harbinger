#!/usr/bin/env bash
set -euo pipefail
N="${1:-6}"
echo "[*] Showing changes from last $N commits..."
echo
git log --oneline --decorate -n "$N"
echo
echo "== Summary =="
git diff --shortstat "HEAD~$N..HEAD" || true
echo
echo "== Files (A/M/D/R) =="
git diff --name-status "HEAD~$N..HEAD" || true
