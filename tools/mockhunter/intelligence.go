// intelligence.go — High-level analysis: clustering, architecture flags,
// fix campaigns, and production readiness checks.
// NOTE: This file contains DETECTION patterns for dangerous code (innerHTML, etc.)
// These strings exist to FIND and FLAG them in user codebases, not to use them.
package main

import (
	"fmt"
	"sort"
	"strings"
)

// ── AUTO-CLUSTERING ───────────────────────────────────────────────────────

type FindingCluster struct {
	Name     string
	Icon     string
	Color    string
	Findings []Finding
	FixCmd   string
	Priority int // 1 = fix first
}

func clusterFindings(findings []Finding) []FindingCluster {
	groups := make(map[string]*FindingCluster)
	for _, f := range findings {
		key := clusterKey(f)
		if c, ok := groups[key]; ok {
			c.Findings = append(c.Findings, f)
		} else {
			groups[key] = newCluster(key, f)
		}
	}
	result := make([]FindingCluster, 0, len(groups))
	for _, c := range groups {
		result = append(result, *c)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Priority < result[j].Priority })
	return result
}

func clusterKey(f Finding) string {
	switch {
	case f.Rule == "VIBE001":
		return "empty-catches"
	case f.Rule == "ERR002":
		return "json-parse"
	case f.Rule == "VIBE003":
		return "any-types"
	case f.Rule == "VIBE005":
		return "alert-calls"
	case strings.HasPrefix(f.Rule, "SEC"):
		return "secrets"
	case strings.HasPrefix(f.Rule, "VULN"):
		return "security"
	case strings.HasPrefix(f.Rule, "AUTH"):
		return "auth"
	case strings.HasPrefix(f.Rule, "AI"):
		return "ai-slop"
	case strings.HasPrefix(f.Rule, "MOCK"):
		return "mock-data"
	case strings.HasPrefix(f.Rule, "STUB"):
		return "stubs"
	case strings.HasPrefix(f.Rule, "CRYPTO"):
		return "crypto"
	default:
		return f.Category
	}
}

func newCluster(key string, first Finding) *FindingCluster {
	c := &FindingCluster{Findings: []Finding{first}}
	switch key {
	case "empty-catches":
		c.Name, c.Icon, c.Color, c.Priority = "Empty Catch Blocks", "🫗", yellow, 4
		c.FixCmd = "mockhunter fix --category vibe-code --auto"
	case "json-parse":
		c.Name, c.Icon, c.Color, c.Priority = "Unsafe JSON.parse", "💥", yellow, 3
		c.FixCmd = "mockhunter fix --category vibe-code"
	case "any-types":
		c.Name, c.Icon, c.Color, c.Priority = "TypeScript any Types", "🔓", yellow, 5
		c.FixCmd = "mockhunter fix --category vibe-code"
	case "alert-calls":
		c.Name, c.Icon, c.Color, c.Priority = "alert() in Production", "🔔", yellow, 5
		c.FixCmd = "mockhunter fix --category vibe-code --auto"
	case "secrets":
		c.Name, c.Icon, c.Color, c.Priority = "Hardcoded Secrets", "🔑", red+bold, 1
		c.FixCmd = "mockhunter fix --category secrets --fixer claude"
	case "security":
		c.Name, c.Icon, c.Color, c.Priority = "Security Vulnerabilities", "🛡️", red, 2
		c.FixCmd = "mockhunter fix --category security --dry-run"
	case "auth":
		c.Name, c.Icon, c.Color, c.Priority = "Auth Gaps", "🚪", red+bold, 1
		c.FixCmd = "mockhunter fix --category auth --fixer claude"
	case "ai-slop":
		c.Name, c.Icon, c.Color, c.Priority = "AI Artifacts", "🤖", magenta, 5
		c.FixCmd = "mockhunter fix --category ai-slop --fixer ollama --auto"
	case "mock-data":
		c.Name, c.Icon, c.Color, c.Priority = "Mock/Fake Data", "🎭", magenta, 3
	case "stubs":
		c.Name, c.Icon, c.Color, c.Priority = "Stub Implementations", "🚧", cyan, 4
	case "crypto":
		c.Name, c.Icon, c.Color, c.Priority = "Weak Cryptography", "🔒", red, 2
	default:
		c.Name, c.Icon, c.Color, c.Priority = key, "📋", gray, 4
	}
	return c
}

// ── ARCHITECTURE FLAGS ────────────────────────────────────────────────────

