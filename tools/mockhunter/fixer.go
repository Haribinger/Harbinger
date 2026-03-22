package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// FixConfig controls the auto-fix behavior
type FixConfig struct {
	Fixer    string // claude, gemini, ollama, opencode, aider
	Category string // filter to specific category
	Auto     bool   // fix without asking
	DryRun   bool   // show what would be fixed
	Dir      string
}

func runFix(cfg FixConfig, report *Report) {
	if report.TotalCount == 0 {
		fmt.Printf("\n  %s%s✔ Nothing to fix — codebase is clean!%s\n\n", green, bold, reset)
		return
	}

	// Auto-detect fixer if not specified
	if cfg.Fixer == "" {
		cfg.Fixer = autoDetectFixer()
		if cfg.Fixer == "" {
			fmt.Printf("\n  %s%s⚠ No AI fixer available!%s\n", yellow, bold, reset)
			fmt.Printf("  Install one:\n")
			fmt.Printf("    %s$ curl -fsSL https://ollama.com/install.sh | sh%s  (free, local)\n", dim, reset)
			fmt.Printf("    %s$ npm i -g @anthropic-ai/claude-code%s\n\n", dim, reset)
			return
		}
	}

	// Filter findings by category if specified
	findings := report.Findings
	if cfg.Category != "" {
		var filtered []Finding
		for _, f := range findings {
			if f.Category == cfg.Category {
				filtered = append(filtered, f)
			}
		}
		findings = filtered
	}

	if len(findings) == 0 {
		fmt.Printf("\n  %s%s✔ No findings in category '%s'%s\n\n", green, bold, cfg.Category, reset)
		return
	}

	// Group findings by file for batch fixing
	fileGroups := groupByFile(findings)

	fmt.Printf("\n  %s%s🔧 FIX MODE%s — using %s%s%s\n", bold, white, reset, cyan+bold, cfg.Fixer, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)
	fmt.Printf("  %sFindings:%s  %d across %d files\n", dim, reset, len(findings), len(fileGroups))
	fmt.Printf("  %sCategory:%s  %s\n", dim, reset, orDefault(cfg.Category, "all"))
	fmt.Printf("  %sMode:%s     %s\n\n", dim, reset, fixMode(cfg))

	if cfg.DryRun {
		printDryRun(fileGroups)
		return
	}

	// Process each file
	fixedCount := 0
	skippedCount := 0

	for file, filefindings := range fileGroups {
		fmt.Printf("  %s📄 %s%s (%d issues)\n", bold, file, reset, len(filefindings))

		for _, f := range filefindings {
			sColor := sevColor(f.Severity)
			fmt.Printf("     %s%s%s L%d: %s\n", sColor, f.Severity.Label(), reset, f.Line, f.Message)
			if f.Fix != "" {
				fmt.Printf("     %s↳ %s%s\n", green, f.Fix, reset)
			}

			if !cfg.Auto {
				action := askUser(fmt.Sprintf("     %sFix with %s? [y/n/s(kip all)/q(uit)]:%s ", dim, cfg.Fixer, reset))
				switch strings.ToLower(action) {
				case "y", "yes":
					if err := applyFix(cfg.Fixer, cfg.Dir, f); err != nil {
						fmt.Printf("     %s✗ Fix failed: %s%s\n", red, err, reset)
					} else {
						fmt.Printf("     %s✔ Fixed%s\n", green, reset)
						fixedCount++
					}
				case "q", "quit":
					fmt.Printf("\n  %sQuitting. Fixed %d/%d findings.%s\n\n", dim, fixedCount, len(findings), reset)
					return
				case "s", "skip":
					fmt.Printf("  %sSkipping remaining...%s\n", dim, reset)
					skippedCount += len(findings) - fixedCount - skippedCount
					goto done
				default:
					skippedCount++
				}
			} else {
				if err := applyFix(cfg.Fixer, cfg.Dir, f); err != nil {
					fmt.Printf("     %s✗ %s%s\n", red, err, reset)
				} else {
					fmt.Printf("     %s✔%s\n", green, reset)
					fixedCount++
				}
			}
		}
		fmt.Println()
	}

done:
	fmt.Printf("  %s═══════════════════════════════════════════════════════════%s\n", dim, reset)
	fmt.Printf("  %s%s✔ Fixed: %d  ⏭ Skipped: %d  📋 Total: %d%s\n\n", bold, white, fixedCount, skippedCount, len(findings), reset)
	if fixedCount > 0 {
		fmt.Printf("  %sRe-run %smockhunter scan%s to verify fixes.%s\n\n", dim, bold, dim, reset)
	}
}

