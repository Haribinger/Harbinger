package vectormem

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// Memory represents a stored semantic memory entry.
type Memory struct {
	ID        string         `json:"id"`
	AgentID   string         `json:"agent_id"`
	FlowID    string         `json:"flow_id"`
	TaskID    string         `json:"task_id"`
	Content   string         `json:"content"`
	DocType   string         `json:"doc_type"`
	Metadata  map[string]any `json:"metadata"`
	Score     float64        `json:"score"`
	CreatedAt time.Time      `json:"created_at"`
}

// StoreRequest is the input for storing a new memory.
type StoreRequest struct {
	AgentID  string         `json:"agent_id"`
	FlowID   string         `json:"flow_id"`
	TaskID   string         `json:"task_id"`
	Content  string         `json:"content"`
	DocType  string         `json:"doc_type"`
	Metadata map[string]any `json:"metadata"`
}

// SearchRequest is the input for searching memories.
type SearchRequest struct {
	Query   string `json:"query"`
	AgentID string `json:"agent_id"`
	DocType string `json:"doc_type"`
	Limit   int    `json:"limit"`
}

// Store provides semantic memory storage. Uses in-memory storage with keyword
// search as a baseline; pgvector integration planned for future versions.
type Store struct {
	db       *sql.DB
	mu       sync.RWMutex
	memories []Memory
}

// NewStore creates a new memory store. db can be nil for pure in-memory mode.
func NewStore(db *sql.DB) *Store {
	return &Store{
		db:       db,
		memories: make([]Memory, 0),
	}
}

// Store persists a new memory and returns its generated ID.
func (s *Store) Store(ctx context.Context, req StoreRequest) (string, error) {
	id, err := generateID()
	if err != nil {
		return "", fmt.Errorf("vectormem: generate id: %w", err)
	}

	docType := req.DocType
	if docType == "" {
		docType = "general"
	}

	mem := Memory{
		ID:        id,
		AgentID:   req.AgentID,
		FlowID:    req.FlowID,
		TaskID:    req.TaskID,
		Content:   req.Content,
		DocType:   docType,
		Metadata:  req.Metadata,
		CreatedAt: time.Now(),
	}

	s.mu.Lock()
	s.memories = append(s.memories, mem)
	s.mu.Unlock()

	return id, nil
}

// Search finds memories matching the query using keyword scoring.
// If query is empty, all memories (subject to filters) are returned.
// Results are sorted by score descending and capped at Limit.
func (s *Store) Search(ctx context.Context, req SearchRequest) ([]Memory, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	queryWords := splitWords(req.Query)
	limit := req.Limit
	if limit <= 0 {
		limit = 10
	}

	var results []Memory
	for _, m := range s.memories {
		if req.AgentID != "" && m.AgentID != req.AgentID {
			continue
		}
		if req.DocType != "" && m.DocType != req.DocType {
			continue
		}

		scored := m
		if len(queryWords) > 0 {
			scored.Score = keywordScore(m.Content, queryWords)
			if scored.Score == 0 {
				continue
			}
		} else {
			scored.Score = 1.0
		}
		results = append(results, scored)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	if len(results) > limit {
		results = results[:limit]
	}

	return results, nil
}

// Delete removes a memory by ID. Returns an error if the ID is not found.
func (s *Store) Delete(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, m := range s.memories {
		if m.ID == id {
			s.memories = append(s.memories[:i], s.memories[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("vectormem: memory %q not found", id)
}

// ListByAgent returns memories for a specific agent, up to limit.
func (s *Store) ListByAgent(ctx context.Context, agentID string, limit int) ([]Memory, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 {
		limit = 10
	}

	var results []Memory
	for _, m := range s.memories {
		if m.AgentID == agentID {
			results = append(results, m)
			if len(results) >= limit {
				break
			}
		}
	}
	return results, nil
}

// keywordScore returns the fraction of query words found in the content.
func keywordScore(content string, queryWords []string) float64 {
	lower := strings.ToLower(content)
	matched := 0
	for _, w := range queryWords {
		if strings.Contains(lower, w) {
			matched++
		}
	}
	return float64(matched) / float64(len(queryWords))
}

// splitWords lowercases and splits a string into non-empty words.
func splitWords(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Fields(strings.ToLower(s))
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// generateID produces a "mem-" prefixed ID with 16 random hex characters.
func generateID() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "mem-" + hex.EncodeToString(b), nil
}
