# Harbinger v2.0 Phase 3: Memory & Knowledge Graph

> **Terminal 6 (T6)** — Memory & Knowledge Graph
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete 5-layer memory system and Neo4j knowledge graph so agents can store, search, share, and reason about findings across missions. This is the brain of Harbinger v2.0 — without it, agents forget everything between runs.

**Architecture:** Extends the existing Go backend with Neo4j Bolt driver, pgvector semantic search, Redis working memory, and a summarization pipeline. All routes follow the dual-prefix pattern (`/api/` + `/api/v1/`). The knowledge graph provides the `harbinger memory search` and `harbinger memory graph` CLI experience.

**Tech Stack:** Go 1.24, neo4j-go-driver/v5, pgvector (existing extension), Redis 7.4 (existing container), OpenAI embeddings API (text-embedding-3-small)

**Spec:** `docs/superpowers/specs/2026-03-22-harbinger-v2-autonomous-os-design.md` § 6

**Depends on:** Phase 0+1 (FastAPI sidecar + execution engine) for mission/task/subtask IDs, but memory layers can be built and tested independently against the existing Go backend.

---

## File Structure

### New Files

```
backend/
├── pkg/
│   ├── neo4jclient/
│   │   ├── client.go              # Neo4j Bolt connection pool, session helpers
│   │   ├── schema.go              # Cypher constraints + indexes (idempotent)
│   │   └── queries.go             # Typed Cypher query builders
│   ├── embedder/
│   │   ├── embedder.go            # Embedding interface + OpenAI implementation
│   │   └── embedder_test.go       # Unit tests with mock provider
│   └── memorylayer/
│       ├── layers.go              # L1-L5 layer router (decides which layer to query)
│       ├── working.go             # L1: Redis working memory (mission-scoped, TTL)
│       ├── mission.go             # L2: Mission memory (PG, cross-agent findings)
│       └── summarizer.go          # Output + chain summarization engine
├── cmd/
│   ├── knowledgegraph.go          # Neo4j HTTP handlers (CRUD entities, relations, queries)
│   └── memorylayer.go             # Memory layer HTTP handlers (unified search, cross-agent)

harbinger-tools/frontend/src/
├── api/
│   ├── knowledgeGraph.ts          # Knowledge graph API client
│   └── memoryLayer.ts             # Unified memory API client
├── store/
│   ├── knowledgeGraphStore.ts     # Zustand store for graph state
│   └── memoryLayerStore.ts        # Zustand store for memory layer state
└── pages/
    └── KnowledgeGraph/
        └── KnowledgeGraph.tsx     # Knowledge graph visualization page (React Flow)
```

### Modified Files

```
backend/cmd/main.go                # Register new routes + init Neo4j + init embedder
backend/cmd/database.go            # Add ensureKnowledgeGraphConstraints() call
backend/pkg/vectormem/store.go     # Add pgvector semantic search (embedding column)
backend/cmd/vectormem.go           # Add embed endpoint, semantic search mode
docker-compose.yml                 # (no changes — Neo4j already present)
go.mod / go.sum                    # Add neo4j-go-driver/v5
harbinger-tools/frontend/src/App.tsx                 # Add KnowledgeGraph route
harbinger-tools/frontend/src/components/Layout/Sidebar.tsx  # Add nav entry
```

---

## PHASE 3A: NEO4J KNOWLEDGE GRAPH (Tasks 1-5)

### Task 1: Neo4j Go Driver + Connection Pool

**Files:**
- Create: `backend/pkg/neo4jclient/client.go`
- Modify: `backend/cmd/main.go` (add init call)
- Modify: `go.mod` (add dependency)

**Steps:**

- [ ] Run `cd backend && go get github.com/neo4j/neo4j-go-driver/v5`
- [ ] Create `backend/pkg/neo4jclient/client.go`:

