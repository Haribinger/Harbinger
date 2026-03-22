package main

import (
	"fmt"
	"io"
	"sort"
	"strings"
)

// Report aggregates all findings from a scan
type Report struct {
	FilesScanned  int       `json:"filesScanned"`
	Findings      []Finding `json:"findings"`
	CriticalCount int       `json:"criticalCount"`
	HighCount     int       `json:"highCount"`
	MediumCount   int       `json:"mediumCount"`
	LowCount      int       `json:"lowCount"`
	InfoCount     int       `json:"infoCount"`
	TotalCount    int       `json:"totalCount"`
	Categories    map[string]int `json:"categories"`
}

// Finalize sorts findings, applies severity filter, and computes counts
func (r *Report) Finalize(minSev Severity) {
	// Filter by minimum severity
	var filtered []Finding
	for _, f := range r.Findings {
		if f.Severity >= minSev {
			filtered = append(filtered, f)
		}
	}
	r.Findings = filtered

	// Sort: critical first, then by file
	sort.Slice(r.Findings, func(i, j int) bool {
		if r.Findings[i].Severity != r.Findings[j].Severity {
			return r.Findings[i].Severity > r.Findings[j].Severity
		}
		if r.Findings[i].File != r.Findings[j].File {
			return r.Findings[i].File < r.Findings[j].File
		}
		return r.Findings[i].Line < r.Findings[j].Line
	})

	// Count by severity
	r.Categories = make(map[string]int)
	for _, f := range r.Findings {
		switch f.Severity {
		case SevCritical:
			r.CriticalCount++
		case SevHigh:
			r.HighCount++
		case SevMedium:
			r.MediumCount++
		case SevLow:
			r.LowCount++
		case SevInfo:
			r.InfoCount++
		}
		r.Categories[f.Category]++
	}
	r.TotalCount = len(r.Findings)
}

// ANSI color codes
const (
	reset     = "\033[0m"
	bold      = "\033[1m"
	dim       = "\033[2m"
	italic    = "\033[3m"
	red       = "\033[31m"
	green     = "\033[32m"
	yellow    = "\033[33m"
	blue      = "\033[34m"
	magenta   = "\033[35m"
	cyan      = "\033[36m"
	white     = "\033[37m"
	bgRed     = "\033[41m"
	bgYellow  = "\033[43m"
	bgBlue    = "\033[44m"
	bgMagenta = "\033[45m"
	gray      = "\033[90m"
)

func sevColor(s Severity) string {
	switch s {
	case SevCritical:
		return bgRed + white + bold
	case SevHigh:
		return red + bold
	case SevMedium:
		return yellow
	case SevLow:
		return blue
	default:
		return gray
	}
}

func catIcon(cat string) string {
	switch cat {
	case "secrets":
		return "🔑"
	case "mock-data":
		return "🎭"
	case "ai-slop":
		return "🤖"
	case "vibe-code":
		return "🎸"
	case "security":
		return "🛡️"
	case "stubs":
		return "🚧"
	default:
		return "📋"
	}
}

