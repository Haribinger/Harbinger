---
name: bugbounty
description: >
  Bug bounty operations skill for Harbinger's BREACH and SCRIBE agents. Covers full
  bug bounty workflow — program discovery, scope analysis, targeted recon, vulnerability
  hunting playbooks (Android APK, OSINT file discovery, web app), HackerOne submission
  guidelines, CVSS triage, and Google dork generation. Use when starting a new bug bounty
  engagement, finding programs, triaging targets, generating dorks, or submitting reports.
  Triggers on: "bug bounty", "find programs", "HackerOne", "Bugcrowd", "scope analysis",
  "bug hunt", "triage target", "submit report", "dork program", "start bounty".
---

# Bug Bounty Skill

BREACH + SCRIBE agent skill — end-to-end bug bounty operations.

## Engagement Start Checklist

```
1. □ Find program (H1/Bugcrowd/Intigriti — see references/program-finder.md)
2. □ Read scope rules (in-scope assets, excluded paths, allowed techniques)
3. □ Note payout table (what pays most: RCE > SQLi > SSRF > XSS > IDOR > Info Disclosure)
4. □ Check existing reports (HackerOne Hacktivity for known bugs on same target)
5. □ Passive recon only first (subfinder, cert transparency, Wayback, Shodan)
6. □ Map tech stack before touching anything (httpx --tech-detect)
```

## High-Value Target Identification

```bash
# Find new programs with good scope
# See references/google-dorks.md for full dork list
"bug bounty" site:hackerone.com intext:"all subdomains"
"responsible disclosure" site:company.com

# Shef Shodan Facets — find exposed admin panels, legacy systems and low hanging fruit staying in scope 
Flags
```
 -q    : search query (required)
  -f    : facet type (default: ip)
  -list : list all facet types
  -json : stdout in JSON format
  -h    : show help message
```
# get specific target's IPs and take web screenshots then view the images in terminal
shef -q org:tesla -f ip | sed 's/^/http:\/\//' | klik && yazi screenshots
klik yazi


# get related/own domains of the query, sometime it exposes internal portals (they shouldn't be same root domain)
shef -q hackerone.com -f domain # chain it with amass for getting more wide attack surfaces

# same for ports
shef -q hackerone.com -f port

# gets asn number(s) of the query then asn lookup with asnmap
asnmap -asn $(shef -q hackerone.com -f asn) # loop it if multiple asn numbers gets as shef's result
asnmap

https://github.com/dootss/shodan-dorks

# gets relative domains and probe {title, IP, status code} then filter non 403 only (sometime, it shows real IPs, non WAF areas)
shef -q hackerone -f domain | httpx -sc -ip -title -silent | grep -vE '403|Cloudflare|Access Denied|Not Allowed'
httpx


# find known vulnerabilities of a product
shef -q "product:jboss" -f vuln


If you see no results or errors
verfiy your query
check your internet connection
use -h for guidance

shef -q "product:MySQL"

shef -q "Org:TargetCorp" --fields ip_str,port,transport,product

shef -q "Org:TargetCorp" 

https://dorkfinder.com/
https://aofirs.org/articles/complete-google-dorks-list-database-guide-2025/
dork google or duckduckgo without getting detected

# Ip scan
nrich ip
```

## Attack Priority Matrix

| Vuln Class | Expected Payout | Discovery Approach |
|-----------|----------------|-------------------|
| RCE / SSTI | $5k-$50k | Template engines, upload endpoints, deserialization |
| SQLi (exfil) | $3k-$25k | Every parameter through sqlmap, error-based probing |
| SSRF (cloud) | $2k-$20k | URL params → internal metadata APIs |
| Auth bypass | $2k-$15k | JWT attacks, password reset flows, MFA bypass |
| IDOR (sensitive data) | $1k-$10k | UUID/sequential ID on all resources |
| XSS (stored) | $500-$5k | All user-controllable output back to admins |
| Open redirect | $100-$500 | ?redirect=, ?url=, ?next= params |

## Quick Win Scripts

```bash
# Run full recon → hand to web skill
./skills/recon/scripts/recon-full.sh target.com

# Scan for known CVEs first (fastest path to bounty)
nuclei -u https://target.com -tags cve,default-login,exposed-panels -o cve-hits.txt

# Find IDOR surface immediately
ffuf -u "https://target.com/api/v1/users/FUZZ" -w ids.txt -mc 200 -o idor-test.txt
```

## References

- **HackerOne submission guide**: See [references/hackerone-guide.md](references/hackerone-guide.md)
- **Google dork generation**: See [references/google-dorks.md](references/google-dorks.md)
- **Program finder strategy**: See [references/program-finder.md](references/program-finder.md)
- **OSINT file discovery**: See [references/osint-file-discovery.md](references/osint-file-discovery.md)
- **Android APK analysis**: See [references/android-apk-analyzer.md](references/android-apk-analyzer.md)
- **Code security analysis (Groovy/Java)**: See [references/code-security-analysis.md](references/code-security-analysis.md)
- **HexStrike AI vuln detection plan**: See [references/hexstrike-vuln-detection.md](references/hexstrike-vuln-detection.md)
- **Bug bounty roadmap**: See [references/roadmap.md](references/roadmap.md)
