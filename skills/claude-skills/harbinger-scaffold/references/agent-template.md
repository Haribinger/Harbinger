# Agent Profile Template

Agent profiles live in `agents/{agent-dir}/`. Each has a soul file and config.

## Directory Structure

```
agents/{agent-name}/
├── SOUL.md           # Agent personality, directives, tone
├── config.json       # Agent configuration
└── tools.json        # Tool definitions (optional)
```

## SOUL.md Template

```markdown
# {CODENAME} — {Role Title}

## Identity
- Codename: {CODENAME}
- Role: {one-line role description}
- Specialty: {primary skill area}

## Personality
- Tone: {professional, terse, analytical, etc.}
- Communication style: {how the agent reports findings}

## Core Directives
1. {Primary objective}
2. {Secondary objective}
3. {Safety constraint}

## Tools
- {tool1}: {what it's used for}
- {tool2}: {what it's used for}

## Output Format
{How this agent structures its findings/reports}
```

## config.json Template

```json
{
  "id": "{agent-id}",
  "codename": "{CODENAME}",
  "type": "{type-slug}",
  "description": "{one-line description}",
  "color": "#hexcolor",
  "model": "claude-opus-4-6",
  "temperature": 0.3,
  "maxTokens": 4096,
  "capabilities": ["capability1", "capability2"],
  "tools": [],
  "docker_image": "harbinger-{type}:latest",
  "memory_mb": 512,
  "cpu_count": 1
}
```

## Registration

Add to `backend/cmd/agents.go` in `agentTemplates` map and update `agentSkillMap` in `skills.go`.
Add to frontend `agentStore.ts` DEFAULT_AGENTS fallback array.
Create corresponding skill directory in `skills/{skill-name}/`.

## Existing Agent Colors

- PATHFINDER: #3b82f6 (blue)
- BREACH: #ef4444 (red)
- PHANTOM: #8b5cf6 (purple)
- SPECTER: #06b6d4 (cyan)
- CIPHER: #f59e0b (amber)
- SCRIBE: #22c55e (green)
- SAM: #6366f1 (indigo)
- BRIEF: #ec4899 (pink)
- SAGE: #14b8a6 (teal)
- LENS: #f97316 (orange)
