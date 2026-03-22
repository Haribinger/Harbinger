package embedder

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// ── helpers ───────────────────────────────────────────────────────────────────

// buildMockServer creates an httptest server that responds with synthetic embeddings.
// onRequest is called for each POST so tests can inspect the incoming body.
func buildMockServer(t *testing.T, statusCode int, onRequest func(req openAIRequest)) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("unexpected method: %s", r.Method)
		}

		var body openAIRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		if onRequest != nil {
			onRequest(body)
		}

		if statusCode != http.StatusOK {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(statusCode)
			var msg string
			switch statusCode {
			case http.StatusTooManyRequests:
				msg = "rate limit exceeded"
			default:
				msg = "internal server error"
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"error": map[string]any{"message": msg, "type": "api_error"},
			})
			return
		}

		// Build a synthetic response: embedding for text[i] is a vector of i+1 repeated.
		data := make([]map[string]any, len(body.Input))
		for i := range body.Input {
			vec := make([]float64, defaultDimension)
			for j := range vec {
				vec[j] = float64(i + 1)
			}
			data[i] = map[string]any{
				"object":    "embedding",
				"embedding": vec,
				"index":     i,
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"object": "list",
			"data":   data,
			"model":  body.Model,
			"usage":  map[string]int{"prompt_tokens": 8, "total_tokens": 8},
		})
	}))
}

// newTestEmbedder creates an OpenAIEmbedder pointed at the given test server URL.
func newTestEmbedder(serverURL string) *OpenAIEmbedder {
	e := NewOpenAI("test-key")
	// Override the endpoint constant via a small closure — we achieve this by
	// pointing the embedder at the mock server using a custom transport that
	// rewrites the host.
	e.client = &http.Client{
		Transport: &rewriteTransport{target: serverURL},
	}
	return e
}

// rewriteTransport replaces the scheme+host of every request with target.
type rewriteTransport struct {
	target string
}

func (rt *rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Parse the target base URL.
	newURL := *req.URL
	newURL.Scheme = "http"
	// Extract host from target (strip scheme).
	host := strings.TrimPrefix(rt.target, "http://")
	host = strings.TrimPrefix(host, "https://")
	newURL.Host = host
	// Keep the original path (/v1/embeddings) intact.
	req2 := req.Clone(req.Context())
	req2.URL = &newURL
	return http.DefaultTransport.RoundTrip(req2)
}

// ── TestNoopEmbedder ──────────────────────────────────────────────────────────

func TestNoopEmbedder(t *testing.T) {
	n := NewNoop()
	ctx := context.Background()

	vec, err := n.Embed(ctx, "hello")
	if err != nil {
		t.Fatalf("Embed: unexpected error: %v", err)
	}
	if vec != nil {
		t.Errorf("Embed: expected nil vector, got %v", vec)
	}

	vecs, err := n.EmbedBatch(ctx, []string{"a", "b", "c"})
	if err != nil {
		t.Fatalf("EmbedBatch: unexpected error: %v", err)
	}
	if len(vecs) != 3 {
		t.Fatalf("EmbedBatch: expected 3 results, got %d", len(vecs))
	}
	for i, v := range vecs {
		if v != nil {
			t.Errorf("EmbedBatch[%d]: expected nil, got %v", i, v)
		}
	}
}

// TestNoopEmbedder_WarnOnce verifies the warning is emitted exactly once.
func TestNoopEmbedder_WarnOnce(t *testing.T) {
	n := NewNoop()
	ctx := context.Background()
	// Calling multiple times should not panic or produce errors.
	for i := 0; i < 5; i++ {
		_, _ = n.Embed(ctx, "text")
	}
	if !n.warned {
		t.Error("expected warned flag to be set after first Embed call")
	}
}

// ── TestOpenAIEmbedder_Embed ──────────────────────────────────────────────────