type ArchFlag struct {
	Level   string // "🔴", "🟡", "🟢"
	Title   string
	Detail  string
	IsFatal bool
}

func detectArchFlags(findings []Finding) []ArchFlag {
	var flags []ArchFlag
	cats := make(map[string]int)
	rules := make(map[string]int)
	for _, f := range findings {
		cats[f.Category]++
		rules[f.Rule]++
	}

	if rules["VULN006"] > 0 || rules["CRYPTO002"] > 0 {
		flags = append(flags, ArchFlag{"🔴", "Weak Cryptography",
			"MD5/SHA1 detected — NOT a patch, requires design decision about hashing strategy", false})
	}
	if cats["auth"] > 0 {
		flags = append(flags, ArchFlag{"🔴", "Authentication Architecture Gap",
			"Routes without auth middleware — auth should be deny-by-default, not opt-in", true})
	}
	if rules["VULN002"] > 0 {
		flags = append(flags, ArchFlag{"🟡", "UI Trust Boundary Issue",
			"innerHTML used without sanitization — risk depends on data source", false})
	}
	if cats["mock-data"]+cats["stubs"] > 3 {
		flags = append(flags, ArchFlag{"🟡", "Fake System Indicators",
			fmt.Sprintf("%d mock/stub items — frontend may show fake success for unimplemented features",
				cats["mock-data"]+cats["stubs"]), false})
	}
	if rules["VIBE001"]+rules["ERR002"] > 10 {
		flags = append(flags, ArchFlag{"🟡", "Error Handling Debt",
			fmt.Sprintf("%d empty catches + unsafe parses — errors silently swallowed",
				rules["VIBE001"]+rules["ERR002"]), false})
	}
	if cats["secrets"] > 2 {
		flags = append(flags, ArchFlag{"🔴", "No Secrets Management",
			"Multiple hardcoded secrets — need .env + secrets manager", true})
	}
	if rules["VIBE003"] > 5 {
		flags = append(flags, ArchFlag{"🟡", "Type Safety Erosion",
			fmt.Sprintf("%d 'any' types — TypeScript used as JavaScript with extra steps", rules["VIBE003"]), false})
	}
	if cats["ai-slop"] > 10 {
		flags = append(flags, ArchFlag{"🟡", "AI Code Without Review",
			fmt.Sprintf("%d AI artifacts — generated but not reviewed", cats["ai-slop"]), false})
	}
	return flags
}

// ── FIX CAMPAIGNS ─────────────────────────────────────────────────────────

type Campaign struct {
	Number   int
	Name     string
	Icon     string
	Count    int
	Risk     string // "safe", "review", "careful"
	Command  string
	Duration string
}

func buildCampaigns(clusters []FindingCluster) []Campaign {
	var campaigns []Campaign
	num := 1
	for _, c := range clusters {
		if len(c.Findings) == 0 {
			continue
		}
		risk := "review"
		dur := fmt.Sprintf("~%dm", len(c.Findings)*2)
		switch c.Priority {
		case 1:
			risk = "careful"
			dur = fmt.Sprintf("~%dm (needs review)", len(c.Findings)*5)
		case 5:
			risk = "safe"
			dur = fmt.Sprintf("~%dm (mechanical)", len(c.Findings))
		}
		cmd := c.FixCmd
		if cmd == "" {
			cmd = fmt.Sprintf("mockhunter fix --category %s", c.Findings[0].Category)
		}
		campaigns = append(campaigns, Campaign{num, c.Name, c.Icon, len(c.Findings), risk, cmd, dur})
		num++
	}
	return campaigns
}

// ── PRODUCTION READINESS ──────────────────────────────────────────────────

type ReadinessCheck struct {
	Name   string
	Status string // "pass", "warn", "fail"
	Detail string
}

