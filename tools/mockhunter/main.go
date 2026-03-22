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

const version = "1.0.0"

func main() {
	dir := flag.String("dir", ".", "Directory to scan")
	format := flag.String("format", "text", "Output format: text, json, sarif")
	severity := flag.String("min-severity", "low", "Minimum severity: info, low, medium, high, critical")
	serve := flag.String("serve", "", "Start HTTP API on this address (e.g. :3010)")
	excludeTests := flag.Bool("exclude-tests", false, "Exclude test files from scan")
	runExternal := flag.Bool("external", false, "Also run external tools (bandit, gitleaks, eslint) if installed")
	category := flag.String("category", "", "Filter by category: secrets, mock-data, ai-slop, vibe-code, security, stubs")
	flag.Parse()

	if *serve != "" {
		startServer(*serve, *dir)
		return
	}

	absDir, err := filepath.Abs(*dir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	scanner := NewScanner(ScanConfig{
		Dir:          absDir,
		MinSeverity:  parseSeverity(*severity),
		ExcludeTests: *excludeTests,
	})
	report := scanner.Scan()

	// Filter by category if specified
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

	// Run external tools if requested
	if *runExternal {
		extFindings := runExternalTools(absDir)
		report.Findings = append(report.Findings, extFindings...)
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
	}

	if report.CriticalCount > 0 {
		os.Exit(2)
	}
	if report.HighCount > 0 {
		os.Exit(1)
	}
}

// runExternalTools attempts to run available external security scanners
func runExternalTools(dir string) []Finding {
	var findings []Finding

	// bandit (Python security linter)
	if _, err := exec.LookPath("bandit"); err == nil {
		fmt.Fprintf(os.Stderr, "%s[mockhunter]%s Running bandit (Python security scanner)...\n", bold+cyan, reset)
		findings = append(findings, runBandit(dir)...)
	}

	// gitleaks (secret scanner)
	if _, err := exec.LookPath("gitleaks"); err == nil {
		fmt.Fprintf(os.Stderr, "%s[mockhunter]%s Running gitleaks (secret scanner)...\n", bold+cyan, reset)
		findings = append(findings, runGitleaks(dir)...)
	}

	// semgrep (SAST)
	if _, err := exec.LookPath("semgrep"); err == nil {
		fmt.Fprintf(os.Stderr, "%s[mockhunter]%s Running semgrep (SAST scanner)...\n", bold+cyan, reset)
		findings = append(findings, runSemgrep(dir)...)
	}

	return findings
}

func runBandit(dir string) []Finding {
	cmd := exec.Command("bandit", "-r", dir, "-f", "json", "-q", "--exit-zero")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}
	var result struct {
		Results []struct {
			Filename   string `json:"filename"`
			LineNumber int    `json:"line_number"`
			Severity   string `json:"issue_severity"`
			TestID     string `json:"test_id"`
			IssueText  string `json:"issue_text"`
			Code       string `json:"code"`
		} `json:"results"`
	}
	if err := json.Unmarshal(out, &result); err != nil {
		return nil
	}
	var findings []Finding
	for _, r := range result.Results {
		relPath, _ := filepath.Rel(dir, r.Filename)
		sev := SevMedium
		switch strings.ToUpper(r.Severity) {
		case "HIGH":
			sev = SevHigh
		case "LOW":
			sev = SevLow
		}
		findings = append(findings, Finding{
			File:     relPath,
			Line:     r.LineNumber,
			Severity: sev,
			Category: "security",
			Rule:     "BANDIT-" + r.TestID,
			Message:  r.IssueText,
			Snippet:  strings.TrimSpace(r.Code),
		})
	}
	return findings
}

func runGitleaks(dir string) []Finding {
	cmd := exec.Command("gitleaks", "detect", "--source", dir, "--report-format", "json", "--no-git", "--exit-code", "0")
	out, _ := cmd.Output()
	if len(out) == 0 {
		return nil
	}
	var results []struct {
		Description string `json:"Description"`
		File        string `json:"File"`
		StartLine   int    `json:"StartLine"`
		Secret      string `json:"Secret"`
		RuleID      string `json:"RuleID"`
	}
	if err := json.Unmarshal(out, &results); err != nil {
		return nil
	}
	var findings []Finding
	for _, r := range results {
		relPath, _ := filepath.Rel(dir, r.File)
		masked := r.Secret
		if len(masked) > 8 {
			masked = masked[:4] + "..." + masked[len(masked)-4:]
		}
		findings = append(findings, Finding{
			File:     relPath,
			Line:     r.StartLine,
			Severity: SevCritical,
			Category: "secrets",
			Rule:     "GITLEAKS-" + r.RuleID,
			Message:  r.Description,
			Snippet:  masked,
			Fix:      "Revoke and rotate this secret immediately",
		})
	}
	return findings
}

