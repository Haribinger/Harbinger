package main

import "regexp"

// vibeCoderRules catches the top patterns AI vibe coders forget before deploying.
// These are DETECTION rules — mockhunter searches for these dangerous patterns
// in user codebases to WARN developers. The patterns themselves are intentionally
// dangerous strings that we want to find and flag.
func vibeCoderRules() []Rule {
	return []Rule{
		// ── AUTH & ACCESS CONTROL ──────────────────────────────────────
		{
			ID: "AUTH001", Category: "auth", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)(router|mux|app)\.(get|post|put|patch|delete)\s*\(\s*["']/api/(admin|internal|private|management)`),
			Message:     "Sensitive admin/internal route — verify auth middleware is applied",
			Fix:         "Wrap with authMiddleware() or requireRole('admin')",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "AUTH002", Category: "auth", Severity: SevCritical, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)jwt\.(sign|verify|decode)\s*\([^)]*(?:algorithm|alg)\s*[:=]\s*["']none["']`),
			Message:     "JWT with 'none' algorithm — complete auth bypass",
			Fix:         "Always specify algorithm: algorithms: ['HS256'] or ['RS256']",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "AUTH004", Category: "auth", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)(?:req|request)\.(query|params|body)\.(role|admin|is_?admin|privilege|permission)`),
			Message:     "Role/permission read from user input — privilege escalation risk",
			Fix:         "Read role from authenticated session/token, never from request",
			ExcludeGlob: "*_test.*",
		},

		// ── INPUT VALIDATION ──────────────────────────────────────────
		{
			ID: "INPUT001", Category: "security", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile("(?i)(?:path\\.join|filepath\\.Join)\\s*\\([^)]*(?:req\\.|request\\.|params\\.|body\\.)"),
			Message:     "Path traversal — user input in file path construction",
			Fix:         "Validate input against allowlist, use filepath.Clean + check prefix",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "INPUT002", Category: "security", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)(?:redirect|location)\s*[=(]\s*(?:req\.|request\.|params\.|body\.|query\.)`),
			Message:     "Open redirect — user-controlled redirect URL",
			Fix:         "Validate redirect URL against allowlist of trusted domains",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "INPUT003", Category: "security", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)Object\.assign\s*\(\s*\w+\s*,\s*(?:req\.|request\.)body`),
			Message:     "Mass assignment — all request fields bound to object",
			Fix:         "Destructure only expected fields: const { name, email } = req.body",
			ExcludeGlob: "*_test.*",
		},

		// ── CRYPTO & RANDOMNESS ───────────────────────────────────────
		{
			ID: "CRYPTO001", Category: "security", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)Math\.random\s*\(\s*\).*(?:token|secret|key|password|session|nonce|salt)`),
			Message:     "Math.random() for security-sensitive value — predictable",
			Fix:         "Use crypto.randomBytes() (Node) or crypto.getRandomValues() (browser)",
			ExcludeGlob: "*_test.*",
		},

		// ── NETWORK & HTTP ────────────────────────────────────────────
		{
			ID: "NET001", Category: "security", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)http\.DefaultClient|http\.Get\s*\(`),
			Message:     "Go http.DefaultClient has no timeout — can hang forever",
			Fix:         "Create client with timeout: &http.Client{Timeout: 30 * time.Second}",
			FileGlob:    "*.go",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "NET003", Category: "security", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)localStorage\.setItem\s*\(\s*["'](?:token|session|auth|jwt|access.token|refresh.token)`),
			Message:     "Auth token stored in localStorage — accessible via XSS",
			Fix:         "Use httpOnly cookies for auth tokens instead",
			ExcludeGlob: "*_test.*",
		},

		// ── ERROR HANDLING ────────────────────────────────────────────
		{
			ID: "ERR001", Category: "vibe-code", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)(?:res|response|w)\.(?:json|send|write)\s*\([^)]*(?:err\.stack|error\.stack|stackTrace)`),
			Message:     "Stack trace exposed to client — information disclosure",
			Fix:         "Return generic error message, log full error server-side",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "ERR002", Category: "vibe-code", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)JSON\.parse\s*\([^)]*\)\s*(?:$|;|\))`),
			Message:     "JSON.parse without try/catch — crashes on malformed input",
			Fix:         "Wrap in try/catch or use a safe parse utility",
			ExcludeGlob: "*_test.*",
		},

		// ── DATA HANDLING (detection rules for dangerous patterns) ────
		{
			ID: "DATA002", Category: "security", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)(?:ioutil\.ReadAll|io\.ReadAll)\s*\(`),
			Message:     "ReadAll without size limit — memory exhaustion on large input",
			Fix:         "Use io.LimitReader(r, maxBytes) before ReadAll",
			FileGlob:    "*.go",
			ExcludeGlob: "*_test.*",
		},

		// ── GO-SPECIFIC ───────────────────────────────────────────────
		{
			ID: "GO001", Category: "security", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`fmt\.Sprintf\s*\(\s*"(?:SELECT|INSERT|UPDATE|DELETE)`),
			Message:     "SQL via fmt.Sprintf — SQL injection risk",
			Fix:         "Use db.Query with $1 params instead of string formatting",
			FileGlob:    "*.go",
			ExcludeGlob: "*_test.*",
		},

		// ── JS/TS-SPECIFIC ────────────────────────────────────────────
		{
			ID: "JS001", Category: "vibe-code", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)useEffect\s*\(\s*(?:async|\(\)\s*=>)\s*\{[^}]*(?:setInterval|addEventListener|subscribe)`),
			Message:     "useEffect with subscription/interval but likely no cleanup return",
			Fix:         "Return a cleanup function: return () => clearInterval(id)",
			ExcludeGlob: "*_test.*",
		},

		// ── INFRASTRUCTURE ────────────────────────────────────────────
		{
			ID: "INFRA001", Category: "security", Severity: SevHigh, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)(?:debug|DEBUG)\s*[:=]\s*(?:true|True|1|"true")`),
			Message:     "Debug mode enabled — exposes internals in production",
			Fix:         "Set debug=false in production, use env var: DEBUG=${DEBUG:-false}",
			ExcludeGlob: "*_test.*",
		},
		{
			ID: "INFRA002", Category: "security", Severity: SevMedium, LineMatch: true,
			Pattern:     regexp.MustCompile(`(?i)FROM\s+(?:python|node|ruby|golang|openjdk):\d+(?:\s|$)`),
			Message:     "Full base image in Dockerfile — large attack surface",
			Fix:         "Use slim/alpine variant: python:3.12-slim, node:20-alpine",
			FileGlob:    "Dockerfile*",
			ExcludeGlob: "*_test.*",
		},
	}
}

// testKeyRules detects known test/example API keys from major providers.
func testKeyRules() []Rule {
	return []Rule{
		{
			ID: "TESTKEY001", Category: "test-keys", Severity: SevInfo, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)sk[-_]test[-_]|pk[-_]test[-_]`),
			Message: "Stripe test key — safe for dev, not for production",
			Fix:     "Verify this is only used in test/dev environments",
		},
		{
			ID: "TESTKEY002", Category: "test-keys", Severity: SevInfo, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)(?:REPLACE_?ME|YOUR_?API_?KEY|INSERT_?TOKEN|PLACEHOLDER)`),
			Message: "Obvious placeholder key — replace before shipping",
			Fix:     "Replace with real credential from secrets manager",
		},
		{
			ID: "TESTKEY003", Category: "test-keys", Severity: SevInfo, LineMatch: true,
			Pattern: regexp.MustCompile(`(?i)test[-_]?(?:api[-_]?)?key|demo[-_]?(?:api[-_]?)?key|sample[-_]?(?:api[-_]?)?key`),
			Message: "Test/demo API key identifier — verify not shipped to production",
			Fix:     "Use environment variables for all API keys",
		},
	}
}
