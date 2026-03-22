package main

import (
	"fmt"
	"strings"
)

// ── DIAGNOSIS MODE ────────────────────────────────────────────────────────
// Deep analysis: real risk level, architectural issues, better fix suggestions.
// Goes beyond "what's wrong" to "what should you actually do about it".

type Diagnosis struct {
	RiskLevel    string // "none", "low", "exploitable", "critical-path", "showstopper"
	IsArchIssue  bool   // true if this is a design problem, not just a code bug
	ArchAnalysis string // what's architecturally wrong
	BetterFix    string // the real fix, not just a patch
	PatchFix     string // the quick patch (what most scanners suggest)
	Intent       string // what the developer was probably trying to do
	FixSafety    int    // 0-100 how safe is it to auto-fix this
}

func diagnose(f Finding, surroundingLines []string) Diagnosis {
	d := Diagnosis{
		PatchFix:  f.Fix,
		FixSafety: 50,
	}

	allContext := strings.Join(surroundingLines, "\n")
	_ = allContext

	switch {
	// ── SECRETS ────────────────────────────────────────────────────
	case f.Category == "secrets" && f.Confidence >= 0.60:
		d.RiskLevel = "critical-path"
		d.IsArchIssue = true
		d.ArchAnalysis = "No secrets management system in place. Secrets are embedded in code rather than injected at runtime via env vars or a vault."
		d.BetterFix = "1. Set up a secrets manager (Vault, AWS Secrets Manager, or even just .env + dotenv)\n           2. Create .env.example with empty placeholders\n           3. Add .env to .gitignore\n           4. Rotate any committed secrets immediately"
		d.Intent = "Developer needed the secret to make something work and hardcoded it as the fastest path."
		d.FixSafety = 30 // moving secrets requires testing all dependent code

	case f.Category == "secrets" && f.Confidence < 0.60:
		d.RiskLevel = "none"
		d.IsArchIssue = false
		d.Intent = "Code references or validates secret patterns — not an actual leak."
		d.FixSafety = 90
		d.BetterFix = "Likely a false positive. Verify and add // mockhunter:ignore if confirmed safe."

	// ── MOCK DATA ─────────────────────────────────────────────────
	case f.Category == "mock-data" && (strings.Contains(f.Rule, "MOCK004") || strings.Contains(f.Snippet, "simulate")):
		d.RiskLevel = "exploitable"
		d.IsArchIssue = true
		d.ArchAnalysis = "Frontend is decoupled from backend. The simulation masks a missing API contract — when the real backend arrives, the data shapes may not match."
		d.BetterFix = "1. Define the API contract (OpenAPI spec or TypeScript interface)\n           2. Build the backend endpoint\n           3. Replace simulation with real API call + error handling + loading state\n           4. Add empty state UI for when no data exists"
		d.Intent = "Developer built the UI before the backend was ready. Simulation was a temporary bridge."
		d.FixSafety = 40

	case f.Category == "mock-data":
		d.RiskLevel = "low"
		d.IsArchIssue = false
		d.BetterFix = "Replace placeholder values with real data or configurable defaults."
		d.Intent = "Quick placeholder used during development."
		d.FixSafety = 80

	// ── AI SLOP ───────────────────────────────────────────────────
	case f.Category == "ai-slop" && f.Rule == "AI005":
		d.RiskLevel = "none"
		d.IsArchIssue = false
		d.BetterFix = "Delete the comment entirely. Good code is self-documenting — if it needs a comment, explain WHY not WHAT."
		d.Intent = "AI generated a description of the code. Developer accepted it without editing."
		d.FixSafety = 95

	case f.Category == "ai-slop":
		d.RiskLevel = "low"
		d.IsArchIssue = false
		d.BetterFix = "Either implement the TODO or delete it. Half-finished code is worse than no code."
		d.Intent = "AI generated a skeleton. The developer moved on before finishing it."
		d.FixSafety = 70

	// ── SECURITY VULNS ────────────────────────────────────────────
	case f.Category == "security" && f.Severity >= SevHigh:
		d.RiskLevel = "exploitable"
		d.IsArchIssue = true
		d.ArchAnalysis = "Security was not part of the design process. Input validation, output encoding, and access control need to be systematic, not per-endpoint."
		d.BetterFix = "1. Add input validation middleware that runs on ALL endpoints\n           2. Use parameterized queries everywhere (never string concatenation for SQL)\n           3. Add output encoding for all user-facing responses\n           4. Consider a security-focused code review of the entire module"
		d.Intent = "Developer focused on functionality. Security was treated as something to add later."
		d.FixSafety = 20

	case f.Category == "security":
		d.RiskLevel = "low"
		d.IsArchIssue = false
		d.BetterFix = f.Fix
		d.Intent = "Minor security hygiene issue. Low exploitability but should be fixed."
		d.FixSafety = 60

	// ── AUTH ───────────────────────────────────────────────────────
	case f.Category == "auth":
		d.RiskLevel = "showstopper"
		d.IsArchIssue = true
		d.ArchAnalysis = "Authentication/authorization was bolted on rather than designed in. The route-level approach creates gaps — every new endpoint must remember to add auth."
		d.BetterFix = "1. Make all routes authenticated by default (deny by default)\n           2. Explicitly mark public routes with a 'public' annotation\n           3. Add integration tests that verify auth on every endpoint\n           4. Implement role-based access control at the middleware level"
		d.Intent = "Routes were built first for speed, auth was supposed to be added later."
		d.FixSafety = 15

	// ── STUBS ─────────────────────────────────────────────────────
	case f.Category == "stubs":
		d.RiskLevel = "low"
		d.IsArchIssue = false
		d.BetterFix = "Either implement the real logic or return a proper not_configured response with HTTP 501."
		d.Intent = "Feature was planned but integration was never completed."
		d.FixSafety = 60

	// ── VIBE CODE ─────────────────────────────────────────────────
	case f.Category == "vibe-code" && f.Rule == "VIBE004":
		d.RiskLevel = "exploitable"
		d.IsArchIssue = true
		d.ArchAnalysis = "The frontend simulates backend behavior with setTimeout — users see fake success. When the real backend is different, the UI will break or show wrong data."
		d.BetterFix = "1. Remove the setTimeout simulation entirely\n           2. Call the real API endpoint\n           3. Add loading/error/empty states\n           4. Handle network failures gracefully"
		d.Intent = "Developer wanted the UI to feel responsive before the backend existed."
		d.FixSafety = 35

	case f.Category == "vibe-code":
		d.RiskLevel = "low"
		d.IsArchIssue = false
		d.BetterFix = f.Fix
		d.Intent = "Common shortcut taken during rapid development."
		d.FixSafety = 75

	default:
		d.RiskLevel = "low"
		d.BetterFix = f.Fix
		d.Intent = "Standard code quality issue."
		d.FixSafety = 50
	}

	return d
}