func autoDetectFixer() string {
	// Priority order: claude (best context), ollama (free), gemini, opencode, aider
	for _, name := range []string{"claude", "ollama", "gemini", "opencode", "aider"} {
		if _, err := exec.LookPath(name); err == nil {
			return name
		}
	}
	return ""
}

func applyFix(fixer, dir string, f Finding) error {
	filePath := f.File
	if dir != "" && !strings.HasPrefix(filePath, "/") {
		filePath = dir + "/" + filePath
	}

	prompt := buildFixPrompt(f)

	switch fixer {
	case "claude":
		return runFixerCommand("claude", []string{
			"-p", prompt,
			"--allowedTools", "Edit,Read",
		}, dir)

	case "gemini":
		return runFixerCommand("gemini", []string{
			"-p", prompt,
		}, dir)

	case "ollama":
		// Use ollama to generate fix suggestion, print it for manual application
		return runOllamaFix(prompt)

	case "opencode":
		return runFixerCommand("opencode", []string{
			"-p", prompt,
		}, dir)

	case "aider":
		return runFixerCommand("aider", []string{
			"--message", prompt,
			filePath,
		}, dir)

	default:
		return fmt.Errorf("unknown fixer: %s", fixer)
	}
}

func buildFixPrompt(f Finding) string {
	return fmt.Sprintf(`Fix this %s severity %s issue in %s at line %d:

Issue: %s
Rule: %s
Code: %s

Fix: %s

Make the minimal change needed. Do not add comments explaining the fix.`,
		f.Severity.String(), f.Category, f.File, f.Line,
		f.Message, f.Rule, f.Snippet, f.Fix)
}

func runFixerCommand(name string, args []string, dir string) error {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func runOllamaFix(prompt string) error {
	input := map[string]any{
		"model":  "llama3",
		"prompt": prompt,
		"stream": false,
	}
	data, _ := json.Marshal(input)

	cmd := exec.Command("ollama", "run", "llama3", prompt)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	_ = data // would use for API mode
	return cmd.Run()
}

func groupByFile(findings []Finding) map[string][]Finding {
	groups := make(map[string][]Finding)
	for _, f := range findings {
		groups[f.File] = append(groups[f.File], f)
	}
	return groups
}

func askUser(prompt string) string {
	fmt.Print(prompt)
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	return strings.TrimSpace(line)
}

func orDefault(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

func fixMode(cfg FixConfig) string {
	if cfg.DryRun {
		return "dry-run (no changes)"
	}
	if cfg.Auto {
		return yellow + "auto-fix (no prompts)" + reset
	}
	return "interactive (confirm each fix)"
}

func printDryRun(groups map[string][]Finding) {
	fmt.Printf("  %s%sDRY RUN — no changes will be made%s\n\n", yellow, bold, reset)
	for file, findings := range groups {
		fmt.Printf("  %s📄 %s%s\n", bold, file, reset)
		for _, f := range findings {
			fmt.Printf("     %sWOULD FIX%s L%d: %s\n", cyan, reset, f.Line, f.Message)
			if f.Fix != "" {
				fmt.Printf("     %s↳ %s%s\n", green, f.Fix, reset)
			}
		}
		fmt.Println()
	}
}