```go
package neo4jclient

import (
    "context"
    "fmt"
    "github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// Client wraps a Neo4j driver with convenience methods.
type Client struct {
    driver neo4j.DriverWithContext
    db     string
}

// Config holds Neo4j connection parameters.
type Config struct {
    Host     string // default: "neo4j"
    Port     string // default: "7687"
    Password string
    Database string // default: "neo4j"
}

// New creates a Neo4j client with connection verification.
func New(ctx context.Context, cfg Config) (*Client, error) {
    uri := fmt.Sprintf("bolt://%s:%s", cfg.Host, cfg.Port)
    auth := neo4j.BasicAuth("neo4j", cfg.Password, "")
    driver, err := neo4j.NewDriverWithContext(uri, auth)
    if err != nil {
        return nil, fmt.Errorf("neo4jclient: create driver: %w", err)
    }
    if err := driver.VerifyConnectivity(ctx); err != nil {
        driver.Close(ctx)
        return nil, fmt.Errorf("neo4jclient: verify connectivity: %w", err)
    }
    db := cfg.Database
    if db == "" {
        db = "neo4j"
    }
    return &Client{driver: driver, db: db}, nil
}

// Close shuts down the driver.
func (c *Client) Close(ctx context.Context) error {
    return c.driver.Close(ctx)
}

// Session returns a new session for the configured database.
func (c *Client) Session(ctx context.Context, mode neo4j.AccessMode) neo4j.SessionWithContext {
    return c.driver.NewSession(ctx, neo4j.SessionConfig{
        DatabaseName: c.db,
        AccessMode:   mode,
    })
}

// Write executes a write transaction and returns the result.
func (c *Client) Write(ctx context.Context, work neo4j.ManagedTransactionWork) (any, error) {
    session := c.Session(ctx, neo4j.AccessModeWrite)
    defer session.Close(ctx)
    return session.ExecuteWrite(ctx, work)
}

// Read executes a read transaction and returns the result.
func (c *Client) Read(ctx context.Context, work neo4j.ManagedTransactionWork) (any, error) {
    session := c.Session(ctx, neo4j.AccessModeRead)
    defer session.Close(ctx)
    return session.ExecuteRead(ctx, work)
}
```

- [ ] Add to `main.go` init section (near `initVectorMem()`):

```go
var graphClient *neo4jclient.Client

func initNeo4j() {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    c, err := neo4jclient.New(ctx, neo4jclient.Config{
        Host:     cfg.Neo4jHost,
        Port:     cfg.Neo4jPort,
        Password: cfg.Neo4jPassword,
        Database: "neo4j",
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
```

- [ ] Add `Neo4jPassword` to config struct + getEnv reading
- [ ] Verify: `cd backend && go build ./cmd/` compiles

**Acceptance:** Backend starts, logs Neo4j connection status. If Neo4j is down, continues gracefully.

---

### Task 2: Neo4j Schema + Constraints

**Files:**
- Create: `backend/pkg/neo4jclient/schema.go`

**Steps:**

- [ ] Create `schema.go` with idempotent Cypher constraints matching v2.0 spec:

```go
package neo4jclient

import (
    "context"
    "github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// schemaStatements are idempotent — safe to run on every startup.
var schemaStatements = []string{
    // Uniqueness constraints
    "CREATE CONSTRAINT host_ip IF NOT EXISTS FOR (h:Host) REQUIRE h.ip IS UNIQUE",
    "CREATE CONSTRAINT service_id IF NOT EXISTS FOR (s:Service) REQUIRE s.id IS UNIQUE",
    "CREATE CONSTRAINT vuln_id IF NOT EXISTS FOR (v:Vulnerability) REQUIRE v.id IS UNIQUE",
    "CREATE CONSTRAINT technique_id IF NOT EXISTS FOR (t:Technique) REQUIRE t.id IS UNIQUE",
    "CREATE CONSTRAINT mission_id IF NOT EXISTS FOR (m:Mission) REQUIRE m.id IS UNIQUE",
    "CREATE CONSTRAINT agent_codename IF NOT EXISTS FOR (a:Agent) REQUIRE a.codename IS UNIQUE",
    "CREATE CONSTRAINT credential_id IF NOT EXISTS FOR (c:Credential) REQUIRE c.id IS UNIQUE",
    "CREATE CONSTRAINT finding_id IF NOT EXISTS FOR (f:Finding) REQUIRE f.id IS UNIQUE",
    "CREATE CONSTRAINT target_id IF NOT EXISTS FOR (t:Target) REQUIRE t.id IS UNIQUE",
    "CREATE CONSTRAINT subdomain_fqdn IF NOT EXISTS FOR (s:Subdomain) REQUIRE s.fqdn IS UNIQUE",

    // Indexes for common lookups
    "CREATE INDEX host_hostname IF NOT EXISTS FOR (h:Host) ON (h.hostname)",
    "CREATE INDEX vuln_severity IF NOT EXISTS FOR (v:Vulnerability) ON (v.severity)",
    "CREATE INDEX finding_severity IF NOT EXISTS FOR (f:Finding) ON (f.severity)",
    "CREATE INDEX mission_status IF NOT EXISTS FOR (m:Mission) ON (m.status)",
    "CREATE INDEX agent_status IF NOT EXISTS FOR (a:Agent) ON (a.status)",
}

// EnsureSchema runs all schema statements. Each is idempotent (IF NOT EXISTS).
func EnsureSchema(ctx context.Context, c *Client) error {
    _, err := c.Write(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
        for _, stmt := range schemaStatements {
            if _, err := tx.Run(ctx, stmt, nil); err != nil {
                return nil, err
            }
        }
        return nil, nil
    })
    return err
}
```

- [ ] Verify: start backend with Neo4j running, check constraints created

**Acceptance:** `SHOW CONSTRAINTS` in Neo4j browser shows all constraints.

