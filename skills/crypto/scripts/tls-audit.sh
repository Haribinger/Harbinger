#!/usr/bin/env bash
# TLS/SSL and cryptography audit pipeline
# Usage: ./skills/crypto/scripts/tls-audit.sh <host:port>
set -euo pipefail
TARGET="${1:?Usage: tls-audit.sh <host:port>}"
[[ "$TARGET" != *:* ]] && TARGET="${TARGET}:443"
HOST="${TARGET%%:*}"
PORT="${TARGET##*:}"
OUT="crypto-output/$HOST/$(date +%Y%m%d)"
mkdir -p "$OUT"
echo "[*] Starting TLS/crypto audit on $TARGET"
echo "[*] Output: $OUT"

# testssl.sh comprehensive scan
echo "[1/5] TLS audit (testssl.sh)..."
if command -v testssl >/dev/null 2>&1 || command -v testssl.sh >/dev/null 2>&1; then
  TESTSSL=$(command -v testssl || command -v testssl.sh)
  "$TESTSSL" --quiet --jsonfile "$OUT/testssl.json" --csvfile "$OUT/testssl.csv" "$TARGET" 2>/dev/null || true
  echo "  Results in $OUT/testssl.json"
else
  echo "  testssl.sh not installed — install with: apt install testssl.sh"
  echo "testssl.sh not installed" > "$OUT/testssl-status.txt"
fi

# sslscan quick check
echo "[2/5] SSL scan (sslscan)..."
if command -v sslscan >/dev/null 2>&1; then
  sslscan --no-colour "$TARGET" > "$OUT/sslscan.txt" 2>/dev/null || true
  WEAK=$(grep -ciE '(RC4|DES|NULL|EXPORT|MD5)' "$OUT/sslscan.txt" 2>/dev/null || echo 0)
  echo "  Found $WEAK weak cipher references"
else
  echo "  sslscan not installed — install with: apt install sslscan"
fi

# OpenSSL certificate inspection
echo "[3/5] Certificate inspection (openssl)..."
if command -v openssl >/dev/null 2>&1; then
  echo | openssl s_client -connect "$TARGET" -servername "$HOST" 2>/dev/null | openssl x509 -text -noout > "$OUT/cert-details.txt" 2>/dev/null || true
  echo | openssl s_client -connect "$TARGET" -servername "$HOST" 2>/dev/null | openssl x509 -enddate -noout > "$OUT/cert-expiry.txt" 2>/dev/null || true
  echo | openssl s_client -connect "$TARGET" -servername "$HOST" 2>/dev/null | grep -E 'Cipher|Protocol' > "$OUT/active-cipher.txt" 2>/dev/null || true
  echo "  Certificate details in $OUT/cert-details.txt"
else
  echo "  openssl not found"
fi

# JWT analysis helper
echo "[4/5] JWT analysis tools check..."
if command -v jwt_tool >/dev/null 2>&1 || command -v jwt_tool.py >/dev/null 2>&1; then
  cat > "$OUT/jwt-notes.txt" <<'JWT'
jwt_tool available — commands:
  jwt_tool <token> -T              # Tampering mode
  jwt_tool <token> -C -d wordlist  # Crack secret
  jwt_tool <token> -X a            # alg:none attack
  jwt_tool <token> -X k            # Key confusion (RS256→HS256)
JWT
  echo "  jwt_tool ready — see $OUT/jwt-notes.txt for commands"
else
  echo "  jwt_tool not installed — pip install jwt_tool" > "$OUT/jwt-notes.txt"
  echo "  jwt_tool not installed"
fi

# Summary
echo "[5/5] Generating crypto audit summary..."
cat > "$OUT/summary.txt" <<SUMMARY
Crypto Audit Summary for $TARGET
Date: $(date)

TLS Scan:    $([ -f "$OUT/testssl.json" ] && echo "Complete (see testssl.json)" || echo "Skipped")
SSL Scan:    $([ -f "$OUT/sslscan.txt" ] && echo "Complete" || echo "Skipped")
Certificate: $([ -f "$OUT/cert-details.txt" ] && echo "Inspected" || echo "Skipped")
Expiry:      $(cat "$OUT/cert-expiry.txt" 2>/dev/null || echo "Unknown")
JWT Tools:   $(command -v jwt_tool >/dev/null 2>&1 && echo "Available" || echo "Not installed")
Weak Ciphers: $(grep -ciE '(RC4|DES|NULL|EXPORT|MD5)' "$OUT/sslscan.txt" 2>/dev/null || echo "N/A")
SUMMARY
cat "$OUT/summary.txt"

echo "[*] Crypto audit complete. Results in $OUT/"
ls -la "$OUT/"
