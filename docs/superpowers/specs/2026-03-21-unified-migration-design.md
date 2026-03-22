# Harbinger Unified v2.0 — Migration Design Spec

> **Date:** 2026-03-21
> **Status:** Approved
> **Scope:** Merge PentAGI (execution engine) and ProwlrBot (protocol + channels) into Harbinger as the single unified platform.
> **Strategy:** Incremental absorption — four phases, each delivering a working system.

---

## 1. Vision

Harbinger becomes a single autonomous offensive security platform combining:

- **Harbinger (Core Brain):** Agent orchestration, dashboards, recon + vuln workflows, knowledge graph, central UI
- **PentAGI (Execution Engine):** Sandboxed Docker execution, agent pipelines, pgvector memory, LLM observability
- **ProwlrBot (Protocol + Interface Layer):** ROAR protocol (internal bus), channel adapters (Discord, Telegram, Slack, etc.)

PentAGI and ProwlrBot are **absorbed and sunset** — not merged wholesale. Cherry-pick the best, rewrite to fit Harbinger's patterns, archive the standalone repos.

---

## 2. Architecture

```
HARBINGER UNIFIED v2.0
═══════════════════════════════════════════════════════════════

                         ┌──────────────┐
                         │   NGINX      │
                         │  (gateway)   │
                         └──────┬───────┘
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
          ┌──────┴──────┐ ┌────┴────┐ ┌───────┴───────┐
          │  HARBINGER  │ │ CHANNEL │ │   EXECUTION   │
          │   BACKEND   │ │ BRIDGE  │ │    ENGINE     │
          │   (Go)      │ │  (Go)   │ │    (Go)       │
          │             │ │         │ │               │
          │ ┌─────────┐ │ │ Discord │ │ Researcher    │
          │ │  ROAR   │◄├─┤Telegram │ │ Developer     │
          │ │  BUS    │ │ │ Slack   │ │ Executor      │
          │ │ (Go pkg)│ │ │ WhatsApp│ │               │
          │ └─────────┘ │ │ iMessage│ │ Docker sandbox│
          │             │ │ ...     │ │ pgvector mem  │
          │ Orchestrator│ │         │ │ Langfuse obs  │
          │ 11 Agents   │ └─────────┘ └───────────────┘
          │ Dashboards  │
          │ Knowledge   │
          └──────┬──────┘
                 │
    ┌────────────┼────────────┬──────────────┐
    │            │            │              │
┌───┴───┐ ┌─────┴─────┐ ┌───┴───┐ ┌────────┴────────┐
│Postgres│ │   Redis   │ │ Neo4j │ │  Docker Proxy   │
│pgvector│ │  (cache)  │ │Graphiti│ │(sandboxed exec) │
└───────┘ └───────────┘ └───────┘ └─────────────────┘

    FILESYSTEM LAYER
    ┌────────────────────────────────────────────┐
    │ .learning/  → cross-agent intelligence     │
    │ .memory/    → per-user profiles            │
    │ .state/     → ephemeral runtime            │
    │ .skills/    → installable marketplace      │
    │ /deprecated/→ clean sunset (never dead)    │
    └────────────────────────────────────────────┘

    EXTERNAL SDK LAYER
    ┌────────────────────────────────────────────┐
    │ roar-sdk (Python) — PyPI package           │
    │ @roar-protocol/sdk (TypeScript) — npm      │
    │ → External agents connect via ROAR over    │
    │   HTTP/WebSocket/gRPC to Harbinger's bus   │
    └────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **PentAGI promoted** from MCP plugin to first-class execution engine with shared DB
2. **ROAR protocol** implemented as native Go package — replaces ad-hoc messaging in `comms.go`
3. **Channel Bridge** — Go service handling all chat platform adapters (ported from ProwlrBot's Python)
4. **Filesystem layer** — `.learning/`, `.memory/`, `.state/`, `.skills/` with strict ownership
5. **External SDKs preserved** — Python/TypeScript ROAR SDKs remain for ecosystem agents
6. **No dead files rule** — enforced by system design, not discipline

### What We Do NOT Absorb

| Source | Rejected | Reason |
|--------|----------|--------|
| PentAGI | Gin router | Harbinger uses stdlib `net/http` — keep it |
| PentAGI | Separate frontend | Harbinger's UI is the UI |
| PentAGI | Auth system | Harbinger `oauth.go` + ROAR identity replaces it |
| PentAGI | Scraper service | Harbinger has `browsers.go` + LENS agent |
| ProwlrBot | Full Python runtime | Only extract protocol + adapter logic, rewrite in Go |
| ProwlrBot | Console UI | Harbinger's React SPA is the UI |
| ProwlrBot | FastAPI server | Go backend only |
| ProwlrBot | RAG pipeline | Future consideration — not Phase 1-4 |
| ProwlrBot | War Room (Hub) | Replaced by ROAR bus + `.state/coordination/` |
| ProwlrBot | Desktop app | Out of scope |

---

## 3. Phase 1 — PentAGI Execution Engine Integration

**Goal:** PentAGI goes from MCP plugin to native execution engine. Remove the PentAGI container.

### Step 1a: Deep Integration (ship first)

Promote PentAGI from MCP service to first-class engine:
- Shared Postgres + pgvector (single database, not two)
- Shared auth (Harbinger's `oauth.go`)
- Direct Go API calls instead of MCP protocol overhead

### Step 1b: Gradual Go-native Port

Port PentAGI modules into Harbinger's backend as they're touched:

```
backend/
├── cmd/
│   ├── executor.go      ← sandboxed Docker task execution
│   ├── pipeline.go      ← Researcher → Developer → Executor chain
│   ├── vectormem.go     ← pgvector semantic memory ops
│   ├── observability.go ← Langfuse + OpenTelemetry
│   └── ... (existing files unchanged)
├── pkg/
│   ├── executor/        ← Docker sandbox logic
│   ├── pipeline/        ← Agent pipeline orchestration
│   └── vectormem/       ← pgvector operations
```

### Capabilities Absorbed from PentAGI

| Capability | PentAGI Source | Harbinger Target |
|---|---|---|
| Sandboxed Docker execution | `pkg/docker/` | Extend `docker-proxy` + `backend/cmd/executor.go` |
| Agent pipeline (Research->Dev->Exec) | `pkg/controller/` | New orchestration mode in `autonomous.go` |
| pgvector semantic memory | `pkg/database/` (GORM) | Extend `database.go` with vector ops |
| Langfuse observability | `pkg/observability/` | New `backend/cmd/observability.go` |
| SQL migrations (goose) | `migrations/sql/` | Adopt for Harbinger's DB schema |

### Migration Rule

Each time a PentAGI feature is touched, port it to Go-native. Never copy-paste — rewrite to fit Harbinger's patterns:
- `writeJSON()` for all responses
- No-crash policy (missing config returns `{ok:false, reason:"not_configured"}`)
- Dual route registration (`/api/` and `/api/v1/`)
- In-memory + DB fallback with `sync.RWMutex`

### Completion Criteria

- [ ] PentAGI container removed from `docker-compose.yml`
- [ ] All execution happens through Harbinger's backend directly
- [ ] pgvector memory accessible from all 11 agents
- [ ] Langfuse tracing on all LLM calls
- [ ] Zero MCP protocol overhead for execution
- [ ] `mcp-plugins/pentagi/` removed

---

## 4. Phase 2 — ROAR Protocol + Channel Adapters

**Goal:** ROAR becomes Harbinger's native internal message bus. Channels become full bidirectional adapters.

### 2a: ROAR Go Package

Native Go implementation of the 5-layer ROAR spec:

```
backend/pkg/roar/
├── identity.go      ← Layer 1: Agent DIDs (did:roar:agent:pathfinder, etc.)
├── discovery.go     ← Layer 2: Agent registry + capability advertisement
├── transport.go     ← Layer 3: In-process channels, WebSocket, HTTP
├── message.go       ← Layer 4: ROARMessage (7 intents), HMAC signing
├── stream.go        ← Layer 5: Event streaming (SSE, WebSocket)
├── bus.go           ← Message router — fanout, routing, backpressure
├── contracts.go     ← Agent capability contracts (enforced at compile time)
├── retry.go         ← Retry policies, dead-letter handling
└── roar_test.go     ← Conformance tests (ported from roar-protocol/tests/)
```

### Why Go-native ROAR (not sidecar)

1. **Performance** — Zero serialization overhead, no IPC, no network hops for internal messages
2. **Fewer failure points** — No process supervision, health checks, transport complexity, or startup-order issues for the message backbone
3. **Cleaner observability** — Native tracing, metrics, backpressure, direct integration with queues/websockets/auth/routing
4. **Better enforcement** — Message schemas, agent capability contracts, auth/attestation, routing rules, retry policies, event persistence — all enforced without depending on another runtime

### ROAR Replaces `comms.go`

| Current (`comms.go`) | Target (`pkg/roar/`) |
|---|---|
| In-memory map relay | Typed `bus.Publish(ROARMessage{...})` |
| No routing rules | Route by intent + capability match |
| No retry | Configurable retry + dead-letter |
| No schema enforcement | Go struct message schemas |
| No observability | Every message traced (OpenTelemetry) |

### The 7 ROAR Intents in Harbinger

| Intent | Harbinger Use |
|---|---|
| `execute` | Agent requests tool execution |
| `delegate` | Orchestrator assigns task to agent |
| `update` | Agent reports progress |
| `ask` | Agent requests human input |
| `respond` | Human/agent answers a question |
| `notify` | Broadcast events (findings, alerts) |
| `discover` | Agent capability lookup |

### Agent DIDs

```
did:roar:agent:pathfinder    (PATHFINDER — Recon)
did:roar:agent:breach        (BREACH — Web Hacking)
did:roar:agent:phantom       (PHANTOM — Cloud)
did:roar:agent:specter       (SPECTER — OSINT)
did:roar:agent:cipher        (CIPHER — Binary RE)
did:roar:agent:scribe        (SCRIBE — Reports)
did:roar:agent:sam           (SAM — Coding)
did:roar:agent:brief         (BRIEF — Reporter)
did:roar:agent:sage          (SAGE — Learning)
did:roar:agent:lens          (LENS — Browser)
did:roar:agent:maintainer    (MAINTAINER — DevOps)
```

### 2b: Channel Adapters

Port ProwlrBot's channel adapters to Go with a common interface:

```go
type ChannelAdapter interface {
    Name() string
    Connect(config ChannelConfig) error
    Send(msg ROARMessage) error
    Listen() <-chan ROARMessage
    Disconnect() error
    HealthCheck() error
}
```

**Adapter priority:**

| Adapter | Priority | Reason |
|---|---|---|
| Discord (full bidirectional) | High | Already have webhook, most users |
| Telegram (full bidirectional) | High | Already have webhook |
| Slack (full bidirectional) | High | Already have webhook |
| WhatsApp | Medium | Growing demand |
| iMessage | Low | Niche |
| DingTalk | Low | Regional |
| Feishu | Low | Regional |

**Upgrade from current:** `channels.go` only does outbound webhooks. New adapters are **bidirectional** — incoming messages become ROAR messages, agents respond back through the same channel.

### 2c: External SDK Compatibility

Go ROAR core exposes endpoints for external Python/TypeScript SDK agents:

```
External Agent (Python + roar-sdk)
  → HTTP POST /api/roar/message
  → WebSocket ws://harbinger/api/roar/stream
  → Authenticated via ROAR Layer 1 (DID + HMAC/Ed25519)
