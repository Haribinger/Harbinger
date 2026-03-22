package memorylayer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// toolPrompts maps known security tool names to focused summarization instructions.
// These prompts are designed to preserve the signal-to-noise ratio for each tool's output.
var toolPrompts = map[string]string{
	"subfinder": "Extract all unique subdomains from this output. Return one per line, no duplicates.",
	"httpx":     "Extract all live hosts with HTTP status code, title, technology stack, and content length. Preserve all entries.",
	"nuclei":    "Extract all vulnerabilities found. For each: template ID, severity, matched URL, and extracted value. Preserve ALL findings.",
	"naabu":     "Extract all open ports per host. Format: host:port (one per line).",
	"ffuf":      "Extract all discovered paths with status codes and response sizes. Remove noise (identical sizes = likely false positives).",
	"sqlmap":    "Extract all SQL injection findings: parameter, technique, DBMS, and any extracted data.",
	"katana":    "Extract all discovered URLs and endpoints. Deduplicate and group by domain.",
}

// defaultToolPrompt is used for any tool not listed in toolPrompts.
const defaultToolPrompt = "Summarize this security tool output. Preserve ALL findings including IPs, ports, vulnerabilities, credentials, and paths. Remove noise and duplicate entries."

// llmMaxInputBytes is the hard cap on content sent to the LLM regardless of ResultLimit.
const llmMaxInputBytes = 32 * 1024 // 32KB

// SummarizerConfig holds the configuration for creating a Summarizer.
// LLM fields are all optional — leave empty to operate in truncation-only mode.
type SummarizerConfig struct {
	// ResultLimit is the max byte length for tool output before compression is applied.
	// Defaults to 16384 (16KB) when zero.
	ResultLimit int

	// ChainLimit is the max number of messages in a conversation chain before
	// compression is applied. Defaults to 50 when zero.
	ChainLimit int

	// LLMEndpoint is the URL for an OpenAI-compatible chat completions endpoint,
	// e.g. "https://api.openai.com/v1/chat/completions". Empty = no LLM.
	LLMEndpoint string

	// LLMModel is the model identifier passed in the API request body,
	// e.g. "gpt-4o-mini".
	LLMModel string

	// LLMAPIKey is the bearer token for the LLM endpoint. May be empty for
	// unauthenticated local endpoints (e.g. Ollama).
	LLMAPIKey string
}

// Summarizer compresses tool output and conversation chains to fit context windows.
// When an LLM provider is configured, it generates intelligent summaries.
// When no LLM is available, it falls back to truncation with structure preservation.
type Summarizer struct {
	// ResultLimit is the max byte length for tool output before compression.
	ResultLimit int

	// ChainLimit is the max number of messages in a conversation chain before compression.
	ChainLimit int

	// LLMEndpoint is the optional OpenAI-compatible chat completions URL.
	LLMEndpoint string

	// LLMModel is the model name passed to the LLM API.
	LLMModel string

	// LLMAPIKey is the bearer token for the LLM endpoint.
	LLMAPIKey string

	httpClient *http.Client
}

// Message represents a single turn in an LLM conversation chain.
type Message struct {
	// Role is one of: system, user, assistant, tool.
	Role    string `json:"role"`
	Content string `json:"content"`
	// Name is the tool name for role=tool messages.
	Name string `json:"name,omitempty"`
}

