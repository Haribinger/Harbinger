#!/usr/bin/env bash
# Email authentication and phishing infrastructure analysis
# Usage: ./skills/social-engineering/scripts/email-auth-check.sh <domain>
set -euo pipefail
DOMAIN="${1:?Usage: email-auth-check.sh <domain>}"
OUT="soceng-output/$DOMAIN/$(date +%Y%m%d)"
mkdir -p "$OUT"
echo "[*] Starting email auth analysis on $DOMAIN"
echo "[*] Output: $OUT"

# SPF record check
echo "[1/5] SPF record check..."
SPF=$(dig +short TXT "$DOMAIN" 2>/dev/null | grep -i "v=spf1" || echo "")
if [[ -n "$SPF" ]]; then
  echo "$SPF" > "$OUT/spf-record.txt"
  echo "  SPF: $SPF"
  if echo "$SPF" | grep -qE '(\+all|~all)'; then
    echo "  WARNING: SPF is permissive (allows spoofing)" | tee -a "$OUT/findings.txt"
  fi
else
  echo "  NO SPF RECORD FOUND — domain is spoofable" | tee -a "$OUT/findings.txt"
  echo "none" > "$OUT/spf-record.txt"
fi

# DKIM selector check
echo "[2/5] DKIM check (common selectors)..."
DKIM_FOUND=0
for selector in default google selector1 selector2 s1 s2 k1 dkim mail; do
  DKIM=$(dig +short TXT "${selector}._domainkey.${DOMAIN}" 2>/dev/null | grep -i "v=DKIM1" || true)
  if [[ -n "$DKIM" ]]; then
    echo "  DKIM found: ${selector}._domainkey.${DOMAIN}" | tee -a "$OUT/dkim-records.txt"
    echo "    $DKIM" >> "$OUT/dkim-records.txt"
    DKIM_FOUND=1
  fi
done
if [[ $DKIM_FOUND -eq 0 ]]; then
  echo "  No DKIM records found for common selectors" | tee -a "$OUT/findings.txt"
  echo "none" > "$OUT/dkim-records.txt"
fi

# DMARC record check
echo "[3/5] DMARC record check..."
DMARC=$(dig +short TXT "_dmarc.${DOMAIN}" 2>/dev/null || echo "")
if [[ -n "$DMARC" ]]; then
  echo "$DMARC" > "$OUT/dmarc-record.txt"
  echo "  DMARC: $DMARC"
  if echo "$DMARC" | grep -qE 'p=none'; then
    echo "  WARNING: DMARC policy is 'none' (monitoring only)" | tee -a "$OUT/findings.txt"
  elif echo "$DMARC" | grep -qE 'p=quarantine'; then
    echo "  DMARC policy: quarantine (moderate protection)"
  elif echo "$DMARC" | grep -qE 'p=reject'; then
    echo "  DMARC policy: reject (strong protection)"
  fi
else
  echo "  NO DMARC RECORD — spoofed emails not rejected" | tee -a "$OUT/findings.txt"
  echo "none" > "$OUT/dmarc-record.txt"
fi

# MX record enumeration
echo "[4/5] MX record enumeration..."
dig +short MX "$DOMAIN" 2>/dev/null | sort -n > "$OUT/mx-records.txt" || true
MX_COUNT=$(wc -l < "$OUT/mx-records.txt" 2>/dev/null || echo 0)
echo "  Found $MX_COUNT MX records"
if [[ $MX_COUNT -gt 0 ]]; then
  while IFS= read -r line; do
    echo "    $line"
  done < "$OUT/mx-records.txt"
fi

# SMTP test with swaks
echo "[5/5] SMTP connectivity test..."
if command -v swaks >/dev/null 2>&1; then
  MX_HOST=$(head -1 "$OUT/mx-records.txt" 2>/dev/null | awk '{print $2}' | sed 's/\.$//')
  if [[ -n "${MX_HOST:-}" ]]; then
    swaks --to "test@${DOMAIN}" --server "$MX_HOST" --quit-after RCPT --hide-all --timeout 10 > "$OUT/smtp-test.txt" 2>&1 || echo "SMTP test failed or timed out" > "$OUT/smtp-test.txt"
    echo "  SMTP test results in $OUT/smtp-test.txt"
  else
    echo "  No MX host to test"
  fi
else
  echo "  swaks not installed — install with: apt install swaks"
  echo "swaks not installed" > "$OUT/smtp-test.txt"
fi

# Spoofability assessment
echo ""
echo "[*] Email Auth Summary for $DOMAIN"
echo "  SPF:   $([ -s "$OUT/spf-record.txt" ] && [ "$(cat "$OUT/spf-record.txt")" != "none" ] && echo "FOUND" || echo "MISSING")"
echo "  DKIM:  $([ "$DKIM_FOUND" -eq 1 ] && echo "FOUND" || echo "MISSING")"
echo "  DMARC: $([ -s "$OUT/dmarc-record.txt" ] && [ "$(cat "$OUT/dmarc-record.txt")" != "none" ] && echo "FOUND" || echo "MISSING")"
echo "  MX:    $MX_COUNT records"

SCORE=0
[ -s "$OUT/spf-record.txt" ] && [ "$(cat "$OUT/spf-record.txt")" != "none" ] && SCORE=$((SCORE + 1))
[ "$DKIM_FOUND" -eq 1 ] && SCORE=$((SCORE + 1))
[ -s "$OUT/dmarc-record.txt" ] && [ "$(cat "$OUT/dmarc-record.txt")" != "none" ] && SCORE=$((SCORE + 1))

case $SCORE in
  0) echo "  RISK: CRITICAL — No email auth. Domain is fully spoofable." | tee -a "$OUT/findings.txt" ;;
  1) echo "  RISK: HIGH — Partial email auth. Spoofing likely possible." | tee -a "$OUT/findings.txt" ;;
  2) echo "  RISK: MEDIUM — Most controls in place. Check enforcement." | tee -a "$OUT/findings.txt" ;;
  3) echo "  RISK: LOW — SPF + DKIM + DMARC all present." | tee -a "$OUT/findings.txt" ;;
esac

echo "[*] Email auth analysis complete. Results in $OUT/"
ls -la "$OUT/"
