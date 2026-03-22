// Package embedder provides vector embedding generation for Harbinger's semantic memory system.
// It supports OpenAI's text-embedding-3-small model via raw HTTP and a no-op fallback
// for environments without an API key.
package embedder

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

const (
	openAIEmbeddingURL = "https://api.openai.com/v1/embeddings"
	defaultModel       = "text-embedding-3-small"
	defaultDimension   = 1536
	// maxBatchSize is the maximum number of texts per OpenAI embedding request.
	// OpenAI recommends staying well below 2048 token limits; 100 items is safe.
	maxBatchSize = 100
)

// Embedder generates vector embeddings from text for semantic search and retrieval.
type Embedder interface {
	// Embed generates a single embedding vector for the given text.
	// Returns nil, nil when the embedder is a no-op (not an error condition).
	Embed(ctx context.Context, text string) ([]float32, error)
	// EmbedBatch generates embeddings for multiple texts in one API call.
	// The returned slice is parallel to the input slice; entries may be nil for no-op embedders.
	EmbedBatch(ctx context.Context, texts []string) ([][]float32, error)
	// Dimension returns the embedding vector dimension this embedder produces.
	Dimension() int
}

// ── OpenAI embedder ──────────────────────────────────────────────────────────

// OpenAIEmbedder calls OpenAI's /v1/embeddings endpoint using raw HTTP.
// No external SDK is required.
type OpenAIEmbedder struct {
	apiKey    string
	model     string
	dimension int
	client    *http.Client
}

// NewOpenAI creates an OpenAIEmbedder configured for text-embedding-3-small (1536 dims).
// The HTTP client has a 30-second timeout, which covers typical embedding latency.
func NewOpenAI(apiKey string) *OpenAIEmbedder {
	return &OpenAIEmbedder{
		apiKey:    apiKey,
		model:     defaultModel,
		dimension: defaultDimension,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Dimension returns 1536, the vector size for text-embedding-3-small.
func (e *OpenAIEmbedder) Dimension() int { return e.dimension }

// Embed generates a single embedding by delegating to EmbedBatch.
func (e *OpenAIEmbedder) Embed(ctx context.Context, text string) ([]float32, error) {
	results, err := e.EmbedBatch(ctx, []string{text})
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("embedder: OpenAI returned empty results for single text")
	}
	return results[0], nil
}

// EmbedBatch generates embeddings for multiple texts. Inputs exceeding maxBatchSize
// are split into multiple sequential requests and reassembled in input order.
func (e *OpenAIEmbedder) EmbedBatch(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	out := make([][]float32, len(texts))

	for start := 0; start < len(texts); start += maxBatchSize {
		end := start + maxBatchSize
		if end > len(texts) {
			end = len(texts)
		}
		chunk := texts[start:end]

		embeddings, err := e.callAPI(ctx, chunk)
		if err != nil {
			return nil, err
		}
		for i, vec := range embeddings {
			out[start+i] = vec
		}
	}

	return out, nil
}

// openAIRequest is the JSON body sent to /v1/embeddings.
type openAIRequest struct {
	Input []string `json:"input"`
	Model string   `json:"model"`
}

// openAIResponse is the JSON body returned by /v1/embeddings.
type openAIResponse struct {
	Object string `json:"object"`
	Data   []struct {
		Object    string    `json:"object"`
		Embedding []float64 `json:"embedding"` // JSON numbers arrive as float64
		Index     int       `json:"index"`
	} `json:"data"`
	Model string `json:"model"`
	Usage struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
}

// openAIErrorResponse is returned by the API on 4xx/5xx responses.
type openAIErrorResponse struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    any    `json:"code"`
	} `json:"error"`
}

