package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

// ============================================================================
// SAFETY CONTROLS — Target validation, scope enforcement, rate limiting,
// audit trail, approval workflows, and safety dashboard.
//
// All stores are in-memory with mutex protection. No external dependencies.
// ============================================================================

// ---- ID generation ---------------------------------------------------------

func genSafetyID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

// ============================================================================
// 1. TARGET VALIDATION
// ============================================================================

// TargetValidation records the outcome of validating a single target against
// the active ruleset. ExpiresAt is optional — zero value means no expiry.
type TargetValidation struct {
	ID          string `json:"id"`
	Target      string `json:"target"`
	Type        string `json:"type"`   // ip, hostname, cidr, url
	Status      string `json:"status"` // allowed, blocked, requires_approval
	Reason      string `json:"reason"`
	ValidatedAt string `json:"validated_at"`
	ValidatedBy string `json:"validated_by"`
	ExpiresAt   string `json:"expires_at,omitempty"`
}

// ValidationRule defines an allow or block pattern applied during target
// validation. Built-in rules for RFC 1918 and cloud metadata IPs are seeded
// at startup and cannot be deleted (BuiltIn == true).
type ValidationRule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Pattern     string `json:"pattern"` // CIDR, hostname glob, or exact IP
	Action      string `json:"action"`  // allow, block, requires_approval
	BuiltIn     bool   `json:"built_in"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
}

var targetValidationStore = struct {
	sync.RWMutex
	rules   []ValidationRule
	history []TargetValidation // recent validations for audit visibility
}{
	rules:   []ValidationRule{},
	history: []TargetValidation{},
}

// seedValidationRules loads the RFC 1918, loopback, and cloud metadata
// blocks that must always be active by default. Operators can add allow
// rules on top to permit specific internal targets inside an engagement scope.
func seedValidationRules() {
	now := time.Now().UTC().Format(time.RFC3339)
	builtIns := []ValidationRule{
		{
			ID:          "rule_builtin_rfc1918_10",
			Name:        "Block RFC 1918 — 10.0.0.0/8",
			Pattern:     "10.0.0.0/8",
			Action:      "block",
			BuiltIn:     true,
			Description: "RFC 1918 private range. Block by default; add a scope allow rule to permit internal engagements.",
			CreatedAt:   now,
		},
		{
			ID:          "rule_builtin_rfc1918_172",
			Name:        "Block RFC 1918 — 172.16.0.0/12",
			Pattern:     "172.16.0.0/12",
			Action:      "block",
			BuiltIn:     true,
			Description: "RFC 1918 private range (172.16–172.31).",
			CreatedAt:   now,
		},
		{
			ID:          "rule_builtin_rfc1918_192",
			Name:        "Block RFC 1918 — 192.168.0.0/16",
			Pattern:     "192.168.0.0/16",
			Action:      "block",
			BuiltIn:     true,
			Description: "RFC 1918 private range.",
			CreatedAt:   now,
		},
		{
			ID:          "rule_builtin_loopback",
			Name:        "Block loopback",
			Pattern:     "127.0.0.0/8",
			Action:      "block",
			BuiltIn:     true,
			Description: "Loopback addresses — scanning these is never appropriate.",
			CreatedAt:   now,
		},
		{
			ID:          "rule_builtin_ipv6_loopback",
			Name:        "Block IPv6 loopback",
			Pattern:     "::1/128",
			Action:      "block",
			BuiltIn:     true,
			Description: "IPv6 loopback address.",
			CreatedAt:   now,
		},
		{
			ID:          "rule_builtin_linklocal",
			Name:        "Block link-local (APIPA)",
			Pattern:     "169.254.0.0/16",
			Action:      "block",
			BuiltIn:     true,
			Description: "Link-local range. 169.254.169.254 is the cloud metadata endpoint — never scan it.",
			CreatedAt:   now,
		},
		{
			ID:          "rule_builtin_aws_metadata",
			Name:        "Block AWS/GCP/Azure metadata service",
			Pattern:     "169.254.169.254/32",
			Action:      "block",
			BuiltIn:     true,
			Description: "Cloud instance metadata endpoint. Reaching this can expose credentials.",
			CreatedAt:   now,
		},
		{
			ID:          "rule_builtin_multicast",
			Name:        "Block multicast",
			Pattern:     "224.0.0.0/4",
			Action:      "block",
			BuiltIn:     true,
			Description: "IPv4 multicast range — not a valid attack surface.",
			CreatedAt:   now,
		},
	}

	targetValidationStore.Lock()
	targetValidationStore.rules = append(targetValidationStore.rules, builtIns...)
	targetValidationStore.Unlock()
}

// classifyTarget determines whether a string is an ip, hostname, cidr, or url.
func classifyTarget(target string) string {
	if strings.Contains(target, "/") && !strings.HasPrefix(target, "http") {
		// Could be CIDR — try parse
		if _, _, err := net.ParseCIDR(target); err == nil {
			return "cidr"
		}
	}
	if strings.HasPrefix(target, "http://") || strings.HasPrefix(target, "https://") {
		return "url"
	}
	if ip := net.ParseIP(target); ip != nil {
		return "ip"
	}
	return "hostname"
}

// extractIP strips a URL or hostname down to a bare IP if possible.
// Returns nil when the string is not a parseable IP.
func extractIP(target string) net.IP {
	// Strip URL scheme and path
	host := target
	if idx := strings.Index(host, "://"); idx != -1 {
		host = host[idx+3:]
	}
	// Strip port
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	// Strip trailing slash / path
	if idx := strings.Index(host, "/"); idx != -1 {
		host = host[:idx]
	}
	return net.ParseIP(host)
}

// validateTargetAgainstRules checks a target against the rule list.
// Later rules in the slice do NOT override earlier ones — first match wins.
// Allow rules installed by an operator take precedence when they appear before
// the built-in blocks (they are prepended by handleAddValidationRule).
func validateTargetAgainstRules(target string) TargetValidation {
	result := TargetValidation{
		ID:          genSafetyID("val"),
		Target:      target,
		Type:        classifyTarget(target),
		ValidatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	ip := extractIP(target)

	targetValidationStore.RLock()
	rules := make([]ValidationRule, len(targetValidationStore.rules))
	copy(rules, targetValidationStore.rules)
	targetValidationStore.RUnlock()

	for _, rule := range rules {
		matched := false

		// Try CIDR match when we have an IP
		if ip != nil {
			if _, cidr, err := net.ParseCIDR(rule.Pattern); err == nil {
				matched = cidr.Contains(ip)
			}
		}

		// Try exact string match (hostname / IP literal)
		if !matched && strings.EqualFold(rule.Pattern, target) {
			matched = true
		}

		// Try glob-style hostname prefix/suffix (e.g. "*.example.com")
		if !matched && strings.Contains(rule.Pattern, "*") {
			matched = globMatch(rule.Pattern, target)
		}

		if matched {
			result.Status = rule.Action
			result.Reason = rule.Description
			return result
		}
	}

	// No rule matched — allow by default
	result.Status = "allowed"
	result.Reason = "no matching rule; target appears to be a public address"
	return result
}

// globMatch performs simple single-level wildcard matching (prefix.*suffix).
func globMatch(pattern, s string) bool {
	if pattern == "*" {
		return true
	}
	if strings.HasPrefix(pattern, "*") {
		return strings.HasSuffix(s, pattern[1:])
	}
	if strings.HasSuffix(pattern, "*") {
		return strings.HasPrefix(s, pattern[:len(pattern)-1])
	}
	// Internal wildcard — split and check both sides
	parts := strings.SplitN(pattern, "*", 2)
	if len(parts) == 2 {
		return strings.HasPrefix(s, parts[0]) && strings.HasSuffix(s, parts[1])
	}
	return false
}

// handleValidateTarget checks a target string against the validation ruleset.
// POST /api/safety/validate
func handleValidateTarget(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Target      string `json:"target"`
		ValidatedBy string `json:"validated_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(input.Target) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "target is required"})
		return
	}

	result := validateTargetAgainstRules(strings.TrimSpace(input.Target))
	if input.ValidatedBy != "" {
		result.ValidatedBy = input.ValidatedBy
	}

	// Persist recent result for audit visibility (cap at 500)
	targetValidationStore.Lock()
	targetValidationStore.history = append(targetValidationStore.history, result)
	if len(targetValidationStore.history) > 500 {
		targetValidationStore.history = targetValidationStore.history[len(targetValidationStore.history)-500:]
	}
	targetValidationStore.Unlock()

	// Always record blocked validations in the audit trail
	if result.Status == "blocked" {
		recordAudit(AuditEntry{
			ID:        genSafetyID("aud"),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Action:    "target_blocked",
			Resource:  "safety/validate",
			Details:   map[string]any{"target": result.Target, "reason": result.Reason},
			Severity:  "warning",
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "validation": result})
}

