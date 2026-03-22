package main

import (
	"path/filepath"
	"strings"
)

// Confidence represents how likely a finding is a true positive (0.0 to 1.0)
type Confidence float64

const (
	ConfDefinite  Confidence = 1.0  // Known bad pattern, no ambiguity
	ConfHigh      Confidence = 0.85 // Very likely real, minor chance of FP
	ConfMedium    Confidence = 0.60 // Needs human review
	ConfLow       Confidence = 0.35 // Probably false positive, context-dependent
	ConfNoise     Confidence = 0.10 // Almost certainly FP, only shown with --show-noise
)

func (c Confidence) Label() string {
	switch {
	case c >= 0.85:
		return "DEFINITE"
	case c >= 0.60:
		return "HIGH"
	case c >= 0.35:
		return "MEDIUM"
	case c >= 0.10:
		return "LOW"
	default:
		return "NOISE"
	}
}

// scoreFinding adjusts a finding's confidence based on contextual signals.
// Returns the confidence score and a list of reasons for the adjustment.
func scoreFinding(f *Finding, filePath string, line string, lineNum int, surroundingLines []string) (Confidence, []string) {
	score := Confidence(0.70) // baseline
	var reasons []string

	// ── PATH-BASED SIGNALS ────────────────────────────────────────────

	// Vendored / third-party code → strong FP signal
	if isVendoredPath(filePath) {
		score -= 0.50
		reasons = append(reasons, "vendored/third-party code")
	}

	// Generated code
	if isGeneratedFile(filePath) {
		score -= 0.40
		reasons = append(reasons, "generated file")
	}

	// .env files → secrets are expected here (if .gitignored)
	if isEnvFile(filePath) && f.Category == "secrets" {
		score -= 0.30
		reasons = append(reasons, ".env file (expected to contain secrets)")
	}

	// Documentation / markdown
	if isDocFile(filePath) {
		score -= 0.35
		reasons = append(reasons, "documentation file")
	}

	// Config examples / templates
	if isExampleConfig(filePath) {
		score -= 0.25
		reasons = append(reasons, "example/template config")
	}

	// Test files (even if not excluded by --exclude-tests)
	if isTestFile(filePath) {
		score -= 0.20
		reasons = append(reasons, "test file")
	}

	// ── LINE CONTEXT SIGNALS ──────────────────────────────────────────

	trimmed := strings.TrimSpace(line)

	// Line is a comment explaining a concept, not actual code
	if isCommentOnly(trimmed, filePath) && f.Category == "secrets" {
		score -= 0.40
		reasons = append(reasons, "comment/docs reference, not actual secret")
	}

	// Line is in a regex or pattern definition (scanner rules, validation)
	if isPatternDefinition(trimmed) {
		score -= 0.35
		reasons = append(reasons, "pattern/regex definition")
	}

	// Line is defining a constant name that CONTAINS the keyword but isn't a value
	if isConstantName(trimmed, f.Category) {
		score -= 0.25
		reasons = append(reasons, "variable/constant name, not a value")
	}

	// Line references env var lookup (getenv, process.env, os.environ)
	if isEnvVarLookup(trimmed) && f.Category == "secrets" {
		score -= 0.30
		reasons = append(reasons, "env var lookup (safe pattern)")
	}

	// Line is an import/require statement
	if isImportLine(trimmed) {
		score -= 0.50
		reasons = append(reasons, "import/require statement")
	}

	// Placeholder values that are obviously not real
	if isObviousPlaceholder(trimmed) {
		score -= 0.15
		reasons = append(reasons, "obvious placeholder value")
	}

	// Line is a validation/check context (map of bad values, comparison)
	allContext := trimmed
	for _, sl := range surroundingLines {
		allContext += " " + sl
	}
	if isValidationContext(allContext) && f.Category == "secrets" {
		score -= 0.40
		reasons = append(reasons, "validation/checking context, not actual secret")
	}

	// Streaming/SSE pacing delays are intentional, not simulation
	if f.Rule == "STUB003" && isStreamingContext(surroundingLines) {
		score -= 0.40
		reasons = append(reasons, "SSE/streaming pacing delay (intentional)")
	}

	// SQL via Sprintf with Join (column names from code, not user input)
	if f.Rule == "GO001" && isSafeSprintfSQL(trimmed) {
		score -= 0.45
		reasons = append(reasons, "Sprintf uses Join() for column names, not user input")
	}

	// ── BOOSTERS (increase confidence) ────────────────────────────────

	// Actual token patterns with high entropy
	if f.Category == "secrets" && hasHighEntropy(trimmed) {
		score += 0.20
		reasons = append(reasons, "high entropy string detected")
	}

	// File is in a deployment path (docker-compose, k8s manifests)
	if isDeploymentConfig(filePath) && f.Category == "secrets" {
		score += 0.15
		reasons = append(reasons, "deployment config (secrets here are risky)")
	}

	// Core application code (not vendored, not test, not generated)
	if isCoreCode(filePath) {
		score += 0.10
		reasons = append(reasons, "core application code")
	}

	// Clamp to [0.0, 1.0]
	if score > 1.0 {
		score = 1.0
	}
	if score < 0.0 {
		score = 0.0
	}

	return score, reasons
}

