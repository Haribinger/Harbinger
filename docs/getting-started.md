# Getting Started with Harbinger

## Overview

Harbinger is a bug bounty hunting platform with autonomous AI agents. It uses a **two-layer architecture**:

1. **Event Handler** (Next.js) - Web interface, API, cron jobs, Telegram bot
2. **Docker Agent** - Autonomous Pi coding agent that executes tasks

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌─────────────────┐         ┌─────────────────┐                    │
│  │  Event Handler  │ ──1──►  │     GitHub      │                    │
│  │  (creates job)  │         │ (job/* branch)  │                    │
│  └────────▲────────┘         └────────┬────────┘                    │
│           │                           │                             │
│           │                           2 (triggers run-job.yml)      │
│           │                           │                             │
│           │                           ▼                             │
│           │                  ┌─────────────────┐                    │
│           │                  │  Docker Agent   │                    │
│           │                  │  (runs Pi, PRs) │                    │
│           │                  └────────┬────────┘                    │
│           │                           │                             │
│           │                           3 (creates PR)              │
│           │                           │                             │
│           │                           ▼                             │
│           │                  ┌─────────────────┐                    │
│           │                  │     GitHub      │                    │
│           │                  │   (PR opened)   │                    │
│           │                  └────────┬────────┘                    │
│           │                           │                             │
│           │                           4a (auto-merge.yml)         │
│           │                           4b (rebuild-event-handler.yml)│
│           │                           │                             │
│           5 (notify-pr-complete.yml / │                             │
│           │  notify-job-failed.yml)  │                             │
│           └───────────────────────────┘                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

You interact with Harbinger via the **web chat interface** or **Telegram** (optional).

## Prerequisites

| Requirement | Install |
|-------------|---------|
| Node.js 18+ | [nodejs.org](https://nodejs.org) |
| npm | Included with Node.js |
| Git | [git-scm.com](https://git-scm.com) |
| GitHub CLI | [cli.github.com](https://cli.github.com) |
| Docker + Docker Compose | [docker.com](https://docker.com) (installer requires admin password) |
| ngrok* | [ngrok.com](https://ngrok.com) (free account + authtoken required) |

*ngrok is only required for local installs without port forwarding. VPS/cloud deployments don't need it.

## Three Steps

### Step 1 — Scaffold a new project

```bash
mkdir my-bugbounty-platform && cd my-bugbounty-platform
npx harbinger@latest init
```

This creates a Next.js project with configuration files, GitHub Actions workflows, and agent templates.

### Step 2 — Run the setup wizard

```bash
npm run setup
```

The wizard walks you through:

- Checks prerequisites (Node.js, Git, GitHub CLI)
- Creates a GitHub repository and pushes your initial commit
- Creates a GitHub Personal Access Token (scoped to your repo)
- Collects API keys (Anthropic required; OpenAI, Brave optional)
- Sets GitHub repository secrets and variables
- Generates `.env`
- Builds the project

### Step 3 — Start your platform

```bash
docker compose up -d
```

**Web Chat**: Visit your `APP_URL` to chat with your agent, create jobs, upload files
**Telegram** (optional): Run `npm run setup-telegram` to connect a Telegram bot
**Webhook**: Send a POST to `/api/create-job` with your API key to create jobs programmatically
**Cron**: Edit `config/CRONS.json` to schedule recurring jobs

## Local Development

Your server needs to be reachable from the internet for GitHub webhooks and Telegram.

- **VPS/Cloud**: Your `APP_URL` is just your domain
- **Local**: Use ngrok (`ngrok http 80`) or port forwarding

If your ngrok URL changes (it changes every time you restart ngrok on the free plan), update it everywhere:

```bash
# Update .env and GitHub variable in one command:
npx harbinger set-var APP_URL https://your-new-url.ngrok.io

# If Telegram is configured, re-register the webhook:
npm run setup-telegram
```

## Manual Updating

### 1. Update the package

```bash
npm install harbinger@latest
```

### 2. Scaffold and update templates

```bash
npx harbinger init
```

For most people, that's it — init handles everything. It updates your project files, runs `npm install`, and updates `HARBINGER_VERSION` in your local `.env`.

### 3. Rebuild for local dev

```bash
npm run build
```

### 4. Commit and push

```bash
git add -A && git commit -m "upgrade harbinger to vX.X.X"
git push
```

Pushing to main triggers the `rebuild-event-handler.yml` workflow on your server. It detects the version change, runs `harbinger init`, updates `HARBINGER_VERSION` in the server's `.env`, pulls the new Docker image, restarts the container, rebuilds `.next`, and reloads PM2.

## Understanding init

### How your project is structured

When you ran `harbinger init` the first time, it scaffolded a project folder with two kinds of files:

**Your files** — These are yours to customize. `init` will never overwrite them:

| Files | What they do |
|-------|--------------|
| `config/SOUL.md`, `EVENT_HANDLER.md`, `AGENT.md`, etc. | Your agent's personality, behavior, and prompts |
| `config/CRONS.json`, `TRIGGERS.json` | Your scheduled jobs and webhook triggers |
| `app/` | Next.js pages and UI components |
| `docker/job/` | The Dockerfile for your agent's job container |

**Managed files** — These are infrastructure files that need to stay in sync with the package version. `init` auto-updates them:

| Files | What they do |
|-------|--------------|
| `.github/workflows/` | GitHub Actions that run jobs, auto-merge PRs, rebuild on deploy |
| `docker-compose.yml` | Defines how your containers run together |
| `docker/event-handler/` | The Dockerfile for the event handler container |
| `.dockerignore` | Keeps unnecessary files out of Docker builds |

### What happens when you run init

- **Managed files** are updated automatically to match the new package version
- **Your files** are left alone — but if the package ships new defaults, init lets you know:

```
Updated templates available:
These files differ from the current package templates.

  config/CRONS.json

To view differences:  npx harbinger diff <file>
To reset to default:  npx harbinger reset <file>
```

### If you've modified managed files

If you've made custom changes to managed files, use `--no-managed` so init doesn't overwrite them:

```bash
npx harbinger init --no-managed
```

## CLI Commands

All commands are run via `npx harbinger <command>` (or the `npm run` shortcuts where noted).

### Project setup

| Command | Description |
|---------|-------------|
| `init` | Scaffold a new project, or update templates |
| `setup` | Run the full interactive setup wizard (`npm run setup`) |
| `setup-telegram` | Reconfigure Telegram webhook (`npm run setup-telegram`) |
| `reset-auth` | Regenerate AUTH_SECRET, invalidating all sessions |

### Templates

| Command | Description |
|---------|-------------|
| `diff [file]` | List files that differ from templates, or diff a specific file |
| `reset [file]` | List all template files, or restore a specific one |

### Secrets & variables

| Command | Description |
|---------|-------------|
| `set-agent-secret KEY [VALUE]` | Set `AGENT_<KEY>` GitHub secret and update `.env` |
| `set-agent-llm-secret KEY [VALUE]` | Set `AGENT_LLM_<KEY>` GitHub secret |
| `set-var KEY [VALUE]` | Set a GitHub repository variable |

**Secret prefixes:**
- `AGENT_*` — Protected secrets passed to Docker container (filtered from LLM)
- `AGENT_LLM_*` — LLM-accessible secrets (not filtered)
- No prefix — Workflow-only secrets, never passed to container
