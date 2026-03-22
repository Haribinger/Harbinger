package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/Haribinger/Harbinger/backend/pkg/neo4jclient"
)

// graphClient is the global Neo4j knowledge graph client.
// It is nil when Neo4j is not configured or unreachable at startup.
var graphClient *neo4jclient.Client

// initNeo4j opens a connection to Neo4j and applies the schema (constraints + indexes).
// If Neo4j is unreachable the backend continues without the knowledge graph — all
// graph handlers degrade gracefully via the nil-check pattern.
func initNeo4j() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	c, err := neo4jclient.New(ctx, neo4jclient.Config{
		Host:     cfg.Neo4jHost,
		Port:     cfg.Neo4jPort,
		Password: cfg.Neo4jPassword,
	})
	if err != nil {
		log.Printf("[WARN] Neo4j not available: %v (knowledge graph disabled)", err)
		return
	}

	graphClient = c

	if err := neo4jclient.EnsureSchema(ctx, c); err != nil {
		log.Printf("[WARN] Neo4j schema setup failed: %v", err)
	}

	log.Println("[OK] Neo4j knowledge graph connected")
}

// handleCreateGraphNode creates or merges a node in the knowledge graph.
// POST /api/v1/graph/nodes
// Body: {"label":"Host","unique_key":"ip","properties":{"ip":"10.0.0.1","hostname":"target.example.com"}}
func handleCreateGraphNode(w http.ResponseWriter, r *http.Request) {
	if graphClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req struct {
		Label      string         `json:"label"`
		UniqueKey  string         `json:"unique_key"`
		Properties map[string]any `json:"properties"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}
	if req.Label == "" || req.UniqueKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "label and unique_key are required"})
		return
	}
	uniqueVal, ok := req.Properties[req.UniqueKey]
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "unique_key not found in properties"})
		return
	}

	node, err := neo4jclient.CreateNode(r.Context(), graphClient, req.Label, req.UniqueKey, uniqueVal, req.Properties)
	if err != nil {
		internalError(w, "create graph node", err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "node": node})
}

// handleListGraphNodes lists nodes of a label with pagination, or retrieves a single
// node when the "key" and "value" query parameters are both provided.
// GET /api/v1/graph/nodes/{label}?key={key}&value={value}
// GET /api/v1/graph/nodes/{label}?limit=50&offset=0
func handleListGraphNodes(w http.ResponseWriter, r *http.Request) {
	if graphClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	label := r.PathValue("label")
	if label == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "label is required"})
		return
	}

	// If both key+value are present, return the single matching node.
	key := r.URL.Query().Get("key")
	value := r.URL.Query().Get("value")
	if key != "" && value != "" {
		node, err := neo4jclient.GetNode(r.Context(), graphClient, label, key, value)
		if err != nil {
			internalError(w, "get graph node", err)
			return
		}
		if node == nil {
			writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "node not found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "node": node})
		return
	}

	// Otherwise paginate.
	limit := 50
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	nodes, err := neo4jclient.ListNodes(r.Context(), graphClient, label, limit, offset)
	if err != nil {
		internalError(w, "list graph nodes", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": nodes, "label": label})
}

// handleDeleteGraphNode removes a node (and its relationships) from the graph.
// DELETE /api/v1/graph/nodes/{label}?key={key}&value={value}
func handleDeleteGraphNode(w http.ResponseWriter, r *http.Request) {
	if graphClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	label := r.PathValue("label")
	key := r.URL.Query().Get("key")
	value := r.URL.Query().Get("value")
	if label == "" || key == "" || value == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "label, key, and value are required"})
		return
	}

	if err := neo4jclient.DeleteNode(r.Context(), graphClient, label, key, value); err != nil {
		internalError(w, "delete graph node", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleCreateGraphRelation creates a directed relationship between two nodes.
// POST /api/v1/graph/relations
// Body: {"from_label":"Host","from_key":"ip","from_val":"10.0.0.1","rel_type":"HAS_SERVICE","to_label":"Service","to_key":"id","to_val":"svc-1","properties":{}}
func handleCreateGraphRelation(w http.ResponseWriter, r *http.Request) {
	if graphClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req neo4jclient.RelInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}
	if req.FromLabel == "" || req.FromKey == "" || req.RelType == "" || req.ToLabel == "" || req.ToKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "from_label, from_key, rel_type, to_label, to_key are required"})
		return
	}
	if req.Properties == nil {
		req.Properties = map[string]any{}
	}

	if err := neo4jclient.CreateRelation(
		r.Context(), graphClient,
		req.FromLabel, req.FromKey, req.FromVal,
		req.RelType,
		req.ToLabel, req.ToKey, req.ToVal,
		req.Properties,
	); err != nil {
		internalError(w, "create graph relation", err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true})
}

// handleGetNeighbors returns the subgraph surrounding a node up to the requested depth.
// GET /api/v1/graph/neighbors/{label}?key={key}&value={value}&depth=2
func handleGetNeighbors(w http.ResponseWriter, r *http.Request) {
	if graphClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	label := r.PathValue("label")
	key := r.URL.Query().Get("key")
	value := r.URL.Query().Get("value")
	if label == "" || key == "" || value == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "label, key, and value are required"})
		return
	}

	depth := 2
	if d := r.URL.Query().Get("depth"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 {
			depth = parsed
		}
	}

	nodes, rels, err := neo4jclient.GetNeighbors(r.Context(), graphClient, label, key, value, depth)
	if err != nil {
		internalError(w, "get graph neighbors", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "nodes": nodes, "relationships": rels})
}

// handleSearchGraph searches nodes across labels using a substring query.
// GET /api/v1/graph/search?q=apache&label=Host&limit=20
func handleSearchGraph(w http.ResponseWriter, r *http.Request) {
	if graphClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "q is required"})
		return
	}

	label := r.URL.Query().Get("label")
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	nodes, err := neo4jclient.SearchNodes(r.Context(), graphClient, q, label, limit)
	if err != nil {
		internalError(w, "search graph", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": nodes})
}

// handleGetAttackPath returns the full attack chain for a mission.
// GET /api/v1/graph/attack-path/{mission_id}
func handleGetAttackPath(w http.ResponseWriter, r *http.Request) {
	if graphClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	missionID := r.PathValue("mission_id")
	if missionID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "mission_id is required"})
		return
	}

	path, err := neo4jclient.GetAttackPath(r.Context(), graphClient, missionID)
	if err != nil {
		internalError(w, "get attack path", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": path, "mission_id": missionID})
}

// handleGetGraphStats returns node counts per label and relationship counts per type.
// GET /api/v1/graph/stats
func handleGetGraphStats(w http.ResponseWriter, r *http.Request) {
	if graphClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	stats, err := neo4jclient.GetStats(r.Context(), graphClient)
	if err != nil {
		internalError(w, "get graph stats", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "stats": stats})
}

// handleBulkIngest ingests arrays of nodes and relationships in a single transaction.
// POST /api/v1/graph/ingest
// Body: {"nodes":[...],"relations":[...]}
func handleBulkIngest(w http.ResponseWriter, r *http.Request) {
	if graphClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req struct {
		Nodes     []neo4jclient.NodeInput `json:"nodes"`
		Relations []neo4jclient.RelInput  `json:"relations"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if err := neo4jclient.BulkIngest(r.Context(), graphClient, req.Nodes, req.Relations); err != nil {
		internalError(w, "bulk ingest", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"nodes":     len(req.Nodes),
		"relations": len(req.Relations),
	})
}
