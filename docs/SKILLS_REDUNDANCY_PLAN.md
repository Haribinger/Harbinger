# Plan: Skills for Redundant Commands

## Problem

Multiple agents invoke the same tools (e.g. `nuclei`, `httpx`, `subfinder`) with similar or duplicate flags. That causes:

- **Drift:** One agent gets updated flags, another doesn’t.
- **Inconsistency:** Same tool, different defaults per agent.
- **Maintenance:** Fixes and improvements must be applied in several places.

## Goal

Introduce **shared command/skill definitions** so a single source of truth drives tool invocations across agents. Redundant per-agent command blocks get replaced by references to these shared skills.

---

## 1. Identify redundant commands

Commands that appear in more than one agent (TOOLS.md, scripts, or pi-skills):

| Command / family | Typical use | Agents today |
|------------------|------------|--------------|
| subfinder        | Subdomain enum | recon-scout, (web-hacker via hexstrike) |
| httpx            | HTTP probe, title/tech | recon-scout, web-hacker |
| naabu            | Port scan  | recon-scout |
| nuclei           | Vuln scan  | recon-scout, web-hacker |
| dnsx             | DNS resolve | recon-scout, osint-detective |
| sqlmap           | SQLi       | web-hacker |
| ffuf / feroxbuster | Fuzzing   | web-hacker |
| dalfox           | XSS        | web-hacker |
| gau / waybackurls | URL discovery | recon-scout, web-hacker |
| amass            | Subdomain / intel | recon-scout, osint-detective |

**Redundancy:** Same tool names and often similar flags in `agents/*/TOOLS.md`, `skills/*/scripts/*.sh`, and pi-skills (hexstrike-call.js). No single canonical “nuclei for recon” vs “nuclei for web” definition.

---

## 2. Single source of truth: where to define

**Option A — `skills/common/` (recommended)**  
- Add `skills/common/` with one subdir per **command family** (e.g. `nuclei`, `httpx`, `subfinder`).  
- Each has:
  - `SKILL.md` — short description + **canonical usage** (flags, env, examples).
  - `references/defaults.md` — recommended flags per context (recon vs web vs fast).
  - Optional `scripts/run-<tool>.sh` that wraps the tool with those defaults.
- Agents and other skills **reference** these (e.g. “use `skills/common/nuclei`”) instead of pasting their own one-off invocations.

**Option B — pi-skills command layer**  
- Add e.g. `pi-skills/commands/` with small wrappers (e.g. `run-nuclei.js`) that call hexstrike (or local binary) with a **named profile** (recon / web / quick).  
- Agents and skills call the wrapper with profile name instead of raw flags.  
- Keeps “canonical flags” in one place (the wrapper or a small config next to it).

**Option C — Hybrid**  
- **skills/common/** = human-readable canonical docs and recommended flags (SKILL.md + references).  
- **pi-skills/commands/** (or scripts in skills/common) = executable wrappers that read those defaults and invoke the tool.  
- Agents use the wrappers where automation exists; otherwise they follow skills/common in TOOLS.md.

Recommendation: **Option C**. Doc in `skills/common/`, runnable wrappers in `skills/common/scripts/` so one place owns both “what to run” and “how to run it.”

---

## 3. Concrete steps

### Phase 1 — Inventory and normalize

1. **Extract** every tool invocation from:
   - `agents/*/TOOLS.md`
   - `skills/*/scripts/*.sh`
   - `pi-skills/hexstrike/scripts/hexstrike-call.js` (and any other call sites).
2. **List** command + typical flags per agent/script.
3. **Pick** for each tool one “default” profile (e.g. nuclei-recon vs nuclei-web) and document it in `skills/common/<tool>/references/defaults.md`.

### Phase 2 — Add skills/common

1. Create `skills/common/` with subdirs for the high-reuse tools: e.g. `nuclei`, `httpx`, `subfinder`, `naabu`, `dnsx`, `sqlmap`, `ffuf`, `dalfox`, `gau`, `amass`.
2. In each:
   - `SKILL.md`: purpose, when to use, link to defaults.
   - `references/defaults.md`: canonical flags for recon / web / quick (or one default if a single use).
3. Add `skills/common/README.md` explaining that these are **shared command definitions** to avoid redundant commands across agents.

### Phase 3 — Wrapper scripts (optional but useful)

1. Add `skills/common/scripts/run-<tool>.sh` (or `.js` in pi-skills) that:
   - Accepts a **profile** (e.g. `recon`, `web`, `quick`) and optional overrides.
   - Reads defaults from `references/defaults.md` or a small JSON/YAML beside the script.
   - Invokes the tool (direct or via hexstrike) with those flags.
2. Document in each `skills/common/<tool>/SKILL.md`: “Preferred entrypoint: `../../scripts/run-<tool>.sh <profile>`.”

### Phase 4 — Point agents at common

1. In **agents**:
   - In each agent’s TOOLS.md, replace long one-off examples with: “Use `skills/common/<tool>`; see defaults for recon/web.”
   - In CONFIG or SKILLS.md, add a line like “Shared commands: `skills/common`” so it’s explicit that the agent relies on common.
2. In **skills/** (recon, web, etc.):
   - Change scripts to call `skills/common/scripts/run-<tool>.sh <profile>` where a profile exists, instead of inlining flags.
3. **pi-skills/hexstrike**: Keep as the execution backend; the “redundancy” we remove is the **duplicate flag lists** in multiple agents, not necessarily the single hexstrike call path.

### Phase 5 — Redundancy checks

1. Add a small script or CI step (e.g. `scripts/check-skill-redundancy.sh`):
   - Grep for tool names (nuclei, httpx, subfinder, …) in `agents/*/TOOLS.md` and `skills/*/scripts/`.
   - Report any invocation that doesn’t reference `skills/common` or the shared script.
2. Over time, migrate those to the shared definition so “redundant commands” become “reference common skill.”

---

## 4. Success criteria

- One canonical definition per tool (or per tool+context) in `skills/common/`.
- Agents and skill scripts reference that definition instead of duplicating flags.
- New agents or skills can adopt the same common skills without re‑typing the same commands.
- Optional: runnable wrappers so automation uses the same defaults as the docs.

---

## 5. File layout (after Phase 2–3)

```
skills/
├── common/
│   ├── README.md              # Explains shared commands / redundancy plan
│   ├── nuclei/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── defaults.md    # recon / web / quick flags
│   ├── httpx/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── defaults.md
│   ├── subfinder/
│   │   └── ...
│   └── scripts/               # Optional wrappers
│       ├── run-nuclei.sh
│       ├── run-httpx.sh
│       └── ...
├── recon/
├── web/
└── ...
```

---

## 6. Relation to pi-skills and agents

- **agents/** — Each agent’s CONFIG lists `pi_skills` (hexstrike, pentagi) and may reference `skills/common` in TOOLS.md or SKILLS.md.
- **pi-skills/** — HexStrike remains the execution layer; `skills/common` defines **what** to run (flags, profiles), and scripts can call hexstrike with those args.
- **skills/** — Domain skills (recon, web, cloud, …) call into `skills/common` for shared tool invocations instead of defining their own redundant commands.

This keeps agent-specific behavior in the agent, shared command behavior in one place, and reduces duplicate command definitions across the repo.