// handleListValidationRules returns all active validation rules.
// GET /api/safety/rules
func handleListValidationRules(w http.ResponseWriter, r *http.Request) {
	targetValidationStore.RLock()
	rules := make([]ValidationRule, len(targetValidationStore.rules))
	copy(rules, targetValidationStore.rules)
	targetValidationStore.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "rules": rules, "count": len(rules)})
}

// handleAddValidationRule inserts a custom allow/block/requires_approval rule.
// Operator rules are prepended so they take priority over built-in blocks.
// POST /api/safety/rules
func handleAddValidationRule(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name        string `json:"name"`
		Pattern     string `json:"pattern"`
		Action      string `json:"action"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.Pattern) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and pattern are required"})
		return
	}
	switch input.Action {
	case "allow", "block", "requires_approval":
		// valid
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "action must be allow, block, or requires_approval"})
		return
	}

	rule := ValidationRule{
		ID:          genSafetyID("vrule"),
		Name:        strings.TrimSpace(input.Name),
		Pattern:     strings.TrimSpace(input.Pattern),
		Action:      input.Action,
		BuiltIn:     false,
		Description: input.Description,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
	}

	targetValidationStore.Lock()
	// Prepend so operator rules are evaluated before built-in defaults
	targetValidationStore.rules = append([]ValidationRule{rule}, targetValidationStore.rules...)
	targetValidationStore.Unlock()

	recordAudit(AuditEntry{
		ID:        genSafetyID("aud"),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Action:    "validation_rule_created",
		Resource:  "safety/rules",
		ResourceID: rule.ID,
		Details:   map[string]any{"name": rule.Name, "pattern": rule.Pattern, "action": rule.Action},
		Severity:  "info",
	})

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "rule": rule})
}

// handleDeleteValidationRule removes a non-built-in validation rule.
// DELETE /api/safety/rules/{id}
func handleDeleteValidationRule(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "rule id is required"})
		return
	}

	targetValidationStore.Lock()
	defer targetValidationStore.Unlock()

	for i, rule := range targetValidationStore.rules {
		if rule.ID == id {
			if rule.BuiltIn {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "built-in rules cannot be deleted"})
				return
			}
			targetValidationStore.rules = append(
				targetValidationStore.rules[:i],
				targetValidationStore.rules[i+1:]...,
			)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": id})
			return
		}
	}

	writeJSON(w, http.StatusNotFound, map[string]string{"error": "rule not found"})
}

// ============================================================================
// 2. SCOPE ENFORCEMENT
// ============================================================================

// ScopeRule defines a target pattern that is explicitly inside (include) or
// outside (exclude) the engagement scope. Exclude rules always win when both
// an include and exclude match the same target.
type ScopeRule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`        // include, exclude
	Target      string `json:"target"`      // CIDR, hostname glob, or port range
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	CreatedBy   string `json:"created_by"`
	Active      bool   `json:"active"`
}