```

No changes needed to existing `roar-protocol` Python/TS SDKs — they point at Harbinger's endpoint.

### Completion Criteria

- [ ] `comms.go` replaced by `pkg/roar/` — zero legacy message passing
- [ ] All 11 agents have DIDs and communicate exclusively via ROAR bus
- [ ] Discord, Telegram, Slack adapters are bidirectional
- [ ] External agents can connect via ROAR SDKs
- [ ] Conformance tests passing (ported from `roar-protocol/tests/`)
- [ ] Every message observable in Langfuse/OpenTelemetry

---

## 5. Phase 3 — System Intelligence Layer

**Goal:** Structured intelligence that persists across sessions and improves agent performance over time.

### 3a: Filesystem Layer

```
~/.harbinger/                          ← HARBINGER_WORKSPACE root
├── .learning/                         ← Cross-agent shared intelligence
│   ├── techniques/
│   │   ├── recon-patterns.json        ← What recon approaches work on what targets
│   │   ├── exploit-chains.json        ← Successful multi-step attack paths
│   │   └── tool-failures.json         ← What tools fail on what configs
│   ├── strategies/
│   │   ├── target-profiles.json       ← "targets like X respond to approach Y"
│   │   └── efficiency-scores.json     ← Autonomous loop cost/benefit history
│   └── models/
│       ├── provider-benchmarks.json   ← Latency, cost, quality per provider per task
│       └── routing-decisions.json     ← Smart router decision log
│
├── .memory/                           ← Per-user profiles
│   ├── {user-id}/
│   │   ├── preferences.json           ← Tone, verbosity, favorite workflows
│   │   ├── workflows.json             ← Custom workflow templates
│   │   └── history.json               ← Command history, recent targets
│   └── _system/
│       └── defaults.json              ← System-wide defaults
│
├── .state/                            ← Ephemeral runtime (cleared on restart)
│   ├── tasks/                         ← Active task manifests
│   ├── locks/                         ← File/resource locks
│   ├── streams/                       ← Active SSE/WebSocket streams
│   └── coordination/                  ← Multi-agent task boards
│
├── .skills/                           ← Installable marketplace
│   ├── registry.json                  ← Installed skills manifest
│   ├── installed/
│   │   ├── {skill-name}/
│   │   │   ├── skill.json             ← Metadata, version, dependencies
│   │   │   ├── run.sh                 ← Execution entry point
│   │   │   └── docker/Dockerfile      ← Optional container definition
│   │   └── ...
│   └── cache/                         ← Downloaded but not installed
│
└── /deprecated/                       ← Clean sunset zone
    ├── MANIFEST.md                    ← What's here, why, when deletable
    └── {module}/                      ← Deprecated code with expiry date