// NewSummarizer creates a Summarizer with the given config.
// Zero values in cfg are replaced with safe defaults.
func NewSummarizer(cfg SummarizerConfig) *Summarizer {
	limit := cfg.ResultLimit
	if limit <= 0 {
		limit = 16384
	}
	chain := cfg.ChainLimit
	if chain <= 0 {
		chain = 50
	}
	return &Summarizer{
		ResultLimit: limit,
		ChainLimit:  chain,
		LLMEndpoint: cfg.LLMEndpoint,
		LLMModel:    cfg.LLMModel,
		LLMAPIKey:   cfg.LLMAPIKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// hasLLM reports whether the summarizer has a configured LLM endpoint.
func (s *Summarizer) hasLLM() bool {
	return s.LLMEndpoint != "" && s.LLMModel != ""
}

// SummarizeOutput compresses a tool's raw output to fit within ResultLimit bytes.
// If the output is already within the limit it is returned unchanged.
// If an LLM is configured it is called with a tool-specific prompt; on failure
// the method falls back to truncation silently. LLM failures never propagate
// as errors — only structural errors (e.g. context cancellation) are returned.
func (s *Summarizer) SummarizeOutput(ctx context.Context, output, toolName string) (string, error) {
	if len(output) <= s.ResultLimit {
		return output, nil
	}

	prompt, ok := toolPrompts[toolName]
	if !ok {
		prompt = defaultToolPrompt
	}

	if s.hasLLM() {
		result, err := s.callLLM(ctx, prompt, output)
		if err != nil {
			// LLM failure is non-fatal: fall through to truncation.
			log.Printf("memorylayer: summarizer: LLM call failed for tool %q, falling back to truncation: %v", toolName, err)
		} else {
			return result, nil
		}
	}

	return s.truncateOutput(output, toolName), nil
}

// SummarizeChain compresses a conversation chain so it fits within ChainLimit messages.
// The keepRecent most recent messages are always preserved verbatim; older messages
// are compressed into a single system-role context message.
// If keepRecent is <= 0 it defaults to 10.
func (s *Summarizer) SummarizeChain(ctx context.Context, chain []Message, keepRecent int) ([]Message, error) {
	if len(chain) <= s.ChainLimit {
		return chain, nil
	}

	if keepRecent <= 0 {
		keepRecent = 10
	}
	// Guard: never try to keep more messages than exist.
	if keepRecent > len(chain) {
		keepRecent = len(chain)
	}

	splitAt := len(chain) - keepRecent
	old := chain[:splitAt]
	recent := chain[splitAt:]

	var summaryContent string

	if s.hasLLM() {
		systemPrompt := "You are summarizing a conversation history for an AI security agent. " +
			"Capture all task context, findings, decisions, and tool results. " +
			"Be concise but preserve every security-relevant detail."
		userContent := s.truncateChain(old)

		result, err := s.callLLM(ctx, systemPrompt, userContent)
		if err != nil {
			log.Printf("memorylayer: summarizer: LLM chain summarization failed, falling back to truncation: %v", err)
			summaryContent = s.truncateChain(old)
		} else {
			summaryContent = result
		}
	} else {
		summaryContent = s.truncateChain(old)
	}

	contextMsg := Message{
		Role:    "system",
		Content: "[Previous context]\n" + summaryContent,
	}

	compressed := make([]Message, 0, 1+len(recent))
	compressed = append(compressed, contextMsg)
	compressed = append(compressed, recent...)
	return compressed, nil
}

// SummarizeFindings produces a consolidated summary from a slice of finding descriptions.
// When an LLM is configured it generates an executive summary; otherwise findings are
// deduplicated, bullet-formatted, and returned as plain text.
func (s *Summarizer) SummarizeFindings(ctx context.Context, findings []string) (string, error) {
	if len(findings) == 0 {
		return "", nil
	}

	if s.hasLLM() {
		systemPrompt := "You are a security report writer. Generate a concise executive summary " +
			"of the following findings. Group by severity. Highlight critical issues first. " +
			"Use plain text, no markdown headers."
		joined := strings.Join(findings, "\n")
		result, err := s.callLLM(ctx, systemPrompt, joined)
		if err != nil {
			log.Printf("memorylayer: summarizer: LLM findings summarization failed, falling back to text: %v", err)
			// fall through to text fallback
		} else {
			return result, nil
		}
	}

	// Deduplication pass: preserve order, skip exact duplicates.
	seen := make(map[string]struct{}, len(findings))
	var buf strings.Builder
	for _, f := range findings {
		trimmed := strings.TrimSpace(f)
		if trimmed == "" {
			continue
		}
		if _, dup := seen[trimmed]; dup {
			continue
		}
		seen[trimmed] = struct{}{}
		buf.WriteString("- ")
		buf.WriteString(trimmed)
		buf.WriteByte('\n')
	}
	return strings.TrimRight(buf.String(), "\n"), nil
}

// truncateOutput compresses tool output when no LLM is available.
// For JSONL-producing tools (subfinder, httpx, nuclei, katana) it parses each line
// as a JSON object, deduplicates by a representative key field, then re-serialises
// up to ResultLimit bytes.
// For all other tools it keeps the first 20% and last 20% of the content with a
// truncation notice in the middle. The first line is always preserved.
func (s *Summarizer) truncateOutput(output, toolName string) string {
	switch toolName {
	case "subfinder", "httpx", "nuclei", "katana":
		return s.truncateJSONL(output, toolName)
	default:
		return s.truncateTextOutput(output)
	}
}

// truncateJSONL deduplicates JSONL output by a per-tool key field,
// then re-serialises lines until ResultLimit is reached.
func (s *Summarizer) truncateJSONL(output, toolName string) string {
	// Key fields used for deduplication per tool.
	keyFields := map[string]string{
		"subfinder": "host",
		"httpx":     "url",
		"nuclei":    "matched-at",
		"katana":    "endpoint",
	}
	keyField := keyFields[toolName]

	lines := strings.Split(strings.TrimSpace(output), "\n")
	seen := make(map[string]struct{})
	var buf strings.Builder
	written := 0

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Try to deduplicate via the key field; fall back to the raw line.
		dedupKey := line
		if keyField != "" {
			var obj map[string]any
			if json.Unmarshal([]byte(line), &obj) == nil {
				if v, ok := obj[keyField]; ok {
					dedupKey = fmt.Sprintf("%v", v)
				}
			}
		}

		if _, dup := seen[dedupKey]; dup {
			continue
		}
		seen[dedupKey] = struct{}{}

		entry := line + "\n"
		if written+len(entry) > s.ResultLimit {
			remaining := len(lines) - len(seen)
			if remaining > 0 {
				fmt.Fprintf(&buf, "\n[... %d additional entries truncated ...]\n", remaining)
			}
			break
		}
		buf.WriteString(entry)
		written += len(entry)
	}

	return strings.TrimRight(buf.String(), "\n")
}

// truncateTextOutput keeps the first 20% and last 20% of text, inserting a
// truncation marker in the middle. The first line is unconditionally preserved.
func (s *Summarizer) truncateTextOutput(output string) string {
	total := len(output)
	if total <= s.ResultLimit {
		return output
	}

	// Each half gets 40% of the limit so the marker fits in the remaining 20%.
	halfLimit := (s.ResultLimit * 2) / 5

	head := output[:halfLimit]
	tail := output[total-halfLimit:]
	skipped := total - (2 * halfLimit)

	return head + fmt.Sprintf("\n\n[... truncated %d bytes ...]\n\n", skipped) + tail
}

// truncateChain concatenates messages as "{role}: {first 200 chars of content}\n"
// and caps the result at ResultLimit bytes. Used when no LLM is available.
func (s *Summarizer) truncateChain(messages []Message) string {
	var buf strings.Builder
	for _, m := range messages {
		preview := m.Content
		if len(preview) > 200 {
			preview = preview[:200] + "..."
		}
		line := fmt.Sprintf("%s: %s\n", m.Role, preview)
		if buf.Len()+len(line) > s.ResultLimit {
			break
		}
		buf.WriteString(line)
	}
	return strings.TrimRight(buf.String(), "\n")
}

// llmRequest is the JSON body sent to an OpenAI-compatible chat completions endpoint.
type llmRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens"`
	Temperature float64   `json:"temperature"`
}

