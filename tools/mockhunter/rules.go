package main

import "regexp"

// allRules returns the complete set of scan rules organized by category.
// Each rule has a compiled regex, severity, and actionable fix suggestion.
func allRules() []Rule {
	return flatten(
		secretRules(),
		mockDataRules(),
		aiSlopRules(),
		vibeCodeRules(),
		securityRules(),
		simulationRules(),
		vibeCoderRules(),
		testKeyRules(),
	)
}

func flatten(groups ...[]Rule) []Rule {
	var all []Rule
	for _, g := range groups {
		all = append(all, g...)
	}
	return all
}

// ── SECRETS & CREDENTIALS ─────────────────────────────────────────────────

func secretRules() []Rule {
	return []Rule{
		{
			ID: "SEC001", Category: "secrets", Severity: SevCritical, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)(api[_-]?key|apikey)\s*[:=]\s*["']?[a-zA-Z0-9_\-]{20,}["']?`),
			Message: "Hardcoded API key detected",
			Fix:     "Move to environment variable or secrets manager",
		},
		{
			ID: "SEC002", Category: "secrets", Severity: SevCritical, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)(password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']`),
			Message: "Hardcoded password in source code",
			Fix:     "Use environment variable: os.Getenv(\"DB_PASSWORD\") or process.env.DB_PASSWORD",
		},
		{
			ID: "SEC003", Category: "secrets", Severity: SevCritical, LineMatch: true,
			Pattern: regexp.MustCompile(`(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}`),
			Message: "GitHub token (PAT/OAuth/App) found in source",
			Fix:     "Revoke immediately at github.com/settings/tokens and use GH_TOKEN env var",
		},
		{
			ID: "SEC004", Category: "secrets", Severity: SevCritical, LineMatch: true,
			Pattern: regexp.MustCompile(`sk-[a-zA-Z0-9]{32,}`),
			Message: "OpenAI API key found in source",
			Fix:     "Use OPENAI_API_KEY environment variable",
		},
		{
			ID: "SEC005", Category: "secrets", Severity: SevCritical, LineMatch: true,
			Pattern: regexp.MustCompile(`sk-ant-[a-zA-Z0-9\-]{80,}`),
			Message: "Anthropic API key found in source",
			Fix:     "Use ANTHROPIC_API_KEY environment variable",
		},
		{
			ID: "SEC006", Category: "secrets", Severity: SevHigh, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)(secret|token)\s*[:=]\s*["'][a-zA-Z0-9+/=_\-]{16,}["']`),
			Message: "Hardcoded secret or token value",
			Fix:     "Move to .env file (never commit) or secrets manager",
		},
		{
			ID: "SEC007", Category: "secrets", Severity: SevHigh, LineMatch: true,
			Pattern: regexp.MustCompile(`AKIA[0-9A-Z]{16}`),
			Message: "AWS Access Key ID found in source",
			Fix:     "Use AWS_ACCESS_KEY_ID environment variable or IAM roles",
		},
		{
			ID: "SEC008", Category: "secrets", Severity: SevCritical, LineMatch: true,
			Pattern: regexp.MustCompile(`-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----`),
			Message: "Private key embedded in source code",
			Fix:     "Move to file outside repo, reference via path in env var",
		},
		{
			ID: "SEC009", Category: "secrets", Severity: SevHigh, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)redis://[^@\s]*:[^@\s]+@`),
			Message: "Redis connection string with embedded password",
			Fix:     "Use REDIS_URL env var with ${REDIS_PASSWORD} substitution",
		},
		{
			ID: "SEC010", Category: "secrets", Severity: SevHigh, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)postgres(ql)?://[^@\s]*:[^@\s]+@`),
			Message: "PostgreSQL connection string with embedded password",
			Fix:     "Use DATABASE_URL env var with separate DB_PASSWORD",
		},
		{
			ID: "SEC011", Category: "secrets", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)["']change[_-]?me["']`),
			Message:     "Placeholder secret value — will ship to production",
			Fix:         "Generate a real secret: openssl rand -hex 32",
			ExcludeGlob: "*_test.*",
		},
	}
}

// ── MOCK & FAKE DATA ──────────────────────────────────────────────────────