---

### Task 3: Knowledge Graph Cypher Query Builders

**Files:**
- Create: `backend/pkg/neo4jclient/queries.go`

**Steps:**

- [ ] Implement typed query functions for the v2.0 graph schema:

```go
package neo4jclient

// Node types used as labels in Neo4j.
const (
    LabelHost          = "Host"
    LabelService       = "Service"
    LabelVulnerability = "Vulnerability"
    LabelTechnique     = "Technique"
    LabelMission       = "Mission"
    LabelAgent         = "Agent"
    LabelCredential    = "Credential"
    LabelFinding       = "Finding"
    LabelTarget        = "Target"
    LabelSubdomain     = "Subdomain"
)

// Relationship types.
const (
    RelHasService     = "HAS_SERVICE"
    RelHasVuln        = "HAS_VULN"
    RelFoundBy        = "FOUND_BY"
    RelTargeted       = "TARGETED"
    RelPerformed      = "PERFORMED"
    RelHasCredential  = "HAS_CREDENTIAL"
    RelHasFinding     = "HAS_FINDING"
    RelSubdomainOf    = "SUBDOMAIN_OF"
    RelAffectedByCVE  = "AFFECTED_BY_CVE"
)
```

- [ ] Implement `CreateNode(ctx, label, props map[string]any) (string, error)` — MERGE by unique key
- [ ] Implement `CreateRelation(ctx, fromLabel, fromKey, fromVal, relType, toLabel, toKey, toVal string, props map[string]any) error`
- [ ] Implement `GetNode(ctx, label, key, val) (map[string]any, error)`
- [ ] Implement `SearchNodes(ctx, label string, query string, limit int) ([]map[string]any, error)` — full-text search
- [ ] Implement `GetNeighbors(ctx, label, key, val string, depth int) (nodes []map[string]any, rels []map[string]any, error)` — subgraph expansion
- [ ] Implement `GetAttackPath(ctx, missionID string) ([]map[string]any, error)` — mission attack chain
- [ ] Implement `GetStats(ctx) (map[string]any, error)` — node/relationship counts per label

**Acceptance:** Each function has a doc comment explaining the Cypher it runs. Unit-testable with Neo4j test container.

---

### Task 4: Knowledge Graph HTTP Handlers

**Files:**
- Create: `backend/cmd/knowledgegraph.go`
- Modify: `backend/cmd/main.go` (register routes)

**Steps:**

- [ ] Create `knowledgegraph.go` with handlers following existing patterns (nil-check on graphClient, writeJSON, dual-prefix):

```
POST   /api/v1/graph/nodes              Create/merge a node
GET    /api/v1/graph/nodes/{label}/{id}  Get a node by label + unique key
GET    /api/v1/graph/nodes/{label}       List nodes of a label (paginated)
DELETE /api/v1/graph/nodes/{label}/{id}  Delete a node
POST   /api/v1/graph/relations           Create a relationship
GET    /api/v1/graph/neighbors/{label}/{id}  Get subgraph around a node
GET    /api/v1/graph/search              Full-text search across all labels
GET    /api/v1/graph/attack-path/{mission_id}  Get attack chain for mission
GET    /api/v1/graph/stats               Node/relationship counts
POST   /api/v1/graph/ingest              Bulk ingest (array of nodes + relations)
```

- [ ] Implement `handleCreateGraphNode` — accepts `{label, properties}`, calls `CreateNode`
- [ ] Implement `handleGetGraphNode` — path params `label`, `id`
- [ ] Implement `handleListGraphNodes` — query params `label`, `limit`, `offset`
- [ ] Implement `handleDeleteGraphNode` — removes node + all relationships
- [ ] Implement `handleCreateGraphRelation` — accepts `{from_label, from_id, rel_type, to_label, to_id, properties}`
- [ ] Implement `handleGetNeighbors` — query param `depth` (default 1, max 3)
- [ ] Implement `handleSearchGraph` — query param `q`, `label` (optional), `limit`
- [ ] Implement `handleGetAttackPath` — mission_id from path
- [ ] Implement `handleGetGraphStats` — returns counts per label/rel type
- [ ] Implement `handleBulkIngest` — accepts `{nodes: [], relations: []}`, runs in single transaction
- [ ] Register all routes in `main.go` with dual-prefix + authMiddleware
- [ ] Verify: `cd backend && go build ./cmd/` compiles

**Acceptance:** All endpoints return proper JSON. Nil graphClient returns `{ok:false, reason:"not_configured"}`.

---

### Task 5: Agent Finding → Graph Ingestion Pipeline

**Files:**
- Modify: `backend/cmd/knowledgegraph.go` (add ingestion helpers)

**Steps:**