// llmResponse is the minimal subset of the OpenAI chat completion response we use.
type llmResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// callLLM sends a summarization request to the configured LLM endpoint.
// userContent is capped at llmMaxInputBytes before being sent.
// Returns an error only for structural failures (encoding, network, bad response);
// callers must fall back to truncation on any non-nil error.
func (s *Summarizer) callLLM(ctx context.Context, systemPrompt, userContent string) (string, error) {
	// Hard cap on what we send to the LLM regardless of how large the original is.
	if len(userContent) > llmMaxInputBytes {
		userContent = userContent[:llmMaxInputBytes]
	}

	body := llmRequest{
		Model: s.LLMModel,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userContent},
		},
		MaxTokens:   4096,
		Temperature: 0.1,
	}

	encoded, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("memorylayer: summarizer: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.LLMEndpoint, bytes.NewReader(encoded))
	if err != nil {
		return "", fmt.Errorf("memorylayer: summarizer: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if s.LLMAPIKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.LLMAPIKey)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("memorylayer: summarizer: http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Read a small snippet for the error message — avoid logging full response.
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		return "", fmt.Errorf("memorylayer: summarizer: LLM returned HTTP %d: %s", resp.StatusCode, snippet)
	}

	var llmResp llmResponse
	if err := json.NewDecoder(resp.Body).Decode(&llmResp); err != nil {
		return "", fmt.Errorf("memorylayer: summarizer: decode response: %w", err)
	}
	if len(llmResp.Choices) == 0 {
		return "", fmt.Errorf("memorylayer: summarizer: LLM returned no choices")
	}

	return strings.TrimSpace(llmResp.Choices[0].Message.Content), nil
}
