package main

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

// Severity levels for findings
type Severity int

const (
	SevInfo Severity = iota
	SevLow
	SevMedium
	SevHigh
	SevCritical
)

func (s Severity) String() string {
	return [...]string{"info", "low", "medium", "high", "critical"}[s]
}

func (s Severity) Label() string {
	return [...]string{"INFO", "LOW", "MED", "HIGH", "CRIT"}[s]
}

func parseSeverity(s string) Severity {
	switch strings.ToLower(s) {
	case "critical", "crit":
		return SevCritical
	case "high":
		return SevHigh
	case "medium", "med":
		return SevMedium
	case "low":
		return SevLow
	default:
		return SevInfo
	}
}

// Finding represents a single issue found by the scanner
type Finding struct {
	File              string     `json:"file"`
	Line              int        `json:"line"`
	Column            int        `json:"column,omitempty"`
	Severity          Severity   `json:"severity"`
	Category          string     `json:"category"`
	Rule              string     `json:"rule"`
	Message           string     `json:"message"`
	Snippet           string     `json:"snippet"`
	Fix               string     `json:"fix,omitempty"`
	Confidence        Confidence `json:"confidence"`
	ConfidenceLabel   string     `json:"confidenceLabel"`
	ConfidenceReasons []string   `json:"confidenceReasons,omitempty"`
}

// Rule defines a pattern to search for
type Rule struct {
	ID          string
	Category    string
	Severity    Severity
	Pattern     *regexp.Regexp
	Message     string
	Fix         string
	FileGlob    string // only apply to files matching this glob (empty = all)
	ExcludeGlob string // skip files matching this glob
	LineMatch   bool   // true = match per line, false = match full file content
}

// ScanConfig controls scanner behavior
type ScanConfig struct {
	Dir           string
	MinSeverity   Severity
	MinConfidence float64  // 0.0 to 1.0, findings below this are suppressed
	ExcludeTests  bool
	GitDiffOnly   bool     // only scan files changed in git
	DangerousMode bool     // show exploit scenarios
	Categories    []string // empty = all categories
	MaxWorkers    int
	ExcludeDirs   []string // additional directories to skip
	ExcludeVendor bool     // skip all vendored/third-party code
}

// Scanner orchestrates the scan
type Scanner struct {
	config ScanConfig
	rules  []Rule
	ignore *IgnoreList
}

func NewScanner(config ScanConfig) *Scanner {
	if config.MaxWorkers == 0 {
		config.MaxWorkers = 8
	}
	return &Scanner{
		config: config,
		rules:  allRules(),
		ignore: loadIgnoreFile(config.Dir),
	}
}

// Scan walks the directory and applies all rules
func (s *Scanner) Scan() *Report {
	report := &Report{}
	var files []string

	// If git-diff mode, only scan changed files
	var gitDiffSet map[string]bool
	if s.config.GitDiffOnly {
		diffFiles, err := getGitDiffFiles(s.config.Dir)
		if err == nil && len(diffFiles) > 0 {
			gitDiffSet = make(map[string]bool, len(diffFiles))
			for _, f := range diffFiles {
				gitDiffSet[f] = true
			}
		}
	}

	filepath.Walk(s.config.Dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			base := info.Name()
			skipDirs := map[string]bool{
				"node_modules": true, ".git": true, "dist": true, "build": true,
				"vendor": true, "__pycache__": true, ".next": true, ".venv": true,
				"venv": true, ".tox": true, ".claude": true, ".cursor": true,
				".idea": true, ".vscode": true, "coverage": true, ".nyc_output": true,
				".pytest_cache": true, ".mypy_cache": true, ".ruff_cache": true,
				"target": true, "Pods": true, ".gradle": true, "obj": true, "bin": true,
				".terraform": true, ".serverless": true, ".vercel": true,
				".pnpm-store": true, ".yarn": true, ".npm": true, ".cache": true,
				".auto-claude": true, ".worktrees": true,
			}
			if skipDirs[base] {
				return filepath.SkipDir
			}
			// User-specified exclude dirs
			for _, d := range s.config.ExcludeDirs {
				if base == d {
					return filepath.SkipDir
				}
			}
			// Vendor exclusion
			if s.config.ExcludeVendor && isVendoredDir(base) {
				return filepath.SkipDir
			}
			// Skip virtual environment directories
			if strings.HasSuffix(base, "-env") || strings.HasSuffix(base, "_env") {
				return filepath.SkipDir
			}
			// Skip anything inside site-packages (vendored Python)
			if base == "site-packages" || base == "lib" {
				rel, _ := filepath.Rel(s.config.Dir, path)
				if strings.Contains(rel, "site-packages") || strings.Contains(rel, "-env/lib") || strings.Contains(rel, "_env/lib") {
					return filepath.SkipDir
				}
			}
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		scannable := map[string]bool{
			".go": true, ".ts": true, ".tsx": true, ".js": true, ".jsx": true,
			".py": true, ".rb": true, ".rs": true, ".java": true, ".kt": true,
			".yaml": true, ".yml": true, ".json": true, ".toml": true, ".env": true,
			".sh": true, ".bash": true, ".sql": true, ".tf": true, ".hcl": true,
			".dockerfile": true, ".xml": true, ".properties": true, ".cfg": true,
			".ini": true, ".conf": true, ".vue": true, ".svelte": true,
		}
		if info.Name() == "Dockerfile" || info.Name() == "Makefile" || info.Name() == "docker-compose.yml" {
			scannable[ext] = true
		}
		if !scannable[ext] {
			return nil
		}
		if s.config.ExcludeTests && isTestFile(path) {
			return nil
		}
		relPath, _ := filepath.Rel(s.config.Dir, path)
		// Check .mockhunterignore
		if s.ignore.shouldIgnoreFile(relPath) {
			return nil
		}
		// Check git-diff filter
		if gitDiffSet != nil && !gitDiffSet[relPath] {
			return nil
		}
		files = append(files, path)
		return nil
	})

	// Parallel scan
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, s.config.MaxWorkers)

	for _, file := range files {
		wg.Add(1)
		sem <- struct{}{}
		go func(f string) {
			defer wg.Done()
			defer func() { <-sem }()
			findings := s.scanFile(f)
			if len(findings) > 0 {
				mu.Lock()
				report.Findings = append(report.Findings, findings...)
				mu.Unlock()
			}
		}(file)
	}
	wg.Wait()

	report.FilesScanned = len(files)
	report.Finalize(s.config.MinSeverity)
	return report
}