func TestOpenAIEmbedder_Embed(t *testing.T) {
	var capturedReq openAIRequest
	srv := buildMockServer(t, http.StatusOK, func(req openAIRequest) {
		capturedReq = req
	})
	defer srv.Close()

	e := newTestEmbedder(srv.URL)
	vec, err := e.Embed(context.Background(), "hello world")
	if err != nil {
		t.Fatalf("Embed: unexpected error: %v", err)
	}

	// Verify request format.
	if len(capturedReq.Input) != 1 {
		t.Errorf("expected 1 input, got %d", len(capturedReq.Input))
	}
	if capturedReq.Input[0] != "hello world" {
		t.Errorf("unexpected input text: %q", capturedReq.Input[0])
	}
	if capturedReq.Model != defaultModel {
		t.Errorf("unexpected model: %q", capturedReq.Model)
	}

	// Verify response parsing: first text → embedding values all == 1.
	if len(vec) != defaultDimension {
		t.Fatalf("expected %d dims, got %d", defaultDimension, len(vec))
	}
	for i, v := range vec {
		if v != 1.0 {
			t.Errorf("vec[%d]: expected 1.0, got %f", i, v)
			break
		}
	}
}

// ── TestOpenAIEmbedder_EmbedBatch ────────────────────────────────────────────

func TestOpenAIEmbedder_EmbedBatch(t *testing.T) {
	t.Run("small batch (single request)", func(t *testing.T) {
		callCount := 0
		srv := buildMockServer(t, http.StatusOK, func(_ openAIRequest) { callCount++ })
		defer srv.Close()

		e := newTestEmbedder(srv.URL)
		texts := make([]string, 5)
		for i := range texts {
			texts[i] = fmt.Sprintf("text-%d", i)
		}

		vecs, err := e.EmbedBatch(context.Background(), texts)
		if err != nil {
			t.Fatalf("EmbedBatch: unexpected error: %v", err)
		}
		if len(vecs) != 5 {
			t.Fatalf("expected 5 results, got %d", len(vecs))
		}
		if callCount != 1 {
			t.Errorf("expected 1 API call, got %d", callCount)
		}
		// Each embedding[i] should have all values == i+1.
		for i, vec := range vecs {
			expected := float32(i + 1)
			if len(vec) != defaultDimension {
				t.Fatalf("vec[%d]: expected %d dims, got %d", i, defaultDimension, len(vec))
			}
			if vec[0] != expected {
				t.Errorf("vec[%d][0]: expected %f, got %f", i, expected, vec[0])
			}
		}
	})

	t.Run("large batch splits into multiple requests", func(t *testing.T) {
		callCount := 0
		lastBatchSize := 0
		srv := buildMockServer(t, http.StatusOK, func(req openAIRequest) {
			callCount++
			lastBatchSize = len(req.Input)
		})
		defer srv.Close()

		// 150 texts should produce ceil(150/100) = 2 API calls.
		const total = 150
		texts := make([]string, total)
		for i := range texts {
			texts[i] = fmt.Sprintf("item-%d", i)
		}

		e := newTestEmbedder(srv.URL)
		vecs, err := e.EmbedBatch(context.Background(), texts)
		if err != nil {
			t.Fatalf("EmbedBatch large: unexpected error: %v", err)
		}
		if len(vecs) != total {
			t.Fatalf("expected %d results, got %d", total, len(vecs))
		}
		if callCount != 2 {
			t.Errorf("expected 2 API calls for 150 items, got %d", callCount)
		}
		// The second batch has the remainder: 150 - 100 = 50.
		if lastBatchSize != 50 {
			t.Errorf("expected last batch size 50, got %d", lastBatchSize)
		}
	})

	t.Run("empty input returns nil", func(t *testing.T) {
		e := NewOpenAI("key")
		vecs, err := e.EmbedBatch(context.Background(), nil)
		if err != nil {
			t.Fatalf("EmbedBatch nil: unexpected error: %v", err)
		}
		if vecs != nil {
			t.Errorf("expected nil, got %v", vecs)
		}
	})
}

// ── TestOpenAIEmbedder_Error ──────────────────────────────────────────────────

func TestOpenAIEmbedder_Error(t *testing.T) {
	t.Run("429 rate limit", func(t *testing.T) {
		srv := buildMockServer(t, http.StatusTooManyRequests, nil)
		defer srv.Close()

		e := newTestEmbedder(srv.URL)
		_, err := e.Embed(context.Background(), "test")
		if err == nil {
			t.Fatal("expected error for 429, got nil")
		}
		if !strings.Contains(err.Error(), "rate limit") {
			t.Errorf("expected rate limit message, got: %v", err)
		}
	})

	t.Run("500 internal server error", func(t *testing.T) {
		srv := buildMockServer(t, http.StatusInternalServerError, nil)
		defer srv.Close()

		e := newTestEmbedder(srv.URL)
		_, err := e.Embed(context.Background(), "test")
		if err == nil {
			t.Fatal("expected error for 500, got nil")
		}
		if !strings.Contains(err.Error(), "500") {
			t.Errorf("expected HTTP 500 in error message, got: %v", err)
		}
	})

	t.Run("context cancellation", func(t *testing.T) {
		// Server that hangs until request context is cancelled.
		block := make(chan struct{})
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			<-block
		}))
		defer srv.Close()
		defer close(block)

		ctx, cancel := context.WithCancel(context.Background())
		e := newTestEmbedder(srv.URL)

		done := make(chan error, 1)
		go func() {
			_, err := e.Embed(ctx, "test")
			done <- err
		}()

		cancel()
		err := <-done
		if err == nil {
			t.Fatal("expected context cancellation error, got nil")
		}
	})
}

