#!/usr/bin/env bash
# OSINT investigation on a person/email
# Usage: ./skills/scripts/osint-person.sh "<Person Name>" <email>
set -euo pipefail

PERSON_NAME="${1:?Usage: osint-person.sh \"<Person Name>\" <email>}"
PERSON_EMAIL="${2:?Usage: osint-person.sh \"<Person Name>\" <email>}"
OUT_DIR="osint-output/$(echo "$PERSON_NAME" | tr -s ' ' '_')_$(date +%Y%m%d)"
mkdir -p "$OUT_DIR"
echo "[*] Starting OSINT investigation for $PERSON_NAME ($PERSON_EMAIL)"
echo "[*] Output: $OUT_DIR"

# TheHarvester for email and subdomain discovery
echo "[1/3] Running theHarvester..."
theharvester -d "$(echo $PERSON_EMAIL | cut -d@ -f2)" -l 500 -b google,linkedin -f "$OUT_DIR/theharvester_domain.json" 2>/dev/null || true
theharvester -e "$PERSON_EMAIL" -l 500 -b google,linkedin -f "$OUT_DIR/theharvester_email.json" 2>/dev/null || true

# Ghunt for Google account information (requires setup)
echo "[2/3] Running Ghunt (if configured)..."
# This is a placeholder. Ghunt requires prior setup and authentication.
echo "Ghunt requires manual setup and authentication. Please run separately if needed." > "$OUT_DIR/ghunt-notes.txt"

# Social media lookup (example, often manual or specialized tools)
echo "[3/3] Performing social media lookup..."
# Placeholder for social media tools like Sherlock or custom scripts
echo "Social media lookup often requires specialized tools or manual investigation." > "$OUT_DIR/social-media-notes.txt"

echo "[*] OSINT investigation complete. Results in $OUT_DIR/"
ls -la "$OUT_DIR/"