func (s *Scanner) scanFile(path string) []Finding {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	relPath, _ := filepath.Rel(s.config.Dir, path)
	if relPath == "" {
		relPath = path
	}

	// Read all lines for surrounding context during confidence scoring
	var allLines []string
	lineScanner := bufio.NewScanner(f)
	lineScanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for lineScanner.Scan() {
		allLines = append(allLines, lineScanner.Text())
	}

	var findings []Finding
	for lineNum, line := range allLines {
		for _, rule := range s.rules {
			if !rule.LineMatch {
				continue
			}
			if rule.FileGlob != "" {
				if matched, _ := filepath.Match(rule.FileGlob, filepath.Base(path)); !matched {
					continue
				}
			}
			if rule.ExcludeGlob != "" {
				if matched, _ := filepath.Match(rule.ExcludeGlob, filepath.Base(path)); matched {
					continue
				}
			}
			if rule.Pattern.MatchString(line) {
				// Check inline ignore: // mockhunter:ignore or // nolint:mockhunter
				if isLineIgnored(line, rule.ID) {
					continue
				}
				// Check .mockhunterignore rule-specific suppression
				if s.ignore.shouldIgnoreRule(relPath, rule.ID) {
					continue
				}

				snippet := strings.TrimSpace(line)
				if len(snippet) > 200 {
					snippet = snippet[:200] + "..."
				}

				finding := Finding{
					File:     relPath,
					Line:     lineNum + 1, // 1-indexed
					Severity: rule.Severity,
					Category: rule.Category,
					Rule:     rule.ID,
					Message:  rule.Message,
					Snippet:  snippet,
					Fix:      rule.Fix,
				}

				// Gather surrounding lines for context (3 above, 3 below)
				surrounding := gatherContext(allLines, lineNum, 3)

				// Score confidence
				conf, reasons := scoreFinding(&finding, relPath, line, lineNum+1, surrounding)
				finding.Confidence = conf
				finding.ConfidenceLabel = conf.Label()
				finding.ConfidenceReasons = reasons

				// Skip noise-level findings unless explicitly requested
				if conf >= Confidence(s.config.MinConfidence) {
					findings = append(findings, finding)
				}
			}
		}
	}
	return findings
}

func gatherContext(lines []string, idx, radius int) []string {
	start := idx - radius
	if start < 0 {
		start = 0
	}
	end := idx + radius + 1
	if end > len(lines) {
		end = len(lines)
	}
	return lines[start:end]
}

func isTestFile(path string) bool {
	base := strings.ToLower(filepath.Base(path))
	dir := strings.ToLower(filepath.Dir(path))

	// File name patterns
	if strings.HasSuffix(base, "_test.go") ||
		strings.HasSuffix(base, ".test.ts") ||
		strings.HasSuffix(base, ".test.tsx") ||
		strings.HasSuffix(base, ".test.js") ||
		strings.HasSuffix(base, ".test.jsx") ||
		strings.HasSuffix(base, ".spec.ts") ||
		strings.HasSuffix(base, ".spec.tsx") ||
		strings.HasSuffix(base, ".spec.js") ||
		strings.HasPrefix(base, "test_") ||
		base == "conftest.py" ||
		base == "fixtures.py" ||
		base == "factories.py" ||
		base == "testutils.go" ||
		base == "testhelpers.go" ||
		base == "setup.ts" {
		return true
	}

	// Directory patterns
	if strings.Contains(dir, "__tests__") ||
		strings.Contains(dir, "/tests/") ||
		strings.Contains(dir, "/test/") ||
		strings.Contains(dir, "/spec/") ||
		strings.Contains(dir, "/fixtures/") ||
		strings.Contains(dir, "/testdata/") ||
		strings.Contains(dir, "/mocks/") ||
		strings.Contains(dir, "/__mocks__/") {
		return true
	}

	return false
}

func isVendoredDir(name string) bool {
	vendorDirs := map[string]bool{
		"vendor": true, "third_party": true, "external": true,
		"deps": true, "lib": true, "packages": true,
	}
	return vendorDirs[name] || strings.HasSuffix(name, "-env") || strings.HasSuffix(name, "_env")
}