```

### Ownership Rules (enforced in code)

| Directory | Owner | Writes | Reads | Lifetime |
|---|---|---|---|---|
| `.learning/` | Any agent | Append-only | All agents | Persistent, pruned quarterly |
| `.memory/` | Auth system | User's own profile only | Orchestrator + assigned agents | Persistent |
| `.state/` | Runtime | Task owner only | Bus subscribers | Ephemeral (cleared on restart) |
| `.skills/` | Skill manager | Install/uninstall only | All agents | Until uninstalled |
| `/deprecated/` | MAINTAINER | Move-in only | Nobody | Until expiry date |

### 3b: Smart Router Upgrade

Port ProwlrBot's cost x speed x availability scoring into `modelrouter.go`:

```go
type RouteScore struct {
    Provider    string
    Model       string
    Cost        float64  // $/1K tokens
    Latency     float64  // p50 ms
    Quality     float64  // task-type-specific accuracy
    Available   bool     // health check status
    Score       float64  // weighted composite
}

func (r *SmartRouter) SelectModel(taskType string, constraints RouteConstraints) RouteScore
```

Feeds from `.learning/models/` — every LLM call logs performance data, router reads it for self-improving model selection.

### 3c: Skills Marketplace

New `backend/cmd/marketplace.go` endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/skills/marketplace` | GET | Browse available skills |
| `/api/skills/install` | POST | Install from registry |
| `/api/skills/{id}` | DELETE | Uninstall |
| `/api/skills/installed` | GET | List installed |
| `/api/skills/{id}/execute` | POST | Run (routes through Phase 1 executor) |

