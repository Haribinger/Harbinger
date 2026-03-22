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
	Categories    []string // empty = all categories
	MaxWorkers    int
}

// Scanner orchestrates the scan
type Scanner struct {
	config ScanConfig
	rules  []Rule
}

func NewScanner(config ScanConfig) *Scanner {
	if config.MaxWorkers == 0 {
		config.MaxWorkers = 8
	}
	return &Scanner{
		config: config,
		rules:  allRules(),
	}
}

// Scan walks the directory and applies all rules
func (s *Scanner) Scan() *Report {
	report := &Report{}
	var files []string

	filepath.Walk(s.config.Dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			base := info.Name()
			if base == "node_modules" || base == ".git" || base == "dist" || base == "build" ||
				base == "vendor" || base == "__pycache__" || base == ".next" || base == ".venv" ||
				base == "venv" || base == ".tox" {
				return filepath.SkipDir
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
	return strings.HasSuffix(base, "_test.go") ||
		strings.HasSuffix(base, ".test.ts") ||
		strings.HasSuffix(base, ".test.tsx") ||
		strings.HasSuffix(base, ".test.js") ||
		strings.HasSuffix(base, ".spec.ts") ||
		strings.HasSuffix(base, ".spec.tsx") ||
		strings.HasSuffix(base, ".spec.js") ||
		strings.HasSuffix(base, "test_") ||
		strings.Contains(base, "__tests__") ||
		strings.HasPrefix(base, "test_")
}