// ScopeCheckResult carries the outcome of a scope check call.
type ScopeCheckResult struct {
	Allowed     bool   `json:"allowed"`
	MatchedRule string `json:"matched_rule"` // rule ID that determined the outcome
	Reason      string `json:"reason"`
}

var scopeStore = struct {
	sync.RWMutex
	rules      []ScopeRule
	checkCount int64
	excludeHits int64
	includeHits int64
}{}

// checkScopeInternal evaluates target (and optional port) against scope rules.
// Exclude rules take priority — a single exclude match blocks the target even
// when an include rule also matches.
func checkScopeInternal(target string, port int) ScopeCheckResult {
	ip := extractIP(target)

	scopeStore.RLock()
	rules := make([]ScopeRule, len(scopeStore.rules))
	copy(rules, scopeStore.rules)
	scopeStore.RUnlock()

	var includeMatch *ScopeRule
	var excludeMatch *ScopeRule

	for i := range rules {
		rule := &rules[i]
		if !rule.Active {
			continue
		}
		matched := false

		// CIDR match
		if ip != nil {
			if _, cidr, err := net.ParseCIDR(rule.Target); err == nil {
				matched = cidr.Contains(ip)
			}
		}
		// Exact or glob hostname match
		if !matched {
			matched = strings.EqualFold(rule.Target, target) ||
				(strings.Contains(rule.Target, "*") && globMatch(rule.Target, target))
		}
		// Port range match: "8000-9000"
		if !matched && port > 0 && strings.Contains(rule.Target, "-") {
			matched = portInRange(rule.Target, port)
		}

		if matched {
			switch rule.Type {
			case "exclude":
				excludeMatch = rule
			case "include":
				if includeMatch == nil {
					includeMatch = rule
				}
			}
		}
	}

	scopeStore.Lock()
	scopeStore.checkCount++
	scopeStore.Unlock()

	// Exclude wins over include
	if excludeMatch != nil {
		scopeStore.Lock()
		scopeStore.excludeHits++
		scopeStore.Unlock()
		return ScopeCheckResult{
			Allowed:     false,
			MatchedRule: excludeMatch.ID,
			Reason:      fmt.Sprintf("target matches exclusion rule: %s", excludeMatch.Name),
		}
	}

	if includeMatch != nil {
		scopeStore.Lock()
		scopeStore.includeHits++
		scopeStore.Unlock()
		return ScopeCheckResult{
			Allowed:     true,
			MatchedRule: includeMatch.ID,
			Reason:      fmt.Sprintf("target matches inclusion rule: %s", includeMatch.Name),
		}
	}

	// No include rules exist — default allow; if include rules exist but
	// none matched — deny (explicit scope model).
	hasActiveIncludes := false
	scopeStore.RLock()
	for _, r := range scopeStore.rules {
		if r.Active && r.Type == "include" {
			hasActiveIncludes = true
			break
		}
	}
	scopeStore.RUnlock()

	if hasActiveIncludes {
		return ScopeCheckResult{
			Allowed:     false,
			MatchedRule: "",
			Reason:      "target does not match any active include rule",
		}
	}

	return ScopeCheckResult{
		Allowed:     true,
		MatchedRule: "",
		Reason:      "no scope rules defined; target allowed by default",
	}
}

// portInRange checks whether port falls within a "min-max" range string.
func portInRange(rangeStr string, port int) bool {
	parts := strings.SplitN(rangeStr, "-", 2)
	if len(parts) != 2 {
		return false
	}
	var min, max int
	if _, err := fmt.Sscanf(parts[0], "%d", &min); err != nil {
		return false
	}
	if _, err := fmt.Sscanf(parts[1], "%d", &max); err != nil {
		return false
	}
	return port >= min && port <= max
}

// handleListScopeRules returns all scope rules.
// GET /api/safety/scope
func handleListScopeRules(w http.ResponseWriter, r *http.Request) {
	scopeStore.RLock()
	rules := make([]ScopeRule, len(scopeStore.rules))
	copy(rules, scopeStore.rules)
	scopeStore.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "rules": rules, "count": len(rules)})
}

// handleCreateScopeRule adds a new scope include/exclude rule.
// POST /api/safety/scope
func handleCreateScopeRule(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name        string `json:"name"`
		Type        string `json:"type"`
		Target      string `json:"target"`
		Description string `json:"description"`
		CreatedBy   string `json:"created_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.Target) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and target are required"})
		return
	}
	if input.Type != "include" && input.Type != "exclude" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "type must be include or exclude"})
		return
	}

	rule := ScopeRule{
		ID:          genSafetyID("scope"),
		Name:        strings.TrimSpace(input.Name),
		Type:        input.Type,
		Target:      strings.TrimSpace(input.Target),
		Description: input.Description,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
		CreatedBy:   input.CreatedBy,
		Active:      true,
	}

	scopeStore.Lock()
	scopeStore.rules = append(scopeStore.rules, rule)
	scopeStore.Unlock()

	recordAudit(AuditEntry{
		ID:         genSafetyID("aud"),
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		Action:     "scope_rule_created",
		Resource:   "safety/scope",
		ResourceID: rule.ID,
		Details:    map[string]any{"name": rule.Name, "type": rule.Type, "target": rule.Target},
		Severity:   "info",
	})

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "rule": rule})
}

// handleUpdateScopeRule patches an existing scope rule's fields.
// PATCH /api/safety/scope/{id}
func handleUpdateScopeRule(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "rule id is required"})
		return
	}

	var patch struct {
		Name        *string `json:"name"`
		Type        *string `json:"type"`
		Target      *string `json:"target"`
		Description *string `json:"description"`
		Active      *bool   `json:"active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	scopeStore.Lock()
	defer scopeStore.Unlock()

	for i, rule := range scopeStore.rules {
		if rule.ID != id {
			continue
		}
		if patch.Name != nil {
			scopeStore.rules[i].Name = *patch.Name
		}
		if patch.Type != nil && (*patch.Type == "include" || *patch.Type == "exclude") {
			scopeStore.rules[i].Type = *patch.Type
		}
		if patch.Target != nil {
			scopeStore.rules[i].Target = *patch.Target
		}
		if patch.Description != nil {
			scopeStore.rules[i].Description = *patch.Description
		}
		if patch.Active != nil {
			scopeStore.rules[i].Active = *patch.Active
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "rule": scopeStore.rules[i]})
		return
	}

	writeJSON(w, http.StatusNotFound, map[string]string{"error": "scope rule not found"})
}

