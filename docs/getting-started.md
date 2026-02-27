# Getting Started with Harbinger

This guide gets you from zero to a running **Harbinger command center**: sign in, spawn agents, run a scan or workflow, and optionally connect Discord, Telegram, or OpenClaw.

**Short on time?** Use **[QUICKSTART.md](../QUICKSTART.md)** for a minimal 5-minute path. This page adds context, two run paths (Docker vs local dev), first steps in the UI, and troubleshooting.  
**All docs:** [docs/README.md](README.md) (index).

---

## What you'll have when you're done

- **Command center** at `http://localhost` (or your host)
- **Signed in** via GitHub (OAuth, Device Flow, or PAT) or API key
- **First agent** (e.g. PATHFINDER) spawned and visible on the Dashboard
- **First action** — recon scan, chat, or a visual workflow — run from the UI

---

## Prerequisites

| Requirement | Version / notes | Install |
|-------------|------------------|---------|
| **Docker + Compose** | v2.20+ | [docker.com](https://docs.docker.com/get-docker/) |
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org/) |
| **pnpm** | 9+ (project uses pnpm, not npm/yarn) | `npm i -g pnpm` |
| **Git** | any | [git-scm.com](https://git-scm.com/) |

**Hardware:** 4 CPU cores, 8 GB RAM, 20 GB disk minimum for full stack.

**Optional (for auth):**

- **GitHub OAuth app** — if you want "Continue with GitHub" (create at [GitHub Developer Settings](https://github.com/settings/developers)).
- **GitHub PAT** — for Device Flow or Token tab (no OAuth app needed).

---

## Path A — Quick start with Docker (recommended)

Best for: first run, demos, and production-like setup. All services (PostgreSQL, Redis, Neo4j, Go backend, React frontend, Nginx) run in containers.

### 1. Clone and configure

```bash
git clone https://github.com/Haribinger/Harbinger.git
cd Harbinger
cp .env.example .env
```

Edit `.env` with at least:

```env
# Required for JWT signing (generate a random value)
JWT_SECRET=$(openssl rand -base64 32)

# Optional: GitHub OAuth (if you use "Continue with GitHub")
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

If you skip OAuth, you can still sign in via **Device Flow** or **Token** (GitHub PAT) on the login page.

### 2. Start the stack

```bash
docker compose up --build -d
```

This starts: PostgreSQL, Redis, Neo4j, Go backend, React frontend, Nginx proxy.

**Verify:**

```bash
docker compose ps
curl http://localhost/health
```

You should see `{"ok":true}` or similar from `/health`.

### 3. Open the app and sign in

Open **http://localhost** in your browser.

**Login options:**

| Method | When to use |
|--------|-------------|
| **OAuth** | You created a GitHub OAuth app and set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`. |
| **Device Flow** | No OAuth app; you scan a QR code on [github.com/login/device](https://github.com/login/device) and authorize. |
| **Token** | You paste a GitHub PAT; no callback URL needed. |
| **API Key** | You validate an OpenAI/Anthropic/Groq key (for provider setup; auth can still be GitHub). |

After sign-in you land on the **Dashboard**.

### 4. Spawn your first agent

1. Click **Agents** in the sidebar.
2. Click **"+ New Agent"** (or pick an existing template).
3. Select **PATHFINDER** (Recon Scout).
4. Click **Spawn** to start the agent container.
5. Check the Dashboard or Agents list for live status.

### 5. Run your first scan

1. Go to **Command Center**.
2. In Quick Ops, click **RECON SCAN**.
3. Enter a target domain (e.g. a scope you’re allowed to test).
4. Watch PATHFINDER (or the assigned agent) run subdomain enum, ports, and services.

---

## Path B — Local development (no Docker)

Best for: frontend/backend development with live reload. You run the Go backend and Vite frontend locally; databases can still run in Docker.

### 1. Clone and install

```bash
git clone https://github.com/Haribinger/Harbinger.git
cd Harbinger
cp .env.example .env
pnpm install
```

Edit `.env` as in Path A (at least `JWT_SECRET`).

### 2. Start databases (optional but recommended)

```bash
docker compose up -d postgres redis neo4j
```

If you skip this, the backend will run in a degraded mode (in-memory only where applicable).

### 3. Run backend and frontend

**Terminal 1 — Backend:**

```bash
cd backend && go run ./cmd/
```

Backend listens on **:8080**.

**Terminal 2 — Frontend:**

```bash
pnpm dev
```

Frontend runs on **:5173** (Vite) and proxies `/api` and `/health` to the backend. Open **http://localhost:5173** to use the app.

### 4. Sign in and use the app

Same as Path A steps 3–5: open the URL, sign in (Device Flow or Token is easiest without OAuth), spawn an agent, run a scan.

**Production build (frontend):**

```bash
pnpm build:ui
```

---

## First steps in the UI

Once you’re in, these are the main surfaces:

| Where | What to do |
|-------|------------|
| **Dashboard** | Overview, agent roster strip, Quick Ops, service health, Bounty Hub strip. |
| **Agents** | Create, spawn, stop, clone agents; view logs and status. |
| **Command Center** | Workspace tabs (chat, terminal, browser, logs); RECON SCAN, SPAWN AGENT, WEB ATTACK, etc. |
| **Chat** | Pick an agent and send messages (streaming); session list. |
| **Workflows** | List and open workflows; **Workflow Editor** for drag-and-drop pipelines. |
| **MCP Tools** | Browse and manage MCP servers (HexStrike, PentAGI, etc.). |
| **Docker** | Container list, start/stop, logs. |
| **Settings** | Providers (AI keys), Channels (Discord, Telegram, Slack), Secrets, theme. |

---

## Optional: Channels and OpenClaw

- **Channels** — In **Settings → Channels** you can configure Discord, Telegram, and Slack (tokens, webhooks). Agents can relay findings and you can receive commands from those platforms. See **[CHANNELS.md](CHANNELS.md)**.
- **OpenClaw** — Voice and text command layer that talks to Harbinger’s API. Install OpenClaw separately and point it at your backend. See **[openclaw/README.md](../openclaw/README.md)** and the **OpenClaw** page in the app.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| **Port already in use** | `fuser -k 8080/tcp` (backend) or `fuser -k 5173/tcp` (Vite). On Windows use `netstat` and stop the process. |
| **Database connection errors** | `docker compose down -v && docker compose up -d postgres redis neo4j` then restart backend. |
| **Frontend not updating (Docker)** | Rebuild: `pnpm build:ui` then `docker compose restart frontend nginx`. Use `pnpm build:ui`, not `pnpm build`. |
| **pnpm not found** | `npm i -g pnpm@9` (or pnpm 10; project uses pnpm-lock.yaml). |
| **Login fails / 401** | Ensure `JWT_SECRET` is set in `.env`. For OAuth, check `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` and callback URL. |
| **Agent won’t spawn** | Check Docker is running and the agent image exists. See **Agents** page and **Docker** page for errors. |
| **API 404** | Ensure you’re using the correct base URL (e.g. Vite proxy to `:8080` in dev; Nginx in Docker). |

More debug steps: **[skills/claude-skills/harbinger-bugfix/references/debug-workflow.md](../skills/claude-skills/harbinger-bugfix/references/debug-workflow.md)** and **[common-errors.md](../skills/claude-skills/harbinger-bugfix/references/common-errors.md)**.

---

## What’s next?

| Goal | Doc or place |
|------|----------------|
| **Architecture** | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| **Agents** | [AGENT_GUIDE.md](AGENT_GUIDE.md) |
| **Roadmap** | [ROADMAP.md](ROADMAP.md) |
| **Channels** | [CHANNELS.md](CHANNELS.md) |
| **Chat & integrations** | [CHAT_INTEGRATIONS_AND_ENHANCEMENTS.md](CHAT_INTEGRATIONS_AND_ENHANCEMENTS.md) |
| **Red team** | [RED_TEAM_GUIDE.md](RED_TEAM_GUIDE.md) |
| **Tools** | [TOOL_INTEGRATIONS.md](TOOL_INTEGRATIONS.md), [TOOLS_GUIDE.md](TOOLS_GUIDE.md) |
| **Improvement tasks** | [DETAILED_IMPROVEMENT_STEPS.md](DETAILED_IMPROVEMENT_STEPS.md) |

In the app: **Settings → Providers** (AI keys), **Settings → Channels** (Discord/Telegram/Slack), **Skills Hub**, **Scope Manager**, **Remediation Tracker**, **Code Health**.

---

## Alternative: Scaffolded project (npx harbinger init)

If you are using the **Harbinger npm package** to scaffold a **separate** Next.js + Docker Agent project (event handler, job branches, GitHub Actions, Telegram bot), that flow is different from running this repo as the command center:

1. **Scaffold:** `mkdir my-project && cd my-project && npx harbinger@latest init`
2. **Setup:** `npm run setup` (wizard: GitHub repo, secrets, API keys, `.env`)
3. **Run:** `docker compose up -d`

That setup uses an **Event Handler** (Next.js) and a **Docker Agent** that runs Pi/jobs and opens PRs. Documentation for that flow lives in the package and in scaffolded projects (e.g. `config/EVENT_HANDLER.md`, `bugs/CLAUDE.md`). This **Getting Started** guide is for the **Harbinger framework repo** (the command center you cloned), not for the scaffolded project.

---

**Last updated:** 2026-02-26
