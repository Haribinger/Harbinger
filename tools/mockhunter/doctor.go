package main

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

// ToolStatus represents the availability of an external tool
type ToolStatus struct {
	Name      string
	Available bool
	Version   string
	Path      string
	Purpose   string
	Icon      string
}

// runDoctor checks the environment and reports what's available
func runDoctor() {
	printBanner()
	fmt.Printf("  %s%sSYSTEM DOCTOR%s — checking your environment\n\n", bold, cyan, reset)

	// ── AI Fixers ─────────────────────────────────────────────────────
	fmt.Printf("  %s%s🤖 AI CODE FIXERS%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)

	aiTools := []ToolStatus{
		checkTool("claude", "Claude Code CLI", "Best for in-context fixes, security review", "🟣"),
		checkTool("gemini", "Gemini CLI", "Fast bulk fixes, comment cleanup", "🔵"),
		checkTool("ollama", "Ollama (local LLM)", "Free, private, no API key needed", "🟢"),
		checkTool("opencode", "OpenCode CLI", "Alternative AI coder", "⚪"),
		checkTool("aider", "Aider", "Git-aware AI pair programmer", "🟡"),
		checkTool("cursor", "Cursor", "AI-first editor", "🟤"),
	}
	availableFixers := 0
	for _, t := range aiTools {
		printToolStatus(t)
		if t.Available {
			availableFixers++
		}
	}
	fmt.Println()

	// ── Security Scanners ─────────────────────────────────────────────
	fmt.Printf("  %s%s🛡️  SECURITY SCANNERS%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)

	secTools := []ToolStatus{
		checkTool("bandit", "Bandit", "Python security linter (OWASP)", "🐍"),
		checkTool("gitleaks", "Gitleaks", "Secret scanner (pre-commit)", "🔐"),
		checkTool("semgrep", "Semgrep", "SAST — multi-language rules", "🔍"),
		checkTool("gosec", "gosec", "Go security checker", "🐹"),
		checkTool("trivy", "Trivy", "Container + dependency scanner", "🐳"),
		checkTool("trufflehog", "TruffleHog", "Deep secret detection", "🐷"),
		checkTool("snyk", "Snyk CLI", "Vulnerability + license scanning", "🐛"),
	}
	for _, t := range secTools {
		printToolStatus(t)
	}
	fmt.Println()

	// ── Code Quality ──────────────────────────────────────────────────
	fmt.Printf("  %s%s📐 CODE QUALITY%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)

	qualTools := []ToolStatus{
		checkTool("eslint", "ESLint", "JS/TS linting + security plugins", "📝"),
		checkTool("golangci-lint", "golangci-lint", "Go meta-linter (40+ linters)", "🐹"),
		checkTool("ruff", "Ruff", "Fast Python linter (replaces flake8)", "⚡"),
		checkTool("mypy", "mypy", "Python type checker", "🐍"),
		checkTool("tsc", "TypeScript", "Type checking (tsc --noEmit)", "🔷"),
	}
	for _, t := range qualTools {
		printToolStatus(t)
	}
	fmt.Println()

	// ── Runtime Info ──────────────────────────────────────────────────
	fmt.Printf("  %s%s⚙️  RUNTIME%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)
	fmt.Printf("    %sOS:%s       %s/%s\n", dim, reset, runtime.GOOS, runtime.GOARCH)
	fmt.Printf("    %sGo:%s       %s\n", dim, reset, runtime.Version())
	fmt.Printf("    %sRules:%s    %d rules across %d categories\n", dim, reset, len(allRules()), countCategories())
	fmt.Printf("    %sVersion:%s  mockhunter v%s\n", dim, reset, version)
	fmt.Println()

	// ── Summary ───────────────────────────────────────────────────────
	fmt.Printf("  %s═══════════════════════════════════════════════════════════%s\n", dim, reset)
	if availableFixers == 0 {
		fmt.Printf("  %s%s⚠ No AI fixers found!%s Install one to enable auto-fix:\n", yellow, bold, reset)
		fmt.Printf("    %s• ollama%s  — curl -fsSL https://ollama.com/install.sh | sh\n", bold, reset)
		fmt.Printf("    %s• claude%s  — npm install -g @anthropic-ai/claude-code\n", bold, reset)
		fmt.Printf("    %s• gemini%s  — npm install -g @anthropic-ai/gemini\n", bold, reset)
	} else {
		fmt.Printf("  %s%s✔ %d AI fixer(s) available%s — run %smockhunter fix%s to auto-fix findings\n",
			green, bold, availableFixers, reset, bold, reset)
	}
	fmt.Println()
}

func checkTool(name, displayName, purpose, icon string) ToolStatus {
	path, err := exec.LookPath(name)
	if err != nil {
		return ToolStatus{Name: displayName, Available: false, Purpose: purpose, Icon: icon}
	}
	ver := getToolVersion(name)
	return ToolStatus{Name: displayName, Available: true, Version: ver, Path: path, Purpose: purpose, Icon: icon}
}

func getToolVersion(name string) string {
	// Try common version flags
	for _, flag := range []string{"--version", "-v", "version", "-V"} {
		cmd := exec.Command(name, flag)
		out, err := cmd.Output()
		if err == nil {
			v := strings.TrimSpace(string(out))
			// Take first line only
			if idx := strings.IndexByte(v, '\n'); idx > 0 {
				v = v[:idx]
			}
			if len(v) > 60 {
				v = v[:60]
			}
			return v
		}
	}
	return "installed"
}

func printToolStatus(t ToolStatus) {
	if t.Available {
		ver := t.Version
		if len(ver) > 40 {
			ver = ver[:40] + "..."
		}
		fmt.Printf("    %s %s%s ✔%s %-18s %s%s%s\n", t.Icon, green, bold, reset, t.Name, dim, ver, reset)
	} else {
		fmt.Printf("    %s %s✗%s %-18s %s%s%s\n", t.Icon, gray, reset, t.Name, dim, t.Purpose, reset)
	}
}

func countCategories() int {
	cats := make(map[string]bool)
	for _, r := range allRules() {
		cats[r.Category] = true
	}
	return len(cats)
}

// ── Warning Status Display ────────────────────────────────────────────────

type WarningLevel int

const (
	StatusOK WarningLevel = iota
	StatusWarn
	StatusDanger
	StatusCritical
)

func (w WarningLevel) Icon() string {
	return [...]string{"✔", "⚠", "✖", "🚨"}[w]
}

func (w WarningLevel) Color() string {
	return [...]string{green, yellow, red, bgRed + white + bold}[w]
}

// printWarningStatus shows a beautiful status line for a finding category
func printWarningStatus(label string, count int, total int) {
	level := StatusOK
	pct := 0
	if total > 0 {
		pct = (count * 100) / total
	}

	switch {
	case count == 0:
		level = StatusOK
	case pct <= 5:
		level = StatusWarn
	case pct <= 20:
		level = StatusDanger
	default:
		level = StatusCritical
	}

	barWidth := 20
	filled := 0
	if total > 0 {
		filled = (count * barWidth) / total
		if filled < 1 && count > 0 {
			filled = 1
		}
	}

	barStr := level.Color() + strings.Repeat("█", filled) + reset + strings.Repeat("░", barWidth-filled)

	fmt.Printf("    %s%s%s %-14s %s %3d/%d (%d%%)\n",
		level.Color(), level.Icon(), reset,
		label, barStr, count, total, pct)
}

// printOnboardingTip shows a contextual tip based on scan results
func printOnboardingTips(report *Report) {
	if report.TotalCount == 0 {
		return
	}

	fmt.Printf("\n  %s%s💡 RECOMMENDATIONS%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)

	if report.Categories["secrets"] > 0 {
		fmt.Printf("    %s🔑 SECRETS:%s %d found — run %smockhunter fix --category secrets%s\n",
			red+bold, reset, report.Categories["secrets"], bold, reset)
		fmt.Printf("       %sTip: Install gitleaks for deep secret scanning%s\n", dim, reset)
	}

	if report.Categories["security"] > 0 {
		fmt.Printf("    %s🛡️  SECURITY:%s %d vulns — run %smockhunter fix --category security%s\n",
			red+bold, reset, report.Categories["security"], bold, reset)
		fmt.Printf("       %sTip: Install semgrep for SAST analysis%s\n", dim, reset)
	}

	if report.Categories["vibe-code"] > 0 {
		fmt.Printf("    %s🎸 VIBE CODE:%s %d issues — run %smockhunter fix --category vibe-code%s\n",
			yellow, reset, report.Categories["vibe-code"], bold, reset)
		fmt.Printf("       %sTip: These are the patterns AI generates that humans wouldn't%s\n", dim, reset)
	}

	if report.Categories["ai-slop"] > 0 {
		fmt.Printf("    %s🤖 AI SLOP:%s %d items — run %smockhunter fix --category ai-slop%s\n",
			yellow, reset, report.Categories["ai-slop"], bold, reset)
		fmt.Printf("       %sTip: Narrative TODOs, buzzword comments, empty stubs%s\n", dim, reset)
	}

	if report.Categories["mock-data"] > 0 {
		fmt.Printf("    %s🎭 MOCK DATA:%s %d items — run %smockhunter fix --category mock-data%s\n",
			magenta, reset, report.Categories["mock-data"], bold, reset)
	}

	if report.Categories["stubs"] > 0 {
		fmt.Printf("    %s🚧 STUBS:%s %d items — implement real logic or return not_configured\n",
			cyan, reset, report.Categories["stubs"])
	}

	// Show available fixers
	fmt.Printf("\n  %s%s🔧 AVAILABLE FIXERS%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)

	fixers := detectFixers()
	if len(fixers) == 0 {
		fmt.Printf("    %s⚠ No AI fixers installed. Install one:%s\n", yellow, reset)
		fmt.Printf("      %s$ curl -fsSL https://ollama.com/install.sh | sh%s  (free, local)\n", dim, reset)
	} else {
		for _, f := range fixers {
			fmt.Printf("    %s%s%s %-12s %s$ mockhunter fix --fixer %s%s\n",
				green, f.Icon, reset, f.Name, dim, strings.ToLower(f.Name), reset)
		}
	}
	fmt.Println()
}

func detectFixers() []ToolStatus {
	var fixers []ToolStatus
	candidates := []struct {
		bin, name, icon string
	}{
		{"claude", "Claude", "🟣"},
		{"gemini", "Gemini", "🔵"},
		{"ollama", "Ollama", "🟢"},
		{"opencode", "OpenCode", "⚪"},
		{"aider", "Aider", "🟡"},
	}
	for _, c := range candidates {
		if _, err := exec.LookPath(c.bin); err == nil {
			fixers = append(fixers, ToolStatus{Name: c.name, Available: true, Icon: c.icon})
		}
	}
	return fixers
}

func printBanner() {
	fmt.Printf("\n%s%s", bold, white)
	fmt.Printf("  ╔══════════════════════════════════════════════════════════════╗\n")
	fmt.Printf("  ║                                                              ║\n")
	fmt.Printf("  ║   %s░█▄▒▄█ ▄▀▄ ▄▀▀ █▄▀ █▄█ █ █ █▄ █ ▀█▀ █▀▀ █▀▄%s            ║\n", yellow, white)
	fmt.Printf("  ║   %s░█▀▒▀█ ▀▄▀ ▀▄▄ █▀▄ █ █ ▀▄█ █ ▀█  █  █▄▄ █▀▄%s  v%s   ║\n", yellow, white, version)
	fmt.Printf("  ║                                                              ║\n")
	fmt.Printf("  ║   %sAI Slop • Mock Data • Secrets • Vibe Code Hunter%s         ║\n", dim, white)
	fmt.Printf("  ║                                                              ║\n")
	fmt.Printf("  ╚══════════════════════════════════════════════════════════════╝%s\n\n", reset)
}

func printUsage() {
	printBanner()
	fmt.Printf("  %s%sUSAGE%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n\n", dim, reset)

	fmt.Printf("    %smockhunter%s %sscan%s [flags]     Scan directory for issues\n", bold, reset, cyan, reset)
	fmt.Printf("    %smockhunter%s %sfix%s  [flags]     Auto-fix findings with AI\n", bold, reset, green, reset)
	fmt.Printf("    %smockhunter%s %sdoctor%s           Check environment & available tools\n", bold, reset, yellow, reset)
	fmt.Printf("    %smockhunter%s %sserve%s [addr]     Start HTTP API server\n", bold, reset, magenta, reset)
	fmt.Printf("    %smockhunter%s %shelp%s             Show this help\n\n", bold, reset, white, reset)

	fmt.Printf("  %s%sSCAN FLAGS%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)
	fmt.Printf("    --dir PATH            Directory to scan (default: .)\n")
	fmt.Printf("    --min-severity LEVEL  Minimum severity: info, low, medium, high, critical\n")
	fmt.Printf("    --min-confidence N    Minimum confidence 0.0-1.0 (default: 0.35)\n")
	fmt.Printf("    --category CAT        Filter: secrets, mock-data, ai-slop, vibe-code, security, stubs, auth\n")
	fmt.Printf("    --exclude-tests       Skip test files\n")
	fmt.Printf("    --external            Also run bandit, gitleaks, semgrep if installed\n")
	fmt.Printf("    --format FORMAT       Output: text, json, sarif\n")
	fmt.Printf("    --show-noise          Show all findings including low-confidence\n\n")

	fmt.Printf("  %s%sFIX FLAGS%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)
	fmt.Printf("    --fixer TOOL          Choose fixer: claude, gemini, ollama, opencode, aider\n")
	fmt.Printf("    --auto                Fix without asking (dangerous!)\n")
	fmt.Printf("    --dry-run             Show what would be fixed without changing files\n\n")

	fmt.Printf("  %s%sEXAMPLES%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)
	fmt.Printf("    %s$ mockhunter scan --dir . --min-severity high%s\n", dim, reset)
	fmt.Printf("    %s$ mockhunter scan --category secrets --format json%s\n", dim, reset)
	fmt.Printf("    %s$ mockhunter fix --fixer ollama --category vibe-code%s\n", dim, reset)
	fmt.Printf("    %s$ mockhunter doctor%s\n", dim, reset)
	fmt.Printf("    %s$ mockhunter serve :3010%s\n\n", dim, reset)

	fmt.Printf("  %s%sEXIT CODES%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)
	fmt.Printf("    0  No high/critical findings\n")
	fmt.Printf("    1  High severity findings present\n")
	fmt.Printf("    2  Critical severity findings present\n\n")
}

// ── SETUP WIZARD ──────────────────────────────────────────────────────────

func runSetup() {
	printBanner()
	fmt.Printf("  %s%s🚀 SETUP WIZARD%s — install recommended tools\n\n", bold, cyan, reset)

	type setupItem struct {
		name, bin, install, purpose, icon string
	}

	items := []setupItem{
		{"Ollama (Local AI)", "ollama", "curl -fsSL https://ollama.com/install.sh | sh", "Free local LLM for auto-fixing", "🟢"},
		{"Gitleaks", "gitleaks", "brew install gitleaks || go install github.com/gitleaks/gitleaks/v8@latest", "Deep secret scanning", "🔐"},
		{"Semgrep", "semgrep", "pip install semgrep", "SAST scanner (1000+ rules)", "🔍"},
		{"Bandit", "bandit", "pip install bandit", "Python security linter", "🐍"},
		{"golangci-lint", "golangci-lint", "go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest", "Go mega-linter", "🐹"},
		{"Ruff", "ruff", "pip install ruff", "Fast Python linter", "⚡"},
		{"Trivy", "trivy", "brew install trivy", "Container + dep scanner", "🐳"},
	}

	fmt.Printf("  %sChecking installed tools...%s\n\n", dim, reset)

	var missing []setupItem
	for _, item := range items {
		if _, err := exec.LookPath(item.bin); err == nil {
			fmt.Printf("    %s %s%s ✔%s %s\n", item.icon, green, bold, reset, item.name)
		} else {
			fmt.Printf("    %s %s✗%s %s — %s%s%s\n", item.icon, gray, reset, item.name, dim, item.purpose, reset)
			missing = append(missing, item)
		}
	}

	if len(missing) == 0 {
		fmt.Printf("\n  %s%s✔ All recommended tools installed!%s\n\n", green, bold, reset)
		return
	}

	fmt.Printf("\n  %s%sMissing %d tool(s). Install commands:%s\n\n", yellow, bold, len(missing), reset)
	for i, item := range missing {
		fmt.Printf("    %s%d.%s %s%s%s\n", bold, i+1, reset, cyan, item.name, reset)
		fmt.Printf("       %s$ %s%s\n\n", dim, item.install, reset)
	}
	fmt.Printf("  %sTip: Run each command, then %smockhunter doctor%s to verify.%s\n\n", dim, bold, dim, reset)
}
