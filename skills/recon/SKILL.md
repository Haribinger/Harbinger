---
name: recon
description: >
  Reconnaissance skill for Harbinger's PATHFINDER agent. Covers subdomain enumeration,
  DNS resolution, HTTP probing, and port scanning using subfinder, dnsx, httpx, naabu, masscan,
  and nmap. Use when performing initial target reconnaissance, asset discovery, scope expansion,
  or running the full recon pipeline on a domain. Triggers on requests like "recon target.com",
  "find subdomains", "enumerate assets", "port scan", "scope this target", or "run pathfinder".
---

# Recon Skill

PATHFINDER agent skill — asset discovery and surface mapping.

## Full Recon Pipeline

Run `scripts/recon-full.sh <domain>` for the complete pipeline:
subfinder → dnsx → httpx → naabu → nuclei (info/low pass)

Results land in `recon-output/<domain>/YYYYMMDD/`.

## Step-by-Step

```bash
# 1. Passive subdomain discovery
subfinder -d target.com -silent -all -recursive -o subdomains.txt

# 2. Resolve which subdomains are alive
dnsx -l subdomains.txt -silent -a -resp -o resolved.txt

# 3. HTTP probe — title, status, tech stack
httpx -l resolved.txt -silent -status-code -title -tech-detect -web-server -o live-hosts.txt

# 4. Port scan live hosts
naabu -list resolved.txt -silent -top-ports 1000 -o ports.txt

# 5. Initial vuln scan (non-intrusive)
nuclei -l live-hosts.txt -severity info,low -silent -o nuclei-initial.txt
```

## References

- **Subdomain enumeration methodology**: See [references/subdomain-enumeration.md](references/subdomain-enumeration.md)
- **Port scanning strategies**: See [references/port-scanning.md](references/port-scanning.md)

## Key Flags

| Tool | Useful Flags |
|------|-------------|
| subfinder | `-all` (all sources), `-recursive`, `-silent`, `-duc` (dedup) |
| dnsx | `-a -aaaa -cname -mx`, `-resp` (show IP) |
| httpx | `-tech-detect`, `-web-server`, `-follow-redirects`, `-screenshot` |
| naabu | `-p -` (all ports), `-rate 1000`, `-exclude-cdn` |
| nuclei | `-t ~/nuclei-templates`, `-tags cve,misconfig` |
