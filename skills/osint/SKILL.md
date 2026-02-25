---
name: osint
description: >
  Open-source intelligence (OSINT) skill for Harbinger's SPECTER agent. Covers email
  enumeration, person investigations, breach checking, social media footprinting, and domain
  OSINT using theHarvester, Sherlock, SpiderFoot, Ghunt, and Hunter.io. Use when building a
  target profile, enumerating emails, checking breaches, finding social accounts, or mapping
  organizational structure. Triggers on: "OSINT", "email enum", "person lookup", "social media
  footprint", "breach check", "theHarvester", "Sherlock", "run specter", "who is this person".
---

# OSINT Skill

SPECTER agent skill — human and organizational intelligence gathering.

## Automated Person Investigation

Run `scripts/osint-person.sh "<Full Name>" <email>` for theHarvester + social media pipeline.

Results in `osint-output/<Name>_YYYYMMDD/`.

## Quick Commands

```bash
# theHarvester — email + subdomain discovery from a domain
theharvester -d target.com -l 500 -b google,linkedin,hunter -f output/harvest.json

# Sherlock — username across 300+ platforms
sherlock username --output sherlock-results.txt

# SpiderFoot — full OSINT automation
sfcli.py -s target.com -m sfp_email,sfp_linkedin,sfp_twitter -o output/

# Hunter.io — email pattern discovery (requires API key)
curl "https://api.hunter.io/v2/domain-search?domain=target.com&api_key=$HUNTER_API_KEY"

# Have I Been Pwned (requires API key)
curl -H "hibp-api-key: $HIBP_API_KEY" "https://haveibeenpwned.com/api/v3/breachedaccount/user@target.com"

# Ghunt — Google account OSINT (requires prior setup)
ghunt email user@gmail.com
```

## OSINT Target Profile Template

When building a target profile, collect:
1. Email addresses (theHarvester, Hunter.io)
2. Social accounts (Sherlock, manual)
3. Breach history (HIBP, DeHashed)
4. Domain/subdomain map (subfinder + theharvester)
5. Employees + org structure (LinkedIn, Hunter.io)
6. Public credentials (GitHub dorks, Pastebin)

## GitHub Dork Examples

```
org:targetorg password OR secret OR api_key
site:github.com "target.com" "api_key"
filename:.env "target.com"
```

## References

- **Email enumeration methodology**: See [references/email-enumeration.md](references/email-enumeration.md)
