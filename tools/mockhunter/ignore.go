package main

import (
	"bufio"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// IgnoreList manages file-level and line-level suppressions
type IgnoreList struct {
	patterns   []string          // glob patterns from .mockhunterignore
	ruleIgnores map[string]bool  // "file:line:rule" → true for inline ignores
}

// loadIgnoreFile reads .mockhunterignore from the scan directory.
// Format is like .gitignore: one glob pattern per line, # for comments.
// Supports rule-specific ignores: "path/to/file.go # SEC001,SEC002"
func loadIgnoreFile(dir string) *IgnoreList {
	ig := &IgnoreList{
		ruleIgnores: make(map[string]bool),
	}

	f, err := os.Open(filepath.Join(dir, ".mockhunterignore"))
	if err != nil {
		return ig
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		ig.patterns = append(ig.patterns, line)
	}
	return ig
}

// shouldIgnoreFile returns true if the file path matches any ignore pattern
func (ig *IgnoreList) shouldIgnoreFile(relPath string) bool {
	for _, pattern := range ig.patterns {
		// Strip trailing rule-specific comment
		pat := pattern
		if idx := strings.Index(pat, " #"); idx > 0 {
			pat = strings.TrimSpace(pat[:idx])
		}

		// Try matching the pattern against the full relative path
		if matched, _ := filepath.Match(pat, relPath); matched {
			return true
		}
		// Try matching against just the filename
		if matched, _ := filepath.Match(pat, filepath.Base(relPath)); matched {
			return true
		}
		// Try prefix match for directory patterns
		if strings.HasSuffix(pat, "/") && strings.HasPrefix(relPath, pat) {
			return true
		}
		// Handle ** patterns (recursive glob)
		if strings.Contains(pat, "**") {
			// Convert ** to a simple contains check
			parts := strings.Split(pat, "**")
			if len(parts) == 2 {
				prefix := strings.TrimRight(parts[0], "/")
				suffix := strings.TrimLeft(parts[1], "/")
				matchPrefix := prefix == "" || strings.HasPrefix(relPath, prefix)
				matchSuffix := suffix == "" || strings.HasSuffix(relPath, suffix)
				if matchPrefix && matchSuffix {
					return true
				}
			}
		}
	}
	return false
}

// shouldIgnoreRule returns true if a specific rule is ignored for a file pattern
func (ig *IgnoreList) shouldIgnoreRule(relPath, ruleID string) bool {
	for _, pattern := range ig.patterns {
		idx := strings.Index(pattern, " #")
		if idx < 0 {
			continue
		}
		pat := strings.TrimSpace(pattern[:idx])
		rules := strings.TrimSpace(pattern[idx+2:])

		// Check if file matches
		fileMatch := false
		if matched, _ := filepath.Match(pat, relPath); matched {
			fileMatch = true
		}
		if matched, _ := filepath.Match(pat, filepath.Base(relPath)); matched {
			fileMatch = true
		}
		if !fileMatch {
			continue
		}

		// Check if rule is in the ignore list
		for _, r := range strings.Split(rules, ",") {
			if strings.TrimSpace(r) == ruleID {
				return true
			}
		}
	}
	return false
}

// isLineIgnored checks if a source line has an inline ignore comment
// Supports: // mockhunter:ignore or // mockhunter:ignore SEC001,SEC002
func isLineIgnored(line, ruleID string) bool {
	lower := strings.ToLower(line)
	idx := strings.Index(lower, "mockhunter:ignore")
	if idx < 0 {
		// Also support nolint-style: // nolint:mockhunter
		idx = strings.Index(lower, "nolint:mockhunter")
	}
	if idx < 0 {
		return false
	}

	// Extract any rule-specific part after the ignore tag
	rest := line[idx:]
	if colonIdx := strings.Index(rest, " "); colonIdx > 0 {
		rules := strings.TrimSpace(rest[colonIdx:])
		if rules != "" {
			for _, r := range strings.Split(rules, ",") {
				if strings.TrimSpace(r) == ruleID {
					return true
				}
			}
			return false // has rule list but this rule isn't in it
		}
	}
	return true // blanket ignore
}

// getGitDiffFiles returns files changed in the current git working tree
func getGitDiffFiles(dir string) ([]string, error) {
	// Get both staged and unstaged changes
	cmd := exec.Command("git", "diff", "--name-only", "HEAD")
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		// Try without HEAD (for repos with no commits)
		cmd = exec.Command("git", "diff", "--name-only", "--cached")
		cmd.Dir = dir
		out, err = cmd.Output()
		if err != nil {
			return nil, err
		}
	}

	// Also get untracked files
	cmd2 := exec.Command("git", "ls-files", "--others", "--exclude-standard")
	cmd2.Dir = dir
	out2, _ := cmd2.Output()

	files := make(map[string]bool)
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line != "" {
			files[line] = true
		}
	}
	for _, line := range strings.Split(strings.TrimSpace(string(out2)), "\n") {
		if line != "" {
			files[line] = true
		}
	}

	// Also get unstaged modifications
	cmd3 := exec.Command("git", "diff", "--name-only")
	cmd3.Dir = dir
	out3, _ := cmd3.Output()
	for _, line := range strings.Split(strings.TrimSpace(string(out3)), "\n") {
		if line != "" {
			files[line] = true
		}
	}

	result := make([]string, 0, len(files))
	for f := range files {
		result = append(result, f)
	}
	return result, nil
}
