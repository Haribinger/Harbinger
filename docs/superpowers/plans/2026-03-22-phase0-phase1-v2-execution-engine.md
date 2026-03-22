# Phase 0 + Phase 1: FastAPI Sidecar + Execution Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the FastAPI sidecar (Phase 0) and build the core execution engine — Mission→Task→SubTask→Action hierarchy, DAG scheduler, ReAct agent loop, terminal tool, and v2 SSE event streaming (Phase 1).

**Architecture:** Strangler Fig — FastAPI sidecar runs alongside Go backend. nginx routes `/api/v2/*` to FastAPI (:8090), everything else to Go (:8080). Auth bridge shares JWT validation between both services. The Go SSE hub (`realtime.go`) remains the single fan-out point — FastAPI publishes events to it via internal HTTP POST.

**Spec:** `docs/superpowers/specs/2026-03-22-harbinger-v2-autonomous-os-design.md`

**Supersedes:** `docs/superpowers/plans/2026-03-21-phase1-execution-engine.md` (that plan ported PentAGI as Go packages; this plan uses FastAPI per the v2.0 spec's Strangler Fig approach)

**Tech Stack:** Python 3.12, FastAPI, asyncio, SQLAlchemy (async), Docker Engine API, litellm, Go 1.24 (existing), nginx, PostgreSQL 17 (pgvector)

**Terminal Assignments:**
- T1 (Mission Control): Monitors overall progress, tests mission lifecycle
- T2 (Agent Watch): Builds SSE event extensions, agent activity streaming, frontend wiring
- T3 (Findings Feed): Not active this phase
- T4 (War Room): Not active this phase

---

## Multi-Terminal Coordination

### Shared Resources (Conflict Zones)
| Resource | Owner | Others Must |
|----------|-------|------------|
| `docker-compose.yml` | T1 | Coordinate before editing |
| `docker/nginx/nginx.conf` | T1 | Coordinate before editing |
| `backend/cmd/main.go` (route registration) | T2 | Coordinate before editing |
| `backend/cmd/realtime.go` (SSE hub) | T2 | POST events, don't modify hub |
| `harbinger-tools/frontend/src/api/` | T2 | Don't create conflicting modules |

### Communication Protocol
FastAPI → Go SSE: `POST http://go-backend:8080/api/realtime/events` (internal Docker network)
Go SSE → Browser: `GET /api/realtime/stream?channel=missions` (existing SSE endpoint)

---

## File Structure

### Phase 0: New Files

| File | Responsibility |
|------|---------------|
| `v2/` | FastAPI sidecar root (new top-level directory) |
| `v2/pyproject.toml` | Python project config (uv/pip) |
| `v2/app/__init__.py` | FastAPI app factory |
| `v2/app/main.py` | FastAPI app, lifespan, CORS, routes |
| `v2/app/config.py` | Settings (Pydantic BaseSettings) |
| `v2/app/auth.py` | JWT validation — shared secret with Go backend |
| `v2/app/deps.py` | FastAPI dependencies (get_db, get_current_user) |
| `v2/app/models/__init__.py` | SQLAlchemy models package |
| `v2/app/models/mission.py` | Mission, Task, SubTask, Action, MsgChain, TerminalLog models |
| `v2/app/db.py` | Async SQLAlchemy engine + session factory |
| `v2/app/event_bridge.py` | Publish events to Go SSE hub via HTTP POST |
| `v2/Dockerfile` | Python 3.12-slim, uvicorn |
| `v2/alembic.ini` | Alembic migration config |
| `v2/alembic/env.py` | Migration environment |
| `v2/alembic/versions/001_initial.py` | Initial migration: missions, tasks, subtasks, actions, etc. |

### Phase 1: New Files

| File | Responsibility |
|------|---------------|
| `v2/app/engine/__init__.py` | Execution engine package |
| `v2/app/engine/scheduler.py` | DAG scheduler — topological sort, parallel dispatch |
| `v2/app/engine/react_loop.py` | Core ReAct loop — reason→act→observe→repeat |
| `v2/app/engine/monitor.py` | Execution monitor — loop detection, adviser intervention |
| `v2/app/engine/tools/__init__.py` | Tool registry |
| `v2/app/engine/tools/terminal.py` | Terminal tool — Docker exec with streaming |
| `v2/app/engine/tools/barrier.py` | Barrier tools — done, ask |
| `v2/app/engine/tools/management.py` | Management tools — subtask_list, subtask_patch |
| `v2/app/routers/__init__.py` | Router package |
| `v2/app/routers/missions.py` | Mission CRUD + lifecycle endpoints |
| `v2/app/routers/tasks.py` | Task CRUD + status endpoints |
| `v2/app/routers/tools.py` | Tool execution + streaming endpoints |
| `v2/app/routers/stream.py` | SSE stream for v2 events (proxied through Go hub) |

### Phase 1: Modified Files (Go Backend — T2 Responsibility)

| File | Changes |
|------|---------|
| `backend/cmd/realtime.go` | Add v2 event types: `mission_update`, `task_update`, `subtask_update`, `action_update`, `tool_output`, `react_iteration` |
| `backend/cmd/main.go` | Register new v2 event type validation |
| `harbinger-tools/frontend/src/api/realtime.ts` | Add v2 event types to TypeScript interface |
| `harbinger-tools/frontend/src/store/realtimeStore.ts` | Add v2 event filtering, per-agent activity log |

### Phase 1: Modified Files (Infrastructure — T1 Responsibility)

| File | Changes |
|------|---------|
| `docker-compose.yml` | Add `harbinger-v2` service (FastAPI), pgvector image |
| `docker/nginx/nginx.conf` | Route `/api/v2/*` to FastAPI :8090 |

---

## PHASE 0: FastAPI Sidecar (3 days)

### Task 0.1: Python Project Scaffold

**Files:** Create `v2/` directory tree

- [ ] **Step 1: Create pyproject.toml**

```toml
# v2/pyproject.toml
[project]
name = "harbinger-v2"
version = "2.0.0-alpha"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "sqlalchemy[asyncio]>=2.0.36",
    "asyncpg>=0.30.0",
    "alembic>=1.14.0",
    "pydantic-settings>=2.7.0",
    "pyjwt>=2.10.0",
    "httpx>=0.28.0",
    "litellm>=1.60.0",
    "docker>=7.1.0",
]

[project.optional-dependencies]
dev = ["pytest", "pytest-asyncio", "ruff"]
```

- [ ] **Step 2: Create FastAPI app factory**

```python
# v2/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db import init_db, close_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()

def create_app() -> FastAPI:
    app = FastAPI(
        title="Harbinger v2 Execution Engine",
        version="2.0.0-alpha",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Routers added in Phase 1
    return app

app = create_app()
```

- [ ] **Step 3: Create config with Pydantic BaseSettings**

```python
# v2/app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://harbinger:harbinger@postgres:5432/harbinger"
    go_backend_url: str = "http://harbinger-backend:8080"
    jwt_secret: str = "harbinger-secret"  # Must match Go backend JWT_SECRET
    frontend_url: str = "http://localhost:5173"
    docker_socket: str = "unix:///var/run/docker.sock"
    default_model: str = "anthropic/claude-sonnet-4-6"

    class Config:
        env_prefix = "HARBINGER_"

settings = Settings()
```

- [ ] **Step 4: Create Dockerfile**

```dockerfile
# v2/Dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN pip install uv
COPY pyproject.toml .
RUN uv pip install --system -r pyproject.toml
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
```

- [ ] **Step 5: Verify FastAPI starts**

Run: `cd v2 && pip install -e . && uvicorn app.main:app --port 8090`
Expected: FastAPI running on :8090 with `/docs` showing empty API

- [ ] **Step 6: Commit**

Message: `feat(v2): scaffold FastAPI sidecar with config, auth deps`

---

### Task 0.2: Auth Bridge (JWT Sharing)

**Files:** `v2/app/auth.py`, `v2/app/deps.py`

The Go backend signs JWTs with `JWT_SECRET`. FastAPI must validate the same tokens.

- [ ] **Step 1: Write test for JWT validation**

```python
# v2/tests/test_auth.py
import pytest
import jwt
from app.auth import validate_token, TokenPayload
from app.config import settings

def test_valid_token():
    token = jwt.encode(
        {"userID": "user_1", "username": "operator", "role": "admin", "exp": 9999999999},
        settings.jwt_secret,
        algorithm="HS256",
    )
    payload = validate_token(token)
    assert payload.user_id == "user_1"
    assert payload.role == "admin"

def test_expired_token():
    token = jwt.encode(
        {"userID": "user_1", "exp": 1000000000},
        settings.jwt_secret,
        algorithm="HS256",
    )
    with pytest.raises(Exception):
        validate_token(token)
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd v2 && pytest tests/test_auth.py -v`

- [ ] **Step 3: Implement auth module**

```python
# v2/app/auth.py
import jwt
from pydantic import BaseModel
from fastapi import HTTPException, status
from app.config import settings

class TokenPayload(BaseModel):
    user_id: str
    username: str
    role: str

def validate_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
    return TokenPayload(
        user_id=payload.get("userID", ""),
        username=payload.get("username", ""),
        role=payload.get("role", "operator"),
    )
```

```python
# v2/app/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth import validate_token, TokenPayload

bearer_scheme = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TokenPayload:
    return validate_token(credentials.credentials)
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

Message: `feat(v2): JWT auth bridge — shared validation with Go backend`

---

### Task 0.3: Database Models + Migration

**Files:** `v2/app/db.py`, `v2/app/models/mission.py`, Alembic setup

- [ ] **Step 1: Create async SQLAlchemy engine**

```python
# v2/app/db.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def close_db():
    await engine.dispose()

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
```

- [ ] **Step 2: Create mission models (from v2.0 spec schema)**

```python
# v2/app/models/mission.py
import enum
from datetime import datetime
from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import relationship
from app.db import Base

class MissionStatus(str, enum.Enum):
    created = "created"
    planning = "planning"
    running = "running"
    waiting = "waiting"
    paused = "paused"
    finished = "finished"
    failed = "failed"
    cancelled = "cancelled"

class TaskStatus(str, enum.Enum):
    created = "created"
    queued = "queued"
    running = "running"
    waiting = "waiting"
    finished = "finished"
    failed = "failed"
    skipped = "skipped"

class SubTaskStatus(str, enum.Enum):
    created = "created"
    running = "running"
    waiting = "waiting"
    finished = "finished"
    failed = "failed"

class ActionStatus(str, enum.Enum):
    received = "received"
    running = "running"
    finished = "finished"
    failed = "failed"

class Mission(Base):
    __tablename__ = "missions"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    title = Column(Text, nullable=False)
    description = Column(Text)
    status = Column(Enum(MissionStatus), nullable=False, default=MissionStatus.created)
    mission_type = Column(Text, nullable=False, default="custom")
    target = Column(Text)
    scope = Column(JSONB)
    autonomy_level = Column(Text, default="supervised")
    trace_id = Column(Text)
    user_id = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    tasks = relationship("Task", back_populates="mission", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mission_id = Column(BigInteger, ForeignKey("missions.id", ondelete="CASCADE"), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text)
    status = Column(Enum(TaskStatus), nullable=False, default=TaskStatus.created)
    agent_codename = Column(Text, nullable=False)
    docker_image = Column(Text, default="harbinger/base:latest")
    container_id = Column(Text)
    depends_on = Column(ARRAY(BigInteger), default=[])
    approval_required = Column(Boolean, default=False)
    priority = Column(Integer, default=0)
    input = Column(Text)
    result = Column(Text)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    mission = relationship("Mission", back_populates="tasks")
    subtasks = relationship("SubTask", back_populates="task", cascade="all, delete-orphan")

class SubTask(Base):
    __tablename__ = "subtasks"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text)
    status = Column(Enum(SubTaskStatus), nullable=False, default=SubTaskStatus.created)
    result = Column(Text)
    context = Column(Text)
    msg_chain_id = Column(BigInteger)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    task = relationship("Task", back_populates="subtasks")
    actions = relationship("Action", back_populates="subtask", cascade="all, delete-orphan")

class Action(Base):
    __tablename__ = "actions"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    subtask_id = Column(BigInteger, ForeignKey("subtasks.id", ondelete="CASCADE"), nullable=False)
    call_id = Column(Text)
    tool_name = Column(Text, nullable=False)
    args = Column(JSONB, nullable=False)
    result = Column(Text)
    result_format = Column(Text, default="markdown")
    status = Column(Enum(ActionStatus), nullable=False, default=ActionStatus.received)
    duration_seconds = Column(Float)
    mission_id = Column(BigInteger, nullable=False)
    task_id = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    subtask = relationship("SubTask", back_populates="actions")

class MsgChain(Base):
    __tablename__ = "msg_chains"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    chain_type = Column(Text, nullable=False)
    model = Column(Text)
    provider = Column(Text)
    tokens_in = Column(BigInteger, default=0)
    tokens_out = Column(BigInteger, default=0)
    chain = Column(JSONB)
    mission_id = Column(BigInteger, nullable=False)
    task_id = Column(BigInteger)
    subtask_id = Column(BigInteger)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TerminalLog(Base):
    __tablename__ = "terminal_logs"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    stream = Column(Text, nullable=False)  # stdout | stderr
    content = Column(Text, nullable=False)
    container_id = Column(Text, nullable=False)
    mission_id = Column(BigInteger, nullable=False)
    task_id = Column(BigInteger)
    subtask_id = Column(BigInteger)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 3: Initialize Alembic + create initial migration**

Run:
```bash
cd v2
alembic init alembic
# Edit alembic/env.py to use async engine from app.db
alembic revision --autogenerate -m "initial: missions tasks subtasks actions"
```

- [ ] **Step 4: Verify migration runs**

Run: `cd v2 && alembic upgrade head`
Expected: Tables created in PostgreSQL

- [ ] **Step 5: Commit**

Message: `feat(v2): database models — mission/task/subtask/action hierarchy with Alembic`

---

### Task 0.4: Event Bridge (FastAPI → Go SSE Hub)

**Files:** `v2/app/event_bridge.py`

FastAPI does NOT run its own SSE hub. It publishes events to Go's existing `publishEvent()` via `POST /api/realtime/events`. This keeps a single source of truth for all SSE clients.

- [ ] **Step 1: Write test for event bridge**

```python
# v2/tests/test_event_bridge.py
import pytest
from unittest.mock import AsyncMock, patch
from app.event_bridge import EventBridge

@pytest.mark.asyncio
async def test_publish_mission_event():
    bridge = EventBridge(go_url="http://localhost:8080")
    with patch.object(bridge, "_post", new_callable=AsyncMock) as mock:
        mock.return_value = {"ok": True}
        await bridge.mission_update(
            mission_id=1, status="running", title="Test Mission"
        )
        mock.assert_called_once()
        args = mock.call_args[0]
        assert args[0]["type"] == "mission_update"
        assert args[0]["channel"] == "missions"
```

- [ ] **Step 2: Implement event bridge**

```python
# v2/app/event_bridge.py
import httpx
from app.config import settings

class EventBridge:
    """Publishes v2 events to Go SSE hub for fan-out to all connected clients."""

    def __init__(self, go_url: str | None = None):
        self.go_url = go_url or settings.go_backend_url
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=5.0)
        return self._client

    async def _post(self, event: dict) -> dict:
        client = await self._get_client()
        resp = await client.post(f"{self.go_url}/api/realtime/events", json=event)
        resp.raise_for_status()
        return resp.json()

    async def mission_update(self, mission_id: int, status: str, **extra):
        await self._post({
            "type": "mission_update",
            "source": "orchestrator",
            "target": "broadcast",
            "channel": "missions",
            "payload": {"missionId": mission_id, "status": status, **extra},
        })

    async def task_update(self, task_id: int, mission_id: int, agent: str, status: str, **extra):
        await self._post({
            "type": "task_update",
            "source": agent,
            "target": "broadcast",
            "channel": f"mission:{mission_id}",
            "payload": {"taskId": task_id, "missionId": mission_id, "agent": agent, "status": status, **extra},
        })

    async def subtask_update(self, subtask_id: int, task_id: int, mission_id: int, status: str, **extra):
        await self._post({
            "type": "subtask_update",
            "source": "engine",
            "target": "broadcast",
            "channel": f"mission:{mission_id}",
            "payload": {"subtaskId": subtask_id, "taskId": task_id, "status": status, **extra},
        })

    async def action_update(self, action_id: int, tool_name: str, agent: str, mission_id: int, status: str, **extra):
        await self._post({
            "type": "action_update",
            "source": agent,
            "target": "broadcast",
            "channel": f"mission:{mission_id}",
            "payload": {"actionId": action_id, "tool": tool_name, "agent": agent, "status": status, **extra},
        })

    async def tool_output(self, agent: str, tool_name: str, mission_id: int, chunk: str):
        """Stream tool stdout/stderr chunks to SSE clients."""
        await self._post({
            "type": "tool_output",
            "source": agent,
            "target": "broadcast",
            "channel": f"agent:{agent}",
            "payload": {"agent": agent, "tool": tool_name, "missionId": mission_id, "chunk": chunk},
        })

    async def react_iteration(self, agent: str, mission_id: int, iteration: int, thought: str, action: str | None = None):
        """Stream ReAct loop iterations for Agent Watch (T2)."""
        await self._post({
            "type": "react_iteration",
            "source": agent,
            "target": "broadcast",
            "channel": f"agent:{agent}",
            "payload": {
                "agent": agent,
                "missionId": mission_id,
                "iteration": iteration,
                "thought": thought,
                "action": action,
            },
        })

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

# Singleton — importable anywhere in FastAPI
event_bridge = EventBridge()
```

- [ ] **Step 3: Run test — expect PASS**

- [ ] **Step 4: Commit**

Message: `feat(v2): event bridge — FastAPI publishes to Go SSE hub`

---

### Task 0.5: Docker + nginx Wiring (T1 Coordinates)

**Files:** `docker-compose.yml`, `docker/nginx/nginx.conf`

- [ ] **Step 1: Add harbinger-v2 service to docker-compose.yml**

```yaml
  harbinger-v2:
    build: ./v2
    container_name: harbinger-v2
    restart: unless-stopped
    ports:
      - "8090:8090"
    environment:
      - HARBINGER_DATABASE_URL=postgresql+asyncpg://harbinger:${POSTGRES_PASSWORD:-harbinger}@postgres:5432/harbinger
      - HARBINGER_GO_BACKEND_URL=http://harbinger-backend:8080
      - HARBINGER_JWT_SECRET=${JWT_SECRET:-harbinger-secret}
      - HARBINGER_DOCKER_SOCKET=/var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - harbinger
```

- [ ] **Step 2: Update postgres image to pgvector**

Change: `image: postgres:17` → `image: pgvector/pgvector:pg17`

- [ ] **Step 3: Add nginx routing for /api/v2/**

Add upstream and location block to `docker/nginx/nginx.conf`:

```nginx
upstream harbinger_v2 {
    server harbinger-v2:8090;
}

# v2 API routes → FastAPI
location /api/v2/ {
    proxy_pass http://harbinger_v2;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# v2 SSE streams → FastAPI (no buffering)
location /api/v2/stream/ {
    proxy_pass http://harbinger_v2;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
    chunked_transfer_encoding off;
}
```

- [ ] **Step 4: Verify full stack boots**

Run: `docker compose up --build`
Expected:
- Go backend on :8080 ✓
- FastAPI on :8090 ✓
- nginx routing /api/v2/* to FastAPI ✓
- nginx routing /api/* to Go ✓

- [ ] **Step 5: Commit**

Message: `feat(v2): docker + nginx — FastAPI sidecar with Strangler Fig routing`

---

### Task 0.6: Go SSE Hub — Add v2 Event Types (T2 Responsibility)

**Files:** `backend/cmd/realtime.go`, `backend/cmd/main.go`

The Go SSE hub needs to accept the new event types that FastAPI publishes.

- [ ] **Step 1: Add v2 event type constants to realtime.go**

After existing `EventType*` constants, add:

```go
// v2 execution engine events — published by FastAPI, fanned out by Go SSE hub.
const (
    EventTypeMissionUpdate  = "mission_update"
    EventTypeTaskUpdate     = "task_update"
    EventTypeSubTaskUpdate  = "subtask_update"
    EventTypeActionUpdate   = "action_update"
    EventTypeToolOutput     = "tool_output"
    EventTypeReactIteration = "react_iteration"
)
```

- [ ] **Step 2: Update handleBroadcastEvent validTypes map**

Add the 6 new types to the `validTypes` map in `handleBroadcastEvent`:

```go
EventTypeMissionUpdate:  true,
EventTypeTaskUpdate:     true,
EventTypeSubTaskUpdate:  true,
EventTypeActionUpdate:   true,
EventTypeToolOutput:     true,
EventTypeReactIteration: true,
```

- [ ] **Step 3: Build + verify**

Run: `cd backend && go build -o /tmp/harbinger-backend ./cmd/`
Expected: Clean build

- [ ] **Step 4: Write test for v2 event broadcasting**

```go
// backend/cmd/realtime_v2_test.go
func TestPublishV2Events(t *testing.T) {
    // Verify all v2 event types are accepted by publishEvent
    v2Types := []string{
        EventTypeMissionUpdate, EventTypeTaskUpdate, EventTypeSubTaskUpdate,
        EventTypeActionUpdate, EventTypeToolOutput, EventTypeReactIteration,
    }
    for _, et := range v2Types {
        evt := RealtimeEvent{
            Type:    et,
            Source:  "test",
            Target:  "broadcast",
            Channel: "test",
            Payload: map[string]any{"test": true},
        }
        publishEvent(evt)
        // Verify event is in the ring buffer
        realtimeHub.RLock()
        found := false
        for _, e := range realtimeHub.events {
            if e.Type == et && e.Source == "test" {
                found = true
                break
            }
        }
        realtimeHub.RUnlock()
        if !found {
            t.Errorf("event type %s not found in ring buffer", et)
        }
    }
}
```

- [ ] **Step 5: Run test**

Run: `cd backend && go test ./cmd/ -run TestPublishV2Events -v`
Expected: PASS

- [ ] **Step 6: Commit**

Message: `feat(realtime): add v2 execution engine event types to SSE hub`

---

## PHASE 1: Execution Engine (1 week)

### Task 1.1: Mission CRUD Router

**Files:** `v2/app/routers/missions.py`

- [ ] **Step 1: Write test for mission creation**

```python
# v2/tests/test_missions.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_create_mission():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v2/missions",
            json={
                "title": "Pentest example.com",
                "target": "example.com",
                "mission_type": "full_pentest",
                "autonomy_level": "supervised",
            },
            headers={"Authorization": "Bearer test-token"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Pentest example.com"
        assert data["status"] == "created"
```

- [ ] **Step 2: Implement mission router**

```python
# v2/app/routers/missions.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.deps import get_current_user, get_db
from app.auth import TokenPayload
from app.models.mission import Mission, MissionStatus
from app.event_bridge import event_bridge

router = APIRouter(prefix="/api/v2/missions", tags=["missions"])

class MissionCreate(BaseModel):
    title: str
    description: str | None = None
    target: str | None = None
    mission_type: str = "custom"
    autonomy_level: str = "supervised"
    scope: dict | None = None

class MissionOut(BaseModel):
    id: int
    title: str
    description: str | None
    status: str
    mission_type: str
    target: str | None
    autonomy_level: str

    class Config:
        from_attributes = True

@router.post("", status_code=201, response_model=MissionOut)
async def create_mission(
    body: MissionCreate,
    db: AsyncSession = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
):
    mission = Mission(
        title=body.title,
        description=body.description,
        target=body.target,
        mission_type=body.mission_type,
        autonomy_level=body.autonomy_level,
        scope=body.scope,
        user_id=int(user.user_id) if user.user_id.isdigit() else 0,
    )
    db.add(mission)
    await db.commit()
    await db.refresh(mission)
    await event_bridge.mission_update(mission.id, "created", title=mission.title)
    return mission

@router.get("", response_model=list[MissionOut])
async def list_missions(
    db: AsyncSession = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
):
    result = await db.execute(select(Mission).order_by(Mission.created_at.desc()))
    return result.scalars().all()

@router.get("/{mission_id}", response_model=MissionOut)
async def get_mission(
    mission_id: int,
    db: AsyncSession = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
):
    mission = await db.get(Mission, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="mission not found")
    return mission
```

- [ ] **Step 3: Register router in app/main.py**

```python
from app.routers.missions import router as missions_router
app.include_router(missions_router)
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

Message: `feat(v2): mission CRUD — create, list, get with SSE events`

---

### Task 1.2: Task CRUD + DAG Scheduler

**Files:** `v2/app/routers/tasks.py`, `v2/app/engine/scheduler.py`

- [ ] **Step 1: Write test for DAG scheduling**

```python
# v2/tests/test_scheduler.py
import pytest
from app.engine.scheduler import topological_sort, find_ready_tasks

def test_topological_sort():
    """Tasks: A(no deps), B(depends A), C(depends A), D(depends B,C)"""
    tasks = [
        {"id": 1, "depends_on": []},      # A
        {"id": 2, "depends_on": [1]},      # B
        {"id": 3, "depends_on": [1]},      # C
        {"id": 4, "depends_on": [2, 3]},   # D
    ]
    order = topological_sort(tasks)
    # A must come before B and C; B and C before D
    pos = {t["id"]: i for i, t in enumerate(order)}
    assert pos[1] < pos[2]
    assert pos[1] < pos[3]
    assert pos[2] < pos[4]
    assert pos[3] < pos[4]

def test_find_ready_tasks():
    tasks = [
        {"id": 1, "depends_on": [], "status": "queued"},
        {"id": 2, "depends_on": [1], "status": "queued"},
        {"id": 3, "depends_on": [], "status": "queued"},
    ]
    completed = {1}
    ready = find_ready_tasks(tasks, completed)
    # Task 1 already done, task 2 now ready (dep 1 done), task 3 always ready
    assert {t["id"] for t in ready} == {2, 3}
```

- [ ] **Step 2: Implement scheduler**

```python
# v2/app/engine/scheduler.py
from collections import defaultdict, deque

def topological_sort(tasks: list[dict]) -> list[dict]:
    """Kahn's algorithm — returns tasks in dependency order."""
    graph = defaultdict(list)
    in_degree = defaultdict(int)
    task_map = {t["id"]: t for t in tasks}

    for t in tasks:
        in_degree.setdefault(t["id"], 0)
        for dep in t.get("depends_on", []):
            graph[dep].append(t["id"])
            in_degree[t["id"]] += 1

    queue = deque(tid for tid, deg in in_degree.items() if deg == 0)
    result = []
    while queue:
        tid = queue.popleft()
        result.append(task_map[tid])
        for neighbor in graph[tid]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(result) != len(tasks):
        raise ValueError("circular dependency detected in task DAG")
    return result

def find_ready_tasks(tasks: list[dict], completed: set[int]) -> list[dict]:
    """Find tasks whose dependencies are all satisfied and status is queued."""
    return [
        t for t in tasks
        if t["status"] == "queued"
        and all(dep in completed for dep in t.get("depends_on", []))
    ]
```

- [ ] **Step 3: Task router with DAG validation**

```python
# v2/app/routers/tasks.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.deps import get_current_user, get_db
from app.auth import TokenPayload
from app.models.mission import Task, TaskStatus, Mission
from app.event_bridge import event_bridge

router = APIRouter(prefix="/api/v2/missions/{mission_id}/tasks", tags=["tasks"])

class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    agent_codename: str
    docker_image: str = "harbinger/base:latest"
    depends_on: list[int] = []
    approval_required: bool = False
    priority: int = 0
    input: str | None = None

class TaskOut(BaseModel):
    id: int
    mission_id: int
    title: str
    status: str
    agent_codename: str
    docker_image: str
    container_id: str | None
    depends_on: list[int]
    approval_required: bool
    priority: int

    class Config:
        from_attributes = True

@router.post("", status_code=201, response_model=TaskOut)
async def create_task(
    mission_id: int,
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
):
    mission = await db.get(Mission, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="mission not found")

    # Get current max position for ordering
    result = await db.execute(
        select(Task.position).where(Task.mission_id == mission_id).order_by(Task.position.desc())
    )
    max_pos = result.scalar() or 0

    task = Task(
        mission_id=mission_id,
        title=body.title,
        description=body.description,
        agent_codename=body.agent_codename,
        docker_image=body.docker_image,
        depends_on=body.depends_on,
        approval_required=body.approval_required,
        priority=body.priority,
        input=body.input,
        status=TaskStatus.created,
        position=max_pos + 1,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    await event_bridge.task_update(
        task.id, mission_id, body.agent_codename, "created", title=body.title,
    )
    return task

@router.get("", response_model=list[TaskOut])
async def list_tasks(
    mission_id: int,
    db: AsyncSession = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
):
    result = await db.execute(
        select(Task).where(Task.mission_id == mission_id).order_by(Task.position)
    )
    return result.scalars().all()
```

- [ ] **Step 4: Run tests**

Run: `cd v2 && pytest tests/test_scheduler.py -v`

- [ ] **Step 5: Register task router**

- [ ] **Step 6: Commit**

Message: `feat(v2): task CRUD + DAG scheduler with topological sort`

---

### Task 1.3: Terminal Tool (Docker Exec with Streaming)

**Files:** `v2/app/engine/tools/terminal.py`

This is the core tool that lets agents actually run commands in Docker containers. Output streams to the SSE hub via event_bridge.tool_output().

- [ ] **Step 1: Write test for terminal tool**

```python
# v2/tests/test_terminal.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.engine.tools.terminal import TerminalTool

@pytest.mark.asyncio
async def test_terminal_execute_echo():
    """Terminal tool should exec command and return output."""
    mock_bridge = AsyncMock()
    tool = TerminalTool(
        container_id="test-container",
        agent_codename="PATHFINDER",
        mission_id=1,
        event_bridge=mock_bridge,
    )

    with patch("app.engine.tools.terminal.docker_client") as mock_docker:
        # Mock Docker exec
        mock_exec = AsyncMock()
        mock_exec.start.return_value = b"hello world\n"
        mock_docker.exec_create.return_value = {"Id": "exec-123"}
        mock_docker.exec_start.return_value = b"hello world\n"

        result = await tool.execute({"command": "echo hello world"})
        assert "hello world" in result
```

- [ ] **Step 2: Implement terminal tool**

```python
# v2/app/engine/tools/terminal.py
import asyncio
import docker
from docker.errors import APIError
from app.config import settings
from app.event_bridge import EventBridge

# Docker client — connects via unix socket
docker_client = docker.DockerClient(base_url=settings.docker_socket)

class TerminalTool:
    """Execute commands inside a Docker container with streaming output."""

    MAX_TIMEOUT = 1200  # 20 minutes
    MAX_OUTPUT = 32768  # 32KB

    def __init__(
        self,
        container_id: str,
        agent_codename: str,
        mission_id: int,
        event_bridge: EventBridge,
        task_id: int | None = None,
        subtask_id: int | None = None,
    ):
        self.container_id = container_id
        self.agent = agent_codename
        self.mission_id = mission_id
        self.bridge = event_bridge
        self.task_id = task_id
        self.subtask_id = subtask_id

    async def execute(self, args: dict) -> str:
        command = args.get("command", "")
        if not command.strip():
            return "[ERROR] empty command"

        timeout = min(args.get("timeout", 60), self.MAX_TIMEOUT)

        try:
            exec_result = docker_client.api.exec_create(
                self.container_id,
                ["sh", "-c", command],
                workdir="/work",
                stdout=True,
                stderr=True,
            )
            exec_id = exec_result["Id"]
        except APIError as e:
            return f"[ERROR] Docker exec_create failed: {e}"

        output = ""
        try:
            # Stream output chunks
            gen = docker_client.api.exec_start(exec_id, stream=True)
            async def read_stream():
                nonlocal output
                for chunk in gen:
                    decoded = chunk.decode("utf-8", errors="replace")
                    output += decoded
                    # Stream to SSE hub for Agent Watch
                    await self.bridge.tool_output(
                        self.agent, "terminal", self.mission_id, decoded
                    )

            await asyncio.wait_for(read_stream(), timeout=timeout)

        except asyncio.TimeoutError:
            try:
                docker_client.api.exec_inspect(exec_id)
            except Exception:
                pass
            output += f"\n[TIMEOUT after {timeout}s]"

        except Exception as e:
            output += f"\n[ERROR] {e}"

        # Truncate large outputs — keep head + tail
        if len(output) > self.MAX_OUTPUT:
            half = self.MAX_OUTPUT // 2
            truncated = len(output) - self.MAX_OUTPUT
            output = output[:half] + f"\n[truncated {truncated} bytes]\n" + output[-half:]

        return output
```

- [ ] **Step 3: Implement barrier tools (done, ask)**

```python
# v2/app/engine/tools/barrier.py

class DoneTool:
    """Signals subtask completion."""
    async def execute(self, args: dict) -> str:
        result = args.get("result", "completed")
        success = args.get("success", True)
        return f"DONE:{result}" if success else f"FAILED:{result}"

class AskTool:
    """Pauses execution and asks the operator a question."""
    def __init__(self, pending_questions: dict):
        self.pending = pending_questions

    async def execute(self, args: dict) -> str:
        question = args.get("question", "")
        subtask_id = args.get("subtask_id")
        event = asyncio.Event()
        self.pending[subtask_id] = {"event": event, "response": None, "question": question}
        try:
            await asyncio.wait_for(event.wait(), timeout=3600)
            return self.pending[subtask_id]["response"] or "No response"
        except asyncio.TimeoutError:
            return "No response. Proceeding with best judgment."
        finally:
            self.pending.pop(subtask_id, None)
```

- [ ] **Step 4: Run test**

Run: `cd v2 && pytest tests/test_terminal.py -v`

- [ ] **Step 5: Commit**

Message: `feat(v2): terminal tool — Docker exec with SSE streaming + barrier tools`

---

### Task 1.4: ReAct Agent Loop

**Files:** `v2/app/engine/react_loop.py`, `v2/app/engine/monitor.py`

The core intelligence loop from PentAGI — reason→act→observe→repeat.

- [ ] **Step 1: Write test for execution monitor**

```python
# v2/tests/test_monitor.py
from app.engine.monitor import ExecutionMonitor

def test_same_tool_limit():
    monitor = ExecutionMonitor(same_tool_limit=3, total_limit=10)
    assert monitor.check("terminal") == "ok"
    assert monitor.check("terminal") == "ok"
    assert monitor.check("terminal") == "adviser"  # 3rd same tool

def test_total_limit():
    monitor = ExecutionMonitor(same_tool_limit=5, total_limit=3)
    assert monitor.check("tool1") == "ok"
    assert monitor.check("tool2") == "ok"
    assert monitor.check("tool3") == "abort"  # hit total
```

- [ ] **Step 2: Implement execution monitor**

```python
# v2/app/engine/monitor.py
from collections import Counter

class ExecutionMonitor:
    """Detects tool-call loops and runaway agents."""

    def __init__(self, same_tool_limit: int = 50, total_limit: int = 100):
        self.same_tool_limit = same_tool_limit
        self.total_limit = total_limit
        self.tool_counts = Counter()
        self.total_calls = 0

    def check(self, tool_name: str) -> str:
        self.tool_counts[tool_name] += 1
        self.total_calls += 1

        if self.total_calls >= self.total_limit:
            return "abort"
        if self.tool_counts[tool_name] >= self.same_tool_limit:
            return "adviser"
        return "ok"

    def reset(self):
        self.tool_counts.clear()
        self.total_calls = 0
```

- [ ] **Step 3: Implement ReAct loop**

```python
# v2/app/engine/react_loop.py
import time
from app.engine.monitor import ExecutionMonitor
from app.event_bridge import EventBridge

async def perform_react_loop(
    agent_codename: str,
    subtask: dict,
    chain: list[dict],
    tools: dict,
    model: str,
    event_bridge: EventBridge,
    mission_id: int,
    max_iterations: int = 100,
) -> str:
    """Core ReAct loop: Reason → Act → Observe → Repeat.

    Returns: "done" | "waiting" | "failed"
    """
    monitor = ExecutionMonitor(
        same_tool_limit=max_iterations // 2,
        total_limit=max_iterations,
    )

    for iteration in range(max_iterations):
        # Broadcast iteration to Agent Watch (T2 terminal)
        await event_bridge.react_iteration(
            agent=agent_codename,
            mission_id=mission_id,
            iteration=iteration,
            thought=f"Step {iteration + 1}/{max_iterations}",
        )

        # Near limit — invoke reflector
        if iteration >= max_iterations - 3:
            chain.append({
                "role": "system",
                "content": "You are near the iteration limit. Summarize progress and finish.",
            })

        # LLM call — get tool calls
        # NOTE: actual litellm integration wired in Task 1.5
        response = await _call_llm(chain, tools, model)

        if not response.get("tool_calls"):
            # No action — inject reflector prompt
            chain.append({
                "role": "system",
                "content": "No action taken. Decide next step or call 'done' to finish.",
            })
            continue

        for tool_call in response["tool_calls"]:
            tool_name = tool_call["name"]
            tool_args = tool_call.get("args", {})

            # Monitor check — detect loops
            intervention = monitor.check(tool_name)
            if intervention == "abort":
                return "failed"
            if intervention == "adviser":
                chain.append({
                    "role": "system",
                    "content": f"WARNING: Tool '{tool_name}' called {monitor.tool_counts[tool_name]} times. Consider a different approach.",
                })
                continue

            # Broadcast action to Agent Watch
            await event_bridge.react_iteration(
                agent=agent_codename,
                mission_id=mission_id,
                iteration=iteration,
                thought=f"Calling {tool_name}",
                action=tool_name,
            )

            # Execute tool
            tool = tools.get(tool_name)
            if not tool:
                chain.append({
                    "role": "tool",
                    "content": f"Unknown tool: {tool_name}",
                    "tool_call_id": tool_call.get("id", ""),
                })
                continue

            start = time.monotonic()
            result = await tool.execute(tool_args)
            duration = time.monotonic() - start

            # Barrier checks
            if tool_name == "done":
                return "done"
            if tool_name == "ask":
                return "waiting"

            # Summarize large outputs
            if len(result) > 16384:
                result = result[:8192] + f"\n[truncated to 16KB]\n" + result[-8192:]

            chain.append({
                "role": "tool",
                "content": result,
                "tool_call_id": tool_call.get("id", ""),
            })

        # Chain summarization if too long
        if len(chain) > 50:
            # Keep system prompt + last 10 messages
            chain = chain[:1] + chain[-10:]

    return "failed"  # max iterations reached


async def _call_llm(chain: list[dict], tools: dict, model: str) -> dict:
    """Placeholder for litellm integration — Task 1.5 wires this up."""
    # In Phase 1, returns empty tool_calls to test the loop structure.
    # Real implementation uses litellm.acompletion() with tool schemas.
    return {"tool_calls": []}
```

- [ ] **Step 4: Run tests**

Run: `cd v2 && pytest tests/test_monitor.py -v`

- [ ] **Step 5: Commit**

Message: `feat(v2): ReAct agent loop + execution monitor with loop detection`

---

### Task 1.5: LLM Integration (litellm)

**Files:** `v2/app/engine/llm.py`

Wire litellm for the actual LLM calls in the ReAct loop. litellm provides a unified interface across providers — same pattern as PentAGI's `performer.go`.

- [ ] **Step 1: Write test for LLM tool calling format**

```python
# v2/tests/test_llm.py
import pytest
from app.engine.llm import format_tools_for_llm

def test_format_tools():
    tools = {
        "terminal": {
            "description": "Execute command in container",
            "schema": {"command": "string", "timeout": "integer"},
        },
    }
    formatted = format_tools_for_llm(tools)
    assert len(formatted) == 1
    assert formatted[0]["type"] == "function"
    assert formatted[0]["function"]["name"] == "terminal"
```

- [ ] **Step 2: Implement LLM wrapper**

```python
# v2/app/engine/llm.py
import litellm
from app.config import settings
from app.event_bridge import event_bridge

async def call_llm_with_tools(
    chain: list[dict],
    tools: dict,
    model: str | None = None,
    agent_codename: str = "ORCHESTRATOR",
    mission_id: int = 0,
) -> dict:
    """Call LLM with tool schemas, return response with tool_calls."""
    model = model or settings.default_model
    formatted_tools = format_tools_for_llm(tools)

    response = await litellm.acompletion(
        model=model,
        messages=chain,
        tools=formatted_tools if formatted_tools else None,
        tool_choice="auto" if formatted_tools else None,
    )

    message = response.choices[0].message

    # Track token usage
    usage = response.usage
    if usage:
        await event_bridge.react_iteration(
            agent=agent_codename,
            mission_id=mission_id,
            iteration=0,
            thought=f"tokens: {usage.prompt_tokens}in/{usage.completion_tokens}out",
        )

    tool_calls = []
    if message.tool_calls:
        for tc in message.tool_calls:
            import json
            tool_calls.append({
                "id": tc.id,
                "name": tc.function.name,
                "args": json.loads(tc.function.arguments) if isinstance(tc.function.arguments, str) else tc.function.arguments,
            })

    # Add assistant message to chain
    chain.append({"role": "assistant", "content": message.content or "", "tool_calls": message.tool_calls})

    return {"tool_calls": tool_calls, "content": message.content, "usage": usage}


def format_tools_for_llm(tools: dict) -> list[dict]:
    """Convert tool registry to OpenAI function-calling format."""
    formatted = []
    for name, spec in tools.items():
        if isinstance(spec, dict) and "description" in spec:
            # Dict-based tool spec
            properties = {}
            required = []
            for param, ptype in spec.get("schema", {}).items():
                properties[param] = {"type": ptype}
                required.append(param)

            formatted.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": spec["description"],
                    "parameters": {
                        "type": "object",
                        "properties": properties,
                        "required": required,
                    },
                },
            })
        elif hasattr(spec, "get_schema"):
            # Object-based tool with schema method
            formatted.append(spec.get_schema())

    return formatted
```

- [ ] **Step 3: Wire real LLM into react_loop.py**

Replace `_call_llm` placeholder with import from `app.engine.llm`:

```python
from app.engine.llm import call_llm_with_tools

# In perform_react_loop, replace the _call_llm call:
response = await call_llm_with_tools(chain, tools, model, agent_codename, mission_id)
```

- [ ] **Step 4: Run test**

Run: `cd v2 && pytest tests/test_llm.py -v`

- [ ] **Step 5: Commit**

Message: `feat(v2): litellm integration — unified LLM calls with tool calling`

---

### Task 1.6: Mission Executor (Orchestrates Everything)

**Files:** `v2/app/engine/executor.py`, `v2/app/routers/missions.py` (add start endpoint)

This ties scheduler + react_loop + terminal_tool + event_bridge together.

- [ ] **Step 1: Write test for mission executor**

```python
# v2/tests/test_executor.py
import pytest
from app.engine.scheduler import topological_sort, find_ready_tasks

@pytest.mark.asyncio
async def test_mission_lifecycle():
    """Verify mission goes through created → planning → running → finished."""
    # This is an integration test — requires DB + Docker
    # Runs with: pytest tests/test_executor.py -v --run-integration
    pass  # Placeholder — real test added after Docker wiring
```

- [ ] **Step 2: Implement mission executor**

```python
# v2/app/engine/executor.py
import asyncio
import docker
from app.engine.scheduler import find_ready_tasks
from app.engine.react_loop import perform_react_loop
from app.engine.tools.terminal import TerminalTool
from app.engine.tools.barrier import DoneTool, AskTool
from app.event_bridge import event_bridge
from app.config import settings

# Agent configurations — which tools each agent gets
AGENT_CONFIG = {
    "ORCHESTRATOR": {"max_iterations": 100, "docker_image": None},
    "PATHFINDER":   {"max_iterations": 100, "docker_image": "harbinger/pd-tools:latest"},
    "BREACH":       {"max_iterations": 100, "docker_image": "harbinger/pd-tools:latest"},
    "SAM":          {"max_iterations": 100, "docker_image": "harbinger/dev-tools:latest"},
    "SCRIBE":       {"max_iterations": 20,  "docker_image": "harbinger/base:latest"},
    "MAINTAINER":   {"max_iterations": 100, "docker_image": "harbinger/dev-tools:latest"},
    "PHANTOM":      {"max_iterations": 100, "docker_image": "harbinger/base:latest"},
    "SPECTER":      {"max_iterations": 100, "docker_image": "harbinger/osint-tools:latest"},
    "CIPHER":       {"max_iterations": 100, "docker_image": "harbinger/base:latest"},
    "SAGE":         {"max_iterations": 20,  "docker_image": "harbinger/base:latest"},
    "BRIEF":        {"max_iterations": 20,  "docker_image": "harbinger/base:latest"},
}

docker_client = docker.DockerClient(base_url=settings.docker_socket)

async def spawn_agent_container(mission_id: int, task: dict, config: dict) -> str | None:
    """Spawn a Docker container for an agent task. Returns container_id."""
    image = task.get("docker_image") or config.get("docker_image")
    if not image:
        return None  # Agent runs in-process (ORCHESTRATOR)

    try:
        container = docker_client.containers.run(
            image,
            command="sleep infinity",  # Keep alive for exec
            name=f"harbinger-{task['agent_codename'].lower()}-{mission_id}-{task['id']}",
            detach=True,
            remove=True,
            network_mode="harbinger_harbinger",  # Same Docker network
            labels={
                "harbinger.mission": str(mission_id),
                "harbinger.task": str(task["id"]),
                "harbinger.agent": task["agent_codename"],
            },
        )
        return container.id
    except Exception as e:
        await event_bridge.task_update(
            task["id"], mission_id, task["agent_codename"], "failed",
            error=str(e),
        )
        return None


async def execute_mission(mission_id: int, tasks: list[dict], autonomy_level: str = "supervised"):
    """Execute a mission by scheduling tasks in DAG order, running them in parallel."""
    completed: set[int] = set()
    failed: set[int] = set()
    running: dict[int, asyncio.Task] = {}

    await event_bridge.mission_update(mission_id, "running")

    while len(completed) + len(failed) < len(tasks):
        ready = find_ready_tasks(
            [t for t in tasks if t["id"] not in completed and t["id"] not in failed],
            completed,
        )

        for task in ready:
            if task["id"] in running:
                continue

            # Approval gate
            if task.get("approval_required") and autonomy_level in ("manual", "supervised"):
                await event_bridge.task_update(
                    task["id"], mission_id, task["agent_codename"], "waiting",
                    reason="approval_required",
                )
                continue

            # Queue the task for execution
            task["status"] = "running"
            await event_bridge.task_update(
                task["id"], mission_id, task["agent_codename"], "running",
            )

            running[task["id"]] = asyncio.create_task(
                _execute_task_with_recovery(task, mission_id)
            )

        if running:
            done, _ = await asyncio.wait(
                running.values(), return_when=asyncio.FIRST_COMPLETED
            )
            for future in done:
                tid = _find_task_id(future, running)
                if tid is None:
                    continue
                try:
                    await future
                    completed.add(tid)
                    await event_bridge.task_update(
                        tid, mission_id, tasks[tid - 1]["agent_codename"] if tid <= len(tasks) else "unknown", "finished",
                    )
                except Exception as e:
                    failed.add(tid)
                    await event_bridge.task_update(
                        tid, mission_id, "unknown", "failed", error=str(e),
                    )
                running.pop(tid, None)
        else:
            await asyncio.sleep(1)

    final_status = "finished" if not failed else "failed"
    await event_bridge.mission_update(mission_id, final_status)


async def _execute_task_with_recovery(task: dict, mission_id: int, max_retries: int = 3):
    """Execute a single task with container recovery on failure."""
    config = AGENT_CONFIG.get(task["agent_codename"], AGENT_CONFIG["ORCHESTRATOR"])

    for attempt in range(max_retries):
        try:
            container_id = await spawn_agent_container(mission_id, task, config)

            # Build tool set for this agent
            pending_questions: dict = {}
            tools = {"done": DoneTool(), "ask": AskTool(pending_questions)}
            if container_id:
                tools["terminal"] = TerminalTool(
                    container_id=container_id,
                    agent_codename=task["agent_codename"],
                    mission_id=mission_id,
                    event_bridge=event_bridge,
                    task_id=task["id"],
                )

            # Run the ReAct loop
            chain = [
                {"role": "system", "content": f"You are {task['agent_codename']}. {task.get('description', '')}"},
                {"role": "user", "content": task.get("input", task["title"])},
            ]

            result = await perform_react_loop(
                agent_codename=task["agent_codename"],
                subtask={"id": task["id"], "title": task["title"]},
                chain=chain,
                tools=tools,
                model=settings.default_model,
                event_bridge=event_bridge,
                mission_id=mission_id,
                max_iterations=config["max_iterations"],
            )

            # Cleanup container
            if container_id:
                try:
                    docker_client.containers.get(container_id).stop(timeout=10)
                except Exception:
                    pass

            if result == "failed" and attempt < max_retries - 1:
                continue
            return result

        except Exception as e:
            if attempt >= max_retries - 1:
                raise


def _find_task_id(future: asyncio.Task, running: dict) -> int | None:
    for tid, task in running.items():
        if task is future:
            return tid
    return None
```

- [ ] **Step 3: Add mission start endpoint**

Add to `v2/app/routers/missions.py`:

```python
@router.post("/{mission_id}/start")
async def start_mission(
    mission_id: int,
    db: AsyncSession = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
):
    mission = await db.get(Mission, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="mission not found")

    # Get all tasks for this mission
    result = await db.execute(
        select(Task).where(Task.mission_id == mission_id).order_by(Task.position)
    )
    tasks_orm = result.scalars().all()
    if not tasks_orm:
        raise HTTPException(status_code=400, detail="mission has no tasks")

    # Queue all tasks
    for t in tasks_orm:
        t.status = TaskStatus.queued
    mission.status = MissionStatus.running
    await db.commit()

    # Convert to dicts for scheduler
    tasks = [
        {
            "id": t.id, "title": t.title, "description": t.description,
            "agent_codename": t.agent_codename, "docker_image": t.docker_image,
            "depends_on": t.depends_on or [], "approval_required": t.approval_required,
            "input": t.input, "status": "queued",
        }
        for t in tasks_orm
    ]

    # Fire and forget — mission runs in background
    import asyncio
    from app.engine.executor import execute_mission
    asyncio.create_task(execute_mission(mission_id, tasks, mission.autonomy_level))

    return {"ok": True, "mission_id": mission_id, "status": "running", "tasks": len(tasks)}
```

- [ ] **Step 4: Commit**

Message: `feat(v2): mission executor — DAG scheduling, parallel tasks, container recovery`

---

### Task 1.7: Frontend v2 Event Types (T2 Responsibility)

**Files:** `harbinger-tools/frontend/src/api/realtime.ts`, `harbinger-tools/frontend/src/store/realtimeStore.ts`

Wire the frontend to receive and filter v2 events from the SSE hub.

- [ ] **Step 1: Add v2 event types to TypeScript interface**

In `api/realtime.ts`, update the `RealtimeEvent` type:

```typescript
export interface RealtimeEvent {
  id: string
  type:
    | 'agent_status' | 'command_output' | 'implant_callback'
    | 'chain_progress' | 'operator_action' | 'system_alert'
    // v2 execution engine events
    | 'mission_update' | 'task_update' | 'subtask_update'
    | 'action_update' | 'tool_output' | 'react_iteration'
  source: string
  target: string
  channel: string
  payload: Record<string, unknown>
  timestamp: string
}
```

- [ ] **Step 2: Add v2 filtered accessors to realtimeStore**

```typescript
// Add to RealtimeState interface:
missionEvents: RealtimeEvent[]
agentActivity: Map<string, RealtimeEvent[]>  // keyed by agent codename

// Add computed getters:
getMissionEvents: (missionId: number) => RealtimeEvent[]
getAgentActivity: (agent: string) => RealtimeEvent[]
```

- [ ] **Step 3: Add SSE channel subscription for agent filtering**

The SSE endpoint already supports `?channel=agent:BREACH` — wire this into the store so Agent Watch can filter by agent.

- [ ] **Step 4: Build**

Run: `pnpm build:ui`
Expected: Clean build

- [ ] **Step 5: Commit**

Message: `feat(frontend): add v2 execution engine event types to realtime store`

---

## Verification Checklist

After completing all tasks:

- [ ] `docker compose up --build` — all services start cleanly
- [ ] FastAPI docs at `http://localhost:8090/docs` — shows mission/task endpoints
- [ ] Go health at `http://localhost:8080/health` — returns ok
- [ ] `POST /api/v2/missions` creates a mission and emits SSE event
- [ ] `POST /api/v2/missions/{id}/tasks` creates tasks with DAG validation
- [ ] `POST /api/v2/missions/{id}/start` kicks off the mission executor
- [ ] SSE stream at `/api/realtime/stream?channel=missions` shows mission_update events
- [ ] SSE stream at `/api/realtime/stream?channel=agent:PATHFINDER` shows agent-specific events
- [ ] Terminal tool executes commands in Docker containers
- [ ] ReAct loop calls LLM and executes tools in sequence
- [ ] Frontend builds cleanly with new event types

---

## What Comes Next

| Phase | What | Depends On |
|-------|------|------------|
| Phase 2 | ROAR Protocol + Channel Adapters | Phase 0 (event bridge) |
| Phase 3 | Docker Agent Images | Phase 1 (container spawning) |
| Phase 4 | Full Tool Layer (search, browser, memory) | Phase 1 (tool registry) |
| Phase 5 | Self-Healing Monitor | Phase 1 (container health) |
| Phase 6 | Observability (Langfuse + metrics) | Phase 1 (action logging) |
| Phase 7 | Frontend — Mission Control, Agent Watch, War Room | Phase 1 (SSE events) |