- [ ] Implement `IngestScanResult(ctx, agentCodename, missionID string, result map[string]any) error`:
  - Parses tool output (subfinder JSONL, httpx JSONL, nuclei JSONL)
  - Creates Host, Service, Vulnerability, Finding nodes
  - Creates relationships (HAS_SERVICE, HAS_VULN, FOUND_BY, TARGETED)
  - Links to Mission and Agent nodes
- [ ] Implement `IngestCredential(ctx, hostIP, username, hash string, valid bool) error`
- [ ] Implement format parsers:
  - `parseSubfinderOutput(data []byte) []map[string]any` — extracts subdomains
  - `parseHttpxOutput(data []byte) []map[string]any` — extracts hosts + services
  - `parseNucleiOutput(data []byte) []map[string]any` — extracts vulns + findings

```
POST /api/v1/graph/ingest/scan    Ingest scan tool output (auto-parse format)
POST /api/v1/graph/ingest/cred    Ingest discovered credential
```

- [ ] Register ingestion routes
- [ ] Verify with sample JSONL payloads

**Acceptance:** Sending subfinder/httpx/nuclei JSONL creates proper graph nodes + relationships.

---

## PHASE 3B: PGVECTOR SEMANTIC SEARCH (Tasks 6-8)

### Task 6: Embedding Provider Interface

**Files:**
- Create: `backend/pkg/embedder/embedder.go`
- Create: `backend/pkg/embedder/embedder_test.go`

**Steps:**

- [ ] Define embedding interface:

```go
package embedder

import "context"

// Embedder generates vector embeddings from text.
type Embedder interface {
    Embed(ctx context.Context, text string) ([]float32, error)
    EmbedBatch(ctx context.Context, texts []string) ([][]float32, error)
    Dimension() int
}
```

- [ ] Implement `OpenAIEmbedder`:
  - Uses `text-embedding-3-small` (1536 dimensions) via HTTP API
  - Reads `OPENAI_API_KEY` from env (or `HARBINGER_EMBEDDING_API_KEY`)
  - Implements rate limiting (3000 RPM default)
  - Batch size: 100 texts per request
  - Falls back gracefully if API key not set (returns nil embedding)

- [ ] Implement `NoopEmbedder` for when no API key is configured:
  - Returns nil embeddings
  - `Dimension()` returns 1536
  - Logs warning once: "Embedding provider not configured — semantic search disabled"

- [ ] Write tests with mock HTTP server

**Acceptance:** `Embed("test")` returns 1536-dim float32 slice. NoopEmbedder returns nil without error.

---

### Task 7: Upgrade vectormem Store with pgvector Search

**Files:**
- Modify: `backend/pkg/vectormem/store.go`
- Modify: `backend/cmd/vectormem.go`
- Modify: `backend/cmd/main.go` (pass embedder to store)

**Steps:**

- [ ] Add `embedder` field to `Store` struct:

```go
type Store struct {
    db       *sql.DB
    embedder embedder.Embedder
    mu       sync.RWMutex
    memories []Memory
}

func NewStore(db *sql.DB, emb embedder.Embedder) *Store { ... }
```

- [ ] Modify `Store.Store()` to generate embedding on write:
  - Call `embedder.Embed(ctx, content)`
  - If embedding is non-nil AND db is available, INSERT with embedding column
  - If embedding is nil, INSERT without embedding (keyword fallback still works)

- [ ] Add `Store.SemanticSearch(ctx, req SearchRequest) ([]Memory, error)`:
  - Generate embedding for query text
  - If embedding available + db available: run pgvector cosine similarity search:
    ```sql
    SELECT id, agent_id, flow_id, task_id, content, doc_type, metadata,
           1 - (embedding <=> $1) AS score, created_at
    FROM vector_memories
    WHERE ($2 = '' OR agent_id = $2)
      AND ($3 = '' OR doc_type = $3)
    ORDER BY embedding <=> $1
    LIMIT $4
    ```
  - If embedding not available: fall back to keyword search

- [ ] Add new endpoint: `POST /api/v1/memory/semantic-search`:
  - Same request format as `/memory/search` but uses embedding similarity
  - Returns results with cosine similarity score

- [ ] Add backfill endpoint: `POST /api/v1/memory/backfill-embeddings`:
  - Reads all memories without embeddings from DB
  - Generates embeddings in batches of 100
  - Updates rows with embeddings
  - Returns `{ok:true, processed: N, failed: N}`

- [ ] Update `initVectorMem()` to pass embedder instance

**Acceptance:** Semantic search returns relevant results even when exact keywords don't match. Backfill processes all existing memories.

---

### Task 8: Memory Collection Types (Guides, Answers, Code)

**Files:**
- Modify: `backend/cmd/vectormem.go`

**Steps:**

- [ ] Add typed store/search endpoints matching v2.0 tool spec:

```
POST /api/v1/memory/store-guide      Store a guide (doc_type="guide", anonymizes content)
POST /api/v1/memory/store-answer     Store Q&A (doc_type="answer")
POST /api/v1/memory/store-code       Store code sample (doc_type="code")
POST /api/v1/memory/search-guide     Search guides only
POST /api/v1/memory/search-answer    Search answers only
POST /api/v1/memory/search-code      Search code only
```

- [ ] Implement content anonymization for guides:
  - Strip IP addresses, domains, emails from content before storing
  - Preserve structure and technique descriptions
  - Store original in metadata.original_content (encrypted if possible)

- [ ] Each typed endpoint is a thin wrapper around `memStore.Store()` / `memStore.SemanticSearch()` with pre-set `doc_type` filter

- [ ] Register all routes with dual-prefix

**Acceptance:** Guides stored with anonymized content. Type-specific search only returns matching doc_type.

---

## PHASE 3C: MEMORY LAYERS (Tasks 9-12)

### Task 9: L1 — Redis Working Memory

**Files:**
- Create: `backend/pkg/memorylayer/working.go`
- Modify: `backend/cmd/main.go` (init Redis for memory)

**Steps:**

- [ ] Implement `WorkingMemory` using existing Redis connection:

```go
package memorylayer

import "context"

// WorkingMemory is L1 — mission-scoped ephemeral context in Redis.
// Keys are prefixed with mission ID and auto-expire.
type WorkingMemory struct {
    redis RedisClient
    ttl   time.Duration // default: 4 hours
}

// Set stores a key-value pair scoped to a mission. Expires after TTL.
func (w *WorkingMemory) Set(ctx context.Context, missionID, key, value string) error

// Get retrieves a value by mission + key. Returns "" if not found or expired.
func (w *WorkingMemory) Get(ctx context.Context, missionID, key string) (string, error)

// GetAll returns all working memory for a mission.
func (w *WorkingMemory) GetAll(ctx context.Context, missionID string) (map[string]string, error)

// Append adds to a list (for accumulating findings during a mission).
func (w *WorkingMemory) Append(ctx context.Context, missionID, key, value string) error

// Clear removes all working memory for a mission.
func (w *WorkingMemory) Clear(ctx context.Context, missionID string) error
```

- [ ] Redis key format: `harbinger:wm:{missionID}:{key}` with TTL
- [ ] For lists: `harbinger:wm:{missionID}:list:{key}` using RPUSH + EXPIRE
- [ ] Add HTTP endpoints:

```
POST   /api/v1/memory/working/set         Set working memory (mission_id, key, value)
GET    /api/v1/memory/working/{mission_id}/{key}  Get value
GET    /api/v1/memory/working/{mission_id}        Get all for mission
POST   /api/v1/memory/working/append      Append to list
DELETE /api/v1/memory/working/{mission_id} Clear mission memory
```

- [ ] Register routes, dual-prefix

**Acceptance:** Set/Get works with Redis. Keys auto-expire. Clear removes all mission keys.

---

### Task 10: L2 — Mission Memory (Cross-Agent Findings)

**Files:**
- Create: `backend/pkg/memorylayer/mission.go`
- Modify: `backend/cmd/memorylayer.go`

**Steps:**

- [ ] Implement `MissionMemory` — aggregates findings across agents within a single mission:

```go
// MissionMemory is L2 — shared findings for one mission, stored in PostgreSQL.
type MissionMemory struct {
    db       *sql.DB
    embedder embedder.Embedder
}

// StoreFinding persists a finding from any agent, linked to mission + task.
func (m *MissionMemory) StoreFinding(ctx context.Context, finding MissionFinding) (string, error)

// SearchFindings searches all findings for a mission using semantic similarity.
func (m *MissionMemory) SearchFindings(ctx context.Context, missionID, query string, limit int) ([]MissionFinding, error)

// SynthesizeFindings generates a summary of all findings for a mission.
func (m *MissionMemory) SynthesizeFindings(ctx context.Context, missionID string) (string, error)

// ShareContext makes one agent's context available to another within the mission.
func (m *MissionMemory) ShareContext(ctx context.Context, missionID, fromAgent, toAgent, context string) error
```

- [ ] `MissionFinding` type:

```go
type MissionFinding struct {
    ID          string         `json:"id"`
    MissionID   string         `json:"mission_id"`
    TaskID      string         `json:"task_id"`
    AgentID     string         `json:"agent_id"`
    Type        string         `json:"type"`     // vuln, info, credential, service
    Severity    string         `json:"severity"` // critical, high, medium, low, info
    Title       string         `json:"title"`
    Description string         `json:"description"`
    Evidence    string         `json:"evidence"`
    Host        string         `json:"host"`
    Metadata    map[string]any `json:"metadata"`
    CreatedAt   time.Time      `json:"created_at"`
}
```

- [ ] Ensure `mission_findings` table (new):

