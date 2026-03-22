package vectormem

import (
	"context"
	"strings"
	"testing"
)

func TestInMemoryStore(t *testing.T) {
	ctx := context.Background()
	s := NewStore(nil)

	id, err := s.Store(ctx, StoreRequest{
		AgentID: "pathfinder",
		Content: "discovered open port 443 on example.com",
		DocType: "recon",
	})
	if err != nil {
		t.Fatalf("Store() error: %v", err)
	}
	if !strings.HasPrefix(id, "mem-") {
		t.Fatalf("expected id to start with 'mem-', got %q", id)
	}

	results, err := s.Search(ctx, SearchRequest{
		Query: "port 443",
		Limit: 10,
	})
	if err != nil {
		t.Fatalf("Search() error: %v", err)
	}
	if len(results) == 0 {
		t.Fatal("expected at least one search result, got none")
	}
	if results[0].Content != "discovered open port 443 on example.com" {
		t.Fatalf("unexpected content: %q", results[0].Content)
	}
	if results[0].Score == 0 {
		t.Fatal("expected non-zero score")
	}
	t.Logf("search returned %d result(s), top score=%.2f", len(results), results[0].Score)
}

func TestInMemoryStoreFilterByType(t *testing.T) {
	ctx := context.Background()
	s := NewStore(nil)

	_, err := s.Store(ctx, StoreRequest{
		AgentID: "pathfinder",
		Content: "found SQL injection in login form",
		DocType: "vuln",
	})
	if err != nil {
		t.Fatalf("Store() vuln error: %v", err)
	}

	_, err = s.Store(ctx, StoreRequest{
		AgentID: "pathfinder",
		Content: "discovered open port 8080 on target host",
		DocType: "recon",
	})
	if err != nil {
		t.Fatalf("Store() recon error: %v", err)
	}

	// Search with doc_type filter — should only return vuln entries
	results, err := s.Search(ctx, SearchRequest{
		Query:   "found",
		DocType: "vuln",
		Limit:   10,
	})
	if err != nil {
		t.Fatalf("Search() error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result filtered by doc_type=vuln, got %d", len(results))
	}
	if results[0].DocType != "vuln" {
		t.Fatalf("expected doc_type=vuln, got %q", results[0].DocType)
	}
	t.Logf("filter returned %d result(s) with doc_type=%q", len(results), results[0].DocType)
}
