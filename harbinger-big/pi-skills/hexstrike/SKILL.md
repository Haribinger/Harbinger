---
name: hexstrike
description: Access 150+ security tools (Nuclei, SQLMap, Nikto, etc.) via HexStrike MCP.
---
# HexStrike Security Tools

Harbinger can now use the full HexStrike arsenal.

## Capabilities

- **Vulnerability Scanning**: Nuclei, Nikto, ZAP.
- **Exploitation**: SQLMap, Metasploit.
- **Enumeration**: Dirsearch, Subfinder, Amass.
- **Custom MCP Tools**: Any tool registered in the HexStrike MCP bridge.

## Usage

The agent can call these tools directly to perform bug bounty tasks.

```bash
# Example: Running a Nuclei scan via the skill bridge
node scripts/hexstrike-call.js nuclei -u example.com -t cves/
```

## Security Note

All tool executions are logged and captured as git commits in the agent repository for full auditability.

You are my authorized web app recon assistant  using the HexStrike o ensive security tooling. Target: https://TARGET.com (legally in scope for a bug bounty program). Tasks: 1. Run a read ‑ only  reconnaissance plan: subdomain discovery, HTTP probing, tech ngerprinting, and visual inspection. 2. Use appropriate tools (e.g., Sub nder/Amass for subdomains, HTTPx/WhatWeb for tech, Aquatone or screenshots for visual mapping). 3. Build a table of: host, status code, title, stack/tech, interesting paths, next recon step. 4. Do not run any destructive or exploit ‑ focused tools yet; keep it low ‑ noise and informational only. 5. Stop after the rst pass and summarize top 5 most promising hosts for deeper testing. I want structured web content discovery against https://app.TARGET.com within bug bounty scope. 1. Use directory/endpoint discovery tools (e.g., gobuster, feroxbuster, uf, dirsearch) to map hidden paths, APIs, and panels. 2. Combine that with smart crawling (e.g., Katana/Hakrawler) to extract links, forms, JS les, and parameters. 3. Output a list grouped by category: Auth, admin, debug, backup, API, upload, and con g endpoints. 4. For each interesting endpoint, note: HTTP method(s), auth required?, parameters, and suggested follow ‑ up tests (IDOR, XSS, SSRF, etc.). 5. Respect robots.txt and rate limits and ask me before running any very aggressive wordlists. Focus on parameter and input surface recon for https://app.TARGET.com. 1. From crawled URLs and archives, mine parameters using tools like ParamSpider, X8, GAU/WaybackURLs. 2. Normalize and deduplicate URLs and parameters. 3. Produce a table: endpoint, parameter, source (live/wayback), data type guess, risk (auth, payment, access control, le, redirect, etc.). 4. Suggest which parameters are best candidates for: IDOR / auth bypass XSS / SSTI SQLi / NoSQLi Open redirect / SSRF 5. Do not send any exploit payloads yet; this phase is recon and classi cation only. 6. W A R E  6.1 H -L W R  6.2 C D & C  6.3 P A -S M