// ── TestNew_NoKey ─────────────────────────────────────────────────────────────

func TestNew_NoKey(t *testing.T) {
	// Ensure both env vars are absent.
	t.Setenv("HARBINGER_EMBEDDING_API_KEY", "")
	t.Setenv("OPENAI_API_KEY", "")

	emb := New()
	if _, ok := emb.(*NoopEmbedder); !ok {
		t.Errorf("expected *NoopEmbedder when no key is set, got %T", emb)
	}
}

func TestNew_HarbingerKey(t *testing.T) {
	t.Setenv("HARBINGER_EMBEDDING_API_KEY", "hbr-key")
	t.Setenv("OPENAI_API_KEY", "")

	emb := New()
	if _, ok := emb.(*OpenAIEmbedder); !ok {
		t.Errorf("expected *OpenAIEmbedder when HARBINGER_EMBEDDING_API_KEY is set, got %T", emb)
	}
}

func TestNew_OpenAIKeyFallback(t *testing.T) {
	t.Setenv("HARBINGER_EMBEDDING_API_KEY", "")
	t.Setenv("OPENAI_API_KEY", "sk-test")

	emb := New()
	if _, ok := emb.(*OpenAIEmbedder); !ok {
		t.Errorf("expected *OpenAIEmbedder when OPENAI_API_KEY is set, got %T", emb)
	}
}

// Verify that HARBINGER_EMBEDDING_API_KEY takes precedence over OPENAI_API_KEY.
func TestNew_HarbingerKeyPrecedence(t *testing.T) {
	t.Setenv("HARBINGER_EMBEDDING_API_KEY", "hbr-preferred")
	t.Setenv("OPENAI_API_KEY", "sk-fallback")

	emb := New()
	oai, ok := emb.(*OpenAIEmbedder)
	if !ok {
		t.Fatalf("expected *OpenAIEmbedder, got %T", emb)
	}
	if oai.apiKey != "hbr-preferred" {
		t.Errorf("expected apiKey %q, got %q", "hbr-preferred", oai.apiKey)
	}
}

// ── TestDimension ─────────────────────────────────────────────────────────────

func TestDimension(t *testing.T) {
	tests := []struct {
		name string
		emb  Embedder
	}{
		{"OpenAIEmbedder", NewOpenAI("key")},
		{"NoopEmbedder", NewNoop()},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if d := tc.emb.Dimension(); d != defaultDimension {
				t.Errorf("%s.Dimension() = %d, want %d", tc.name, d, defaultDimension)
			}
		})
	}
}

// ── TestOpenAIEmbedder_AuthHeader ─────────────────────────────────────────────

// Verify the Authorization header is sent correctly.
func TestOpenAIEmbedder_AuthHeader(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		// Respond with a valid single embedding.
		vec := make([]float64, defaultDimension)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"object": "list",
			"data": []map[string]any{
				{"object": "embedding", "embedding": vec, "index": 0},
			},
			"model": defaultModel,
		})
	}))
	defer srv.Close()

	e := newTestEmbedder(srv.URL)
	e.apiKey = "sk-secret"
	_, err := e.Embed(context.Background(), "test")
	if err != nil {
		t.Fatalf("Embed: %v", err)
	}
	expected := "Bearer sk-secret"
	if gotAuth != expected {
		t.Errorf("Authorization header: got %q, want %q", gotAuth, expected)
	}
}

// TestMain clears sensitive env vars before the suite runs so tests that check
// for NoopEmbedder aren't polluted by the developer's local environment.
func TestMain(m *testing.M) {
	os.Unsetenv("HARBINGER_EMBEDDING_API_KEY")
	os.Unsetenv("OPENAI_API_KEY")
	os.Exit(m.Run())
}