// handleDeleteScopeRule removes a scope rule by ID.
// DELETE /api/safety/scope/{id}
func handleDeleteScopeRule(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "rule id is required"})
		return
	}

	scopeStore.Lock()
	defer scopeStore.Unlock()

	for i, rule := range scopeStore.rules {
		if rule.ID == id {
			scopeStore.rules = append(scopeStore.rules[:i], scopeStore.rules[i+1:]...)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": id})
			return
		}
	}

	writeJSON(w, http.StatusNotFound, map[string]string{"error": "scope rule not found"})
}

// handleCheckScope evaluates a target against active scope rules.
// POST /api/safety/scope/check
func handleCheckScope(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Target string `json:"target"`
		Port   int    `json:"port"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(input.Target) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "target is required"})
		return
	}

	result := checkScopeInternal(strings.TrimSpace(input.Target), input.Port)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": result})
}

// handleGetScopeStats returns aggregate counts for the scope ruleset.
// GET /api/safety/scope/stats
func handleGetScopeStats(w http.ResponseWriter, r *http.Request) {
	scopeStore.RLock()
	total := len(scopeStore.rules)
	checks := scopeStore.checkCount
	excludeHits := scopeStore.excludeHits
	includeHits := scopeStore.includeHits

	include := 0
	exclude := 0
	inactive := 0
	for _, rule := range scopeStore.rules {
		if !rule.Active {
			inactive++
			continue
		}
		switch rule.Type {
		case "include":
			include++
		case "exclude":
			exclude++
		}
	}
	scopeStore.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"total_rules":  total,
		"include":      include,
		"exclude":      exclude,
		"inactive":     inactive,
		"total_checks": checks,
		"exclude_hits": excludeHits,
		"include_hits": includeHits,
	})
}

// ============================================================================
// 3. RATE LIMITING (per-operation)
// ============================================================================

// RateLimitConfig holds thresholds for a single operation type. MaxConcurrent
// uses a simple counter rather than a token bucket — sufficient for the
// operation types Harbinger performs (scans, exploit chains, C2 tasks).
type RateLimitConfig struct {
	ID             string `json:"id"`
	OperationType  string `json:"operation_type"`
	MaxPerMinute   int    `json:"max_per_minute"`
	MaxPerHour     int    `json:"max_per_hour"`
	MaxConcurrent  int    `json:"max_concurrent"`
	Active         bool   `json:"active"`
}

// RateLimitStatus combines configuration with live counters for a dashboard.
type RateLimitStatus struct {
	OperationType     string `json:"operation_type"`
	MaxPerMinute      int    `json:"max_per_minute"`
	MaxPerHour        int    `json:"max_per_hour"`
	MaxConcurrent     int    `json:"max_concurrent"`
	CurrentMinute     int    `json:"current_minute"`
	CurrentHour       int    `json:"current_hour"`
	CurrentConcurrent int    `json:"current_concurrent"`
	IsLimited         bool   `json:"is_limited"`
}

// rateLimitCounter tracks time-windowed invocation counts for one op type.
type rateLimitCounter struct {
	minuteWindow []time.Time // timestamps within the last 60 s
	hourWindow   []time.Time // timestamps within the last 60 min
	concurrent   int         // currently running operations
}

var rateLimitStore = struct {
	sync.RWMutex
	configs  []RateLimitConfig
	counters map[string]*rateLimitCounter // keyed by operationType
}{
	counters: make(map[string]*rateLimitCounter),
}

// pruneWindows removes expired timestamps from the sliding windows.
// Caller must hold rateLimitStore write lock.
func pruneWindows(c *rateLimitCounter) {
	now := time.Now()
	minuteCutoff := now.Add(-1 * time.Minute)
	hourCutoff := now.Add(-1 * time.Hour)

	pruned := c.minuteWindow[:0]
	for _, t := range c.minuteWindow {
		if t.After(minuteCutoff) {
			pruned = append(pruned, t)
		}
	}
	c.minuteWindow = pruned

	prunedH := c.hourWindow[:0]
	for _, t := range c.hourWindow {
		if t.After(hourCutoff) {
			prunedH = append(prunedH, t)
		}
	}
	c.hourWindow = prunedH
}

// getOrCreateCounter returns the counter for an op type, creating if missing.
// Caller must hold rateLimitStore write lock.
func getOrCreateCounter(opType string) *rateLimitCounter {
	if c, ok := rateLimitStore.counters[opType]; ok {
		return c
	}
	c := &rateLimitCounter{}
	rateLimitStore.counters[opType] = c
	return c
}

// handleListRateLimits returns all configs with their current usage.
// GET /api/safety/rate-limits
func handleListRateLimits(w http.ResponseWriter, r *http.Request) {
	rateLimitStore.Lock()
	defer rateLimitStore.Unlock()

	statuses := make([]RateLimitStatus, 0, len(rateLimitStore.configs))
	for _, cfg := range rateLimitStore.configs {
		c := getOrCreateCounter(cfg.OperationType)
		pruneWindows(c)

		isLimited := false
		if cfg.Active {
			isLimited = (cfg.MaxPerMinute > 0 && len(c.minuteWindow) >= cfg.MaxPerMinute) ||
				(cfg.MaxPerHour > 0 && len(c.hourWindow) >= cfg.MaxPerHour) ||
				(cfg.MaxConcurrent > 0 && c.concurrent >= cfg.MaxConcurrent)
		}

		statuses = append(statuses, RateLimitStatus{
			OperationType:     cfg.OperationType,
			MaxPerMinute:      cfg.MaxPerMinute,
			MaxPerHour:        cfg.MaxPerHour,
			MaxConcurrent:     cfg.MaxConcurrent,
			CurrentMinute:     len(c.minuteWindow),
			CurrentHour:       len(c.hourWindow),
			CurrentConcurrent: c.concurrent,
			IsLimited:         isLimited,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "rate_limits": statuses, "count": len(statuses)})
}

// handleSetRateLimit creates or updates a rate limit config by operationType.
// POST /api/safety/rate-limits
func handleSetRateLimit(w http.ResponseWriter, r *http.Request) {
	var input struct {
		OperationType string `json:"operation_type"`
		MaxPerMinute  int    `json:"max_per_minute"`
		MaxPerHour    int    `json:"max_per_hour"`
		MaxConcurrent int    `json:"max_concurrent"`
		Active        *bool  `json:"active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(input.OperationType) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "operation_type is required"})
		return
	}

	active := true
	if input.Active != nil {
		active = *input.Active
	}

	rateLimitStore.Lock()
	defer rateLimitStore.Unlock()

	// Update existing config if operationType matches
	for i, cfg := range rateLimitStore.configs {
		if cfg.OperationType == input.OperationType {
			rateLimitStore.configs[i].MaxPerMinute = input.MaxPerMinute
			rateLimitStore.configs[i].MaxPerHour = input.MaxPerHour
			rateLimitStore.configs[i].MaxConcurrent = input.MaxConcurrent
			rateLimitStore.configs[i].Active = active
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "config": rateLimitStore.configs[i]})
			return
		}
	}

	cfg := RateLimitConfig{
		ID:            genSafetyID("rl"),
		OperationType: strings.TrimSpace(input.OperationType),
		MaxPerMinute:  input.MaxPerMinute,
		MaxPerHour:    input.MaxPerHour,
		MaxConcurrent: input.MaxConcurrent,
		Active:        active,
	}
	rateLimitStore.configs = append(rateLimitStore.configs, cfg)
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "config": cfg})
}

