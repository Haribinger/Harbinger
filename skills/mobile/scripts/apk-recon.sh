#!/usr/bin/env bash
# Mobile APK security analysis pipeline
# Usage: ./skills/mobile/scripts/apk-recon.sh <path_to_apk>
set -euo pipefail
APK="${1:?Usage: apk-recon.sh <path_to_apk>}"
APK_NAME=$(basename -s .apk "$APK")
OUT="mobile-output/$APK_NAME/$(date +%Y%m%d)"
mkdir -p "$OUT"
echo "[*] Starting mobile APK analysis on $APK"
echo "[*] Output: $OUT"

# Decompile with apktool
echo "[1/5] Decompiling APK (apktool)..."
if command -v apktool >/dev/null 2>&1; then
  apktool d -f "$APK" -o "$OUT/decompiled" 2>/dev/null || echo "apktool decompilation failed" > "$OUT/apktool-error.txt"
  echo "  Decompiled to $OUT/decompiled/"
else
  echo "apktool not installed — install with: apt install apktool" > "$OUT/apktool-error.txt"
  echo "  apktool not installed"
fi

# Decompile to Java with jadx
echo "[2/5] Decompiling to Java (jadx)..."
if command -v jadx >/dev/null 2>&1; then
  jadx -d "$OUT/jadx-output" "$APK" 2>/dev/null || echo "jadx decompilation failed" > "$OUT/jadx-error.txt"
  echo "  Java source in $OUT/jadx-output/"
else
  echo "jadx not installed — see https://github.com/skylot/jadx" > "$OUT/jadx-error.txt"
  echo "  jadx not installed"
fi

# Static analysis — search for common issues
echo "[3/5] Static analysis (hardcoded secrets, URLs, keys)..."
SEARCH_DIR="$OUT/decompiled"
if [ -d "$SEARCH_DIR" ]; then
  grep -rniE '(api[_-]?key|secret|password|token|aws_|firebase)\s*[:=]' "$SEARCH_DIR" 2>/dev/null | head -50 > "$OUT/hardcoded-secrets.txt" || true
  grep -rnoE 'https?://[a-zA-Z0-9./?=_&%-]+' "$SEARCH_DIR" 2>/dev/null | sort -u > "$OUT/urls-found.txt" || true
  grep -rniE '(allowBackup="true"|debuggable="true"|usesCleartextTraffic="true")' "$SEARCH_DIR" 2>/dev/null > "$OUT/insecure-config.txt" || true

  SECRETS=$(wc -l < "$OUT/hardcoded-secrets.txt" 2>/dev/null || echo 0)
  URLS=$(wc -l < "$OUT/urls-found.txt" 2>/dev/null || echo 0)
  INSECURE=$(wc -l < "$OUT/insecure-config.txt" 2>/dev/null || echo 0)
  echo "  Found: $SECRETS potential secrets, $URLS URLs, $INSECURE insecure configs"
else
  echo "  Skipping (decompilation failed)"
fi

# Certificate pinning detection
echo "[4/5] Checking for SSL pinning..."
if [ -d "$SEARCH_DIR" ]; then
  grep -rniE '(certificatePinner|TrustManager|X509TrustManager|ssl[Pp]inning|network_security_config)' "$SEARCH_DIR" 2>/dev/null > "$OUT/ssl-pinning.txt" || true
  PINS=$(wc -l < "$OUT/ssl-pinning.txt" 2>/dev/null || echo 0)
  echo "  Found $PINS SSL pinning references"
else
  echo "  Skipping (decompilation failed)"
fi

# MobSF scan (if available)
echo "[5/5] Automated scan (MobSF)..."
if curl -sf http://localhost:8000/api/v1/scan >/dev/null 2>&1; then
  echo "  MobSF available — submit APK at http://localhost:8000"
  echo "MobSF available at http://localhost:8000" > "$OUT/mobsf-status.txt"
else
  echo "  MobSF not running — start with: docker run -p 8000:8000 opensecurity/mobile-security-framework-mobsf"
  echo "MobSF not running" > "$OUT/mobsf-status.txt"
fi

echo "[*] Mobile APK analysis complete. Results in $OUT/"
ls -la "$OUT/"
