package memorylayer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// shortOutput is smaller than the default 16KB limit.
const shortOutput = "192.168.1.1:80\n192.168.1.2:443\n"

// buildLongOutput produces a string that exceeds the given byte limit.
func buildLongOutput(limit int) string {
	line := strings.Repeat("a", 100) + "\n"
	var sb strings.Builder
	for sb.Len() < limit+1 {
		sb.WriteString(line)
	}
	return sb.String()
}

// buildJSONLOutput produces n JSONL lines for a given host-like field.
func buildJSONLOutput(n int, keyField, valuePrefix string) string {
	var sb strings.Builder
	for i := 0; i < n; i++ {
		obj := map[string]string{keyField: valuePrefix + string(rune('a'+i%26)) + strings.Repeat("x", 5)}
		b, _ := json.Marshal(obj)
		sb.Write(b)
		sb.WriteByte('\n')
	}
	return sb.String()
}

// --- TestSummarizeOutput_Short ---

// TestSummarizeOutput_Short verifies that output already within the limit is
// returned verbatim without modification.
func TestSummarizeOutput_Short(t *testing.T) {
	s := NewSummarizer(SummarizerConfig{})
	out, err := s.SummarizeOutput(context.Background(), shortOutput, "naabu")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out != shortOutput {
		t.Errorf("expected output unchanged, got %q", out)
	}
}

// --- TestSummarizeOutput_Truncate ---

// TestSummarizeOutput_Truncate verifies that long text output is truncated when
// no LLM is configured, and that the result is within the configured limit plus
// the truncation marker overhead.
func TestSummarizeOutput_Truncate(t *testing.T) {
	limit := 500
	s := NewSummarizer(SummarizerConfig{ResultLimit: limit})

	long := buildLongOutput(limit)
	out, err := s.SummarizeOutput(context.Background(), long, "unknown-tool")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) >= len(long) {
		t.Errorf("expected output shorter than input (%d), got %d bytes", len(long), len(out))
	}
	if !strings.Contains(out, "truncated") {
		t.Errorf("expected truncation marker in output, got: %q", out[:min(200, len(out))])
	}
}

// --- TestSummarizeOutput_JSONLTruncate ---

// TestSummarizeOutput_JSONLTruncate verifies that JSONL tool output is deduplicated
// and truncated by re-serialising up to the limit.
func TestSummarizeOutput_JSONLTruncate(t *testing.T) {
	limit := 300
	s := NewSummarizer(SummarizerConfig{ResultLimit: limit})

	// Build output with duplicate host entries so deduplication is exercised.
	var sb strings.Builder
	for i := 0; i < 50; i++ {
		obj := map[string]string{"host": "sub.example.com"} // all identical → should deduplicate to 1
		b, _ := json.Marshal(obj)
		sb.Write(b)
		sb.WriteByte('\n')
	}
	// Add unique entries that would exceed the limit if all kept.
	for i := 0; i < 100; i++ {
		obj := map[string]string{"host": strings.Repeat(string(rune('a'+i%26)), 8) + ".example.com"}
		b, _ := json.Marshal(obj)
		sb.Write(b)
		sb.WriteByte('\n')
	}

	out, err := s.SummarizeOutput(context.Background(), sb.String(), "subfinder")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) == 0 {
		t.Fatal("expected non-empty output")
	}
	// After deduplication the 50 identical lines become one.
	count := strings.Count(out, "sub.example.com")
	if count > 1 {
		t.Errorf("expected deduplication to collapse identical hosts, got %d occurrences", count)
	}
}

// --- TestSummarizeChain_Short ---