```sql
CREATE TABLE IF NOT EXISTS mission_findings (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL,
    task_id TEXT,
    agent_id TEXT NOT NULL,
    finding_type TEXT NOT NULL DEFAULT 'info',
    severity TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    description TEXT,
    evidence TEXT,
    host TEXT,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mf_mission ON mission_findings(mission_id);
CREATE INDEX IF NOT EXISTS idx_mf_agent ON mission_findings(agent_id);
CREATE INDEX IF NOT EXISTS idx_mf_severity ON mission_findings(severity);
CREATE INDEX IF NOT EXISTS idx_mf_embedding ON mission_findings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

- [ ] Add HTTP endpoints:

```
POST   /api/v1/memory/mission/findings           Store finding
GET    /api/v1/memory/mission/{id}/findings       List findings for mission
POST   /api/v1/memory/mission/{id}/search         Semantic search within mission
POST   /api/v1/memory/mission/{id}/synthesize     Generate findings summary
POST   /api/v1/memory/mission/share               Share context between agents
```

- [ ] On StoreFinding: also ingest into Neo4j graph (create Finding node + relationships)

**Acceptance:** Findings stored with embeddings. Cross-agent search works. Synthesize produces LLM summary.

---

### Task 11: L5 — Agent Identity Learning

**Files:**
- Modify: `backend/cmd/memorylayer.go`

**Steps:**

- [ ] Implement agent identity persistence — learned patterns that survive across missions:

```go
// AgentIdentity is L5 — permanent learned behaviors per agent.
type AgentIdentity struct {
    db *sql.DB
}

// RecordPattern stores a learned pattern for an agent.
func (a *AgentIdentity) RecordPattern(ctx context.Context, agentID, pattern, context string, confidence float64) error

// GetPatterns retrieves all learned patterns for an agent.
func (a *AgentIdentity) GetPatterns(ctx context.Context, agentID string) ([]LearnedPattern, error)

