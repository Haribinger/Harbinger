#!/usr/bin/env bash
# Web and API fuzzing pipeline
# Usage: ./skills/fuzzing/scripts/web-fuzz.sh <target_url>
set -euo pipefail
TARGET="${1:?Usage: web-fuzz.sh <target_url>}"
OUT="fuzzing-output/$(echo "$TARGET" | sed 's|https\?://||;s|/|_|g')/$(date +%Y%m%d)"
mkdir -p "$OUT"
echo "[*] Starting web fuzzing on $TARGET"
echo "[*] Output: $OUT"

# Directory bruteforce with ffuf
echo "[1/4] Directory fuzzing (ffuf)..."
if command -v ffuf >/dev/null 2>&1; then
  WORDLIST="/usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt"
  [ ! -f "$WORDLIST" ] && WORDLIST="/usr/share/wordlists/dirb/common.txt"
  [ ! -f "$WORDLIST" ] && WORDLIST="/usr/share/dirbuster/wordlists/directory-list-2.3-small.txt"
  if [ -f "$WORDLIST" ]; then
    ffuf -u "${TARGET}/FUZZ" -w "$WORDLIST" -mc 200,301,302,403 -t 50 -o "$OUT/ffuf-dirs.json" -of json 2>/dev/null || true
    FOUND=$(jq '.results | length' "$OUT/ffuf-dirs.json" 2>/dev/null || echo 0)
    echo "  Found $FOUND directories/endpoints"
  else
    echo "  No wordlist found — install seclists: apt install seclists"
    echo "no wordlist" > "$OUT/ffuf-dirs.txt"
  fi
else
  echo "  ffuf not installed — install with: go install github.com/ffuf/ffuf/v2@latest"
  echo "ffuf not installed" > "$OUT/ffuf-dirs.txt"
fi

# Parameter fuzzing
echo "[2/4] Parameter fuzzing (ffuf)..."
if command -v ffuf >/dev/null 2>&1; then
  PARAM_LIST="/usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt"
  [ ! -f "$PARAM_LIST" ] && PARAM_LIST="/usr/share/wordlists/wfuzz/general/common.txt"
  if [ -f "$PARAM_LIST" ]; then
    ffuf -u "${TARGET}?FUZZ=test" -w "$PARAM_LIST" -mc 200 -t 50 -fs 0 -o "$OUT/ffuf-params.json" -of json 2>/dev/null || true
    FOUND=$(jq '.results | length' "$OUT/ffuf-params.json" 2>/dev/null || echo 0)
    echo "  Found $FOUND valid parameters"
  else
    echo "  No parameter wordlist found"
  fi
else
  echo "  Skipping (ffuf not installed)"
fi

# Input mutation with radamsa
echo "[3/4] Mutation fuzzing samples (radamsa)..."
if command -v radamsa >/dev/null 2>&1; then
  mkdir -p "$OUT/mutations"
  for payload in '{"id":1}' '<script>alert(1)</script>' "admin' OR 1=1--" '../../../../etc/passwd'; do
    echo "$payload" | radamsa -n 10 >> "$OUT/mutations/mutated-inputs.txt" 2>/dev/null || true
  done
  MUTATIONS=$(wc -l < "$OUT/mutations/mutated-inputs.txt" 2>/dev/null || echo 0)
  echo "  Generated $MUTATIONS mutated payloads in $OUT/mutations/"
else
  echo "  radamsa not installed — install with: apt install radamsa"
  echo "radamsa not installed" > "$OUT/mutations-status.txt"
fi

# Summary
echo "[4/4] Generating summary..."
cat > "$OUT/summary.txt" <<SUMMARY
Fuzzing Summary for $TARGET
Date: $(date)

Directory Fuzzing: $([ -f "$OUT/ffuf-dirs.json" ] && jq '.results | length' "$OUT/ffuf-dirs.json" 2>/dev/null || echo "N/A") results
Parameter Fuzzing: $([ -f "$OUT/ffuf-params.json" ] && jq '.results | length' "$OUT/ffuf-params.json" 2>/dev/null || echo "N/A") results
Mutation Samples:  $(wc -l < "$OUT/mutations/mutated-inputs.txt" 2>/dev/null || echo "N/A") payloads
SUMMARY
cat "$OUT/summary.txt"

echo "[*] Web fuzzing complete. Results in $OUT/"
ls -la "$OUT/"