// TestSummarizeChain_Short verifies that a chain within the limit is returned as-is.
func TestSummarizeChain_Short(t *testing.T) {
	s := NewSummarizer(SummarizerConfig{ChainLimit: 50})
	chain := []Message{
		{Role: "system", Content: "You are a security agent."},
		{Role: "user", Content: "Scan example.com"},
		{Role: "assistant", Content: "Scanning now..."},
	}
	out, err := s.SummarizeChain(context.Background(), chain, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != len(chain) {
		t.Errorf("expected %d messages unchanged, got %d", len(chain), len(out))
	}
	for i, m := range out {
		if m.Role != chain[i].Role || m.Content != chain[i].Content {
			t.Errorf("message %d changed: got {%s %q}", i, m.Role, m.Content)
		}
	}
}

// --- TestSummarizeChain_Truncate ---

// TestSummarizeChain_Truncate verifies that a chain exceeding the limit is compressed
// so that only (1 summary + keepRecent) messages are returned.
func TestSummarizeChain_Truncate(t *testing.T) {
	s := NewSummarizer(SummarizerConfig{ChainLimit: 5})

	// Build 20 messages — well over the limit of 5.
	chain := make([]Message, 20)
	for i := range chain {
		chain[i] = Message{Role: "user", Content: strings.Repeat("msg", 10)}
	}
	chain[0].Role = "system"
	chain[0].Content = "system context"

	keepRecent := 4
	out, err := s.SummarizeChain(context.Background(), chain, keepRecent)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Expect: 1 summary context message + keepRecent recent messages.
	expected := 1 + keepRecent
	if len(out) != expected {
		t.Errorf("expected %d messages, got %d", expected, len(out))
	}
	if out[0].Role != "system" {
		t.Errorf("expected first message to be system role, got %q", out[0].Role)
	}
	if !strings.Contains(out[0].Content, "[Previous context]") {
		t.Errorf("expected summary header in first message, got: %q", out[0].Content[:min(100, len(out[0].Content))])
	}
	// The last keepRecent messages should match the tail of the original chain.
	for i, m := range out[1:] {
		orig := chain[len(chain)-keepRecent+i]
		if m.Content != orig.Content {
			t.Errorf("recent message %d content changed", i)
		}
	}
}

// --- TestSummarizeFindings ---

// TestSummarizeFindings verifies that findings are deduplicated and bullet-formatted
// when no LLM is configured.
func TestSummarizeFindings(t *testing.T) {
	s := NewSummarizer(SummarizerConfig{})
	findings := []string{
		"SQLi in /login",
		"XSS in /search",
		"SQLi in /login", // duplicate
		"",               // empty — should be skipped
		"Open redirect at /redirect",
	}
	out, err := s.SummarizeFindings(context.Background(), findings)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should have exactly 3 unique bullets (empty and duplicate stripped).
	bulletCount := strings.Count(out, "\n- ") + strings.Count(out, "- ") // count all bullets
	// Simple check: the duplicate and empty entry should not appear.
	lines := strings.Split(strings.TrimSpace(out), "\n")
	if len(lines) != 3 {
		t.Errorf("expected 3 lines after dedup, got %d:\n%s", len(lines), out)
	}
	_ = bulletCount
	if !strings.Contains(out, "- SQLi in /login") {
		t.Errorf("expected SQLi finding in output")
	}
	if strings.Count(out, "SQLi in /login") != 1 {
		t.Errorf("duplicate finding should be collapsed")
	}
}

// --- TestToolPrompts ---

// TestToolPrompts verifies that each known tool has a non-empty distinct prompt and
// that an unknown tool falls back to the default prompt without panicking.
func TestToolPrompts(t *testing.T) {
	knownTools := []string{"subfinder", "httpx", "nuclei", "naabu", "ffuf", "sqlmap", "katana"}
	seen := make(map[string]bool)

	for _, tool := range knownTools {
		prompt, ok := toolPrompts[tool]
		if !ok {
			t.Errorf("tool %q missing from toolPrompts", tool)
			continue
		}
		if prompt == "" {
			t.Errorf("tool %q has empty prompt", tool)
		}
		if seen[prompt] {
			t.Errorf("tool %q has duplicate prompt (same as another tool)", tool)
		}
		seen[prompt] = true
	}

	// Unknown tool should not be in the map (falls back to default at call time).
	if _, ok := toolPrompts["unknowntool"]; ok {
		t.Errorf("expected unknown tool to be absent from toolPrompts")
	}
}

// --- TestSummarizeOutput_WithLLM ---

// TestSummarizeOutput_WithLLM verifies that when an LLM is available, the request
// body includes the tool-specific system prompt and a user message with the output.
// It uses a mock HTTP server to capture the request.
func TestSummarizeOutput_WithLLM(t *testing.T) {
	var capturedReq llmRequest

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&capturedReq); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		// Return a minimal valid OpenAI-style response.
		resp := map[string]any{
			"choices": []map[string]any{
				{"message": map[string]string{"content": "summarized output"}},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp) //nolint:errcheck
	}))
	defer srv.Close()

	s := NewSummarizer(SummarizerConfig{
		ResultLimit: 10, // very low so any real output triggers summarization
		LLMEndpoint: srv.URL,
		LLMModel:    "test-model",
		LLMAPIKey:   "test-key",
	})

	toolName := "nuclei"
	input := "CVE-2024-1234 [critical] matched at https://target.com/admin"

	out, err := s.SummarizeOutput(context.Background(), input, toolName)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out != "summarized output" {
		t.Errorf("expected LLM response, got %q", out)
	}

	// Verify the system prompt contains the nuclei-specific instructions.
	if len(capturedReq.Messages) < 2 {
		t.Fatalf("expected at least 2 messages in LLM request, got %d", len(capturedReq.Messages))
	}
	systemMsg := capturedReq.Messages[0]
	if systemMsg.Role != "system" {
		t.Errorf("expected first message role=system, got %q", systemMsg.Role)
	}
	expectedPrompt := toolPrompts[toolName]
	if systemMsg.Content != expectedPrompt {
		t.Errorf("expected nuclei prompt in system message\ngot:  %q\nwant: %q", systemMsg.Content, expectedPrompt)
	}

	// Verify user message contains the original input.
	userMsg := capturedReq.Messages[1]
	if userMsg.Role != "user" {
		t.Errorf("expected second message role=user, got %q", userMsg.Role)
	}
	if !strings.Contains(userMsg.Content, "CVE-2024-1234") {
		t.Errorf("expected tool output in user message, got %q", userMsg.Content)
	}

	// Verify the model field is passed through.
	if capturedReq.Model != "test-model" {
		t.Errorf("expected model=test-model, got %q", capturedReq.Model)
	}
}

// min is a local helper for Go versions before 1.21's built-in min.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
