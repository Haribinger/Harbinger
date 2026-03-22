package main

import (
	"fmt"
	"path/filepath"
	"strings"
)

// ── WHY THIS HAPPENED ─────────────────────────────────────────────────────
// For each finding, generate a likely root cause based on context signals.

type RootCause struct {
	Reason     string // short label
	Detail     string // explanation
	Likelihood string // "likely", "possible", "unlikely"
}

func analyzeRootCause(f Finding) RootCause {
	switch {
	// Secrets in code
	case f.Category == "secrets" && f.Confidence >= 0.60:
		if strings.Contains(f.File, ".env") {
			return RootCause{
				Reason:     "dev-only config leaked",
				Detail:     "Local .env file contains real secrets. Safe if .gitignored, dangerous if committed.",
				Likelihood: "likely",
			}
		}
		return RootCause{
			Reason:     "quick prototype shortcut",
			Detail:     "Developer hardcoded a secret to get something working fast and forgot to extract it to env vars.",
			Likelihood: "likely",
		}

	case f.Category == "secrets" && f.Confidence < 0.60:
		return RootCause{
			Reason:     "validation or documentation reference",
			Detail:     "This looks like code that checks for or documents secret patterns, not an actual leaked secret.",
			Likelihood: "likely",
		}

	// Mock/fake data
	case f.Category == "mock-data":
		if strings.Contains(f.Snippet, "simulate") || strings.Contains(f.Snippet, "Simulate") {
			return RootCause{
				Reason:     "backend not ready",
				Detail:     "Frontend was built before the backend endpoint existed. Simulated data was used as a placeholder.",
				Likelihood: "likely",
			}
		}
		if strings.Contains(f.Snippet, "example") || strings.Contains(f.Snippet, "sample") {
			return RootCause{
				Reason:     "AI-generated placeholder",
				Detail:     "AI code generator used example.com / sample data that was never replaced with real values.",
				Likelihood: "likely",
			}
		}
		return RootCause{
			Reason:     "rushed prototype",
			Detail:     "Demo data was hardcoded during rapid prototyping and never replaced with real data sources.",
			Likelihood: "possible",
		}

	// AI slop
	case f.Category == "ai-slop":
		if f.Rule == "AI001" || f.Rule == "AI007" {
			return RootCause{
				Reason:     "unfinished AI output",
				Detail:     "AI generated a skeleton with TODOs/stubs. The developer accepted it without implementing the marked sections.",
				Likelihood: "likely",
			}
		}
		if f.Rule == "AI005" {
			return RootCause{
				Reason:     "AI-generated comments kept verbatim",
				Detail:     "AI tends to write marketing-style descriptions. This comment adds no value and clutters the code.",
				Likelihood: "likely",
			}
		}
		return RootCause{
			Reason:     "copied AI output without review",
			Detail:     "This pattern is characteristic of AI-generated code that was accepted without editing.",
			Likelihood: "possible",
		}

	// Vibe code
	case f.Category == "vibe-code":
		if f.Rule == "VIBE001" { // empty catch
			return RootCause{
				Reason:     "error handling skipped",
				Detail:     "Developer (or AI) prioritized the happy path. Error handling was left empty to 'deal with later'.",
				Likelihood: "likely",
			}
		}
		if f.Rule == "VIBE003" { // any type
			return RootCause{
				Reason:     "TypeScript escape hatch",
				Detail:     "Using 'any' bypasses type safety. Usually done when the correct type is complex or the developer doesn't know it.",
				Likelihood: "likely",
			}
		}
		if f.Rule == "VIBE004" { // setTimeout simulation
			return RootCause{
				Reason:     "backend not ready",
				Detail:     "Frontend fakes async behavior with setTimeout because the real API endpoint doesn't exist yet.",
				Likelihood: "likely",
			}
		}
		return RootCause{
			Reason:     "code quality shortcut",
			Detail:     "Common pattern when moving fast. The code works but isn't production-quality.",
			Likelihood: "possible",
		}

	// Security
	case f.Category == "security":
		if strings.Contains(f.Rule, "VULN") {
			return RootCause{
				Reason:     "security not considered",
				Detail:     "This is a real vulnerability pattern. AI code generators frequently produce insecure code that looks correct.",
				Likelihood: "likely",
			}
		}
		return RootCause{
			Reason:     "missing security review",
			Detail:     "This code was likely never reviewed by someone with security expertise.",
			Likelihood: "possible",
		}

	// Auth
	case f.Category == "auth":
		return RootCause{
			Reason:     "auth added as afterthought",
			Detail:     "Authentication/authorization was not designed upfront. Routes were built first, auth middleware added later (incompletely).",
			Likelihood: "likely",
		}

	// Stubs
	case f.Category == "stubs":
		return RootCause{
			Reason:     "incomplete integration",
			Detail:     "The code acknowledges it needs a real implementation ('in production...') but the integration was never completed.",
			Likelihood: "likely",
		}

	// Test keys
	case f.Category == "test-keys":
		return RootCause{
			Reason:     "dev/prod separation missing",
			Detail:     "Test keys should only appear in test environments. If this is in production code, environment separation is broken.",
			Likelihood: "possible",
		}

	default:
		return RootCause{
			Reason:     "unclear",
			Detail:     "This finding needs human review to determine the root cause.",
			Likelihood: "unclear",
		}
	}
}