// PrintText renders a beautiful terminal report
func (r *Report) PrintText(w io.Writer) {
	// Banner
	fmt.Fprintf(w, "\n%s%s", bold, white)
	fmt.Fprintf(w, "  ╔══════════════════════════════════════════════════════════════╗\n")
	fmt.Fprintf(w, "  ║                                                              ║\n")
	fmt.Fprintf(w, "  ║   %s░█▄▒▄█ ▄▀▄ ▄▀▀ █▄▀ █▄█ █ █ █▄ █ ▀█▀ █▀▀ █▀▄%s            ║\n", yellow, white)
	fmt.Fprintf(w, "  ║   %s░█▀▒▀█ ▀▄▀ ▀▄▄ █▀▄ █ █ ▀▄█ █ ▀█  █  █▄▄ █▀▄%s  v1.0.0   ║\n", yellow, white)
	fmt.Fprintf(w, "  ║                                                              ║\n")
	fmt.Fprintf(w, "  ║   %sAI Slop • Mock Data • Secrets • Vibe Code Hunter%s         ║\n", dim, white)
	fmt.Fprintf(w, "  ║                                                              ║\n")
	fmt.Fprintf(w, "  ╚══════════════════════════════════════════════════════════════╝%s\n\n", reset)

	// Summary bar
	fmt.Fprintf(w, "  %s%s FILES SCANNED: %d%s\n\n", bold, cyan, r.FilesScanned, reset)

	if r.TotalCount == 0 {
		fmt.Fprintf(w, "  %s%s✔ CLEAN — No issues found!%s\n\n", bold, green, reset)
		return
	}

	// Severity breakdown
	fmt.Fprintf(w, "  ┌─────────────────────────────────────────┐\n")
	fmt.Fprintf(w, "  │  %s%sFINDINGS SUMMARY%s                        │\n", bold, white, reset)
	fmt.Fprintf(w, "  ├─────────────────────────────────────────┤\n")
	if r.CriticalCount > 0 {
		fmt.Fprintf(w, "  │  %s CRIT %s  %s%-3d%s  %-28s │\n", bgRed+white+bold, reset, red+bold, r.CriticalCount, reset, bar(r.CriticalCount, r.TotalCount, red))
	}
	if r.HighCount > 0 {
		fmt.Fprintf(w, "  │  %s HIGH %s  %s%-3d%s  %-28s │\n", red+bold, reset, red, r.HighCount, reset, bar(r.HighCount, r.TotalCount, red))
	}
	if r.MediumCount > 0 {
		fmt.Fprintf(w, "  │  %s MED  %s  %s%-3d%s  %-28s │\n", yellow, reset, yellow, r.MediumCount, reset, bar(r.MediumCount, r.TotalCount, yellow))
	}
	if r.LowCount > 0 {
		fmt.Fprintf(w, "  │  %s LOW  %s  %s%-3d%s  %-28s │\n", blue, reset, blue, r.LowCount, reset, bar(r.LowCount, r.TotalCount, blue))
	}
	fmt.Fprintf(w, "  │                                         │\n")
	fmt.Fprintf(w, "  │  %sTOTAL: %d issues%s                        │\n", bold, r.TotalCount, reset)
	fmt.Fprintf(w, "  └─────────────────────────────────────────┘\n\n")

	// Category breakdown
	fmt.Fprintf(w, "  %sBY CATEGORY:%s\n", bold, reset)
	for cat, count := range r.Categories {
		fmt.Fprintf(w, "    %s %s%-12s%s %d\n", catIcon(cat), bold, cat, reset, count)
	}
	fmt.Fprintf(w, "\n")

	// Findings detail
	fmt.Fprintf(w, "  %s═══════════════════════════════════════════════════════════%s\n", dim, reset)
	fmt.Fprintf(w, "  %s%s FINDINGS DETAIL%s\n", bold, white, reset)
	fmt.Fprintf(w, "  %s═══════════════════════════════════════════════════════════%s\n\n", dim, reset)

	lastFile := ""
	for i, f := range r.Findings {
		if f.File != lastFile {
			if lastFile != "" {
				fmt.Fprintf(w, "\n")
			}
			fmt.Fprintf(w, "  %s%s📄 %s%s\n", bold, white, f.File, reset)
			fmt.Fprintf(w, "  %s────────────────────────────────────────────%s\n", dim, reset)
			lastFile = f.File
		}

		sColor := sevColor(f.Severity)
		fmt.Fprintf(w, "  %s %s %s %s[%s]%s L%d: %s\n",
			sColor, f.Severity.Label(), reset,
			gray, f.Rule, reset,
			f.Line, f.Message)

		if f.Snippet != "" {
			fmt.Fprintf(w, "      %s│%s %s%s%s\n", dim, reset, italic, truncate(f.Snippet, 100), reset)
		}
		if f.Fix != "" {
			fmt.Fprintf(w, "      %s│%s %s↳ Fix: %s%s\n", dim, reset, green, f.Fix, reset)
		}

		if i < len(r.Findings)-1 && r.Findings[i+1].File == f.File {
			fmt.Fprintf(w, "      %s│%s\n", dim, reset)
		}
	}

	// Footer
	fmt.Fprintf(w, "\n  %s═══════════════════════════════════════════════════════════%s\n", dim, reset)
	if r.CriticalCount > 0 {
		fmt.Fprintf(w, "  %s%s⚠ %d CRITICAL issues must be fixed before shipping%s\n", bgRed, white+bold, r.CriticalCount, reset)
	} else if r.HighCount > 0 {
		fmt.Fprintf(w, "  %s%s⚠ %d HIGH severity issues should be reviewed%s\n", red, bold, r.HighCount, reset)
	} else {
		fmt.Fprintf(w, "  %s%s✔ No critical or high issues — looking good!%s\n", green, bold, reset)
	}
	fmt.Fprintf(w, "\n")
}

func bar(count, total int, color string) string {
	if total == 0 {
		return ""
	}
	width := 20
	filled := (count * width) / total
	if filled < 1 {
		filled = 1
	}
	return color + strings.Repeat("█", filled) + reset + strings.Repeat("░", width-filled)
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

// ToSARIF converts the report to SARIF 2.1.0 format for CI integration
func (r *Report) ToSARIF() map[string]any {
	rules := make([]map[string]any, 0)
	ruleIDs := make(map[string]bool)
	results := make([]map[string]any, 0)

	for _, f := range r.Findings {
		if !ruleIDs[f.Rule] {
			ruleIDs[f.Rule] = true
			rules = append(rules, map[string]any{
				"id": f.Rule,
				"shortDescription": map[string]string{
					"text": f.Message,
				},
				"help": map[string]string{
					"text": f.Fix,
				},
				"properties": map[string]any{
					"tags":     []string{f.Category},
					"severity": f.Severity.String(),
				},
			})
		}

		level := "note"
		switch f.Severity {
		case SevCritical:
			level = "error"
		case SevHigh:
			level = "error"
		case SevMedium:
			level = "warning"
		}

		results = append(results, map[string]any{
			"ruleId":  f.Rule,
			"level":   level,
			"message": map[string]string{"text": f.Message},
			"locations": []map[string]any{
				{
					"physicalLocation": map[string]any{
						"artifactLocation": map[string]string{
							"uri": f.File,
						},
						"region": map[string]int{
							"startLine": f.Line,
						},
					},
				},
			},
		})
	}

	return map[string]any{
		"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
		"version": "2.1.0",
		"runs": []map[string]any{
			{
				"tool": map[string]any{
					"driver": map[string]any{
						"name":           "mockhunter",
						"version":        "1.0.0",
						"informationUri": "https://github.com/Haribinger/Harbinger/tools/mockhunter",
						"rules":          rules,
					},
				},
				"results": results,
			},
		},
	}
}
