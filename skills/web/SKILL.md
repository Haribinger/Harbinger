---
name: web
description: >
  Web application hacking skill for Harbinger's BREACH agent. Covers XSS, SQL injection,
  SSRF, API testing (BOLA/IDOR, GraphQL, rate limiting), nuclei scanning, dalfox, and sqlmap.
  Use when attacking web apps, testing APIs, hunting for injection vulns, probing for SSRF,
  or running automated web vulnerability scans. Triggers on: "scan web app", "test for XSS",
  "SQL injection", "SSRF", "API testing", "BOLA", "IDOR", "GraphQL security", "run breach",
  "web vuln scan", "dalfox", "nuclei scan".
---

# Web Skill

BREACH agent skill — web application vulnerability discovery and exploitation.

## Automated Scan Pipeline

Run `scripts/web-scan.sh <targets.txt>` for nuclei + dalfox pipeline.

Results in `webscan-output/<name>_YYYYMMDD/`.

## Quick Attack Commands

```bash
# Nuclei — critical/high severity
nuclei -l targets.txt -severity critical,high -t ~/nuclei-templates -o nuclei-out.txt

# Dalfox — XSS hunting
cat urls.txt | dalfox pipe -o xss-out.txt
dalfox url "https://target.com/search?q=FUZZ" -o xss.txt

# SQLMap — injection
sqlmap -u "https://target.com/page?id=1" --batch --dbs
sqlmap -u "https://target.com/page?id=1" -D dbname --tables

# FFUF — endpoint discovery
ffuf -u "https://target.com/FUZZ" -w ~/wordlists/api-endpoints.txt -mc 200,301,302,403

# Recx — request manipulation (Harbinger tool)
recx -u "https://target.com" -headers "Authorization: Bearer TOKEN"
```

## References

- **XSS (reflected, stored, DOM + filter bypass)**: See [references/xss.md](references/xss.md)
- **SQL Injection (types + WAF bypass)**: See [references/sql-injection.md](references/sql-injection.md)
- **SSRF (cloud metadata, DNS rebinding)**: See [references/ssrf.md](references/ssrf.md)
- **API Testing (BOLA/IDOR, GraphQL, rate limits)**: See [references/api-testing.md](references/api-testing.md)

## Priority Vuln Classes

| Class | Severity | Tool |
|-------|----------|------|
| IDOR/BOLA | Critical | Manual + recx |
| SQLi | Critical | sqlmap |
| SSRF (cloud) | Critical | Manual |
| Stored XSS | High | dalfox |
| Auth bypass | High | ffuf + manual |
| Open redirect | Medium | nuclei |