// ── CODEBASE MATURITY DETECTION ───────────────────────────────────────────

type MaturityLevel int

const (
	MaturityPrototype MaturityLevel = iota
	MaturityMVP
	MaturityBeta
	MaturityProductionish
	MaturityHardened
)

func (m MaturityLevel) String() string {
	return [...]string{"PROTOTYPE", "MVP", "BETA", "PRODUCTION-ISH", "HARDENED"}[m]
}

func (m MaturityLevel) Icon() string {
	return [...]string{"🔬", "🏗️", "🧪", "🏭", "🛡️"}[m]
}

func (m MaturityLevel) Color() string {
	return [...]string{red, yellow, cyan, green, green + bold}[m]
}

type MaturityReport struct {
	Level       MaturityLevel
	Score       int // 0-100
	Signals     []string
	Weaknesses  []string
}

func detectMaturity(report *Report, filesScanned int) MaturityReport {
	mr := MaturityReport{Score: 70} // start optimistic

	cats := report.Categories
	total := report.TotalCount

	// ── Negative signals ──────────────────────────────────────────

	if cats["secrets"] > 3 {
		mr.Score -= 25
		mr.Weaknesses = append(mr.Weaknesses, fmt.Sprintf("%d hardcoded secrets — no secrets management", cats["secrets"]))
	} else if cats["secrets"] > 0 {
		mr.Score -= 10
		mr.Weaknesses = append(mr.Weaknesses, fmt.Sprintf("%d secret(s) need attention", cats["secrets"]))
	}

	if cats["mock-data"] > 5 {
		mr.Score -= 20
		mr.Weaknesses = append(mr.Weaknesses, fmt.Sprintf("%d mock/fake data entries — not wired to real backends", cats["mock-data"]))
	} else if cats["mock-data"] > 0 {
		mr.Score -= 5
	}

	if cats["stubs"] > 3 {
		mr.Score -= 15
		mr.Weaknesses = append(mr.Weaknesses, fmt.Sprintf("%d stub endpoints — features not implemented", cats["stubs"]))
	}

	if cats["ai-slop"] > 10 {
		mr.Score -= 15
		mr.Weaknesses = append(mr.Weaknesses, fmt.Sprintf("%d AI-generated artifacts — code needs human review", cats["ai-slop"]))
	}

	if cats["vibe-code"] > 10 {
		mr.Score -= 10
		mr.Weaknesses = append(mr.Weaknesses, fmt.Sprintf("%d code quality issues — empty catches, any types, etc.", cats["vibe-code"]))
	}

	if cats["security"] > 5 {
		mr.Score -= 20
		mr.Weaknesses = append(mr.Weaknesses, fmt.Sprintf("%d security vulnerabilities — needs security review", cats["security"]))
	}

	if cats["auth"] > 0 {
		mr.Score -= 15
		mr.Weaknesses = append(mr.Weaknesses, fmt.Sprintf("%d auth issues — access control gaps", cats["auth"]))
	}

	// ── Positive signals ──────────────────────────────────────────

	if total == 0 {
		mr.Score = 95
		mr.Signals = append(mr.Signals, "Zero findings — code appears clean")
	}

	if filesScanned > 100 {
		mr.Signals = append(mr.Signals, fmt.Sprintf("%d files — substantial codebase", filesScanned))
	}

	findingRate := 0.0
	if filesScanned > 0 {
		findingRate = float64(total) / float64(filesScanned)
	}

	if findingRate < 0.02 {
		mr.Score += 10
		mr.Signals = append(mr.Signals, "Very low finding rate (<2% of files)")
	} else if findingRate < 0.1 {
		mr.Signals = append(mr.Signals, fmt.Sprintf("Finding rate: %.1f%%", findingRate*100))
	} else {
		mr.Score -= 10
		mr.Signals = append(mr.Signals, fmt.Sprintf("High finding rate: %.1f%% of files", findingRate*100))
	}

	if report.CriticalCount == 0 {
		mr.Score += 5
		mr.Signals = append(mr.Signals, "No critical findings")
	}

	// Clamp
	if mr.Score > 100 {
		mr.Score = 100
	}
	if mr.Score < 0 {
		mr.Score = 0
	}

	// Determine level
	switch {
	case mr.Score >= 85:
		mr.Level = MaturityHardened
	case mr.Score >= 70:
		mr.Level = MaturityProductionish
	case mr.Score >= 50:
		mr.Level = MaturityBeta
	case mr.Score >= 30:
		mr.Level = MaturityMVP
	default:
		mr.Level = MaturityPrototype
	}

	return mr
}

