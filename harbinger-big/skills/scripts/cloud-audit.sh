#!/usr/bin/env bash
# Cloud misconfiguration audit pipeline
# Usage: ./skills/scripts/cloud-audit.sh aws/azure/gcp <target_account_id/project_id>
set -euo pipefail

CLOUD_PROVIDER="${1:?Usage: cloud-audit.sh <aws/azure/gcp> <target_id>}"
TARGET_ID="${2:?Usage: cloud-audit.sh <aws/azure/gcp> <target_id>}"
OUT_DIR="cloud-audit-output/$CLOUD_PROVIDER/$TARGET_ID/$(date +%Y%m%d)"
mkdir -p "$OUT_DIR"
echo "[*] Starting cloud audit for $CLOUD_PROVIDER target $TARGET_ID"
echo "[*] Output: $OUT_DIR"

case "$CLOUD_PROVIDER" in
    aws)
        echo "[1/2] Running Prowler for AWS..."
        prowler aws -M json -o "$OUT_DIR/prowler-aws.json" 2>/dev/null || true
        echo "[2/2] Running ScoutSuite for AWS..."
        scoutsuite aws --report-dir "$OUT_DIR/scoutsuite-aws" 2>/dev/null || true
        ;;
    azure)
        echo "[1/2] Running Prowler for Azure..."
        prowler azure -M json -o "$OUT_DIR/prowler-azure.json" 2>/dev/null || true
        echo "[2/2] Running ScoutSuite for Azure..."
        scoutsuite azure --report-dir "$OUT_DIR/scoutsuite-azure" 2>/dev/null || true
        ;;
    gcp)
        echo "[1/2] Running Prowler for GCP..."
        prowler gcp -M json -o "$OUT_DIR/prowler-gcp.json" 2>/dev/null || true
        echo "[2/2] Running ScoutSuite for GCP..."
        scoutsuite gcp --report-dir "$OUT_DIR/scoutsuite-gcp" 2>/dev/null || true
        ;;
    *)
        echo "Error: Unsupported cloud provider. Choose aws, azure, or gcp."
        exit 1
        ;;
esac

echo "[*] Cloud audit complete. Results in $OUT_DIR/"
ls -la "$OUT_DIR/"
