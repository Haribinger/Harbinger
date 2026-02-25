#!/usr/bin/env bash
set -euo pipefail
N="${1:-6}"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo"; exit 1; }

echo "[*] Showing changes from last $N commits..."
echo
git log --oneline --decorate -n "$N" 2>/dev/null || true
echo
echo "== Summary =="
git diff --shortstat "HEAD~$N..HEAD" 2>/dev/null || true
echo
echo "== Files (A/M/D/R) =="
git diff --name-status "HEAD~$N..HEAD" 2>/dev/null || true
