#!/usr/bin/env bash
# Auto-generate markdown report from findings
# Usage: ./skills/scripts/generate-report.sh <findings_dir> <report_name>
set -euo pipefail

FINDINGS_DIR="${1:?Usage: generate-report.sh <findings_dir> <report_name>}"
REPORT_NAME="${2:?Usage: generate-report.sh <findings_dir> <report_name>}"
REPORT_FILE="reports/$REPORT_NAME_$(date +%Y%m%d%H%M%S).md"
mkdir -p "reports"

echo "# Vulnerability Report: $REPORT_NAME" > "$REPORT_FILE"
echo "\n## Date: $(date)" >> "$REPORT_FILE"
echo "\n## Findings Summary\n" >> "$REPORT_FILE"

# Iterate through findings and append to report
for finding_file in "$FINDINGS_DIR"/*;
do
  if [ -f "$finding_file" ]; then
    echo "### $(basename "$finding_file")\n" >> "$REPORT_FILE"
    cat "$finding_file" >> "$REPORT_FILE"
    echo "\n" >> "$REPORT_FILE"
  fi
done

echo "\n## Remediation Recommendations\n" >> "$REPORT_FILE"
echo "[Placeholder for general remediation advice based on findings]" >> "$REPORT_FILE"

echo "[*] Report generated: $REPORT_FILE"
ls -la "reports/"