func mockDataRules() []Rule {
	return []Rule{
		{
			ID: "MOCK001", Category: "mock-data", Severity: SevHigh, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)(fake|mock|dummy|placeholder|sample|demo)[_\-]?(data|user|email|name|token|key|response|api|result)`),
			Message: "Fake/mock/dummy data reference — likely not production-ready",
			Fix:     "Replace with real data source or remove before shipping",
		},
		{
			ID: "MOCK002", Category: "mock-data", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)@example\.(com|org|net)`),
			Message:     "Example domain email — may be placeholder data",
			Fix:         "Replace with real email or make configurable",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "MOCK003", Category: "mock-data", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)["']John\s+Doe["']|["']Jane\s+Doe["']|["']Test\s+User["']`),
			Message:     "Placeholder person name in code",
			Fix:         "Remove hardcoded test names",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "MOCK004", Category: "mock-data", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)//\s*simulate|//\s*simulated|//\s*fake\s|#\s*simulate|#\s*fake\s`),
			Message:     "Code explicitly marked as simulated/fake",
			Fix:         "Implement real logic or return {ok:false, reason:\"not_configured\"}",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "MOCK005", Category: "mock-data", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)["']lorem\s+ipsum`),
			Message:     "Lorem ipsum placeholder text in code",
			Fix:         "Replace with real content or empty state message",
			ExcludeGlob: "*_test.*",
		},
	}
}

// ── AI SLOP DETECTOR ──────────────────────────────────────────────────────

func aiSlopRules() []Rule {
	return []Rule{
		{
			ID: "AI001", Category: "ai-slop", Severity: SevMedium, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)//\s*TODO:?\s*(implement|add|fix|handle|complete|finish|write)`),
			Message: "AI-generated TODO — code was generated but not finished",
			Fix:     "Implement the TODO or remove the stub entirely",
		},
		{
			ID: "AI002", Category: "ai-slop", Severity: SevHigh, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)//\s*(?:this|the)\s+(?:function|method|class|component)\s+(?:will|should|would|could)\s`),
			Message: "AI narrative comment — describes intent without implementation",
			Fix:     "Replace comment with actual code, or delete if code exists",
		},
		{
			ID: "AI003", Category: "ai-slop", Severity: SevMedium, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)//\s*(?:for now|for demonstration|for testing|for development|as an? example)`),
			Message: "Temporary qualifier in comment — code not production-ready",
			Fix:     "Make it production-ready or remove it",
		},
		{
			ID: "AI005", Category: "ai-slop", Severity: SevHigh, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)\b(implementation|functionality|utilize|leverage|robust|scalable|seamless|streamline|empower|enhance)\b.*\b(implementation|functionality|utilize|leverage|robust|scalable|seamless|streamline|empower|enhance)\b`),
			Message: "AI buzzword soup in comment — signals generated text",
			Fix:     "Rewrite in plain language: say what the code does, not marketing copy",
		},
		{
			ID: "AI006", Category: "ai-slop", Severity: SevMedium, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)//\s*(?:error handling|handle errors?|add error)\s*$`),
			Message: "Empty error handling TODO — errors will be silently swallowed",
			Fix:     "Implement proper error handling now, not later",
		},
		{
			ID: "AI007", Category: "ai-slop", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)(?:pass|\.\.\.)\s*(?://|#)\s*(?:implement|todo|placeholder|stub)`),
			Message:     "Pass/stub with TODO — function body is empty",
			Fix:         "Implement the function or raise NotImplementedError",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "AI008", Category: "ai-slop", Severity: SevMedium, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)//\s*(?:you can|you may|you should|you might|feel free to)\s`),
			Message: "AI talking to the user in code comments",
			Fix:     "Rewrite as technical documentation, not instructions to a person",
		},
	}
}

// ── VIBE CODE DETECTOR ────────────────────────────────────────────────────

