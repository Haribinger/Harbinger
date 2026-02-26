# Harbinger Skills Inventory

Single reference for all **pi-skills** (executable packages) and **skills** (operation playbooks), and which agents use them.

---

## pi-skills (executable packages)

Live under `pi-skills/`. Declared per-agent in `agents/<agent>/CONFIG.yaml` as `pi_skills: [name]`. Resolve to `pi-skills/<name>/`.

| pi-skill    | Script / entry              | Purpose                              | Agents using it        |
|------------|-----------------------------|--------------------------------------|------------------------|
| **hexstrike** | `scripts/hexstrike-call.js` | Proxy 150+ security tools via HexStrike MCP | recon-scout, web-hacker, cloud-infiltrator, osint-detective, binary-reverser |
| **pentagi**   | `scripts/pentagi-think.js`  | PentAGI next-step reasoning         | cloud-infiltrator       |

**Other pi-skills content (reference only, not runtime scripts):**

| Dir         | Role |
|------------|------|
| `pi-skills/bugbounty/*.MD` | Methodology prompts; overlap with `skills/bugbounty/references/` |
| `pi-skills/utils/*.MD`     | General AI prompts (research, writing) |
| `pi-skills/programming/`   | Project ideas doc |

---

## skills (operation playbooks)

Live under `skills/`. Each has `SKILL.md`, `references/`, `scripts/`. Mapped to agents by role.

| Skill        | Primary agent   | Focus |
|-------------|-----------------|--------|
| **recon/**  | recon-scout     | Subdomain enum, port scan, asset discovery |
| **web/**    | web-hacker      | XSS, SQLi, SSRF, API testing, nuclei |
| **cloud/**  | cloud-infiltrator | AWS/Azure/GCP, IAM, metadata |
| **osint/**  | osint-detective | Email enum, person lookup, dorking |
| **binary-re/** | binary-reverser | Ghidra/r2, exploit dev |
| **reporting/** | report-writer  | Report structure, CVSS, impact |
| **bugbounty/**  | web-hacker, recon-scout | Program finder, vuln detection, dorks |
| **network/**    | recon-scout, cloud-infiltrator | Pivoting, lateral movement |
| **mobile/**     | web-hacker (mobile apps) | APK recon, Frida |
| **fuzzing/**    | web-hacker, binary-reverser | AFL, web fuzzing |
| **crypto/**     | web-hacker, cloud-infiltrator | TLS, JWT |
| **social-engineering/** | osint-detective | Email recon, phishing infra |

---

## Agent → pi_skills + skills (at a glance)

| Agent             | pi_skills              | skills (playbooks)        |
|-------------------|------------------------|---------------------------|
| recon-scout       | hexstrike              | recon, bugbounty, network |
| web-hacker        | hexstrike              | web, bugbounty, mobile, fuzzing, crypto |
| cloud-infiltrator | hexstrike, pentagi     | cloud, network, crypto   |
| osint-detective   | hexstrike              | osint, bugbounty, social-engineering |
| binary-reverser   | hexstrike              | binary-re, fuzzing        |
| report-writer     | —                      | reporting                 |
| browser-agent     | —                      | —                         |

---

## Path reference

- **From repo root:** `pi-skills/<name>/`, `skills/<name>/`
- **From agent dir:** `../../pi-skills/<name>/`, `../../skills/<name>/`
- **In CONFIG.yaml:** only `pi_skills` list; skills are assigned by role (no path in CONFIG).

See also: [agents/README.md](../agents/README.md) (Referencing pi-skills), [skills/README.md](../skills/README.md) (Adding a custom skill).
