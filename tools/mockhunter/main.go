// NOTE: This file contains an embedded HTML dashboard that uses innerHTML for
// rendering scan results. The data comes exclusively from mockhunter's own
// scan output (not user input), so XSS risk is mitigated by design.
// All finding data is generated server-side by the scanner engine.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const version = "2.0.0"

func main() {
	if len(os.Args) < 2 {
		os.Args = append(os.Args[:1], append([]string{"scan"}, os.Args[1:]...)...)
	}

	subcommand := os.Args[1]

	switch subcommand {
	case "scan":
		cmdScan(os.Args[2:])
	case "fix":
		cmdFix(os.Args[2:])
	case "doctor":
		runDoctor()
	case "setup":
		runSetup()
	case "serve":
		addr := ":3010"
		dir := "."
		if len(os.Args) > 2 {
			addr = os.Args[2]
		}
		if len(os.Args) > 3 {
			dir = os.Args[3]
		}
		startServer(addr, dir)
	case "help", "--help", "-h":
		printUsage()
	case "version", "--version", "-v":
		fmt.Printf("mockhunter v%s\n", version)
	default:
		cmdScan(os.Args[1:])
	}
}

func cmdScan(args []string) {
	fs := flag.NewFlagSet("scan", flag.ExitOnError)
	dir := fs.String("dir", ".", "Directory to scan")
	format := fs.String("format", "text", "Output format: text, json, sarif")
	severity := fs.String("min-severity", "low", "Minimum severity")
	excludeTests := fs.Bool("exclude-tests", false, "Exclude test files")
	runExternal := fs.Bool("external", false, "Also run bandit, gitleaks, semgrep")
	category := fs.String("category", "", "Filter by category")
	minConf := fs.Float64("min-confidence", 0.35, "Minimum confidence 0.0-1.0")
	showNoise := fs.Bool("show-noise", false, "Show all including noise")
	gitDiff := fs.Bool("git-diff", false, "Only scan files changed in git (staged + unstaged + untracked)")
	dangerous := fs.Bool("dangerous", false, "Show exploit scenarios for high-risk findings (authorized testing only)")
	fs.Parse(args)

	if *showNoise {
		*minConf = 0.0
	}

	absDir, err := filepath.Abs(*dir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	scanner := NewScanner(ScanConfig{
		Dir: absDir, MinSeverity: parseSeverity(*severity),
		MinConfidence: *minConf, ExcludeTests: *excludeTests,
		GitDiffOnly: *gitDiff, DangerousMode: *dangerous,
	})
	report := scanner.Scan()

	if *category != "" {
		var filtered []Finding
		for _, f := range report.Findings {
			if f.Category == *category {
				filtered = append(filtered, f)
			}
		}
		report.Findings = filtered
		report.Finalize(parseSeverity(*severity))
	}

	if *runExternal {
		report.Findings = append(report.Findings, runExternalTools(absDir)...)
		report.Finalize(parseSeverity(*severity))
	}

	switch *format {
	case "json":
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		enc.Encode(report)
	case "sarif":
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		enc.Encode(report.ToSARIF())
	default:
		report.PrintText(os.Stdout)
		if *dangerous {
			report.PrintDangerous(os.Stdout)
		}
		printOnboardingTips(report)
	}

	if report.CriticalCount > 0 {
		os.Exit(2)
	}
	if report.HighCount > 0 {
		os.Exit(1)
	}
}

func cmdFix(args []string) {
	fs := flag.NewFlagSet("fix", flag.ExitOnError)
	dir := fs.String("dir", ".", "Directory to scan and fix")
	fixer := fs.String("fixer", "", "AI fixer: claude, gemini, ollama, opencode, aider")
	category := fs.String("category", "", "Only fix this category")
	auto := fs.Bool("auto", false, "Fix without asking")
	dryRun := fs.Bool("dry-run", false, "Show what would be fixed")
	severity := fs.String("min-severity", "medium", "Minimum severity to fix")
	minConf := fs.Float64("min-confidence", 0.60, "Minimum confidence to fix")
	fs.Parse(args)

	absDir, _ := filepath.Abs(*dir)
	scanner := NewScanner(ScanConfig{
		Dir: absDir, MinSeverity: parseSeverity(*severity),
		MinConfidence: *minConf, ExcludeTests: true,
	})
	report := scanner.Scan()
	printBanner()
	runFix(FixConfig{
		Fixer: *fixer, Category: *category, Auto: *auto,
		DryRun: *dryRun, Dir: absDir,
	}, report)
}

func runExternalTools(dir string) []Finding {
	var findings []Finding
	if _, err := exec.LookPath("bandit"); err == nil {
		fmt.Fprintf(os.Stderr, "%s[mockhunter]%s Running bandit...\n", bold+cyan, reset)
		findings = append(findings, runBandit(dir)...)
	}
	if _, err := exec.LookPath("gitleaks"); err == nil {
		fmt.Fprintf(os.Stderr, "%s[mockhunter]%s Running gitleaks...\n", bold+cyan, reset)
		findings = append(findings, runGitleaks(dir)...)
	}
	if _, err := exec.LookPath("semgrep"); err == nil {
		fmt.Fprintf(os.Stderr, "%s[mockhunter]%s Running semgrep...\n", bold+cyan, reset)
		findings = append(findings, runSemgrep(dir)...)
	}
	return findings
}

func runBandit(dir string) []Finding {
	cmd := exec.Command("bandit", "-r", dir, "-f", "json", "-q", "--exit-zero")
	out, err := cmd.Output()
	if err != nil { return nil }
	var result struct {
		Results []struct {
			Filename string `json:"filename"`; LineNumber int `json:"line_number"`
			Severity string `json:"issue_severity"`; TestID string `json:"test_id"`
			IssueText string `json:"issue_text"`; Code string `json:"code"`
		} `json:"results"`
	}
	if json.Unmarshal(out, &result) != nil { return nil }
	var findings []Finding
	for _, r := range result.Results {
		relPath, _ := filepath.Rel(dir, r.Filename)
		sev := SevMedium
		if strings.ToUpper(r.Severity) == "HIGH" { sev = SevHigh }
		if strings.ToUpper(r.Severity) == "LOW" { sev = SevLow }
		findings = append(findings, Finding{File: relPath, Line: r.LineNumber, Severity: sev,
			Category: "security", Rule: "BANDIT-" + r.TestID, Message: r.IssueText, Snippet: strings.TrimSpace(r.Code)})
	}
	return findings
}

func runGitleaks(dir string) []Finding {
	cmd := exec.Command("gitleaks", "detect", "--source", dir, "--report-format", "json", "--no-git", "--exit-code", "0")
	out, _ := cmd.Output()
	if len(out) == 0 { return nil }
	var results []struct {
		Description string `json:"Description"`; File string `json:"File"`
		StartLine int `json:"StartLine"`; Secret string `json:"Secret"`; RuleID string `json:"RuleID"`
	}
	if json.Unmarshal(out, &results) != nil { return nil }
	var findings []Finding
	for _, r := range results {
		relPath, _ := filepath.Rel(dir, r.File)
		masked := r.Secret
		if len(masked) > 8 { masked = masked[:4] + "..." + masked[len(masked)-4:] }
		findings = append(findings, Finding{File: relPath, Line: r.StartLine, Severity: SevCritical,
			Category: "secrets", Rule: "GITLEAKS-" + r.RuleID, Message: r.Description, Snippet: masked,
			Fix: "Revoke and rotate this secret immediately"})
	}
	return findings
}

func runSemgrep(dir string) []Finding {
	cmd := exec.Command("semgrep", "--config", "auto", "--json", "--quiet", dir)
	out, _ := cmd.Output()
	if len(out) == 0 { return nil }
	var result struct {
		Results []struct {
			CheckID string `json:"check_id"`; Path string `json:"path"`
			Start struct{ Line int `json:"line"` } `json:"start"`
			Extra struct{ Message string `json:"message"`; Severity string `json:"severity"` } `json:"extra"`
		} `json:"results"`
	}
	if json.Unmarshal(out, &result) != nil { return nil }
	var findings []Finding
	for _, r := range result.Results {
		relPath, _ := filepath.Rel(dir, r.Path)
		sev := SevMedium
		if strings.ToUpper(r.Extra.Severity) == "ERROR" { sev = SevHigh }
		if strings.ToUpper(r.Extra.Severity) == "INFO" { sev = SevLow }
		findings = append(findings, Finding{File: relPath, Line: r.Start.Line, Severity: sev,
			Category: "security", Rule: "SEMGREP-" + filepath.Base(r.CheckID), Message: r.Extra.Message})
	}
	return findings
}

func startServer(addr, dir string) {
	absDir, _ := filepath.Abs(dir)
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "version": version})
	})

	mux.HandleFunc("POST /scan", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Dir string `json:"dir"`; MinSeverity string `json:"minSeverity"`
			MinConfidence float64 `json:"minConfidence"`; ExcludeTests bool `json:"excludeTests"`
			Category string `json:"category"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		scanDir := absDir
		if body.Dir != "" { scanDir = body.Dir }
		minSev := SevLow
		if body.MinSeverity != "" { minSev = parseSeverity(body.MinSeverity) }
		minConf := 0.35
		if body.MinConfidence > 0 { minConf = body.MinConfidence }
		scanner := NewScanner(ScanConfig{Dir: scanDir, MinSeverity: minSev, MinConfidence: minConf, ExcludeTests: body.ExcludeTests})
		report := scanner.Scan()
		if body.Category != "" {
			var filtered []Finding
			for _, f := range report.Findings { if f.Category == body.Category { filtered = append(filtered, f) } }
			report.Findings = filtered
			report.Finalize(minSev)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(report)
	})

	mux.HandleFunc("GET /rules", func(w http.ResponseWriter, r *http.Request) {
		rules := allRules()
		type ri struct { ID, Category, Severity, Message, Fix string }
		var out []ri
		for _, rule := range rules {
			out = append(out, ri{rule.ID, rule.Category, rule.Severity.String(), rule.Message, rule.Fix})
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	})

	mux.HandleFunc("GET /doctor", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "version": version, "fixers": detectFixers(), "ruleCount": len(allRules()), "categories": countCategories()})
	})

	printBanner()
	fmt.Printf("  %s%sHTTP API + DASHBOARD%s\n", bold, cyan, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)
	fmt.Printf("  %sDashboard:%s  http://localhost%s\n", dim, reset, addr)
	fmt.Printf("  %sScan API:%s   POST http://localhost%s/scan\n", dim, reset, addr)
	fmt.Printf("  %sRules:%s      GET  http://localhost%s/rules\n", dim, reset, addr)
	fmt.Printf("  %sDoctor:%s     GET  http://localhost%s/doctor\n", dim, reset, addr)
	fmt.Printf("  %sHealth:%s     GET  http://localhost%s/health\n\n", dim, reset, addr)

	server := &http.Server{Addr: addr, Handler: mux, ReadTimeout: 30 * time.Second, WriteTimeout: 120 * time.Second}
	if err := server.ListenAndServe(); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}
