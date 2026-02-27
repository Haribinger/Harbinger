#!/usr/bin/env bash
# Lightweight recon chain — fast initial assessment for bug bounty
# Usage: ./quick-recon.sh target.com
set -euo pipefail
TARGET="${1:?Usage: quick-recon.sh <domain>}"
OUT="${HARBINGER_WORKSPACE:-$HOME/.harbinger/workspace}/recon/$TARGET/$(date +%Y%m%d)"
mkdir -p "$OUT"
echo "[*] Quick recon on $TARGET → $OUT"

# Phase 1: Subdomain enumeration (fast mode)
echo "[1/3] Subdomains..."
subfinder -d "$TARGET" -silent -timeout 30 -o "$OUT/subs.txt" 2>/dev/null || echo "$TARGET" > "$OUT/subs.txt"
SUB_COUNT=$(wc -l < "$OUT/subs.txt")
echo "  Found $SUB_COUNT subdomains"

# Phase 2: HTTP probe live hosts
echo "[2/3] Probing live hosts..."
cat "$OUT/subs.txt" | httpx -silent -status-code -title -o "$OUT/live.txt" 2>/dev/null || true
LIVE_COUNT=$(wc -l < "$OUT/live.txt" 2>/dev/null || echo 0)
echo "  $LIVE_COUNT live hosts"

# Phase 3: Nuclei quick scan (critical + high only)
echo "[3/3] Quick vulnerability scan..."
if [ -f "$OUT/live.txt" ] && [ -s "$OUT/live.txt" ]; then
  nuclei -l "$OUT/live.txt" -severity critical,high -silent -o "$OUT/vulns.txt" 2>/dev/null || true
  VULN_COUNT=$(wc -l < "$OUT/vulns.txt" 2>/dev/null || echo 0)
  echo "  $VULN_COUNT findings (critical/high)"
else
  echo "  No live hosts to scan"
fi

echo ""
echo "[*] Quick recon complete"
echo "  Subdomains: $SUB_COUNT"
echo "  Live hosts: $LIVE_COUNT"
echo "  Results:    $OUT/"