func checkReadiness(findings []Finding, filesScanned int) []ReadinessCheck {
	cats := make(map[string]int)
	rules := make(map[string]int)
	for _, f := range findings {
		cats[f.Category]++
		rules[f.Rule]++
	}

	check := func(name, cat string, warnThresh, failThresh int) ReadinessCheck {
		n := cats[cat]
		if n == 0 {
			return ReadinessCheck{name, "pass", "No issues"}
		} else if n < warnThresh {
			return ReadinessCheck{name, "warn", fmt.Sprintf("%d issue(s)", n)}
		}
		return ReadinessCheck{name, "fail", fmt.Sprintf("%d issue(s)", n)}
	}

	var checks []ReadinessCheck
	checks = append(checks, check("Secret Management", "secrets", 1, 1))
	checks = append(checks, check("Authentication", "auth", 1, 1))
	checks = append(checks, check("Security Scan", "security", 3, 3))

	errCount := rules["VIBE001"] + rules["ERR002"]
	if errCount == 0 {
		checks = append(checks, ReadinessCheck{"Error Handling", "pass", "No silent errors"})
	} else if errCount < 5 {
		checks = append(checks, ReadinessCheck{"Error Handling", "warn", fmt.Sprintf("%d issue(s)", errCount)})
	} else {
		checks = append(checks, ReadinessCheck{"Error Handling", "fail", fmt.Sprintf("%d errors swallowed", errCount)})
	}

	checks = append(checks, check("Real Implementations", "mock-data", 3, 3))
	checks = append(checks, check("Code Review", "ai-slop", 5, 10))

	rate := 0.0
	if filesScanned > 0 {
		rate = float64(len(findings)) / float64(filesScanned) * 100
	}
	if rate < 1 {
		checks = append(checks, ReadinessCheck{"Code Quality", "pass", fmt.Sprintf("%.1f%% finding rate", rate)})
	} else if rate < 5 {
		checks = append(checks, ReadinessCheck{"Code Quality", "warn", fmt.Sprintf("%.1f%% finding rate", rate)})
	} else {
		checks = append(checks, ReadinessCheck{"Code Quality", "fail", fmt.Sprintf("%.1f%% finding rate", rate)})
	}

	return checks
}

// ── PRINT FUNCTIONS ───────────────────────────────────────────────────────

func printClusters(clusters []FindingCluster) {
	fmt.Printf("\n  %s%s📦 FINDING CLUSTERS%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)
	for _, c := range clusters {
		fileSet := make(map[string]bool)
		for _, f := range c.Findings {
			fileSet[f.File] = true
		}
		fmt.Printf("    %s %s%-24s%s %s%d findings%s in %d files\n",
			c.Icon, c.Color+bold, c.Name, reset, c.Color, len(c.Findings), reset, len(fileSet))
		if c.FixCmd != "" {
			fmt.Printf("      %s$ %s%s\n", dim, c.FixCmd, reset)
		}
	}
	fmt.Println()
}

func printArchFlags(flags []ArchFlag) {
	if len(flags) == 0 {
		return
	}
	fmt.Printf("  %s%s🏗️  ARCHITECTURE FLAGS%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)
	for _, f := range flags {
		fmt.Printf("    %s %s%s%s\n", f.Level, bold, f.Title, reset)
		fmt.Printf("      %s%s%s\n", dim, f.Detail, reset)
		if f.IsFatal {
			fmt.Printf("      %s⚠ Blocks production deployment%s\n", red, reset)
		}
	}
	fmt.Println()
}

func printCampaigns(campaigns []Campaign) {
	if len(campaigns) == 0 {
		return
	}
	fmt.Printf("  %s%s🎯 FIX CAMPAIGNS — \"What should I fix first?\"%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)
	for _, c := range campaigns {
		badge := yellow + "REVIEW" + reset
		switch c.Risk {
		case "safe":
			badge = green + "SAFE" + reset
		case "careful":
			badge = red + bold + "CAREFUL" + reset
		}
		fmt.Printf("\n    %s%s Campaign %d: %s%s  [%s]  %s%d fixes%s  %s%s%s\n",
			bold, c.Icon, c.Number, c.Name, reset, badge,
			bold, c.Count, reset, dim, c.Duration, reset)
		fmt.Printf("      %s$ %s%s\n", dim, c.Command, reset)
	}
	fmt.Println()
}

func printReadiness(checks []ReadinessCheck) {
	fmt.Printf("\n  %s%s🚀 PRODUCTION READINESS%s\n", bold, white, reset)
	fmt.Printf("  %s────────────────────────────────────────────%s\n", dim, reset)
	pass := 0
	for _, c := range checks {
		icon, color := "❌", red
		switch c.Status {
		case "pass":
			icon, color = "✅", green
			pass++
		case "warn":
			icon, color = "⚠️", yellow
		}
		fmt.Printf("    %s %s%-22s%s %s%s%s\n", icon, color, c.Name, reset, dim, c.Detail, reset)
	}
	fmt.Printf("\n    %sScore: %d/%d passing%s", bold, pass, len(checks), reset)
	if pass == len(checks) {
		fmt.Printf("  %s✔ PRODUCTION READY%s\n", green+bold, reset)
	} else {
		fmt.Printf("  %s✖ NOT READY%s\n", red+bold, reset)
	}
	fmt.Println()
}