Skill manifest format:

```json
{
  "name": "nmap-advanced",
  "version": "1.2.0",
  "description": "Advanced nmap scanning with OS detection and service enumeration",
  "agent_compatibility": ["pathfinder", "breach"],
  "requires_docker": true,
  "docker_image": "harbinger/skill-nmap:1.2.0",
  "entry_point": "run.sh",
  "inputs": { "target": "string", "scan_type": "enum:quick|full|stealth" },
  "outputs": { "results": "json", "report": "markdown" },
  "mitre_attack": ["T1046"],
  "tags": ["recon", "network", "scanning"]
}
```

### 3d: Learning System Upgrade

Upgrade existing `learning.go` to write to `.learning/`:

```
Agent completes task
  → ROARMessage{intent:"update", payload: TaskResult}
  → Learning System (bus subscriber) intercepts
  → Records to .learning/ (technique rates, tool performance, chain effectiveness)
  → Smart Router + Orchestrator read .learning/ for future decisions
```

### Completion Criteria

- [ ] `.learning/`, `.memory/`, `.state/`, `.skills/` directories created and enforced
- [ ] Smart router using historical performance data
- [ ] Skills marketplace functional (install/uninstall/execute)
- [ ] Learning system recording all task outcomes
- [ ] Ownership rules enforced in code

