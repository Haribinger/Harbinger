#!/usr/bin/env bash
# Harbinger One-Command Installer
set -euo pipefail

echo "Installing Harbinger..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker required. Install: https://docs.docker.com/get-docker/"; exit 1; }
command -v docker compose >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose required."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "Git required."; exit 1; }

# Clone if not already in repo
if [ ! -f "docker-compose.yml" ]; then
  git clone https://github.com/Haribinger/Harbinger.git
  cd Harbinger
fi

# Setup env
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "Created .env from template. Edit with your settings or use the setup wizard."
fi

# Create Docker network
docker network create harbinger-net 2>/dev/null || true

# Build and start
docker compose up -d --build

echo ""
echo "Harbinger is starting up!"
echo "Open http://localhost:3000 in your browser"
echo "The setup wizard will guide you through configuration."
echo ""
echo "Useful commands:"
echo "  docker compose logs -f          # View logs"
echo "  docker compose down             # Stop"
echo "  docker compose up -d            # Start"
echo "  ./scripts/harbinger-sync.sh     # Sync with remote"
