---
name: reporting
description: >
  Vulnerability report writing skill for Harbinger's SCRIBE agent. Covers professional
  security report structure, CVSS scoring, impact statements, executive summaries, and
  remediation recommendations. Use when writing bug bounty reports, pentest deliverables,
  vulnerability disclosures, or generating reports from findings directories. Triggers on:
  "write report", "generate report", "bug bounty report", "vulnerability report", "CVSS score",
  "draft disclosure", "run scribe", "format findings", "create pentest report".
---

# Reporting Skill

SCRIBE agent skill — professional vulnerability report generation.

## Auto-Generate Report from Findings

Run `scripts/generate-report.sh <findings_dir> <report_name>`:

```bash
./skills/reporting/scripts/generate-report.sh recon-output/target.com/20240101 "target-com-initial"
```

Output: `reports/target-com-initial_YYYYMMDDHHMMSS.md`

## Report Structure

```markdown
# [Target] Security Assessment — [Date]

## Executive Summary
[2-3 sentences: what was tested, critical findings count, overall risk]

## Findings

### [VULN-001] <Vulnerability Name> — <Severity>
**CVSS:** 9.8 (Critical) — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
**Endpoint:** https://target.com/api/users/{id}
**Impact:** [Business consequence — data exposed, accounts compromised, etc.]

#### Steps to Reproduce
1. ...
2. ...

#### Evidence
[Screenshot / request-response / PoC code]

#### Remediation
[Specific fix — not generic advice]

---
```

## CVSS 3.1 Quick Reference

| Metric | Values |
|--------|--------|
| AV (Attack Vector) | N=Network, A=Adjacent, L=Local, P=Physical |
| AC (Complexity) | L=Low, H=High |
| PR (Privileges) | N=None, L=Low, H=High |
| UI (User Interaction) | N=None, R=Required |
| C/I/A (Impact) | N=None, L=Low, H=High |

Critical ≥ 9.0 · High 7.0-8.9 · Medium 4.0-6.9 · Low 0.1-3.9

## Bug Bounty Platform Templates

- **HackerOne**: Title format `[Asset] Vulnerability Type leads to Impact`
- **Bugcrowd**: Include VRT category in title
- **Intigriti**: CVSS required, include OWASP category

## References

- **Full report structure + impact statements + templates**: See [references/writing-winning-reports.md](references/writing-winning-reports.md)