// ── SAFE AUTO-FIX CLASSIFICATION ──────────────────────────────────────────

// canAutoFix returns true if a finding is safe to auto-fix without human review
func canAutoFix(f Finding) bool {
	// NEVER auto-fix these categories — too dangerous
	switch f.Rule {
	case "AUTH001", "AUTH002", "AUTH003", "AUTH004": // auth logic
		return false
	case "VULN001", "VULN003", "GO001": // command injection, SQL injection
		return false
	case "CRYPTO001", "CRYPTO002", "CRYPTO003": // crypto decisions
		return false
	case "INPUT001", "INPUT002", "INPUT003": // input validation architecture
		return false
	}

	// SAFE to auto-fix
	switch f.Rule {
	case "VIBE002": // console.log removal
		return true
	case "VIBE005": // alert() → proper notification
		return true
	case "VIBE006": // FIXME/HACK/XXX normalization
		return true
	case "AI001": // TODO cleanup
		return true
	case "AI004": // instructional comment removal
		return true
	case "AI008": // "you should" comment rewrite
		return true
	case "MOCK005": // lorem ipsum removal
		return true
	case "NET001": // http.DefaultClient → timeout client
		return true
	case "INFRA002": // Dockerfile base image → slim variant
		return true
	}

	// Everything else needs human review
	return false
}

func autoFixLabel(f Finding) string {
	if canAutoFix(f) {
		return green + "AUTO-FIXABLE" + reset
	}
	return yellow + "NEEDS REVIEW" + reset
}

// ── ENHANCED FINDING DISPLAY ──────────────────────────────────────────────