// ── DANGEROUS MODE ────────────────────────────────────────────────────────
// Shows exploit scenarios with big warnings. Only for authorized security testing.

func printDangerousMode(f Finding, d Diagnosis) {
	if d.RiskLevel != "exploitable" && d.RiskLevel != "showstopper" && d.RiskLevel != "critical-path" {
		return
	}

	fmt.Printf("  %s%s", bgRed, white+bold)
	fmt.Printf("  ⚡ EXPLOIT SCENARIO                                         ")
	fmt.Printf("%s\n", reset)

	switch {
	case strings.Contains(f.Rule, "SEC002") || strings.Contains(f.Rule, "SEC003") || strings.Contains(f.Rule, "SEC004"):
		fmt.Printf("  %s│%s An attacker who finds this secret in your git history can:\n", red, reset)
		fmt.Printf("  %s│%s   1. Access the associated service with full privileges\n", red, reset)
		fmt.Printf("  %s│%s   2. Pivot to other systems using the compromised credentials\n", red, reset)
		fmt.Printf("  %s│%s   3. Exfiltrate data or deploy malicious code\n", red, reset)
		fmt.Printf("  %s│%s %sIMPACT:%s Full account takeover of the service this key authenticates to\n", red, reset, bold, reset)

	case strings.Contains(f.Rule, "GO001") || strings.Contains(f.Rule, "VULN003"):
		fmt.Printf("  %s│%s An attacker can craft input that modifies the SQL query:\n", red, reset)
		fmt.Printf("  %s│%s   1. Extract all data from the database (UNION SELECT)\n", red, reset)
		fmt.Printf("  %s│%s   2. Modify or delete records (UPDATE/DELETE injection)\n", red, reset)
		fmt.Printf("  %s│%s   3. Execute OS commands if DB has xp_cmdshell or COPY TO\n", red, reset)
		fmt.Printf("  %s│%s %sIMPACT:%s Full database compromise, potential RCE\n", red, reset, bold, reset)

	case strings.Contains(f.Rule, "VULN001") || strings.Contains(f.Rule, "VULN002"):
		fmt.Printf("  %s│%s An attacker can inject code that runs in user browsers:\n", red, reset)
		fmt.Printf("  %s│%s   1. Steal session cookies and auth tokens\n", red, reset)
		fmt.Printf("  %s│%s   2. Redirect users to phishing pages\n", red, reset)
		fmt.Printf("  %s│%s   3. Modify page content to trick users\n", red, reset)
		fmt.Printf("  %s│%s %sIMPACT:%s Account takeover, data theft, reputation damage\n", red, reset, bold, reset)

	case f.Category == "auth":
		fmt.Printf("  %s│%s Without proper auth, an attacker can:\n", red, reset)
		fmt.Printf("  %s│%s   1. Access admin endpoints without authentication\n", red, reset)
		fmt.Printf("  %s│%s   2. Escalate privileges by modifying their role in requests\n", red, reset)
		fmt.Printf("  %s│%s   3. Access other users' data via IDOR\n", red, reset)
		fmt.Printf("  %s│%s %sIMPACT:%s Complete access control bypass\n", red, reset, bold, reset)

	case strings.Contains(f.Rule, "MOCK004") || f.Category == "mock-data":
		fmt.Printf("  %s│%s Simulated data masks real failures:\n", yellow, reset)
		fmt.Printf("  %s│%s   1. Users think features work when they don't\n", yellow, reset)
		fmt.Printf("  %s│%s   2. Bug reports become impossible to reproduce\n", yellow, reset)
		fmt.Printf("  %s│%s   3. Real backend changes break the facade silently\n", yellow, reset)
		fmt.Printf("  %s│%s %sIMPACT:%s User trust erosion, hidden bugs, data integrity issues\n", yellow, reset, bold, reset)

	default:
		fmt.Printf("  %s│%s This issue could be exploited in a production environment.\n", red, reset)
		fmt.Printf("  %s│%s %sIMPACT:%s Varies — review the specific finding above\n", red, reset, bold, reset)
	}
	fmt.Println()
}

