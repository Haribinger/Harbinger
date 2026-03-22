# MockHunter — AI Slop & Vibe Code Scanner

## What This Tool Does

MockHunter is a static analysis scanner that catches the things AI code generators leave behind:
hardcoded secrets, fake/mock data, placeholder values, simulated behavior, empty handlers,
AI narrative comments, vibe-code anti-patterns, and security vulnerabilities.

It runs as a single Go binary (9MB, zero dependencies) and outputs beautiful terminal reports,
JSON for CI, or SARIF for GitHub Code Scanning.

## When to Use

Run mockhunter:
- **Before every commit** — catch issues before they enter version control
- **Before every PR** — ensure no AI slop ships to review
- **Before deployment** — final gate to block fake data, test keys, hardcoded secrets
- **After AI-assisted coding sessions** — clean up what the AI left behind
- **In CI/CD pipelines** — automated quality gate (exits 1 for high, 2 for critical)

## How Agents Should Use This

### Step 1: Run the scan
```bash
mockhunter --dir /path/to/project --min-severity medium --exclude-tests --format json
```

### Step 2: Parse findings
Each finding in JSON output contains:
```json
{
  "file": "src/api/auth.ts",
  "line": 42,
  "severity": 3,            // 0=info, 1=low, 2=med, 3=high, 4=critical
  "category": "secrets",     // secrets, mock-data, ai-slop, vibe-code, security, stubs, auth, test-keys
  "rule": "SEC003",
  "message": "GitHub token (PAT/OAuth/App) found in source",
  "snippet": "const TOKEN = 'ghp_abc123...'",
  "fix": "Use GH_TOKEN environment variable",
  "confidence": 0.85,        // 0.0-1.0, higher = more likely real issue
  "confidenceLabel": "HIGH",
  "confidenceReasons": ["core application code", "high entropy string detected"]
}
```

### Step 3: Route to correct agent
| Category | Route To | Action |
|----------|----------|--------|
| `secrets` | MAINTAINER | Move to env vars, rotate compromised keys |
| `mock-data` | SAM | Replace with real API calls or proper empty states |
| `ai-slop` | SAM | Remove narrative comments, implement TODOs or delete |
| `vibe-code` | SAM | Fix empty catches, add error handling, remove console.log |
| `security` | BREACH | Fix vulnerabilities (SQLi, XSS, path traversal, etc.) |
| `stubs` | SAM | Implement stub endpoints or return proper not_configured |
| `auth` | BREACH | Add auth middleware, fix JWT issues, validate permissions |
| `test-keys` | MAINTAINER | Replace with env vars, verify test-only usage |

### Step 4: Fix and re-scan
After fixing, re-run to verify the fix didn't introduce new issues:
```bash
mockhunter --dir /path/to/project --min-severity medium --exclude-tests
```

## Confidence Scoring

Every finding has a confidence score (0.0-1.0) that reduces false positives:

**Suppressors (lower confidence):**
- Vendored/third-party code: -0.50
- Generated files: -0.40
- .env files (secrets expected): -0.30
- Documentation files: -0.35
- Comment-only lines: -0.40
- Regex/pattern definitions: -0.35
- Env var lookups: -0.30
- Import statements: -0.50

**Boosters (higher confidence):**
- High entropy strings: +0.20
- Deployment configs: +0.15
- Core application code: +0.10

## CLI Reference

```bash
# Basic scan (medium+ severity, beautiful terminal output)
mockhunter --dir .

# Strict scan (only definite findings)
mockhunter --dir . --min-severity high --min-confidence 0.85

# JSON for CI/agents
mockhunter --dir . --format json

# SARIF for GitHub Code Scanning
mockhunter --dir . --format sarif > results.sarif

# Only specific category
mockhunter --dir . --category secrets

# Run with external tools (bandit, gitleaks, semgrep)
mockhunter --dir . --external

# Show everything including noise
mockhunter --dir . --show-noise

# HTTP API mode (for dashboard/integration)
mockhunter --serve :3010

# Exclude test files
mockhunter --dir . --exclude-tests
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No high/critical findings |
| 1 | High severity findings present |
| 2 | Critical severity findings present |

## Categories & Rule Count

| Category | Rules | What It Catches |
|----------|-------|-----------------|
| secrets | 11 | API keys, tokens, passwords, private keys, connection strings |
| mock-data | 5 | Fake emails, placeholder names, simulated responses |
| ai-slop | 7 | Narrative TODOs, buzzword comments, empty stubs |
| vibe-code | 7 | Empty catches, any types, console.log, dead onClick |
| security | 13 | Command injection, XSS, SQLi, path traversal, weak crypto |
| stubs | 3 | "In production" comments, not-implemented returns |
| auth | 4 | Missing auth, JWT none algorithm, user-controlled roles |
| test-keys | 3 | Stripe test keys, placeholder keys, demo API keys |

**Total: 53 rules** with confidence scoring and actionable fix suggestions.

## Questions Agents Should Ask Users

When findings are ambiguous (confidence 0.35-0.60), agents should ask:

1. **For secrets:** "Is this a real API key or a test/example key? Where are your production secrets stored?"
2. **For mock data:** "Is this placeholder data intentional (e.g., form defaults) or should it be removed?"
3. **For stubs:** "Is this feature planned for implementation, or should it return not_configured?"
4. **For test keys:** "Are you using separate environments (dev/staging/prod)? Is this key test-only?"
5. **For auth issues:** "Do you have auth middleware? Which routes should be public vs. authenticated?"