// ── PATH CLASSIFIERS ──────────────────────────────────────────────────────

func isVendoredPath(p string) bool {
	parts := strings.Split(filepath.ToSlash(p), "/")
	vendored := map[string]bool{
		"node_modules": true, "vendor": true, "site-packages": true,
		"dist": true, ".next": true, "build": true, "__pycache__": true,
		"venv": true, ".venv": true, "env": true, ".tox": true,
		"Pods": true, "Carthage": true, ".gradle": true,
		"target": true, "pkg": true, "third_party": true,
		"external": true, "deps": true, "lib": true,
	}
	for _, part := range parts {
		if vendored[part] {
			return true
		}
	}
	// Paths with -env/ often indicate virtual environments
	for _, part := range parts {
		if strings.HasSuffix(part, "-env") || strings.HasSuffix(part, "_env") {
			return true
		}
	}
	return false
}

func isGeneratedFile(p string) bool {
	base := strings.ToLower(filepath.Base(p))
	return strings.Contains(base, ".generated.") ||
		strings.Contains(base, ".gen.") ||
		strings.HasSuffix(base, ".pb.go") ||
		strings.HasSuffix(base, "_generated.go") ||
		strings.HasSuffix(base, ".d.ts") ||
		strings.Contains(base, "bundle.") ||
		strings.Contains(base, ".min.")
}

func isEnvFile(p string) bool {
	base := filepath.Base(p)
	return base == ".env" || base == ".env.local" || base == ".env.development" ||
		base == ".env.test" || base == ".env.staging"
}

func isDocFile(p string) bool {
	ext := strings.ToLower(filepath.Ext(p))
	return ext == ".md" || ext == ".rst" || ext == ".txt" || ext == ".adoc"
}

func isExampleConfig(p string) bool {
	base := strings.ToLower(filepath.Base(p))
	return strings.Contains(base, "example") || strings.Contains(base, "sample") ||
		strings.Contains(base, "template") || strings.HasSuffix(base, ".example") ||
		strings.HasSuffix(base, ".sample") || strings.HasSuffix(base, ".template")
}

func isDeploymentConfig(p string) bool {
	base := strings.ToLower(filepath.Base(p))
	return base == "docker-compose.yml" || base == "docker-compose.yaml" ||
		strings.HasSuffix(base, ".dockerfile") || base == "dockerfile" ||
		strings.Contains(base, "k8s") || strings.Contains(base, "kubernetes") ||
		strings.Contains(base, "helm") || strings.Contains(base, "terraform")
}

func isCoreCode(p string) bool {
	return !isVendoredPath(p) && !isGeneratedFile(p) && !isTestFile(p) &&
		!isDocFile(p) && !isEnvFile(p)
}

// ── LINE CONTENT CLASSIFIERS ──────────────────────────────────────────────

func isCommentOnly(line, filePath string) bool {
	ext := strings.ToLower(filepath.Ext(filePath))
	trimmed := strings.TrimSpace(line)

	switch ext {
	case ".go", ".ts", ".tsx", ".js", ".jsx", ".java", ".kt", ".rs":
		return strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "/*") || strings.HasPrefix(trimmed, "*")
	case ".py", ".rb", ".sh", ".bash", ".yaml", ".yml":
		return strings.HasPrefix(trimmed, "#")
	}
	return false
}