// ── REAL vs FAKE SYSTEM DETECTOR ──────────────────────────────────────────
// Distinguishes: "this is a mock" vs "this is broken" vs "this is intentional"

type SystemVerdict int

const (
	VerdictReal        SystemVerdict = iota // actual working code
	VerdictFake                             // simulated/mocked behavior
	VerdictStub                             // placeholder awaiting implementation
	VerdictIntentional                      // deliberate design choice
	VerdictBroken                           // code that appears real but won't work
)

func (v SystemVerdict) String() string {
	return [...]string{"REAL", "FAKE", "STUB", "INTENTIONAL", "BROKEN"}[v]
}

func (v SystemVerdict) Icon() string {
	return [...]string{"✅", "🎭", "🚧", "✔️", "💀"}[v]
}

func (v SystemVerdict) Color() string {
	return [...]string{green, magenta, yellow, cyan, red}[v]
}

func classifySystem(f Finding, line string, surrounding []string) SystemVerdict {
	ctx := strings.Join(surrounding, " ")
	lower := strings.ToLower(ctx)

	// Check for explicit simulation markers
	if strings.Contains(lower, "simulate") || strings.Contains(lower, "fake") ||
		strings.Contains(lower, "mock") || strings.Contains(lower, "dummy") {
		return VerdictFake
	}

	// Check for explicit "in production" / "when deployed" markers
	if strings.Contains(lower, "in production") || strings.Contains(lower, "when deployed") ||
		strings.Contains(lower, "replace with") || strings.Contains(lower, "placeholder") {
		return VerdictStub
	}

	// Check for intentional design (best-effort, graceful degradation)
	if strings.Contains(lower, "best-effort") || strings.Contains(lower, "graceful") ||
		strings.Contains(lower, "fallback") || strings.Contains(lower, "not_configured") ||
		strings.Contains(lower, "intentional") {
		return VerdictIntentional
	}

	// Check for broken code (references to non-existent things)
	if strings.Contains(lower, "undefined") || strings.Contains(lower, "null") ||
		strings.Contains(lower, "not found") || strings.Contains(lower, "404") {
		return VerdictBroken
	}

	return VerdictReal
}