---

## 6. Phase 4 — Cleanup & Sunset

**Goal:** Zero dead files. Clean deprecation. CI enforcement.

### Deprecation Protocol

1. Code identified for removal → moved to `/deprecated/{module}/`
2. `MANIFEST.md` entry added (what, why, when, which PR)
3. MAINTAINER agent checks `/deprecated/` nightly
4. After expiry → deleted with clean commit

### Sunset Schedule

| Item | Action | When |
|---|---|---|
| PentAGI Docker service | Remove from `docker-compose.yml` | After Phase 1 |
| `comms.go` | Replace with `pkg/roar/` | After Phase 2 |
| `channels.go` (webhook-only) | Replace with `pkg/channels/` | After Phase 2 |
| PentAGI standalone repo | Archive on GitHub | After Phase 1 verified |
| ProwlrBot standalone repo | Archive on GitHub | After Phase 2+3 verified |
| `mcp-plugins/pentagi/` | Remove | After Phase 1 |

### CI Enforcement

Add to `.github/workflows/ci.yml`:
- Check `/deprecated/` for expired modules
- Check for unused imports
- Check for files not referenced by any route, component, or test
- Fail build if violations found

### The "No Dead Files" System Rules

```
IF modifying existing logic:
  UPDATE the existing file
ELSE IF new concept:
  CREATE new module in correct directory
ELSE:
  REFACTOR

NEVER duplicate files.
ALWAYS update existing.
Versioning = Git Only.
```

---

## 7. Timeline

```
Phase 1: PentAGI → Native Execution Engine
  1a: Deep integration (shared DB, direct API)       ~2-3 weeks
  1b: Gradual Go-native port                         ~3-4 weeks (ongoing)

Phase 2: ROAR Protocol + Channels
  2a: Go ROAR package (pkg/roar/)                    ~2 weeks
  2b: Channel adapters (Discord/Telegram/Slack)       ~1-2 weeks
  2c: External SDK compatibility                      ~1 week

Phase 3: System Intelligence
  3a: Filesystem layer (.learning/.memory/.state/.skills)  ~1 week
  3b: Smart Router upgrade                            ~1 week
  3c: Skills Marketplace                              ~2 weeks
  3d: Learning system upgrade                         ~1 week

Phase 4: Cleanup & Sunset                             Ongoing throughout
  4a: Deprecation protocol                            Continuous
  4b: Service removal                                 After each phase
  4c: CI enforcement                                  Day 1
```

---

## 8. Risk Mitigation

| Risk | Mitigation |
|---|---|
| PentAGI deep integration breaks existing MCP users | Keep MCP endpoint as thin proxy during transition |
| ROAR Go port diverges from spec | Port conformance tests first, run against Go implementation |
| Channel adapters are complex (platform API quirks) | Start with Discord/Telegram/Slack only, add others later |
| `.learning/` data grows unbounded | Quarterly pruning, max file sizes, ring buffer for high-volume data |
| Migration takes longer than expected | Each phase is independently valuable — can pause between phases |
| Dead files accumulate during migration | CI enforcement from Day 1, `/deprecated/` with expiry dates |

---

## 9. Success Metrics

- **Phase 1 done:** PentAGI container gone, execution is native, pgvector accessible
- **Phase 2 done:** All agents use ROAR DIDs, channels are bidirectional, external SDKs work
- **Phase 3 done:** Smart router self-improving, marketplace has 5+ installable skills, learning loop active
- **Phase 4 done:** Zero files in `/deprecated/`, CI passes clean, PentAGI + ProwlrBot repos archived
- **Overall:** Single `docker compose up` runs the entire unified platform
