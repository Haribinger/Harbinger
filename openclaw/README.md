# OpenClaw + Harbinger: Voice-Controlled Mission Control

> Tell OpenClaw what to do. Harbinger makes it happen. You watch everything in real-time.

## What This Is

**Harbinger** is your autonomous security swarm — unlimited agents running in Docker, each with real offensive tools, visualized through a dark command center.

**OpenClaw** is your voice commander — the open-source AI agent runtime (215K+ GitHub stars) that translates your spoken commands into Harbinger API calls and shows you what's happening live.

Together, they create a **mission control center** where you:
1. **Speak** naturally ("Scan example.com with PATHFINDER")
2. **Watch** live agent terminals, graphs, and findings appear
3. **Command** entire swarms with a single sentence
4. **Receive** voice reports of what your agents found

---

## Architecture

```
    YOU (Voice / Text / Telegram / WhatsApp / Slack)
         |
    [OpenClaw Gateway]  ←  Node.js runtime + LLM
         |
    [Harbinger API]  ←  Go backend on :8080
         |
    ┌────┴────┐
    │ Agents  │  ←  Docker containers with real tools
    │ (6+)    │     subfinder, nuclei, sqlmap, Ghidra...
    └─────────┘
         |
    [PostgreSQL + Redis + Neo4j]
         |
    [Harbinger Frontend]  ←  React mission control on :5173
```

## Quick Start

### 1. Install OpenClaw (if not already installed)

```bash
# One-liner install (Mac/Linux/Windows WSL2)
curl -fsSL https://openclaw.ai/install.sh  | sh

# Or via npm
npm install -g openclaw

# Or via pnpm
pnpm add -g openclaw

# Verify
openclaw --version
```

### 2. Install Harbinger Integration

```bash
# From the Harbinger root directory
cd /path/to/Harbinger
bash openclaw/scripts/install.sh
```

This script:
- Detects your OpenClaw installation
- Copies Harbinger skills to `~/.openclaw/skills/harbinger/`
- Configures multi-agent routing (one OpenClaw agent per Harbinger agent)
- Sets up the webhook channel for real-time events
- Adds Harbinger API as a known endpoint

### 3. Start Everything

```bash
# Terminal 1: Start Harbinger stack
docker-compose up -d

# Terminal 2: Start OpenClaw gateway
openclaw gateway start

# Terminal 3: Open mission control
open http://localhost:5173/openclaw
```

### 4. Talk to Your Swarm

```
You: "OpenClaw, launch a full recon on example.com"

OpenClaw:
  → POST /api/agents/{pathfinder-id}/spawn
  → Opens browser to http://localhost:5173/agents
  → Polls status every 5 seconds
  → "Found 42 subdomains, 12 live hosts. Should I deploy BREACH?"
```

---

## Voice Command Reference

| You Say | OpenClaw Does |
|---------|---------------|
| "Show me my swarm" | Opens `/agents` page, lists all agents with status |
| "PATHFINDER, scan hackerone.com" | Spawns PATHFINDER container targeting hackerone.com |
| "What did you find?" | Fetches latest jobs/findings, reads results aloud |
| "Test everything for SQLi" | Feeds PATHFINDER results to BREACH with SQLi focus |
| "PHANTOM, check AWS for misconfig" | Spawns PHANTOM with cloud audit parameters |
| "SPECTER, who works at target.com?" | Runs OSINT pipeline on target.com employees |
| "Write up the critical findings" | Triggers SCRIBE to draft platform report |
| "Clean up and standby" | Stops all running agent containers |
| "Show me the attack surface" | Opens workflow graph with discovered assets |
| "How many findings today?" | Queries dashboard stats, reads summary |
| "Deploy full operation on target.com" | Multi-agent orchestration (see below) |

---

## Multi-Agent Orchestration

When you say "Full operation on target.com", OpenClaw runs this pipeline:

```
1. Spawn PATHFINDER → recon (subdomains, ports, services)
   ↓ results
2. Spawn BREACH → web vuln scan on live HTTP targets
   ↓ findings
3. Spawn PHANTOM → cloud asset check (S3, metadata)
   ↓ findings
4. Spawn SPECTER → OSINT on target employees
   ↓ intelligence
5. Spawn SCRIBE → compile all findings into report
   ↓
6. Report ready → PDF + Markdown + platform-ready format
```

OpenClaw handles the orchestration, waits for each phase, feeds results forward, and reports back.

---

## Harbinger API Reference (For OpenClaw Skills)

Base URL: `http://localhost:8080/api`

### Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create new agent |
| GET | `/api/agents/{id}` | Get agent details |
| PATCH | `/api/agents/{id}` | Update agent |
| DELETE | `/api/agents/{id}` | Delete agent |
| POST | `/api/agents/{id}/spawn` | Start agent container |
| POST | `/api/agents/{id}/stop` | Stop agent container |
| GET | `/api/agents/{id}/status` | Get agent + container status |
| GET | `/api/agents/{id}/logs` | Get container logs |
| POST | `/api/agents/{id}/heartbeat` | Send heartbeat |

### Jobs & Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List all jobs |
| POST | `/api/jobs` | Create job for agent |
| PATCH | `/api/jobs/{id}` | Update job status |
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows` | Create workflow |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Agent/job/finding counts |
| GET | `/api/dashboard/activity` | Recent activity feed |
| GET | `/api/dashboard/health` | Service health checks |

### Docker
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/docker/containers` | List all containers |
| GET | `/api/docker/containers/{id}/logs` | Container logs |
| GET | `/api/docker/containers/{id}/stats` | Container resource usage |
| POST | `/api/docker/images/pull` | Pull Docker image |

### OpenClaw Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/openclaw/status` | OpenClaw connection status |
| POST | `/api/openclaw/webhook` | Receive OpenClaw events |
| POST | `/api/openclaw/command` | Execute command from OpenClaw |
| GET | `/api/openclaw/skills` | List available Harbinger skills |

---

## OpenClaw Multi-Agent Configuration

Each Harbinger agent maps to an OpenClaw agent with its own personality:

```json
{
  "agents": {
    "list": [
      {
        "id": "harbinger-commander",
        "name": "Harbinger Commander",
        "model": "claude-opus-4-6",
        "workspace": "~/.openclaw/agents/harbinger-commander",
        "skills": ["harbinger-recon", "harbinger-web-scan", "harbinger-report", "harbinger-orchestrate"]
      },
      {
        "id": "harbinger-pathfinder",
        "name": "PATHFINDER",
        "model": "claude-sonnet-4-6",
        "workspace": "~/.openclaw/agents/harbinger-pathfinder",
        "skills": ["harbinger-recon"]
      },
      {
        "id": "harbinger-breach",
        "name": "BREACH",
        "model": "claude-sonnet-4-6",
        "workspace": "~/.openclaw/agents/harbinger-breach",
        "skills": ["harbinger-web-scan"]
      }
    ]
  }
}
```

---

## Skills

Skills are Markdown instruction files that teach OpenClaw how to interact with Harbinger:

- `recon.skill` — Reconnaissance operations (PATHFINDER)
- `web-scan.skill` — Web vulnerability scanning (BREACH)
- `cloud-audit.skill` — Cloud misconfiguration detection (PHANTOM)
- `osint.skill` — OSINT intelligence gathering (SPECTER)
- `binary-re.skill` — Binary reverse engineering (CIPHER)
- `report.skill` — Report generation (SCRIBE)
- `orchestrate.skill` — Multi-agent orchestration pipeline
- `dashboard.skill` — Dashboard queries and status checks

See `openclaw/skills/` for full skill definitions.

---

## Channels

OpenClaw can receive commands from any supported channel:

- **Voice** — Always-on mic with ElevenLabs TTS (macOS/iOS/Android)
- **Telegram** — `/scan example.com` in your Telegram bot
- **WhatsApp** — Send commands via WhatsApp
- **Slack** — `@harbinger scan example.com` in your workspace
- **Discord** — Bot commands in your server
- **WebChat** — Built-in browser chat at `http://localhost:3007`
- **Harbinger UI** — OpenClaw page at `http://localhost:5173/openclaw`

---

## Design Philosophy

Harbinger follows the **Obsidian Command** design system:

| Element | Value |
|---------|-------|
| Background | `#0a0a0f` |
| Surface | `#0d0d15` |
| Borders | `#1a1a2e` |
| Accent | `#f0c040` (gold) |
| Success | `#22c55e` |
| Danger | `#ef4444` |
| Font | JetBrains Mono, Fira Code |

When OpenClaw opens Harbinger in the browser, it always looks like a professional command center — never like a chatbot.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| OpenClaw can't reach Harbinger | Check `docker-compose up -d` is running, verify `:8080` |
| Voice not working | Install ElevenLabs: `openclaw config set tts.provider elevenlabs` |
| Skills not loading | Run `bash openclaw/scripts/install.sh` again |
| Agent spawn fails | Check Docker socket: `docker ps` should work |
| No findings showing | Agents need targets — provide domain/IP in spawn command |

---

## Links

- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenClaw Docs](https://docs.openclaw.ai)
- [Harbinger GitHub](https://github.com/Haribinger/Harbinger)
- [ClawHub Skills Registry](https://clawhub.dev)