// callAPI performs a single POST /v1/embeddings request for the given texts.
// It returns embeddings sorted to match the input order (OpenAI returns them
// with an "index" field that may not match insertion order under some conditions).
func (e *OpenAIEmbedder) callAPI(ctx context.Context, texts []string) ([][]float32, error) {
	body, err := json.Marshal(openAIRequest{Input: texts, Model: e.model})
	if err != nil {
		return nil, fmt.Errorf("embedder: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIEmbeddingURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("embedder: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+e.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("embedder: HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("embedder: read response body: %w", err)
	}

	// Surface API errors with actionable messages.
	if resp.StatusCode != http.StatusOK {
		var apiErr openAIErrorResponse
		if jsonErr := json.Unmarshal(respBytes, &apiErr); jsonErr == nil && apiErr.Error.Message != "" {
			if resp.StatusCode == http.StatusTooManyRequests {
				return nil, fmt.Errorf("embedder: OpenAI rate limit exceeded: %s", apiErr.Error.Message)
			}
			return nil, fmt.Errorf("embedder: OpenAI API error %d: %s", resp.StatusCode, apiErr.Error.Message)
		}
		return nil, fmt.Errorf("embedder: OpenAI returned HTTP %d", resp.StatusCode)
	}

	var apiResp openAIResponse
	if err := json.Unmarshal(respBytes, &apiResp); err != nil {
		return nil, fmt.Errorf("embedder: parse response: %w", err)
	}

	if len(apiResp.Data) != len(texts) {
		return nil, fmt.Errorf("embedder: expected %d embeddings, got %d", len(texts), len(apiResp.Data))
	}

	// Re-order by index field to guarantee alignment with input order.
	out := make([][]float32, len(texts))
	for _, item := range apiResp.Data {
		if item.Index < 0 || item.Index >= len(texts) {
			return nil, fmt.Errorf("embedder: response index %d out of range for %d inputs", item.Index, len(texts))
		}
		vec := make([]float32, len(item.Embedding))
		for i, v := range item.Embedding {
			vec[i] = float32(v)
		}
		out[item.Index] = vec
	}
	return out, nil
}

// ── No-op embedder ───────────────────────────────────────────────────────────

// NoopEmbedder is a silent fallback for environments without an embedding API key.
// It satisfies the Embedder interface but returns nil vectors, which the memory
// store treats as "no embedding available" rather than an error.
type NoopEmbedder struct {
	mu      sync.Mutex
	warned  bool
}

// NewNoop creates a NoopEmbedder. It emits a one-time log warning on first use
// to help operators notice that semantic search is disabled.
func NewNoop() *NoopEmbedder { return &NoopEmbedder{} }

// Dimension returns 1536, matching the OpenAI embedder so schema is consistent.
func (n *NoopEmbedder) Dimension() int { return defaultDimension }

// Embed returns nil, nil — no embedding is generated and no error is raised.
// A one-time warning is logged so the operator knows embeddings are disabled.
func (n *NoopEmbedder) Embed(_ context.Context, _ string) ([]float32, error) {
	n.logOnce()
	return nil, nil
}

// EmbedBatch returns a slice of nils with the same length as the input.
func (n *NoopEmbedder) EmbedBatch(_ context.Context, texts []string) ([][]float32, error) {
	n.logOnce()
	out := make([][]float32, len(texts))
	return out, nil
}

// logOnce emits the "no embedding key" warning exactly once per process lifetime.
func (n *NoopEmbedder) logOnce() {
	n.mu.Lock()
	defer n.mu.Unlock()
	if !n.warned {
		log.Println("embedder: no API key configured — semantic search is disabled. " +
			"Set HARBINGER_EMBEDDING_API_KEY or OPENAI_API_KEY to enable.")
		n.warned = true
	}
}

// ── Factory ──────────────────────────────────────────────────────────────────

// New creates an Embedder based on available environment configuration.
// It checks HARBINGER_EMBEDDING_API_KEY first, then OPENAI_API_KEY as a fallback.
// When neither is set a NoopEmbedder is returned so callers never receive nil.
func New() Embedder {
	key := os.Getenv("HARBINGER_EMBEDDING_API_KEY")
	if key == "" {
		key = os.Getenv("OPENAI_API_KEY")
	}
	if key == "" {
		return NewNoop()
	}
	return NewOpenAI(key)
}
