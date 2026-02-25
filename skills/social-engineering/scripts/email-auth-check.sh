#!/usr/bin/env bash
# Full recon pipeline for a target domain
# Usage: ./skills/scripts/recon-full.sh target.com
set -euo pipefail
TARGET="${1:?Usage: recon-full.sh <domain>}"
OUT="recon-output/$TARGET/$(date +%Y%m%d)"
mkdir -p "$OUT"
echo "[*] Starting full recon on $TARGET"
echo "[*] Output: $OUT"

# Subdomain enumeration
echo "[1/5] Subdomain enumeration..."
subfinder -d "$TARGET" -silent -o "$OUT/subdomains.txt" 2>/dev/null || echo "$TARGET" > "$OUT/subdomains.txt"

# DNS resolution
echo "[2/5] DNS resolution..."
cat "$OUT/subdomains.txt" | dnsx -silent -o "$OUT/resolved.txt" 2>/dev/null || cp "$OUT/subdomains.txt" "$OUT/resolved.txt"

# HTTP probing
echo "[3/5] HTTP probing..."
cat "$OUT/resolved.txt" | httpx -silent -status-code -title -tech-detect -o "$OUT/live-hosts.txt" 2>/dev/null || true

# Port scanning
echo "[4/5] Port scanning..."
naabu -list "$OUT/resolved.txt" -silent -o "$OUT/ports.txt" 2>/dev/null || true

# Vulnerability scan (info + low only for initial pass)
echo "[5/5] Initial vulnerability scan..."
nuclei -l "$OUT/live-hosts.txt" -severity info,low -silent -o "$OUT/nuclei-initial.txt" 2>/dev/null || true

echo "[*] Recon complete. Results in $OUT/"
ls -la "$OUT/"