func printEnhancedFinding(f Finding, idx int) {
	sColor := sevColor(f.Severity)
	cause := analyzeRootCause(f)
	fixable := autoFixLabel(f)
	d := diagnose(f, nil) // surrounding lines loaded during scan, use nil for display
	verdict := classifySystem(f, f.Snippet, f.ConfidenceReasons)

	// Risk level color
	riskColor := gray
	switch d.RiskLevel {
	case "showstopper":
		riskColor = bgRed + white + bold
	case "critical-path":
		riskColor = red + bold
	case "exploitable":
		riskColor = red
	case "low":
		riskColor = yellow
	}

	fmt.Printf("\n  %s┌─ Finding #%d ─────────────────────────────────────────┐%s\n", dim, idx, reset)
	fmt.Printf("  %s│%s %s %s %s  %s%s%s  conf:%s%.2f%s  %s\n",
		dim, reset,
		sColor, f.Severity.Label(), reset,
		gray, f.Rule, reset,
		cyan, f.Confidence, reset,
		fixable)
	fmt.Printf("  %s│%s %sRisk:%s %s%s%s  %sVerdict:%s %s%s %s%s  %sFix safety:%s %s\n",
		dim, reset,
		dim, reset, riskColor, d.RiskLevel, reset,
		dim, reset, verdict.Color(), verdict.Icon(), verdict, reset,
		dim, reset, fixSafetyBar(d.FixSafety))
	fmt.Printf("  %s│%s\n", dim, reset)
	fmt.Printf("  %s│%s %s📄 %s:%d%s\n", dim, reset, bold, f.File, f.Line, reset)
	fmt.Printf("  %s│%s %s%s%s\n", dim, reset, white, f.Message, reset)
	if f.Snippet != "" {
		fmt.Printf("  %s│%s\n", dim, reset)
		fmt.Printf("  %s│%s %s  %s%s\n", dim, reset, gray, truncate(f.Snippet, 90), reset)
	}

	// What to check
	fmt.Printf("  %s│%s\n", dim, reset)
	fmt.Printf("  %s│%s %s🔍 What to check:%s\n", dim, reset, bold, reset)
	switch f.Category {
	case "secrets":
		fmt.Printf("  %s│%s   • Is this a real credential or a test/example key?\n", dim, reset)
		fmt.Printf("  %s│%s   • Is the file in .gitignore?\n", dim, reset)
		fmt.Printf("  %s│%s   • Has this been committed to git history?\n", dim, reset)
	case "security":
		fmt.Printf("  %s│%s   • Is the input attacker-controlled?\n", dim, reset)
		fmt.Printf("  %s│%s   • Is there already a size/validation cap?\n", dim, reset)
		fmt.Printf("  %s│%s   • Is this only local tooling or production?\n", dim, reset)
	case "mock-data":
		fmt.Printf("  %s│%s   • Is the real backend endpoint implemented?\n", dim, reset)
		fmt.Printf("  %s│%s   • Is this intentional fallback data?\n", dim, reset)
	case "auth":
		fmt.Printf("  %s│%s   • Is auth middleware applied to this route?\n", dim, reset)
		fmt.Printf("  %s│%s   • Can this endpoint be accessed without authentication?\n", dim, reset)
		fmt.Printf("  %s│%s   • Is role/permission checked (not just authentication)?\n", dim, reset)
	default:
		fmt.Printf("  %s│%s   • Does this need to be fixed before shipping?\n", dim, reset)
	}

	// Patch fix vs better fix
	fmt.Printf("  %s│%s\n", dim, reset)
	if d.BetterFix != "" && d.BetterFix != f.Fix {
		fmt.Printf("  %s│%s %s🩹 Quick patch:%s %s\n", dim, reset, yellow, reset, f.Fix)
		fmt.Printf("  %s│%s %s✅ Better fix:%s\n", dim, reset, green+bold, reset)
		for _, line := range strings.Split(d.BetterFix, "\n") {
			fmt.Printf("  %s│%s     %s\n", dim, reset, strings.TrimSpace(line))
		}
	} else if f.Fix != "" {
		fmt.Printf("  %s│%s %s✅ Fix:%s %s\n", dim, reset, green+bold, reset, f.Fix)
	}

	// Architectural issue flag
	if d.IsArchIssue {
		fmt.Printf("  %s│%s\n", dim, reset)
		fmt.Printf("  %s│%s %s🏗️  ARCHITECTURAL ISSUE%s\n", dim, reset, red+bold, reset)
		fmt.Printf("  %s│%s %s  %s%s\n", dim, reset, dim, d.ArchAnalysis, reset)
	}

	// Intent detection
	if d.Intent != "" {
		fmt.Printf("  %s│%s\n", dim, reset)
		fmt.Printf("  %s│%s %s🎯 Intent:%s %s\n", dim, reset, cyan, reset, d.Intent)
	}

	// Why this happened
	fmt.Printf("  %s│%s %s💭 Why:%s %s (%s)\n", dim, reset, yellow, reset, cause.Reason, cause.Likelihood)

	// Human review needed?
	fmt.Printf("  %s│%s\n", dim, reset)
	if canAutoFix(f) {
		fmt.Printf("  %s│%s %s👤 Human review: No — safe to auto-fix%s\n", dim, reset, green, reset)
	} else {
		fmt.Printf("  %s│%s %s👤 Human review: Yes — requires judgment%s\n", dim, reset, yellow, reset)
	}

	fmt.Printf("  %s└──────────────────────────────────────────────────────┘%s\n", dim, reset)
}

