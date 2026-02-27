package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// setupTestMux creates a minimal mux with health routes for testing.
// Routes are registered the same way as in main() so we test real handler behavior.
func setupTestMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealthCheck)
	mux.HandleFunc("GET /api/health", handleHealthCheck)
	mux.HandleFunc("GET /api/v1/health", handleHealthCheck)
	return mux
}

func TestHealthEndpoints(t *testing.T) {
	mux := setupTestMux()

	endpoints := []string{"/health", "/api/health", "/api/v1/health"}
	for _, ep := range endpoints {
		t.Run("GET "+ep, func(t *testing.T) {
			req := httptest.NewRequest("GET", ep, nil)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected 200, got %d", w.Code)
			}

			// Verify JSON body has "checks" array
			var body map[string]interface{}
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatalf("response is not valid JSON: %v", err)
			}

			checks, ok := body["checks"]
			if !ok {
				t.Fatal("response missing 'checks' field")
			}

			arr, ok := checks.([]interface{})
			if !ok {
				t.Fatal("'checks' is not an array")
			}

			if len(arr) == 0 {
				t.Error("'checks' array is empty — expected at least database, redis, docker entries")
			}

			// Verify each check has required fields
			for i, item := range arr {
				check, ok := item.(map[string]interface{})
				if !ok {
					t.Errorf("check[%d] is not an object", i)
					continue
				}
				for _, field := range []string{"id", "name", "status"} {
					if _, exists := check[field]; !exists {
						t.Errorf("check[%d] missing field %q", i, field)
					}
				}
			}
		})
	}
}

func TestHealthContentType(t *testing.T) {
	mux := setupTestMux()
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
}