// ── COMMAND SUGGESTION ENGINE ─────────────────────────────────────────────
// Tells users exactly what to run next based on their findings.

func suggestNextCommands(report *Report) {
	if report.TotalCount == 0 {
		fmt.Printf("  %s%s✔ No issues found! Suggested next steps:%s\n", green, bold, reset)
		fmt.Printf("    %s$ git commit%s  — your code is clean\n", dim, reset)
		fmt.Printf("    %s$ mockhunter scan --external%s  — run bandit/gitleaks/semgrep for deeper analysis\n\n", dim, reset)
		return
	}

	fmt.Printf("\n  %s%s⚡ SUGGESTED COMMANDS%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)

	// Priority 1: Critical secrets
	if report.Categories["secrets"] > 0 {
		fmt.Printf("    %s1.%s %s%s$ mockhunter fix --category secrets --fixer claude%s\n",
			red+bold, reset, bold, red, reset)
		fmt.Printf("       %s↳ Fix %d secret(s) immediately — these are the highest risk%s\n\n", dim, report.Categories["secrets"], reset)
	}

	// Priority 2: Security vulns
	if report.Categories["security"] > 0 {
		fmt.Printf("    %s2.%s %s$ mockhunter fix --category security --dry-run%s\n",
			yellow+bold, reset, bold, reset)
		fmt.Printf("       %s↳ Preview fixes for %d security issue(s) before applying%s\n\n", dim, report.Categories["security"], reset)
	}

	// Priority 3: Auth issues
	if report.Categories["auth"] > 0 {
		fmt.Printf("    %s3.%s %s$ mockhunter fix --category auth --fixer claude%s\n",
			yellow+bold, reset, bold, reset)
		fmt.Printf("       %s↳ Auth issues need human judgment — use an AI that understands context%s\n\n", dim, reset)
	}

	// Priority 4: Mock/fake data
	if report.Categories["mock-data"] > 0 || report.Categories["stubs"] > 0 {
		count := report.Categories["mock-data"] + report.Categories["stubs"]
		fmt.Printf("    %s4.%s %s$ mockhunter fix --category mock-data%s\n",
			cyan+bold, reset, bold, reset)
		fmt.Printf("       %s↳ Replace %d mock/stub item(s) with real implementations%s\n\n", dim, count, reset)
	}

	// Priority 5: AI slop + vibe code (batch cleanup)
	aiVibe := report.Categories["ai-slop"] + report.Categories["vibe-code"]
	if aiVibe > 0 {
		fmt.Printf("    %s5.%s %s$ mockhunter fix --category ai-slop --fixer ollama --auto%s\n",
			blue+bold, reset, bold, reset)
		fmt.Printf("       %s↳ Bulk clean %d AI/vibe issue(s) — safe to auto-fix with Ollama (free)%s\n\n", dim, aiVibe, reset)
	}

	// Final: re-scan
	fmt.Printf("    %s→%s %s$ mockhunter scan --git-diff%s  %s(verify fixes)%s\n\n",
		green+bold, reset, bold, reset, dim, reset)
}

// ── FIX SAFETY SCORE DISPLAY ──────────────────────────────────────────────

func fixSafetyBar(score int) string {
	width := 10
	filled := (score * width) / 100
	if filled < 1 && score > 0 {
		filled = 1
	}

	color := red
	if score >= 70 {
		color = green
	} else if score >= 40 {
		color = yellow
	}

	return fmt.Sprintf("%s%s%s%s %d%%",
		color, strings.Repeat("█", filled), reset,
		strings.Repeat("░", width-filled), score)
}