// printMaturity renders the codebase maturity assessment
func printMaturity(mr MaturityReport) {
	fmt.Printf("\n  %s╔══════════════════════════════════════════════════════════╗%s\n", dim, reset)
	fmt.Printf("  %s║%s  %s CODEBASE MATURITY: %s%s%s %s%s   Score: %d/100         %s║%s\n",
		dim, reset,
		mr.Level.Icon(), mr.Level.Color(), mr.Level, reset, dim, reset, mr.Score, dim, reset)
	fmt.Printf("  %s╚══════════════════════════════════════════════════════════╝%s\n", dim, reset)

	if len(mr.Signals) > 0 {
		fmt.Printf("  %s Signals:%s\n", dim, reset)
		for _, s := range mr.Signals {
			fmt.Printf("    %s•%s %s\n", green, reset, s)
		}
	}
	if len(mr.Weaknesses) > 0 {
		fmt.Printf("  %s Weaknesses:%s\n", dim, reset)
		for _, w := range mr.Weaknesses {
			fmt.Printf("    %s•%s %s\n", red, reset, w)
		}
	}
	fmt.Println()

	// Upgrade path
	if mr.Level < MaturityHardened {
		nextLevel := mr.Level + 1
		fmt.Printf("  %s To reach %s:%s\n", dim, nextLevel, reset)
		switch mr.Level {
		case MaturityPrototype:
			fmt.Printf("    → Remove all hardcoded secrets\n")
			fmt.Printf("    → Replace mock data with real API calls\n")
			fmt.Printf("    → Add basic error handling\n")
		case MaturityMVP:
			fmt.Printf("    → Fix security vulnerabilities (run mockhunter fix --category security)\n")
			fmt.Printf("    → Implement stub endpoints\n")
			fmt.Printf("    → Add input validation on all boundaries\n")
		case MaturityBeta:
			fmt.Printf("    → Add auth middleware to all sensitive routes\n")
			fmt.Printf("    → Remove AI slop (TODOs, narrative comments)\n")
			fmt.Printf("    → Add rate limiting and request size limits\n")
		case MaturityProductionish:
			fmt.Printf("    → Pass security audit (zero HIGH/CRITICAL findings)\n")
			fmt.Printf("    → Add observability (structured logging, metrics)\n")
			fmt.Printf("    → Implement graceful degradation for all dependencies\n")
		}
		fmt.Println()
	}
}

// fileCategory returns the broad category of a file for maturity signals
func fileCategory(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".go":
		return "go"
	case ".ts", ".tsx":
		return "typescript"
	case ".py":
		return "python"
	case ".js", ".jsx":
		return "javascript"
	case ".yaml", ".yml":
		return "config"
	default:
		return "other"
	}
}
