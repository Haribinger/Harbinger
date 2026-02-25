# pi-skills — Harbinger Agent Pi-Skills

These are pi-skills for the autonomous Docker agent. Unlike `skills/` (which are agent operation
playbooks), these are **executable skill packages** the agent can call at runtime.

## The 2 Production Pi-Skills

| Skill | Script | Purpose |
|-------|--------|---------|
| `hexstrike/` | `scripts/hexstrike-call.js` | Proxy tool calls to the HexStrike MCP container (150+ security tools) |
| `pentagi/` | `scripts/pentagi-think.js` | Consult the PentAGI autonomous pentesting brain for next-step decisions |

## Usage

```bash
# Call any HexStrike tool (nuclei, sqlmap, subfinder, etc.)
node pi-skills/hexstrike/scripts/hexstrike-call.js nuclei -u https://target.com -t cves/

# Ask PentAGI what to do next
node pi-skills/pentagi/scripts/pentagi-think.js "Found Tomcat 9.0.37 on port 8080"
```

## Environment Variables

| Var | Default | Purpose |
|-----|---------|---------|
| `HEXSTRIKE_API_URL` | `http://hexstrike:3001` | HexStrike container URL |
| `HEXSTRIKE_TIMEOUT` | `120000` | Timeout in ms |
| `PENTAGI_API_URL` | `http://pentagi:3002` | PentAGI container URL |
| `PENTAGI_TIMEOUT` | `60000` | Timeout in ms |

## Other Directories (Not Pi-Skills)

- `bugbounty/` — Agent operation prompts, now consolidated in `skills/bugbounty/references/`
- `utils/` — General-purpose AI prompts, moved to `docs/prompts/general/`
- `programming/` — Project ideas document

Both hexstrike and pentagi require their respective Docker containers to be running.
See `docker-compose.yml` for service definitions.