// handleDeleteRateLimit removes a rate limit config.
// DELETE /api/safety/rate-limits/{id}
func handleDeleteRateLimit(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "rate limit id is required"})
		return
	}

	rateLimitStore.Lock()
	defer rateLimitStore.Unlock()

	for i, cfg := range rateLimitStore.configs {
		if cfg.ID == id {
			rateLimitStore.configs = append(rateLimitStore.configs[:i], rateLimitStore.configs[i+1:]...)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": id})
			return
		}
	}

	writeJSON(w, http.StatusNotFound, map[string]string{"error": "rate limit config not found"})
}

// handleCheckRateLimit reports whether an operation is currently throttled.
// POST /api/safety/rate-limits/check
func handleCheckRateLimit(w http.ResponseWriter, r *http.Request) {
	var input struct {
		OperationType string `json:"operationType"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(input.OperationType) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "operationType is required"})
		return
	}

	rateLimitStore.Lock()
	defer rateLimitStore.Unlock()

	c := getOrCreateCounter(input.OperationType)
	pruneWindows(c)

	isLimited := false
	reason := ""
	for _, cfg := range rateLimitStore.configs {
		if cfg.OperationType != input.OperationType || !cfg.Active {
			continue
		}
		if cfg.MaxPerMinute > 0 && len(c.minuteWindow) >= cfg.MaxPerMinute {
			isLimited = true
			reason = fmt.Sprintf("per-minute limit of %d reached (%d)", cfg.MaxPerMinute, len(c.minuteWindow))
		} else if cfg.MaxPerHour > 0 && len(c.hourWindow) >= cfg.MaxPerHour {
			isLimited = true
			reason = fmt.Sprintf("per-hour limit of %d reached (%d)", cfg.MaxPerHour, len(c.hourWindow))
		} else if cfg.MaxConcurrent > 0 && c.concurrent >= cfg.MaxConcurrent {
			isLimited = true
			reason = fmt.Sprintf("concurrent limit of %d reached (%d running)", cfg.MaxConcurrent, c.concurrent)
		}
		break
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"operation_type":  input.OperationType,
		"is_limited":      isLimited,
		"reason":          reason,
		"current_minute":  len(c.minuteWindow),
		"current_hour":    len(c.hourWindow),
		"current_concurrent": c.concurrent,
	})
}

// handleIncrementRateCounter records an execution against a rate limit config.
// POST /api/safety/rate-limits/{id}/increment
func handleIncrementRateCounter(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "rate limit id is required"})
		return
	}

	var body struct {
		// concurrent_delta: +1 to mark start, -1 to mark completion.
		// Omit or 0 to just record a timestamp hit.
		ConcurrentDelta int `json:"concurrent_delta"`
	}
	// Ignore decode errors — body is optional for timestamp-only increments
	_ = json.NewDecoder(r.Body).Decode(&body)

	rateLimitStore.Lock()
	defer rateLimitStore.Unlock()

	var opType string
	for _, cfg := range rateLimitStore.configs {
		if cfg.ID == id {
			opType = cfg.OperationType
			break
		}
	}
	if opType == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "rate limit config not found"})
		return
	}

	c := getOrCreateCounter(opType)
	pruneWindows(c)

	now := time.Now()
	if body.ConcurrentDelta == 0 || body.ConcurrentDelta > 0 {
		// Record a timestamped invocation
		c.minuteWindow = append(c.minuteWindow, now)
		c.hourWindow = append(c.hourWindow, now)
	}
	if body.ConcurrentDelta != 0 {
		c.concurrent += body.ConcurrentDelta
		if c.concurrent < 0 {
			c.concurrent = 0
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                 true,
		"operation_type":     opType,
		"current_minute":     len(c.minuteWindow),
		"current_hour":       len(c.hourWindow),
		"current_concurrent": c.concurrent,
	})
}

// ============================================================================
// 4. AUDIT TRAIL
// ============================================================================

// AuditEntry records a single security-relevant event. Severity levels mirror
// common SIEM conventions: info, warning, critical.
type AuditEntry struct {
	ID         string         `json:"id"`
	Timestamp  string         `json:"timestamp"`
	UserID     string         `json:"user_id,omitempty"`
	Username   string         `json:"username,omitempty"`
	Action     string         `json:"action"`
	Resource   string         `json:"resource"`
	ResourceID string         `json:"resource_id,omitempty"`
	Details    map[string]any `json:"details,omitempty"`
	Severity   string         `json:"severity"` // info, warning, critical
	IPAddress  string         `json:"ip_address,omitempty"`
}

const auditRingSize = 10000

// auditRing is a fixed-capacity ring buffer for AuditEntry records.
// When capacity is reached, the oldest entry is overwritten.
var auditRing = struct {
	sync.RWMutex
	buf  [auditRingSize]AuditEntry
	head int // index of next write slot
	size int // number of valid entries (0 ≤ size ≤ auditRingSize)
}{}

// recordAudit stores an entry in the ring buffer. Safe for concurrent use —
// called from multiple handlers. No logging here to avoid log feedback loops.
func recordAudit(entry AuditEntry) {
	if entry.ID == "" {
		entry.ID = genSafetyID("aud")
	}
	if entry.Timestamp == "" {
		entry.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	auditRing.Lock()
	auditRing.buf[auditRing.head] = entry
	auditRing.head = (auditRing.head + 1) % auditRingSize
	if auditRing.size < auditRingSize {
		auditRing.size++
	}
	auditRing.Unlock()
}

// readAuditEntries returns all valid entries ordered oldest-to-newest.
func readAuditEntries() []AuditEntry {
	auditRing.RLock()
	defer auditRing.RUnlock()

	size := auditRing.size
	if size == 0 {
		return []AuditEntry{}
	}

	entries := make([]AuditEntry, size)
	// The oldest entry sits at head when the buffer is full, or at index 0
	// when it hasn't wrapped yet.
	start := 0
	if auditRing.size == auditRingSize {
		start = auditRing.head // next write slot = oldest after wrap
	}
	for i := 0; i < size; i++ {
		entries[i] = auditRing.buf[(start+i)%auditRingSize]
	}
	return entries
}

// handleListAuditEntries returns audit log entries with pagination and filters.
// GET /api/safety/audit?userId=&action=&severity=&from=&to=&offset=&limit=
func handleListAuditEntries(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	userFilter := q.Get("userId")
	actionFilter := q.Get("action")
	severityFilter := q.Get("severity")
	fromStr := q.Get("from")
	toStr := q.Get("to")

	offsetStr := q.Get("offset")
	limitStr := q.Get("limit")
	offset := 0
	limit := 100

	if offsetStr != "" {
		if n, err := fmt.Sscanf(offsetStr, "%d", &offset); n == 0 || err != nil {
			offset = 0
		}
	}
	if limitStr != "" {
		var parsed int
		if n, err := fmt.Sscanf(limitStr, "%d", &parsed); n == 1 && err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 1000 {
		limit = 1000 // cap to prevent giant payloads
	}

	var fromTime, toTime time.Time
	if fromStr != "" {
		fromTime, _ = time.Parse(time.RFC3339, fromStr)
	}
	if toStr != "" {
		toTime, _ = time.Parse(time.RFC3339, toStr)
	}

	all := readAuditEntries()

	// Filter newest-first for API consumers
	sort.Slice(all, func(i, j int) bool { return all[i].Timestamp > all[j].Timestamp })

	filtered := make([]AuditEntry, 0)
	for _, e := range all {
		if userFilter != "" && e.UserID != userFilter {
			continue
		}
		if actionFilter != "" && !strings.Contains(e.Action, actionFilter) {
			continue
		}
		if severityFilter != "" && e.Severity != severityFilter {
			continue
		}
		if !fromTime.IsZero() {
			if t, err := time.Parse(time.RFC3339, e.Timestamp); err == nil && t.Before(fromTime) {
				continue
			}
		}
		if !toTime.IsZero() {
			if t, err := time.Parse(time.RFC3339, e.Timestamp); err == nil && t.After(toTime) {
				continue
			}
		}
		filtered = append(filtered, e)
	}

	total := len(filtered)
	if offset >= total {
		filtered = []AuditEntry{}
	} else {
		end := offset + limit
		if end > total {
			end = total
		}
		filtered = filtered[offset:end]
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"entries": filtered,
	})
}

// handleCreateAuditEntry allows external callers to push entries into the trail.
// POST /api/safety/audit
func handleCreateAuditEntry(w http.ResponseWriter, r *http.Request) {
	var entry AuditEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(entry.Action) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "action is required"})
		return
	}

	switch entry.Severity {
	case "info", "warning", "critical":
		// valid
	default:
		entry.Severity = "info"
	}

	entry.ID = genSafetyID("aud")
	entry.Timestamp = time.Now().UTC().Format(time.RFC3339)
	// Capture request IP when not provided by caller
	if entry.IPAddress == "" {
		entry.IPAddress = r.RemoteAddr
	}

	recordAudit(entry)
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "entry": entry})
}

// handleGetAuditStats returns aggregate counts across the audit trail.
// GET /api/safety/audit/stats
func handleGetAuditStats(w http.ResponseWriter, r *http.Request) {
	entries := readAuditEntries()

	bySeverity := map[string]int{"info": 0, "warning": 0, "critical": 0}
	byAction := map[string]int{}
	byUser := map[string]int{}

	for _, e := range entries {
		if _, ok := bySeverity[e.Severity]; ok {
			bySeverity[e.Severity]++
		}
		byAction[e.Action]++
		if e.UserID != "" {
			byUser[e.UserID]++
		}
	}

	// Top 10 users by event volume
	type userCount struct {
		UserID string `json:"user_id"`
		Count  int    `json:"count"`
	}
	topUsers := make([]userCount, 0, len(byUser))
	for uid, count := range byUser {
		topUsers = append(topUsers, userCount{uid, count})
	}
	sort.Slice(topUsers, func(i, j int) bool { return topUsers[i].Count > topUsers[j].Count })
	if len(topUsers) > 10 {
		topUsers = topUsers[:10]
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"total":         len(entries),
		"by_severity":   bySeverity,
		"by_action":     byAction,
		"top_users":     topUsers,
	})
}

// handleExportAudit streams the full audit trail as a JSON array.
// GET /api/safety/audit/export
func handleExportAudit(w http.ResponseWriter, r *http.Request) {
	entries := readAuditEntries()
	// Export oldest-first for chronological compliance logs
	sort.Slice(entries, func(i, j int) bool { return entries[i].Timestamp < entries[j].Timestamp })

	recordAudit(AuditEntry{
		ID:        genSafetyID("aud"),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Action:    "audit_export",
		Resource:  "safety/audit/export",
		Details:   map[string]any{"entry_count": len(entries)},
		Severity:  "warning", // Exporting the audit log is a sensitive operation
		IPAddress: r.RemoteAddr,
	})

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "entries": entries, "count": len(entries)})
}

// ============================================================================
// 5. APPROVAL WORKFLOWS
// ============================================================================

// ApprovalRequest gates high-impact operations behind a human review step.
// Once approved it carries an ExpiresAt so stale approvals cannot be replayed.
type ApprovalRequest struct {
	ID          string         `json:"id"`
	Type        string         `json:"type"`   // chain_execution, scope_change, kill_command, data_exfil
	Title       string         `json:"title"`
	Description string         `json:"description"`
	RequestedBy string         `json:"requested_by"`
	RequestedAt string         `json:"requested_at"`
	Status      string         `json:"status"`      // pending, approved, rejected, expired
	ReviewedBy  string         `json:"reviewed_by,omitempty"`
	ReviewedAt  string         `json:"reviewed_at,omitempty"`
	ExpiresAt   string         `json:"expires_at,omitempty"`
	Metadata    map[string]any `json:"metadata,omitempty"`
}

var approvalStore = struct {
	sync.RWMutex
	requests []ApprovalRequest
}{}

// expireStaleApprovals marks pending requests past their ExpiresAt as expired.
// Runs lazily on read; no background goroutine needed at this scale.
func expireStaleApprovals() {
	now := time.Now().UTC()
	for i, req := range approvalStore.requests {
		if req.Status != "pending" || req.ExpiresAt == "" {
			continue
		}
		exp, err := time.Parse(time.RFC3339, req.ExpiresAt)
		if err != nil {
			continue
		}
		if now.After(exp) {
			approvalStore.requests[i].Status = "expired"
		}
	}
}

// handleListApprovals returns approval requests, optionally filtered by status.
// GET /api/safety/approvals?status=pending
func handleListApprovals(w http.ResponseWriter, r *http.Request) {
	statusFilter := r.URL.Query().Get("status")

	approvalStore.Lock()
	expireStaleApprovals()
	reqs := make([]ApprovalRequest, len(approvalStore.requests))
	copy(reqs, approvalStore.requests)
	approvalStore.Unlock()

	// Sort newest first
	sort.Slice(reqs, func(i, j int) bool {
		return reqs[i].RequestedAt > reqs[j].RequestedAt
	})

	if statusFilter != "" {
		filtered := reqs[:0]
		for _, req := range reqs {
			if req.Status == statusFilter {
				filtered = append(filtered, req)
			}
		}
		reqs = filtered
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "requests": reqs, "count": len(reqs)})
}

// handleCreateApproval submits a new approval request for human review.
// POST /api/safety/approvals
func handleCreateApproval(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Type        string         `json:"type"`
		Title       string         `json:"title"`
		Description string         `json:"description"`
		RequestedBy string         `json:"requested_by"`
		ExpiresAt   string         `json:"expires_at"` // RFC3339, optional
		Metadata    map[string]any `json:"metadata"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(input.Type) == "" || strings.TrimSpace(input.Title) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "type and title are required"})
		return
	}

	// Default expiry to 24 hours if not specified — prevents indefinite pending
	expiresAt := input.ExpiresAt
	if expiresAt == "" {
		expiresAt = time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
	}

	req := ApprovalRequest{
		ID:          genSafetyID("appr"),
		Type:        strings.TrimSpace(input.Type),
		Title:       strings.TrimSpace(input.Title),
		Description: input.Description,
		RequestedBy: input.RequestedBy,
		RequestedAt: time.Now().UTC().Format(time.RFC3339),
		Status:      "pending",
		ExpiresAt:   expiresAt,
		Metadata:    input.Metadata,
	}

	approvalStore.Lock()
	approvalStore.requests = append(approvalStore.requests, req)
	approvalStore.Unlock()

	recordAudit(AuditEntry{
		ID:         genSafetyID("aud"),
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		Action:     "approval_requested",
		Resource:   "safety/approvals",
		ResourceID: req.ID,
		Details:    map[string]any{"type": req.Type, "title": req.Title, "requested_by": req.RequestedBy},
		Severity:   "warning",
	})

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "request": req})
}