func runSemgrep(dir string) []Finding {
	cmd := exec.Command("semgrep", "--config", "auto", "--json", "--quiet", dir)
	out, _ := cmd.Output()
	if len(out) == 0 {
		return nil
	}
	var result struct {
		Results []struct {
			CheckID string `json:"check_id"`
			Path    string `json:"path"`
			Start   struct {
				Line int `json:"line"`
			} `json:"start"`
			Extra struct {
				Message  string `json:"message"`
				Severity string `json:"severity"`
			} `json:"extra"`
		} `json:"results"`
	}
	if err := json.Unmarshal(out, &result); err != nil {
		return nil
	}
	var findings []Finding
	for _, r := range result.Results {
		relPath, _ := filepath.Rel(dir, r.Path)
		sev := SevMedium
		switch strings.ToUpper(r.Extra.Severity) {
		case "ERROR":
			sev = SevHigh
		case "WARNING":
			sev = SevMedium
		case "INFO":
			sev = SevLow
		}
		findings = append(findings, Finding{
			File:     relPath,
			Line:     r.Start.Line,
			Severity: sev,
			Category: "security",
			Rule:     "SEMGREP-" + filepath.Base(r.CheckID),
			Message:  r.Extra.Message,
		})
	}
	return findings
}

// ── HTTP API MODE ─────────────────────────────────────────────────────────

func startServer(addr, dir string) {
	absDir, _ := filepath.Abs(dir)
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "version": version})
	})

	mux.HandleFunc("POST /scan", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Dir          string `json:"dir"`
			MinSeverity  string `json:"minSeverity"`
			ExcludeTests bool   `json:"excludeTests"`
			Category     string `json:"category"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		scanDir := absDir
		if body.Dir != "" {
			scanDir = body.Dir
		}
		minSev := SevLow
		if body.MinSeverity != "" {
			minSev = parseSeverity(body.MinSeverity)
		}
		scanner := NewScanner(ScanConfig{
			Dir:          scanDir,
			MinSeverity:  minSev,
			ExcludeTests: body.ExcludeTests,
		})
		report := scanner.Scan()
		if body.Category != "" {
			var filtered []Finding
			for _, f := range report.Findings {
				if f.Category == body.Category {
					filtered = append(filtered, f)
				}
			}
			report.Findings = filtered
			report.Finalize(minSev)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(report)
	})

	mux.HandleFunc("GET /rules", func(w http.ResponseWriter, r *http.Request) {
		rules := allRules()
		type ruleInfo struct {
			ID       string `json:"id"`
			Category string `json:"category"`
			Severity string `json:"severity"`
			Message  string `json:"message"`
			Fix      string `json:"fix"`
		}
		var out []ruleInfo
		for _, rule := range rules {
			out = append(out, ruleInfo{
				ID:       rule.ID,
				Category: rule.Category,
				Severity: rule.Severity.String(),
				Message:  rule.Message,
				Fix:      rule.Fix,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	})

	fmt.Printf("\n%s%s", bold, white)
	fmt.Printf("  ░█▄▒▄█ ▄▀▄ ▄▀▀ █▄▀ █▄█ █ █ █▄ █ ▀█▀ █▀▀ █▀▄%s\n", yellow)
	fmt.Printf("  %s░█▀▒▀█ ▀▄▀ ▀▄▄ █▀▄ █ █ ▀▄█ █ ▀█  █  █▄▄ █▀▄%s  v%s\n\n", yellow, reset, version)
	fmt.Printf("  %sHTTP API%s listening on %s%s%s\n", bold, reset, cyan, addr, reset)
	fmt.Printf("  %sScanning%s %s\n\n", bold, reset, absDir)
	fmt.Printf("  %sEndpoints:%s\n", bold, reset)
	fmt.Printf("    POST /scan    — run scan (body: {dir, minSeverity, category})\n")
	fmt.Printf("    GET  /rules   — list all rules\n")
	fmt.Printf("    GET  /health  — health check\n\n")

	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 120 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}
