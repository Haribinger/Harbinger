#!/usr/bin/env bash
# Automated web vulnerability scanning pipeline
# Usage: ./skills/scripts/web-scan.sh targets.txt
set -euo pipefail
TARGETS_FILE="${1:?Usage: web-scan.sh <targets_file>}"
OUT_DIR="webscan-output/$(basename -s .txt $TARGETS_FILE)_$(date +%Y%m%d)"
mkdir -p "$OUT_DIR"
echo "[*] Starting web scan on targets from $TARGETS_FILE"
echo "[*] Output: $OUT_DIR"

# Nuclei scan for critical/high severity
echo "[1/3] Running Nuclei scan (critical/high)..."
nuclei -l "$TARGETS_FILE" -severity critical,high -silent -o "$OUT_DIR/nuclei-critical-high.txt" 2>/dev/null || true

# SQLMap scan (example, usually requires more specific input)
echo "[2/3] Running SQLMap (example, manual review needed)..."
# This is a placeholder. Real SQLMap usage requires specific URLs and parameters.
# For demonstration, we'll just echo a message.
echo "SQLMap requires specific URL and parameter input. Manual review of targets is recommended." > "$OUT_DIR/sqlmap-notes.txt"

# Dalfox (XSS scanner)
echo "[3/3] Running Dalfox (XSS scan)..."
# Again, Dalfox often needs specific URLs. This is a generic example.
cat "$TARGETS_FILE" | dalfox -o "$OUT_DIR/dalfox-xss.txt" 2>/dev/null || true

echo "[*] Web scan complete. Results in $OUT_DIR/"
ls -la "$OUT_DIR/"
