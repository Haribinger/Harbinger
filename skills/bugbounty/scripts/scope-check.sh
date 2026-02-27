#!/usr/bin/env bash
# Validate that a target is in scope before any scanning
# Usage: ./scope-check.sh target.com [scope-file]
set -euo pipefail
TARGET="${1:?Usage: scope-check.sh <target> [scope-file]}"
SCOPE_FILE="${2:-${HARBINGER_WORKSPACE:-$HOME/.harbinger/workspace}/scope/inscope.txt}"

if [ ! -f "$SCOPE_FILE" ]; then
  echo "[!] No scope file found at $SCOPE_FILE"
  echo "[!] Create one with in-scope domains/CIDRs, one per line"
  exit 1
fi

echo "[*] Checking if $TARGET is in scope..."

# Check exact domain match
if grep -qiF "$TARGET" "$SCOPE_FILE"; then
  echo "[+] $TARGET is IN SCOPE (exact match)"
  exit 0
fi

# Check if target is a subdomain of any scoped domain
while IFS= read -r scope_entry; do
  [ -z "$scope_entry" ] && continue
  [[ "$scope_entry" =~ ^# ]] && continue
  # Wildcard match: *.example.com covers sub.example.com
  scope_entry="${scope_entry#\*.}"
  if [[ "$TARGET" == *"$scope_entry" ]]; then
    echo "[+] $TARGET is IN SCOPE (subdomain of $scope_entry)"
    exit 0
  fi
done < "$SCOPE_FILE"

echo "[-] $TARGET is OUT OF SCOPE"
echo "[-] Aborting — do not scan this target"
exit 1