// GetRelevantPatterns retrieves patterns matching a query for an agent.
func (a *AgentIdentity) GetRelevantPatterns(ctx context.Context, agentID, situation string) ([]LearnedPattern, error)
```

- [ ] Ensure `agent_patterns` table:

```sql
CREATE TABLE IF NOT EXISTS agent_patterns (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    pattern TEXT NOT NULL,
    context TEXT,
    confidence FLOAT DEFAULT 0.5,
    times_applied INT DEFAULT 0,
    last_applied TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ap_agent ON agent_patterns(agent_id);
```

- [ ] Add HTTP endpoints:

```
POST   /api/v1/memory/identity/{agent_id}/patterns    Record pattern
GET    /api/v1/memory/identity/{agent_id}/patterns     List patterns
POST   /api/v1/memory/identity/{agent_id}/relevant     Get relevant patterns for situation
PATCH  /api/v1/memory/identity/{agent_id}/patterns/{id} Update confidence/times_applied
```

**Acceptance:** Patterns stored per agent. Relevance search returns matching patterns.

---

### Task 12: Unified Memory Layer Router

**Files:**
- Create: `backend/pkg/memorylayer/layers.go`
- Create: `backend/cmd/memorylayer.go`

**Steps:**

- [ ] Implement `LayerRouter` that unifies all 5 layers behind a single search API:

```go
// LayerRouter decides which memory layer(s) to query based on request context.
type LayerRouter struct {
    L1 *WorkingMemory
    L2 *MissionMemory
    L3 *vectormem.Store
    L4 *neo4jclient.Client
    L5 *AgentIdentity
}

// UnifiedSearch searches across layers with priority: L1 > L2 > L3 > L4.
func (r *LayerRouter) UnifiedSearch(ctx context.Context, req UnifiedSearchRequest) ([]SearchResult, error)

type UnifiedSearchRequest struct {
    Query     string   `json:"query"`
    MissionID string   `json:"mission_id"` // if set, includes L1+L2
    AgentID   string   `json:"agent_id"`   // if set, includes L5
    Layers    []string `json:"layers"`     // explicit layer selection: ["L1","L2","L3","L4","L5"]
    Limit     int      `json:"limit"`
}

type SearchResult struct {
    Layer   string         `json:"layer"`   // L1, L2, L3, L4, L5
    Score   float64        `json:"score"`
    Content string         `json:"content"`
    Type    string         `json:"type"`    // working, finding, memory, entity, pattern
    Metadata map[string]any `json:"metadata"`
}
```

- [ ] Search logic:
  1. If `mission_id` set: query L1 (Redis working) + L2 (mission findings)
  2. Always query L3 (pgvector knowledge)
  3. If query looks like entity reference: query L4 (Neo4j graph)
  4. If `agent_id` set: query L5 (agent patterns)
  5. Merge + deduplicate + sort by score
  6. Respect `layers` filter if explicitly specified

- [ ] Add unified endpoint:

```
POST /api/v1/memory/search-all    Unified search across all layers
GET  /api/v1/memory/layers/stats  Stats per layer (count, size, health)
```

- [ ] Register routes

**Acceptance:** Single search endpoint queries multiple layers, returns merged results with layer attribution.

---

## PHASE 3D: SUMMARIZATION ENGINE (Tasks 13-14)

### Task 13: Output + Chain Summarization

**Files:**
- Create: `backend/pkg/memorylayer/summarizer.go`

**Steps:**

- [ ] Implement `Summarizer` matching v2.0 spec § 10:

```go
// Summarizer compresses tool output and conversation chains to fit context windows.
type Summarizer struct {
    ResultLimit int // default: 16384 (16KB)
    ChainLimit  int // default: 50 messages
}

// SummarizeOutput compresses tool output if it exceeds ResultLimit.
// Preserves all findings, IPs, ports, vulns — strips noise.
func (s *Summarizer) SummarizeOutput(ctx context.Context, output, toolName string) (string, error)

// SummarizeChain compresses a message chain if it exceeds ChainLimit.
// Keeps the most recent `keepRecent` messages intact, summarizes older ones.
func (s *Summarizer) SummarizeChain(ctx context.Context, chain []Message, keepRecent int) ([]Message, error)

// SummarizeFindings generates a mission-level summary from all findings.
func (s *Summarizer) SummarizeFindings(ctx context.Context, findings []MissionFinding) (string, error)
```

- [ ] Summarization uses the configured LLM provider (falls back to truncation if unavailable)
- [ ] Tool-specific summarization prompts:
  - `subfinder`: "Extract all unique subdomains"
  - `nuclei`: "Extract all vulnerabilities with severity, template, and host"
  - `httpx`: "Extract all live hosts with status codes, titles, and technologies"
  - Default: "Preserve all security-relevant findings"

- [ ] Add HTTP endpoint:

```
POST /api/v1/memory/summarize     Summarize arbitrary text (tool output or chain)
```

**Acceptance:** 100KB nuclei output → compressed to ~4KB with all vulns preserved. 200-message chain → 50 messages with summary prefix.

---

### Task 14: Memory Dashboard Stats + Health

**Files:**
- Modify: `backend/cmd/memorylayer.go`

**Steps:**

- [ ] Add comprehensive stats endpoint:

```
GET /api/v1/memory/dashboard    Returns:
{
    "layers": {
        "L1_working": { "status": "ok", "active_missions": 3, "keys_count": 47 },
        "L2_mission": { "status": "ok", "findings_count": 234, "missions_with_findings": 12 },
        "L3_knowledge": { "status": "ok", "memories_count": 1500, "with_embeddings": 1200, "without_embeddings": 300 },
        "L4_graph": { "status": "ok", "nodes": 450, "relationships": 890, "labels": {...} },
        "L5_identity": { "status": "ok", "agents_with_patterns": 8, "total_patterns": 56 }
    },
    "embedding_provider": "openai/text-embedding-3-small",
    "embedding_dimension": 1536,
    "graph_connected": true,
    "redis_connected": true
}
```

- [ ] Add per-agent memory summary:

```
GET /api/v1/memory/agent/{agent_id}/summary  Returns memory across all layers for one agent
```

**Acceptance:** Dashboard returns real stats from all 5 layers. Disconnected services show degraded status.

---

## PHASE 3E: FRONTEND (Tasks 15-17)

### Task 15: Knowledge Graph API Client + Store

**Files:**
- Create: `harbinger-tools/frontend/src/api/knowledgeGraph.ts`
- Create: `harbinger-tools/frontend/src/store/knowledgeGraphStore.ts`
- Create: `harbinger-tools/frontend/src/api/memoryLayer.ts`
- Create: `harbinger-tools/frontend/src/store/memoryLayerStore.ts`

**Steps:**

- [ ] `knowledgeGraph.ts` — API client for all `/api/v1/graph/*` endpoints
- [ ] `knowledgeGraphStore.ts` — Zustand store:
  - `nodes`, `relations`, `stats`, `searchResults`, `attackPath`
  - Actions: `fetchStats`, `searchGraph`, `getNeighbors`, `getAttackPath`, `createNode`, `createRelation`
- [ ] `memoryLayer.ts` — API client for all `/api/v1/memory/*` endpoints
- [ ] `memoryLayerStore.ts` — Zustand store:
  - `layerStats`, `searchResults`, `agentSummaries`
  - Actions: `fetchDashboard`, `unifiedSearch`, `storeMemory`, `searchByLayer`

**Acceptance:** Stores fetch data correctly. Types match backend response shapes.

---

### Task 16: Knowledge Graph Visualization Page

**Files:**
- Create: `harbinger-tools/frontend/src/pages/KnowledgeGraph/KnowledgeGraph.tsx`
- Modify: `harbinger-tools/frontend/src/App.tsx` (add route)
- Modify: Sidebar (add nav entry)

**Steps:**

- [ ] Page layout (Obsidian Command theme):
  - **Left panel**: Search bar + filter by node type + recent searches
  - **Center**: Interactive graph visualization using `@xyflow/react` (already in deps)
    - Nodes color-coded by label (Host=blue, Vuln=red, Service=green, etc.)
    - Edges labeled with relationship type
    - Click node → expand neighbors (depth 1-3)
    - Click node → show properties panel
  - **Right panel**: Node/edge details, attack path viewer, stats
  - **Bottom**: Memory layer stats bar (L1-L5 status indicators)

- [ ] Node type → color mapping:

```ts
const NODE_COLORS: Record<string, string> = {
  Host: '#00d4ff',           // cyber blue
  Service: '#22c55e',        // green
  Vulnerability: '#ef4444',  // red
  Finding: '#f0c040',        // gold accent
  Technique: '#a855f7',      // purple
  Mission: '#3b82f6',        // blue
  Agent: '#f97316',          // orange
  Credential: '#ec4899',     // pink
  Target: '#14b8a6',         // teal
  Subdomain: '#64748b',      // slate
};
```

- [ ] Attack path view: given a mission ID, render the full chain as a directed path
- [ ] Add lazy-loaded route in App.tsx: `/knowledge-graph`
- [ ] Add sidebar entry under "Intelligence" section

**Acceptance:** Graph renders with proper Obsidian Command styling. Nodes expand on click. Search works.

---

### Task 17: Memory Search Page Enhancement

**Files:**
- Modify existing memory-related UI (if any) or integrate into KnowledgeGraph page

**Steps:**

- [ ] Add "Memory" tab to KnowledgeGraph page with:
  - Unified search bar (queries all layers)
  - Layer filter toggles (L1-L5)
  - Results grouped by layer with score
  - Memory dashboard stats cards (one per layer)
  - Agent memory summary view

- [ ] Add memory store/search to agent detail views (existing Agents page):
  - Show agent's L3 memories (knowledge)
  - Show agent's L5 patterns (identity)
  - Show agent's mission findings (L2)

**Acceptance:** Unified memory search works across layers. Agent memory visible from agent detail.

---

## Verification

After all tasks complete:

```bash
# Backend builds
cd backend && go build -o /tmp/harbinger-backend ./cmd/

# Backend tests pass
cd backend && go test ./cmd/ ./pkg/... -v

# Frontend builds
pnpm build:ui

# Neo4j schema created
docker compose exec neo4j cypher-shell -u neo4j -p "$NEO4J_PASSWORD" "SHOW CONSTRAINTS"

# Memory endpoints respond
curl -s http://localhost:8080/api/v1/memory/dashboard | jq .
curl -s http://localhost:8080/api/v1/graph/stats | jq .

# Semantic search works (if embedding key configured)
curl -s -X POST http://localhost:8080/api/v1/memory/semantic-search \
  -H 'Content-Type: application/json' \
  -d '{"query":"apache struts vulnerability","limit":5}' | jq .

# Knowledge graph accepts data
curl -s -X POST http://localhost:8080/api/v1/graph/nodes \
  -H 'Content-Type: application/json' \
  -d '{"label":"Host","properties":{"ip":"10.0.0.1","hostname":"target.example.com"}}' | jq .
```

---

## Dependencies on Other Terminals

| Terminal | What T6 Needs | What T6 Provides |
|----------|---------------|-------------------|
| T1 (Mission Control) | Mission IDs for L2 memory scoping | Memory search CLI (`harbinger memory search`) |
| T2 (Agent Watch) | Agent codenames for L5 identity | Agent pattern lookups |
| T3 (Findings Feed) | Finding data to ingest into L2 + L4 | Finding persistence + search |
| T4 (War Room) | Task/subtask IDs for context linking | Cross-agent memory sharing |
| T5 (Agent Shell) | Docker container IDs for terminal log linking | Memory query API within containers |
| T7 (Healing) | Nothing | Memory health stats for healing decisions |

---

## Estimated Effort

| Phase | Tasks | Effort | Description |
|-------|-------|--------|-------------|
| 3A | 1-5 | 3-4 days | Neo4j driver, schema, queries, handlers, ingestion |
| 3B | 6-8 | 2-3 days | Embedder, pgvector search, typed collections |
| 3C | 9-12 | 3-4 days | L1 Redis, L2 mission, L5 identity, unified router |
| 3D | 13-14 | 1-2 days | Summarization engine, dashboard stats |
| 3E | 15-17 | 2-3 days | Frontend API/stores, graph viz, memory search |
| **Total** | **17 tasks** | **~2 weeks** | Complete memory + knowledge graph system |
