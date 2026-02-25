#!/usr/bin/env bash
# Auto-generate markdown report from findings directory
# Usage: ./skills/reporting/scripts/generate-report.sh <findings_dir> <report_name>
set -euo pipefail

FINDINGS_DIR="${1:?Usage: generate-report.sh <findings_dir> <report_name>}"
REPORT_NAME="${2:?Usage: generate-report.sh <findings_dir> <report_name>}"
# Fix: wrap variable in braces so _ is not treated as part of var name
REPORT_FILE="reports/${REPORT_NAME}_$(date +%Y%m%d%H%M%S).md"
mkdir -p "reports"

printf "# Vulnerability Report: %s\n\n" "$REPORT_NAME" > "$REPORT_FILE"
printf "## Date: %s\n\n" "$(date)" >> "$REPORT_FILE"
printf "## Findings Summary\n\n" >> "$REPORT_FILE"

for finding_file in "$FINDINGS_DIR"/*; do
  if [ -f "$finding_file" ]; then
    printf "### %s\n\n" "$(basename "$finding_file")" >> "$REPORT_FILE"
    cat "$finding_file" >> "$REPORT_FILE"
    printf "\n\n" >> "$REPORT_FILE"
  fi
done

printf "## Remediation Recommendations\n\n" >> "$REPORT_FILE"
printf "[Add remediation steps based on findings above]\n" >> "$REPORT_FILE"

echo "[*] Report generated: $REPORT_FILE"
ls -la "reports/"