func isPatternDefinition(line string) bool {
	return strings.Contains(line, "regexp.") || strings.Contains(line, "Regexp") ||
		strings.Contains(line, "regex") || strings.Contains(line, "Pattern:") ||
		strings.Contains(line, "pattern:") || strings.Contains(line, "MustCompile")
}

func isConstantName(line, category string) bool {
	if category != "secrets" {
		return false
	}
	// Lines like `PASSWORD_MIN_LENGTH = 8` or `type Password struct` aren't secrets
	return strings.Contains(line, "_MIN") || strings.Contains(line, "_MAX") ||
		strings.Contains(line, "_LENGTH") || strings.Contains(line, "_POLICY") ||
		strings.Contains(line, "type ") || strings.Contains(line, "interface ")
}

func isEnvVarLookup(line string) bool {
	return strings.Contains(line, "os.Getenv") || strings.Contains(line, "getEnv(") ||
		strings.Contains(line, "process.env.") || strings.Contains(line, "os.environ") ||
		strings.Contains(line, "${") || strings.Contains(line, "env.get(") ||
		strings.Contains(line, "getenv(")
}

func isImportLine(line string) bool {
	trimmed := strings.TrimSpace(line)
	return strings.HasPrefix(trimmed, "import ") || strings.HasPrefix(trimmed, "from ") ||
		strings.HasPrefix(trimmed, "require(") || strings.HasPrefix(trimmed, "use ") ||
		strings.HasPrefix(trimmed, "#include")
}

func isSafeSprintfSQL(line string) bool {
	lower := strings.ToLower(line)
	// strings.Join(setClauses, ...) is building column names from code, not user input
	return strings.Contains(lower, "strings.join") ||
		strings.Contains(lower, "setclauses") ||
		strings.Contains(lower, "columns") ||
		strings.Contains(lower, "fields") ||
		// $%d is a parameterized placeholder index, not user input
		strings.Contains(line, "$%d")
}

func isStreamingContext(surroundingLines []string) bool {
	for _, l := range surroundingLines {
		lower := strings.ToLower(l)
		if strings.Contains(lower, "sse") || strings.Contains(lower, "stream") ||
			strings.Contains(lower, "flush") || strings.Contains(lower, "event-stream") ||
			strings.Contains(lower, "flusher") || strings.Contains(lower, "text/event") ||
			strings.Contains(lower, "chunk") || strings.Contains(lower, "token") ||
			strings.Contains(lower, "pacing") || strings.Contains(lower, "cadence") {
			return true
		}
	}
	return false
}

func isValidationContext(line string) bool {
	lower := strings.ToLower(line)
	// Checking FOR weak values, not USING them
	return strings.Contains(lower, "map[string]bool") ||
		strings.Contains(lower, "weakdefaults") ||
		strings.Contains(lower, "weak_") ||
		strings.Contains(lower, "blacklist") ||
		strings.Contains(lower, "blocklist") ||
		strings.Contains(lower, "banned") ||
		strings.Contains(lower, "invalid") ||
		strings.Contains(lower, "forbidden") ||
		strings.Contains(line, "!=") ||
		strings.Contains(line, "==") ||
		strings.Contains(lower, "if ") ||
		strings.Contains(lower, "switch") ||
		strings.Contains(lower, "case ") ||
		strings.Contains(lower, "assert") ||
		strings.Contains(lower, "expect(")
}

func isObviousPlaceholder(line string) bool {
	lower := strings.ToLower(line)
	return strings.Contains(lower, "your-") || strings.Contains(lower, "your_") ||
		strings.Contains(lower, "<your") || strings.Contains(lower, "xxx") ||
		strings.Contains(lower, "placeholder") || strings.Contains(lower, "replace-me")
}

func hasHighEntropy(line string) bool {
	// Quick entropy check: count unique chars in longest quoted string
	inQuote := false
	var current []byte
	var longest []byte
	for i := 0; i < len(line); i++ {
		if line[i] == '"' || line[i] == '\'' {
			if inQuote {
				if len(current) > len(longest) {
					longest = current
				}
				current = nil
			}
			inQuote = !inQuote
			continue
		}
		if inQuote {
			current = append(current, line[i])
		}
	}
	if len(longest) < 16 {
		return false
	}
	seen := make(map[byte]bool)
	for _, b := range longest {
		seen[b] = true
	}
	// High entropy: many unique chars relative to length
	ratio := float64(len(seen)) / float64(len(longest))
	return ratio > 0.4 && len(longest) > 20
}
