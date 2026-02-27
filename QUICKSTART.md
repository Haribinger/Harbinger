# Harbinger Quickstart — Up and Running in 5 Minutes

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker + Compose | v2.20+ | [docker.com](https://docs.docker.com/get-docker/) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 9+ | `npm i -g pnpm` |
| Git | any | [git-scm.com](https://git-scm.com/) |

**Hardware:** 4 CPU cores, 8 GB RAM, 20 GB disk minimum.

---

## Step 1: Clone and Configure

```bash
git clone https://github.com/Haribinger/Harbinger.git
cd harbinger
cp .env.example .env
```

Edit `.env` with your GitHub OAuth credentials:

```env
GITHUB_CLIENT_ID=your_id_here
GITHUB_CLIENT_SECRET=your_secret_here
JWT_SECRET=$(openssl rand -base64 32)
```

> **No GitHub OAuth?** Skip it — use Token auth with a GitHub PAT instead.

## Step 2: Start Services

```bash
docker compose up --build -d
```

This starts: PostgreSQL, Redis, Neo4j, Go backend, React frontend, Nginx proxy.

Verify everything is running:

```bash
docker compose ps
curl http://localhost/health
```

## Step 3: Sign In

Open **http://localhost** in your browser.

Three sign-in options:
- **OAuth** — Click "Continue with GitHub" (requires OAuth app setup)
- **Device Flow** — Scan QR code on github.com/login/device
- **Token** — Paste a GitHub PAT directly
- **API Key** — Validate an OpenAI/Anthropic/Groq key

## Step 4: Spawn Your First Agent

1. Navigate to **Agents** from the sidebar
2. Click **"+ New Agent"**
3. Select **PATHFINDER** (Recon Scout) template
4. Click **"Spawn"** to start the Docker container
5. Watch the live status in the Dashboard

## Step 5: Run Your First Scan

1. Go to **Command Center**
2. Click **RECON SCAN** in Quick Ops
3. Enter a target domain
4. Watch PATHFINDER enumerate subdomains, ports, and services

---

## Local Development (No Docker)

For live-reload development:

```bash
# Terminal 1: Backend
cd backend && go run ./cmd/

# Terminal 2: Frontend
pnpm install && pnpm dev
```

Frontend runs on `:3000`, proxies `/api` to backend on `:8080`.

Build for production:

```bash
pnpm build:ui
```

---

## What's Next?

| Goal | Where |
|------|-------|
| Understand the architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Create a custom agent | [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md) |
| Build visual workflows | [docs/WORKFLOW_GUIDE.md](docs/WORKFLOW_GUIDE.md) |
| Configure Discord/Telegram/Slack | Settings > Channels |
| Set up AI providers | Settings > Providers |
| Browse security tools | MCP Tools page |
| Track vulnerabilities | Scope Manager + Remediation pages |
| Monitor code health | Code Health page |

---

## Troubleshooting

**"Port already in use"**
```bash
fuser -k 8080/tcp   # Kill backend port
fuser -k 3000/tcp   # Kill frontend port
```

**Database connection errors**
```bash
docker compose down -v && docker compose up -d postgres redis neo4j
```

**Frontend not updating**
```bash
pnpm build:ui   # NOT pnpm build
docker compose restart frontend nginx
```

**pnpm not found**
```bash
npm i -g pnpm@9
```