// handleReviewApproval sets the status of a pending approval request.
// PATCH /api/safety/approvals/{id}
func handleReviewApproval(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "approval id is required"})
		return
	}

	var input struct {
		Status     string `json:"status"`      // approved, rejected
		ReviewedBy string `json:"reviewed_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if input.Status != "approved" && input.Status != "rejected" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "status must be approved or rejected"})
		return
	}

	approvalStore.Lock()
	expireStaleApprovals()

	for i, req := range approvalStore.requests {
		if req.ID != id {
			continue
		}
		if req.Status != "pending" {
			approvalStore.Unlock()
			writeJSON(w, http.StatusConflict, map[string]string{
				"error": fmt.Sprintf("approval is already %s", req.Status),
			})
			return
		}
		approvalStore.requests[i].Status = input.Status
		approvalStore.requests[i].ReviewedBy = input.ReviewedBy
		approvalStore.requests[i].ReviewedAt = time.Now().UTC().Format(time.RFC3339)
		updated := approvalStore.requests[i]
		approvalStore.Unlock()

		recordAudit(AuditEntry{
			ID:         genSafetyID("aud"),
			Timestamp:  time.Now().UTC().Format(time.RFC3339),
			Action:     "approval_" + input.Status,
			Resource:   "safety/approvals",
			ResourceID: id,
			Details:    map[string]any{"type": req.Type, "reviewed_by": input.ReviewedBy},
			Severity:   "warning",
		})

		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "request": updated})
		return
	}

	approvalStore.Unlock()
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "approval request not found"})
}

// handleGetPendingCount returns the number of pending approval requests.
// GET /api/safety/approvals/pending/count
func handleGetPendingCount(w http.ResponseWriter, r *http.Request) {
	approvalStore.Lock()
	expireStaleApprovals()

	count := 0
	for _, req := range approvalStore.requests {
		if req.Status == "pending" {
			count++
		}
	}
	approvalStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "pending_count": count})
}

// ============================================================================
// 6. SAFETY DASHBOARD
// ============================================================================

// SafetyDashboard is the aggregate view surfaced on the frontend Safety page.
type SafetyDashboard struct {
	PendingApprovals   int              `json:"pending_approvals"`
	ScopeRuleCount     int              `json:"scope_rule_count"`
	ValidationRuleCount int             `json:"validation_rule_count"`
	RateLimitedOps     []string         `json:"rate_limited_ops"`
	RecentAuditEntries []AuditEntry     `json:"recent_audit_entries"`
	RecentBlockedTargets []TargetValidation `json:"recent_blocked_targets"`
	AuditSeverityCounts map[string]int  `json:"audit_severity_counts"`
}

// handleSafetyDashboard returns the aggregate safety system overview.
// GET /api/safety/dashboard
func handleSafetyDashboard(w http.ResponseWriter, r *http.Request) {
	// Pending approvals
	approvalStore.Lock()
	expireStaleApprovals()
	pendingCount := 0
	for _, req := range approvalStore.requests {
		if req.Status == "pending" {
			pendingCount++
		}
	}
	approvalStore.Unlock()

	// Scope rule count
	scopeStore.RLock()
	scopeRuleCount := len(scopeStore.rules)
	scopeStore.RUnlock()

	// Validation rule count
	targetValidationStore.RLock()
	validationRuleCount := len(targetValidationStore.rules)
	// Blocked targets from recent history
	blockedTargets := make([]TargetValidation, 0)
	for _, v := range targetValidationStore.history {
		if v.Status == "blocked" {
			blockedTargets = append(blockedTargets, v)
		}
	}
	targetValidationStore.RUnlock()

	// Most recent 10 blocked targets (newest first)
	sort.Slice(blockedTargets, func(i, j int) bool {
		return blockedTargets[i].ValidatedAt > blockedTargets[j].ValidatedAt
	})
	if len(blockedTargets) > 10 {
		blockedTargets = blockedTargets[:10]
	}

	// Rate limited operations
	rateLimitStore.Lock()
	limitedOps := make([]string, 0)
	for _, cfg := range rateLimitStore.configs {
		if !cfg.Active {
			continue
		}
		c := getOrCreateCounter(cfg.OperationType)
		pruneWindows(c)
		if (cfg.MaxPerMinute > 0 && len(c.minuteWindow) >= cfg.MaxPerMinute) ||
			(cfg.MaxPerHour > 0 && len(c.hourWindow) >= cfg.MaxPerHour) ||
			(cfg.MaxConcurrent > 0 && c.concurrent >= cfg.MaxConcurrent) {
			limitedOps = append(limitedOps, cfg.OperationType)
		}
	}
	rateLimitStore.Unlock()

	// Recent audit entries (last 10, newest first)
	allAudit := readAuditEntries()
	sort.Slice(allAudit, func(i, j int) bool { return allAudit[i].Timestamp > allAudit[j].Timestamp })
	recentAudit := allAudit
	if len(recentAudit) > 10 {
		recentAudit = recentAudit[:10]
	}

	// Severity counts across full trail
	severityCounts := map[string]int{"info": 0, "warning": 0, "critical": 0}
	for _, e := range allAudit {
		if _, ok := severityCounts[e.Severity]; ok {
			severityCounts[e.Severity]++
		}
	}

	dash := SafetyDashboard{
		PendingApprovals:    pendingCount,
		ScopeRuleCount:      scopeRuleCount,
		ValidationRuleCount: validationRuleCount,
		RateLimitedOps:      limitedOps,
		RecentAuditEntries:  recentAudit,
		RecentBlockedTargets: blockedTargets,
		AuditSeverityCounts: severityCounts,
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "dashboard": dash})
}

// ============================================================================
// INIT — seed built-in validation rules at startup
// ============================================================================

func init() {
	seedValidationRules()
}
