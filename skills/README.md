# Harbinger Skills System

Each skill is a self-contained package mapped to an agent. Every skill directory contains:
- `SKILL.md` — frontmatter metadata + workflow instructions
- `references/` — detailed technique docs loaded on demand
- `scripts/` — executable automation scripts

## Skill → Agent Mapping

| Skill | Agent | Focus |
|-------|-------|-------|
| `recon/` | PATHFINDER | Subdomain enum, port scanning, asset discovery |
| `web/` | BREACH | XSS, SQLi, SSRF, API testing, nuclei |
| `cloud/` | PHANTOM | AWS/Azure/GCP audits, IAM escalation, metadata |
| `osint/` | SPECTER | Email enum, person lookup, social footprinting |
| `reporting/` | SCRIBE | Report structure, CVSS, impact statements |
| `binary-re/` | CIPHER | Ghidra/r2 analysis, pwntools exploit dev |

## Directory Structure

```
skills/
├── recon/
│   ├── SKILL.md
│   ├── references/
│   │   ├── subdomain-enumeration.md
│   │   └── port-scanning.md
│   └── scripts/
│       └── recon-full.sh
├── web/
│   ├── SKILL.md
│   ├── references/
│   │   ├── xss.md
│   │   ├── sql-injection.md
│   │   ├── ssrf.md
│   │   └── api-testing.md
│   └── scripts/
│       └── web-scan.sh
├── cloud/
│   ├── SKILL.md
│   ├── references/
│   │   └── aws-misconfig.md
│   └── scripts/
│       └── cloud-audit.sh
├── osint/
│   ├── SKILL.md
│   ├── references/
│   │   └── email-enumeration.md
│   └── scripts/
│       └── osint-person.sh
├── reporting/
│   ├── SKILL.md
│   ├── references/
│   │   └── writing-winning-reports.md
│   └── scripts/
│       └── generate-report.sh
└── binary-re/
    ├── SKILL.md
    ├── references/
    │   ├── ghidra.md
    │   └── exploit-patterns.md
    └── scripts/
        └── analyze-binary.sh
```

## Adding a Custom Skill

1. Create `skills/<skill-name>/SKILL.md` with YAML frontmatter:
   ```yaml
   ---
   name: skill-name
   description: >
     What this skill does and when it triggers.
   ---
   ```
2. Add `references/` for methodology docs
3. Add `scripts/` for automation — make executable with `chmod +x`
4. Reference scripts/references from SKILL.md body
