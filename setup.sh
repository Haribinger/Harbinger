#!/bin/bash

# Harbinger - Professional Bug Bounty Platform Setup Script
# All configuration via wizards — no manual .env editing.

echo "🦞 Starting Harbinger Setup..."

# 1. Install dependencies
echo "[*] Installing project dependencies..."
npm install

# 2. Initialize the agent infrastructure (if needed)
echo "[*] Initializing agent infrastructure..."
node bin/cli.js init --no-managed 2>/dev/null || true

# 3. Create necessary directories
echo "[*] Creating operational directories..."
mkdir -p logs tmp data/reports mcp-plugins/pentagi mcp-plugins/hexstrike

# 4. Link Skills (if pi-skills exists)
if [ -d "pi-skills" ]; then
  echo "[*] Linking security skills..."
  mkdir -p .pi/skills
  ln -sf ../../pi-skills/hexstrike .pi/skills/hexstrike 2>/dev/null || true
  ln -sf ../../pi-skills/pentagi .pi/skills/pentagi 2>/dev/null || true
fi

# 5. Run unified setup wizard (Platform + Agent — user chooses)
echo ""
echo "[*] Launching configuration wizard..."
node bin/cli.js setup

echo ""
echo "✅ Harbinger is ready! Run: docker-compose up -d"
