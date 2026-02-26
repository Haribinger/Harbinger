# Backend Handler Template (Go)

Backend handlers live in `backend/cmd/`. Each file groups related handlers.

## Template for a New Handler File

```go
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// --- Types ---

type Item struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateItemRequest struct {
	Name   string                 `json:"name"`
	Type   string                 `json:"type"`
	Config map[string]interface{} `json:"config,omitempty"`
}

// --- Handlers ---

func handleItemList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !dbAvailable() {
		// No-Crash Policy: return empty, not 500
		json.NewEncoder(w).Encode([]Item{})
		return
	}

	items, err := dbQueryItems()
	if err != nil {
		log.Printf("[Items] query error: %v", err)
		json.NewEncoder(w).Encode([]Item{})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func handleItemCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	item := Item{
		ID:        generateID(), // use existing ID generator
		Name:      req.Name,
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if dbAvailable() {
		if err := dbCreateItem(item); err != nil {
			log.Printf("[Items] create error: %v", err)
			http.Error(w, "failed to create item", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}
```

## Route Registration

Add to `main.go` route setup:

```go
mux.HandleFunc("/api/items", handleItemList)
mux.HandleFunc("/api/items/create", handleItemCreate)
```

## Key Conventions

- No-Crash Policy: return empty arrays or `{ok:false, reason:"..."}`, never raw 500
- Check `dbAvailable()` before DB operations
- Validate request body fields
- Use `json:"field_name"` tags (snake_case)
- Log with `[Module]` prefix: `log.Printf("[Items] ...")`
- Set Content-Type header before encoding response