func vibeCodeRules() []Rule {
	return []Rule{
		{
			ID: "VIBE001", Category: "vibe-code", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)`),
			Message:     "Empty catch block — errors silently swallowed",
			Fix:         "Log the error or add a comment explaining why it's safe to ignore",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "VIBE002", Category: "vibe-code", Severity: SevLow, LineMatch: true,
			Pattern:     regexp.MustCompile(`console\.(log|debug|info|warn)\(`),
			Message:     "Console statement left in code — use proper logging",
			Fix:         "Remove or replace with structured logging (winston, pino, log.Printf)",
			FileGlob:    "*.ts",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "VIBE003", Category: "vibe-code", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`:\s*any\b`),
			Message:     "TypeScript 'any' type — defeats type safety",
			Fix:         "Define a proper interface or use 'unknown' with type narrowing",
			FileGlob:    "*.ts",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "VIBE004", Category: "vibe-code", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)setTimeout\s*\(\s*(?:(?:function|\(\))\s*(?:=>)?\s*\{[^}]*(?:setState|setStatus|setResult|update|complete|finish))`),
			Message:     "setTimeout simulating async operation — fake delay instead of real API call",
			Fix:         "Replace with actual API call using fetch/axios",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "VIBE005", Category: "vibe-code", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)alert\s*\(`),
			Message:     "alert() in production code — use proper UI notification",
			Fix:         "Replace with toast notification or modal component",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "VIBE006", Category: "vibe-code", Severity: SevLow, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)(FIXME|HACK|XXX|BROKEN|KLUDGE|WORKAROUND)`),
			Message:     "Code quality marker left in source",
			Fix:         "Fix the issue or create a tracked ticket",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "VIBE007", Category: "vibe-code", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}`),
			Message:     "Empty onClick handler — button does nothing",
			Fix:         "Implement handler or remove the button",
			ExcludeGlob: "*_test.*",
		},
	}
}

// ── SECURITY PATTERNS ─────────────────────────────────────────────────────
// Note: rules reference dangerous functions for DETECTION purposes only.
// mockhunter finds these patterns to warn developers — it does not execute them.

func securityRules() []Rule {
	return []Rule{
		{
			ID: "VULN001", Category: "security", Severity: SevCritical, LineMatch: true,
			// Detects dangerous code-execution functions called with user-controlled input
			Pattern: regexp.MustCompile(`(?i)(?:exec|spawn|system|popen)\s*\(\s*(?:req\.|request\.|params\.|user|input|body)`),
			Message: "OS command execution with user input — Command Injection risk",
			Fix:     "Use parameterized APIs, never pass user input to shell commands",
		},
		{
			ID: "VULN002", Category: "security", Severity: SevHigh, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)innerHTML\s*=`),
			Message: "innerHTML assignment — XSS vulnerability risk",
			Fix:     "Use textContent or a sanitization library (DOMPurify)",
		},
		{
			ID: "VULN003", Category: "security", Severity: SevHigh, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)(?:SELECT|INSERT|UPDATE|DELETE)\s+.*\+\s*(?:req\.|request\.|params\.|body\.|query\.)`),
			Message: "SQL string concatenation with user input — SQL Injection risk",
			Fix:     "Use parameterized queries ($1, ?, :param) instead of string concatenation",
		},
		{
			ID: "VULN004", Category: "security", Severity: SevMedium, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)cors.*origin.*[*]|Access-Control-Allow-Origin.*[*]`),
			Message: "CORS allows all origins — may expose API to unauthorized domains",
			Fix:     "Restrict to specific trusted origins",
		},
		{
			ID: "VULN005", Category: "security", Severity: SevHigh, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)verify\s*[:=]\s*false|rejectUnauthorized\s*[:=]\s*false|InsecureSkipVerify\s*[:=]\s*true`),
			Message: "TLS/SSL verification disabled — vulnerable to MITM attacks",
			Fix:     "Enable certificate verification in production",
		},
		{
			ID: "VULN006", Category: "security", Severity: SevMedium, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)(?:md5|sha1)\s*\(`),
			Message: "Weak hash algorithm (MD5/SHA1) — not suitable for security",
			Fix:     "Use SHA-256, bcrypt, or argon2 for passwords; SHA-256+ for integrity",
		},
	}
}

// ── SIMULATION & STUB DETECTION ───────────────────────────────────────────

func simulationRules() []Rule {
	return []Rule{
		{
			ID: "STUB001", Category: "stubs", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)(?://|#)\s*(?:in production|when deployed|in real|in actual|for real)`),
			Message:     "Comment indicates code is not production-ready",
			Fix:         "Implement the production version now",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "STUB002", Category: "stubs", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)(?:return|Response)\s*\(\s*["'](?:not[_ ]implemented|coming soon|todo|wip)["']`),
			Message:     "Endpoint returns 'not implemented' — broken for users",
			Fix:         "Implement the endpoint or return proper HTTP 501 with structured error",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "STUB003", Category: "stubs", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)time\.Sleep\s*\(\s*\d+\s*\*\s*time\.(Millisecond|Second)`),
			Message:     "Artificial delay — may be simulating async work",
			Fix:         "If simulating latency, replace with real async operation",
			ExcludeGlob: "*_test.*",
		},
	}
}
