# Harbinger v2.0 Phase 0+1: Foundation + Execution Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a FastAPI sidecar alongside the existing Go backend, then build the core execution engine (Mission->Task->SubTask->Action with ReAct loop and terminal tool).

**Architecture:** FastAPI runs as `backend-py` service in docker-compose on :8000. Nginx routes `/api/v2/*` to FastAPI, everything else stays on Go (:8080). Shared PostgreSQL, Redis, and JWT secret. The execution engine implements PentAGI's Flow pattern: missions decompose into tasks, tasks decompose into subtasks, subtasks execute via ReAct agent chain with tool calling.

**Tech Stack:** Python 3.12, FastAPI, asyncpg, SQLAlchemy (async), Alembic, Docker API (httpx), pytest, uvicorn

**Spec:** `docs/superpowers/specs/2026-03-22-harbinger-v2-autonomous-os-design.md`

---

## File Structure

### New Files (Phase 0 — FastAPI Sidecar)

```
prowlrbot-engine/
├── Dockerfile                          # Python 3.12, uvicorn, production-ready
├── pyproject.toml                      # Dependencies: fastapi, asyncpg, httpx, pyjwt
├── alembic.ini                         # Database migrations config
├── migrations/
│   ├── env.py                          # Alembic environment (async engine)
│   └── versions/
│       └── 001_missions_schema.py      # Mission/Task/SubTask/Action tables
├── src/
│   ├── __init__.py
│   ├── main.py                         # FastAPI app, lifespan, router registration
│   ├── config.py                       # Environment-based config (matches Go patterns)
│   ├── db.py                           # asyncpg connection pool
│   ├── auth.py                         # JWT validation (reads Go-issued tokens)
│   ├── routers/
│   │   ├── __init__.py
│   │   └── health.py                   # GET /health, GET /api/v2/health
│   └── models/
│       ├── __init__.py
│       └── base.py                     # SQLAlchemy async base
└── tests/
    ├── __init__.py
    ├── conftest.py                     # pytest fixtures (test DB, test client)
    └── test_health.py                  # Health endpoint tests
```

### New Files (Phase 1 — Execution Engine)

```
prowlrbot-engine/src/
├── routers/
│   ├── missions.py                     # Mission CRUD + lifecycle
│   ├── tasks.py                        # Task management + status
│   └── tools.py                        # Tool execution API
├── engine/
│   ├── __init__.py
│   ├── scheduler.py                    # Mission DAG scheduler (parallel tasks)
│   ├── executor.py                     # Task executor (spawns container, runs agent)
│   ├── performer.py                    # ReAct agent chain loop
│   ├── monitor.py                      # Execution monitor (loop detection)
│   ├── summarizer.py                   # Output + chain summarization
│   └── tools/
│       ├── __init__.py
│       ├── registry.py                 # Tool registry with schemas
│       ├── terminal.py                 # Docker exec terminal tool
│       ├── file_tool.py                # File read/write in container
│       └── barriers.py                 # done + ask barrier tools
├── docker/
│   ├── __init__.py
│   └── client.py                       # Docker API client (via socket proxy)
├── models/
│   ├── mission.py                      # Mission SQLAlchemy model
│   ├── task.py                         # Task model
│   ├── subtask.py                      # SubTask model
│   └── action.py                       # Action (tool call) model
└── tests/
    ├── test_missions.py
    ├── test_scheduler.py
    ├── test_performer.py
    ├── test_terminal_tool.py
    └── test_docker_client.py
```

### Modified Files

```
docker-compose.yml                      # Add backend-py service
docker/nginx/nginx.conf                 # Add /api/v2/* → backend-py:8000
```

---

## PHASE 0: FASTAPI SIDECAR (Tasks 1-6)

### Task 1: Python Project Skeleton

**Files:**
- Create: `prowlrbot-engine/pyproject.toml`
- Create: `prowlrbot-engine/src/__init__.py`
- Create: `prowlrbot-engine/src/config.py`

- [ ] **Step 1: Create pyproject.toml**

```bash
mkdir -p prowlrbot-engine/src prowlrbot-engine/tests
```

Write `prowlrbot-engine/pyproject.toml`:
```toml
[project]
name = "harbinger-engine"
version = "2.0.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "asyncpg>=0.30.0",
    "sqlalchemy[asyncio]>=2.0.36",
    "alembic>=1.14.0",
    "pyjwt[crypto]>=2.10.0",
    "httpx>=0.28.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.7.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.24.0",
    "httpx>=0.28.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Create config.py**

Write `prowlrbot-engine/src/config.py`:
```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database (same as Go backend)
    db_host: str = "postgres"
    db_port: int = 5432
    db_name: str = "harbinger"
    db_user: str = "harbinger"
    db_password: str = ""
    db_sslmode: str = "disable"

    # Redis
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_password: str = ""

    # Auth (shared with Go)
    jwt_secret: str = ""

    # Docker
    docker_host: str = "tcp://docker-proxy:2375"
    docker_network: str = "harbinger_harbinger-network"

    # Server
    port: int = 8000
    app_env: str = "development"
    log_level: str = "info"

    # Ollama
    ollama_url: str = "http://host.docker.internal:11434"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    class Config:
        env_prefix = ""
        case_sensitive = False


settings = Settings()
```

- [ ] **Step 3: Create empty init files**

Write `prowlrbot-engine/src/__init__.py`: empty file.
Write `prowlrbot-engine/tests/__init__.py`: empty file.

- [ ] **Step 4: Verify project structure**

```bash
ls -la prowlrbot-engine/
ls -la prowlrbot-engine/src/
cat prowlrbot-engine/pyproject.toml
```

Expected: pyproject.toml, src/ with config.py and __init__.py, tests/

- [ ] **Step 5: Commit**

```bash
git add prowlrbot-engine/
git commit -m "feat(engine): scaffold Python project skeleton with config"
```

---

### Task 2: Database Connection + Health Endpoint

**Files:**
- Create: `prowlrbot-engine/src/db.py`
- Create: `prowlrbot-engine/src/main.py`
- Create: `prowlrbot-engine/src/routers/__init__.py`
- Create: `prowlrbot-engine/src/routers/health.py`
- Create: `prowlrbot-engine/tests/conftest.py`
- Create: `prowlrbot-engine/tests/test_health.py`

- [ ] **Step 1: Write the failing test**

Write `prowlrbot-engine/tests/conftest.py`:
```python
import pytest
from httpx import ASGITransport, AsyncClient

from src.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

Write `prowlrbot-engine/tests/test_health.py`:
```python
import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("ok", "degraded")
    assert data["service"] == "harbinger-engine"


@pytest.mark.asyncio
async def test_api_v2_health(client):
    resp = await client.get("/api/v2/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "harbinger-engine"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd prowlrbot-engine && pip install -e ".[dev]" && pytest tests/test_health.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'src.main'`

- [ ] **Step 3: Write db.py**

Write `prowlrbot-engine/src/db.py`:
```python
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from src.config import settings

engine: AsyncEngine | None = None
async_session: async_sessionmaker | None = None


async def init_db():
    global engine, async_session
    try:
        engine = create_async_engine(
            settings.database_url,
            pool_size=10,
            max_overflow=5,
            pool_timeout=30,
            pool_recycle=300,
            echo=settings.app_env == "development",
        )
        # Verify connection
        async with engine.begin() as conn:
            await conn.execute(
                __import__("sqlalchemy").text("SELECT 1")
            )
        async_session = async_sessionmaker(engine, expire_on_commit=False)
    except Exception as e:
        print(f"[DB] Connection failed, running degraded: {e}")
        engine = None
        async_session = None


async def close_db():
    global engine
    if engine:
        await engine.dispose()


def db_available() -> bool:
    return engine is not None
```

- [ ] **Step 4: Write health router**

Write `prowlrbot-engine/src/routers/__init__.py`: empty file.

Write `prowlrbot-engine/src/routers/health.py`:
```python
from fastapi import APIRouter

from src.db import db_available

router = APIRouter()


@router.get("/health")
@router.get("/api/v2/health")
async def health():
    status = "ok" if db_available() else "degraded"
    checks = {"status": status, "service": "harbinger-engine"}

    if db_available():
        checks["postgres"] = "connected"
    else:
        checks["postgres"] = "disconnected"

    status_code = 200 if status == "ok" else 503
    from fastapi.responses import JSONResponse

    return JSONResponse(checks, status_code=status_code)
```

- [ ] **Step 5: Write main.py**

Write `prowlrbot-engine/src/main.py`:
```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.db import close_db, init_db
from src.routers.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Harbinger Engine",
        description="Autonomous Security Operating System — Execution Engine",
        version="2.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)

    return app


app = create_app()
```

- [ ] **Step 6: Run tests**

```bash
cd prowlrbot-engine && pytest tests/test_health.py -v
```

Expected: 2 PASSED (health returns "degraded" since no real DB in test)

- [ ] **Step 7: Commit**

```bash
git add prowlrbot-engine/
git commit -m "feat(engine): FastAPI app with health endpoint and DB connection"
```

---

### Task 3: JWT Auth Middleware

**Files:**
- Create: `prowlrbot-engine/src/auth.py`
- Create: `prowlrbot-engine/tests/test_auth.py`

- [ ] **Step 1: Write the failing test**

Write `prowlrbot-engine/tests/test_auth.py`:
```python
import jwt
import pytest
from datetime import datetime, timedelta, timezone

TEST_SECRET = "test-jwt-secret-for-harbinger-engine"


def make_token(payload: dict, secret: str = TEST_SECRET) -> str:
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.mark.asyncio
async def test_protected_route_rejects_no_token(client):
    resp = await client.get("/api/v2/protected-test")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_accepts_valid_token(client):
    token = make_token({
        "sub": "user-123",
        "exp": (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp(),
    })
    resp = await client.get(
        "/api/v2/protected-test",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["user_id"] == "user-123"


@pytest.mark.asyncio
async def test_protected_route_rejects_expired_token(client):
    token = make_token({
        "sub": "user-123",
        "exp": (datetime.now(timezone.utc) - timedelta(hours=1)).timestamp(),
    })
    resp = await client.get(
        "/api/v2/protected-test",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd prowlrbot-engine && pytest tests/test_auth.py -v
```

Expected: FAIL — no `/api/v2/protected-test` route

- [ ] **Step 3: Write auth.py**

Write `prowlrbot-engine/src/auth.py`:
```python
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request


def get_jwt_secret() -> str:
    from src.config import settings
    return settings.jwt_secret


async def get_current_user(request: Request) -> dict:
    """Validate JWT token from Authorization header. Compatible with Go-issued tokens."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = auth_header[7:]
    secret = get_jwt_secret()

    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing sub")

    return {"user_id": user_id, "claims": payload}


CurrentUser = Annotated[dict, Depends(get_current_user)]
```

- [ ] **Step 4: Add test route and update conftest**

Update `prowlrbot-engine/tests/conftest.py` — replace the `app` fixture:
```python
import os
import pytest
from httpx import ASGITransport, AsyncClient

os.environ["JWT_SECRET"] = "test-jwt-secret-for-harbinger-engine"

from src.main import create_app
from src.auth import CurrentUser
from fastapi import APIRouter

test_router = APIRouter()


@test_router.get("/api/v2/protected-test")
async def protected_test(user: CurrentUser):
    return {"user_id": user["user_id"]}


@pytest.fixture
def app():
    application = create_app()
    application.include_router(test_router)
    return application


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

- [ ] **Step 5: Run tests**

```bash
cd prowlrbot-engine && pytest tests/test_auth.py -v
```

Expected: 3 PASSED

- [ ] **Step 6: Commit**

```bash
git add prowlrbot-engine/src/auth.py prowlrbot-engine/tests/
git commit -m "feat(engine): JWT auth middleware compatible with Go-issued tokens"
```

---

### Task 4: Dockerfile

**Files:**
- Create: `prowlrbot-engine/Dockerfile`

- [ ] **Step 1: Write Dockerfile**

Write `prowlrbot-engine/Dockerfile`:
```dockerfile
FROM python:3.12-slim AS base

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Copy source
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY alembic.ini ./

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--workers", "1"]
```

- [ ] **Step 2: Create placeholder alembic files**

```bash
mkdir -p prowlrbot-engine/migrations/versions
```

Write `prowlrbot-engine/alembic.ini`:
```ini
[alembic]
script_location = migrations
sqlalchemy.url = driver://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic
[handlers]
keys = console
[formatters]
keys = generic
[logger_root]
level = WARN
handlers = console
[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine
[logger_alembic]
level = INFO
handlers =
qualname = alembic
[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic
[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

Write `prowlrbot-engine/migrations/env.py`:
```python
from alembic import context
from sqlalchemy import engine_from_config, pool
import os

config = context.config
config.set_main_option(
    "sqlalchemy.url",
    os.getenv("DATABASE_URL", "postgresql://harbinger:harbinger@localhost/harbinger"),
)


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=None)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
```

- [ ] **Step 3: Verify Dockerfile builds**

```bash
cd prowlrbot-engine && docker build -t harbinger-engine:test .
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add prowlrbot-engine/Dockerfile prowlrbot-engine/alembic.ini prowlrbot-engine/migrations/
git commit -m "feat(engine): Dockerfile and Alembic migration scaffold"
```

---

### Task 5: Add backend-py to docker-compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add backend-py service**

Add this service block to `docker-compose.yml` after the existing `backend` service (around line 200):

```yaml
  backend-py:
    build:
      context: ./prowlrbot-engine
      dockerfile: Dockerfile
    container_name: harbinger-engine
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=${DB_NAME:-harbinger}
      - DB_USER=${DB_USER:-harbinger}
      - DB_PASSWORD=${DB_PASSWORD:?DB_PASSWORD is required}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD:?REDIS_PASSWORD is required}
      - JWT_SECRET=${JWT_SECRET:?JWT_SECRET is required}
      - DOCKER_HOST=tcp://docker-proxy:2375
      - DOCKER_NETWORK=harbinger_harbinger-network
      - OLLAMA_URL=${OLLAMA_URL:-http://host.docker.internal:11434}
      - APP_ENV=${APP_ENV:-production}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    networks:
      - harbinger-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8000/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"
    deploy:
      resources:
        limits:
          cpus: "4.0"
          memory: 4G
        reservations:
          cpus: "0.5"
          memory: 512M
```

- [ ] **Step 2: Verify service starts**

```bash
docker compose build backend-py && docker compose up -d backend-py
docker compose logs backend-py --tail 20
```

Expected: `Uvicorn running on http://0.0.0.0:8000`

- [ ] **Step 3: Test health from within network**

```bash
docker compose exec backend-py wget -qO- http://localhost:8000/health
```

Expected: `{"status":"ok","service":"harbinger-engine","postgres":"connected"}`

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): add backend-py (FastAPI engine) to compose stack"
```

---

### Task 6: Nginx Route Splitting

**Files:**
- Modify: `docker/nginx/nginx.conf`

- [ ] **Step 1: Add backend-py upstream and /api/v2/ location**

In `docker/nginx/nginx.conf`, add after the existing `upstream backend` block:

```nginx
upstream backend_py {
    server backend-py:8000;
    keepalive 32;
}
```

Add these location blocks BEFORE the existing `location /api/` block (order matters — nginx picks longest prefix match):

```nginx
    # === FastAPI Engine (v2 API) ===
    location /api/v2/ {
        limit_req zone=api_general burst=50 nodelay;
        proxy_pass http://backend_py;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_connect_timeout 30s;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # SSE streams from FastAPI (buffering off)
    location ~ ^/api/v2/.*/stream$ {
        proxy_pass http://backend_py;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 3600s;
    }

    # WebSocket from FastAPI
    location /ws/v2/ {
        proxy_pass http://backend_py;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
```

Also add `backend-py` to nginx's `depends_on` in docker-compose.yml:
```yaml
  nginx:
    depends_on:
      frontend:
        condition: service_healthy
      backend:
        condition: service_healthy
      backend-py:
        condition: service_healthy
```

- [ ] **Step 2: Reload nginx and test**

```bash
docker compose up -d nginx --force-recreate
curl -s http://localhost:8980/api/v2/health | python3 -m json.tool
```

Expected: `{"status": "ok", "service": "harbinger-engine", "postgres": "connected"}`

- [ ] **Step 3: Verify Go backend still works**

```bash
curl -s http://localhost:8980/api/health | python3 -m json.tool
```

Expected: Go health response (unchanged).

- [ ] **Step 4: Commit**

```bash
git add docker/nginx/nginx.conf docker-compose.yml
git commit -m "feat(nginx): route /api/v2/* to FastAPI engine, SSE + WebSocket support"
```

---

## PHASE 1: EXECUTION ENGINE (Tasks 7-14)

### Task 7: Database Schema — Missions & Tasks

**Files:**
- Create: `prowlrbot-engine/src/models/base.py`
- Create: `prowlrbot-engine/src/models/__init__.py`
- Create: `prowlrbot-engine/src/models/mission.py`
- Create: `prowlrbot-engine/src/models/task.py`
- Create: `prowlrbot-engine/src/models/subtask.py`
- Create: `prowlrbot-engine/src/models/action.py`
- Create: `prowlrbot-engine/migrations/versions/001_missions_schema.py`
- Create: `prowlrbot-engine/tests/test_missions.py`

- [ ] **Step 1: Write the failing test**

Write `prowlrbot-engine/tests/test_missions.py`:
```python
import pytest


@pytest.mark.asyncio
async def test_create_mission(client):
    resp = await client.post("/api/v2/missions", json={
        "title": "Test pentest",
        "target": "example.com",
        "mission_type": "full_pentest",
    })
    # Will fail initially — no route exists yet
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test pentest"
    assert data["status"] == "created"
    assert data["id"] is not None


@pytest.mark.asyncio
async def test_list_missions(client):
    resp = await client.get("/api/v2/missions")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_mission(client):
    # Create first
    create_resp = await client.post("/api/v2/missions", json={
        "title": "Get test",
        "target": "test.com",
    })
    mission_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v2/missions/{mission_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Get test"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd prowlrbot-engine && pytest tests/test_missions.py -v
```

Expected: FAIL — 404 (no route)

- [ ] **Step 3: Write SQLAlchemy models**

Write `prowlrbot-engine/src/models/__init__.py`:
```python
from src.models.base import Base
from src.models.mission import Mission
from src.models.task import Task
from src.models.subtask import SubTask
from src.models.action import Action

__all__ = ["Base", "Mission", "Task", "SubTask", "Action"]
```

Write `prowlrbot-engine/src/models/base.py`:
```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

Write `prowlrbot-engine/src/models/mission.py`:
```python
from datetime import datetime, timezone
from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="created")
    mission_type: Mapped[str] = mapped_column(String(50), nullable=False, default="custom")
    target: Mapped[str | None] = mapped_column(String(500))
    scope: Mapped[dict | None] = mapped_column(JSONB)
    autonomy_level: Mapped[str] = mapped_column(String(20), default="supervised")
    trace_id: Mapped[str | None] = mapped_column(String(200))
    user_id: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tasks: Mapped[list["Task"]] = relationship(back_populates="mission", cascade="all, delete-orphan")
```

Write `prowlrbot-engine/src/models/task.py`:
```python
from datetime import datetime
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    mission_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("missions.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="created")
    agent_codename: Mapped[str] = mapped_column(String(50), nullable=False)
    docker_image: Mapped[str] = mapped_column(String(200), default="harbinger/base:latest")
    container_id: Mapped[str | None] = mapped_column(String(100))
    depends_on: Mapped[list | None] = mapped_column(JSONB, default=list)
    approval_required: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    input: Mapped[str | None] = mapped_column(Text)
    result: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    mission: Mapped["Mission"] = relationship(back_populates="tasks")
    subtasks: Mapped[list["SubTask"]] = relationship(back_populates="task", cascade="all, delete-orphan")
```

Write `prowlrbot-engine/src/models/subtask.py`:
```python
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base


class SubTask(Base):
    __tablename__ = "subtasks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="created")
    result: Mapped[str | None] = mapped_column(Text)
    context: Mapped[str | None] = mapped_column(Text)
    msg_chain_id: Mapped[int | None] = mapped_column(BigInteger)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    task: Mapped["Task"] = relationship(back_populates="subtasks")
    actions: Mapped[list["Action"]] = relationship(back_populates="subtask", cascade="all, delete-orphan")
```

Write `prowlrbot-engine/src/models/action.py`:
```python
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base


class Action(Base):
    __tablename__ = "actions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    subtask_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("subtasks.id", ondelete="CASCADE"), nullable=False)
    call_id: Mapped[str | None] = mapped_column(String(200))
    tool_name: Mapped[str] = mapped_column(String(100), nullable=False)
    args: Mapped[dict] = mapped_column(JSONB, nullable=False)
    result: Mapped[str | None] = mapped_column(Text)
    result_format: Mapped[str] = mapped_column(String(20), default="markdown")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="received")
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    mission_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    task_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    subtask: Mapped["SubTask"] = relationship(back_populates="actions")
```

- [ ] **Step 4: Write mission router**

Write `prowlrbot-engine/src/routers/missions.py`:
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from src.db import async_session, db_available
from src.models.mission import Mission

router = APIRouter(prefix="/api/v2/missions", tags=["missions"])


class MissionCreate(BaseModel):
    title: str
    description: str | None = None
    target: str | None = None
    mission_type: str = "custom"
    autonomy_level: str = "supervised"
    scope: dict | None = None


class MissionResponse(BaseModel):
    id: int
    title: str
    description: str | None
    status: str
    mission_type: str
    target: str | None
    autonomy_level: str

    class Config:
        from_attributes = True


@router.post("", status_code=201, response_model=MissionResponse)
async def create_mission(body: MissionCreate):
    if not db_available():
        raise HTTPException(503, "Database not available")

    async with async_session() as session:
        mission = Mission(
            title=body.title,
            description=body.description,
            target=body.target,
            mission_type=body.mission_type,
            autonomy_level=body.autonomy_level,
            scope=body.scope,
            user_id="system",  # TODO: from JWT
        )
        session.add(mission)
        await session.commit()
        await session.refresh(mission)
        return mission


@router.get("", response_model=list[MissionResponse])
async def list_missions():
    if not db_available():
        return []

    async with async_session() as session:
        result = await session.execute(
            select(Mission).order_by(Mission.created_at.desc()).limit(100)
        )
        return result.scalars().all()


@router.get("/{mission_id}", response_model=MissionResponse)
async def get_mission(mission_id: int):
    if not db_available():
        raise HTTPException(503, "Database not available")

    async with async_session() as session:
        mission = await session.get(Mission, mission_id)
        if not mission:
            raise HTTPException(404, "Mission not found")
        return mission
```

- [ ] **Step 5: Register router in main.py**

Add to `prowlrbot-engine/src/main.py` after the health router import:
```python
from src.routers.missions import router as missions_router
```

And in `create_app()`:
```python
    app.include_router(missions_router)
```

- [ ] **Step 6: Create tables on startup**

Update the lifespan in `prowlrbot-engine/src/main.py` startup section:
```python
    # Startup
    await init_db()
    # Create tables if they don't exist
    from src.db import engine
    from src.models import Base
    if engine:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
```

- [ ] **Step 7: Run tests**

```bash
cd prowlrbot-engine && pytest tests/test_missions.py -v
```

Note: These tests need a real DB. For CI, update conftest to use SQLite or skip.
For now, test manually against Docker:

```bash
docker compose up -d backend-py
curl -s -X POST http://localhost:8980/api/v2/missions \
  -H "Content-Type: application/json" \
  -d '{"title":"Test pentest","target":"example.com","mission_type":"full_pentest"}' | python3 -m json.tool
```

Expected: `{"id":1,"title":"Test pentest","status":"created",...}`

- [ ] **Step 8: Commit**

```bash
git add prowlrbot-engine/src/models/ prowlrbot-engine/src/routers/missions.py prowlrbot-engine/tests/
git commit -m "feat(engine): Mission CRUD with SQLAlchemy models and /api/v2/missions endpoints"
```

---

### Task 8: Docker Client (for spawning agent containers)

**Files:**
- Create: `prowlrbot-engine/src/docker/__init__.py`
- Create: `prowlrbot-engine/src/docker/client.py`
- Create: `prowlrbot-engine/tests/test_docker_client.py`

- [ ] **Step 1: Write the failing test**

Write `prowlrbot-engine/tests/test_docker_client.py`:
```python
import pytest
from unittest.mock import AsyncMock, patch

from src.docker.client import DockerClient


@pytest.mark.asyncio
async def test_docker_client_ping():
    """Test that DockerClient can construct API URLs correctly."""
    client = DockerClient(host="tcp://localhost:2375")
    assert client.base_url == "http://localhost:2375"


@pytest.mark.asyncio
async def test_docker_client_builds_container_config():
    """Test container config generation for agent tasks."""
    client = DockerClient(host="tcp://localhost:2375", network="test-net")
    config = client.build_container_config(
        image="harbinger/pd-tools:latest",
        name="harbinger-m1-pathfinder-t1",
        env={"MISSION_ID": "1", "AGENT": "PATHFINDER"},
        workspace="/data/workspace/missions/1",
    )

    assert config["Image"] == "harbinger/pd-tools:latest"
    assert config["WorkingDir"] == "/work"
    assert "MISSION_ID=1" in config["Env"]
    assert config["HostConfig"]["NetworkMode"] == "test-net"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd prowlrbot-engine && pytest tests/test_docker_client.py -v
```

Expected: FAIL — no module

- [ ] **Step 3: Write Docker client**

Write `prowlrbot-engine/src/docker/__init__.py`: empty file.

Write `prowlrbot-engine/src/docker/client.py`:
```python
import httpx

from src.config import settings


class DockerClient:
    """Docker Engine API client via HTTP (through socket proxy)."""

    def __init__(
        self,
        host: str | None = None,
        network: str | None = None,
    ):
        raw_host = host or settings.docker_host
        # Convert tcp://host:port to http://host:port
        self.base_url = raw_host.replace("tcp://", "http://")
        self.network = network or settings.docker_network
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=30.0)

    def build_container_config(
        self,
        image: str,
        name: str,
        env: dict[str, str] | None = None,
        workspace: str | None = None,
    ) -> dict:
        """Build Docker container creation config."""
        config = {
            "Image": image,
            "WorkingDir": "/work",
            "Hostname": name[:63],
            "Env": [f"{k}={v}" for k, v in (env or {}).items()],
            "HostConfig": {
                "NetworkMode": self.network,
                "Memory": 2 * 1024 * 1024 * 1024,  # 2GB
                "CpuQuota": 200000,  # 2 CPUs
                "RestartPolicy": {"Name": "on-failure", "MaximumRetryCount": 3},
            },
        }

        if workspace:
            config["HostConfig"]["Binds"] = [f"{workspace}:/work"]

        return config

    async def create_container(self, name: str, config: dict) -> str:
        """Create container, return container ID."""
        resp = await self._client.post(
            "/v1.41/containers/create",
            params={"name": name},
            json=config,
        )
        resp.raise_for_status()
        return resp.json()["Id"]

    async def start_container(self, container_id: str):
        """Start a created container."""
        resp = await self._client.post(f"/v1.41/containers/{container_id}/start")
        if resp.status_code not in (204, 304):
            resp.raise_for_status()

    async def exec_command(self, container_id: str, command: str, timeout: int = 60) -> str:
        """Execute a command in a running container and return output."""
        # Create exec instance
        exec_resp = await self._client.post(
            f"/v1.41/containers/{container_id}/exec",
            json={
                "AttachStdout": True,
                "AttachStderr": True,
                "Cmd": ["sh", "-c", command],
                "WorkingDir": "/work",
            },
        )
        exec_resp.raise_for_status()
        exec_id = exec_resp.json()["Id"]

        # Start exec and get output
        start_resp = await self._client.post(
            f"/v1.41/exec/{exec_id}/start",
            json={"Detach": False, "Tty": False},
            timeout=float(timeout),
        )
        start_resp.raise_for_status()

        # Docker multiplexes stdout/stderr in a binary stream
        # For simplicity, decode as UTF-8 and strip Docker stream headers
        raw = start_resp.content
        return self._demux_docker_stream(raw)

    async def stop_container(self, container_id: str, timeout: int = 10):
        """Stop a running container."""
        await self._client.post(
            f"/v1.41/containers/{container_id}/stop",
            params={"t": timeout},
        )

    async def remove_container(self, container_id: str):
        """Remove a stopped container."""
        await self._client.delete(
            f"/v1.41/containers/{container_id}",
            params={"force": True},
        )

    async def get_container_logs(self, container_id: str, tail: int = 50) -> str:
        """Get recent container logs."""
        resp = await self._client.get(
            f"/v1.41/containers/{container_id}/logs",
            params={"stdout": True, "stderr": True, "tail": str(tail)},
        )
        resp.raise_for_status()
        return self._demux_docker_stream(resp.content)

    async def inspect_container(self, container_id: str) -> dict:
        """Get container state."""
        resp = await self._client.get(f"/v1.41/containers/{container_id}/json")
        resp.raise_for_status()
        return resp.json()

    async def ping(self) -> bool:
        """Check Docker API is reachable."""
        try:
            resp = await self._client.get("/_ping")
            return resp.status_code == 200
        except Exception:
            return False

    @staticmethod
    def _demux_docker_stream(raw: bytes) -> str:
        """Demultiplex Docker stream (8-byte header per frame)."""
        output = []
        pos = 0
        while pos + 8 <= len(raw):
            # Header: [stream_type(1), 0, 0, 0, size(4)]
            size = int.from_bytes(raw[pos + 4 : pos + 8], "big")
            pos += 8
            if pos + size <= len(raw):
                output.append(raw[pos : pos + size].decode("utf-8", errors="replace"))
            pos += size
        result = "".join(output)
        # Fallback: if no valid frames found, return raw decode
        if not result and raw:
            return raw.decode("utf-8", errors="replace")
        return result

    async def close(self):
        await self._client.aclose()
```

- [ ] **Step 4: Run tests**

```bash
cd prowlrbot-engine && pytest tests/test_docker_client.py -v
```

Expected: 2 PASSED

- [ ] **Step 5: Commit**

```bash
git add prowlrbot-engine/src/docker/ prowlrbot-engine/tests/test_docker_client.py
git commit -m "feat(engine): Docker API client for agent container management"
```

---

### Task 9: Terminal Tool

**Files:**
- Create: `prowlrbot-engine/src/engine/__init__.py`
- Create: `prowlrbot-engine/src/engine/tools/__init__.py`
- Create: `prowlrbot-engine/src/engine/tools/terminal.py`
- Create: `prowlrbot-engine/tests/test_terminal_tool.py`

- [ ] **Step 1: Write the failing test**

Write `prowlrbot-engine/tests/test_terminal_tool.py`:
```python
import pytest
from unittest.mock import AsyncMock

from src.engine.tools.terminal import TerminalTool


@pytest.mark.asyncio
async def test_terminal_tool_executes_command():
    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "hello world\n"

    tool = TerminalTool(container_id="abc123", docker_client=mock_docker)
    result = await tool.execute({"command": "echo hello world"})

    assert result == "hello world\n"
    mock_docker.exec_command.assert_called_once_with("abc123", "echo hello world", timeout=60)


@pytest.mark.asyncio
async def test_terminal_tool_truncates_large_output():
    mock_docker = AsyncMock()
    large_output = "x" * 50000
    mock_docker.exec_command.return_value = large_output

    tool = TerminalTool(container_id="abc123", docker_client=mock_docker)
    result = await tool.execute({"command": "cat bigfile"})

    assert len(result) < 50000
    assert "[truncated" in result


@pytest.mark.asyncio
async def test_terminal_tool_respects_timeout():
    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "ok"

    tool = TerminalTool(container_id="abc123", docker_client=mock_docker)
    await tool.execute({"command": "sleep 5", "timeout": 10})

    mock_docker.exec_command.assert_called_once_with("abc123", "sleep 5", timeout=10)


@pytest.mark.asyncio
async def test_terminal_tool_caps_timeout_at_1200():
    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "ok"

    tool = TerminalTool(container_id="abc123", docker_client=mock_docker)
    await tool.execute({"command": "long-scan", "timeout": 9999})

    mock_docker.exec_command.assert_called_once_with("abc123", "long-scan", timeout=1200)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd prowlrbot-engine && pytest tests/test_terminal_tool.py -v
```

Expected: FAIL — no module

- [ ] **Step 3: Write terminal tool**

Write `prowlrbot-engine/src/engine/__init__.py`: empty file.
Write `prowlrbot-engine/src/engine/tools/__init__.py`: empty file.

Write `prowlrbot-engine/src/engine/tools/terminal.py`:
```python
from src.docker.client import DockerClient

RESULT_SIZE_LIMIT = 16384  # 16KB
HARD_TIMEOUT = 1200  # 20 minutes
DEFAULT_TIMEOUT = 60  # 1 minute


class TerminalTool:
    """Execute commands in an agent's Docker container."""

    def __init__(self, container_id: str, docker_client: DockerClient):
        self.container_id = container_id
        self.docker = docker_client

    async def execute(self, args: dict) -> str:
        command = args["command"]
        timeout = min(args.get("timeout", DEFAULT_TIMEOUT), HARD_TIMEOUT)

        result = await self.docker.exec_command(
            self.container_id, command, timeout=timeout
        )

        # Truncate large outputs (PentAGI pattern: keep first + last 16KB)
        if len(result) > RESULT_SIZE_LIMIT * 2:
            result = (
                result[:RESULT_SIZE_LIMIT]
                + f"\n\n[truncated {len(result) - RESULT_SIZE_LIMIT * 2} bytes]\n\n"
                + result[-RESULT_SIZE_LIMIT:]
            )

        return result

    @staticmethod
    def schema() -> dict:
        return {
            "name": "terminal",
            "description": (
                "Execute a shell command in the agent's Docker container. "
                "Blocking mode, 1200s hard timeout, 60s default timeout."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds (max 1200)",
                        "default": 60,
                    },
                },
                "required": ["command"],
            },
        }
```

- [ ] **Step 4: Run tests**

```bash
cd prowlrbot-engine && pytest tests/test_terminal_tool.py -v
```

Expected: 4 PASSED

- [ ] **Step 5: Commit**

```bash
git add prowlrbot-engine/src/engine/ prowlrbot-engine/tests/test_terminal_tool.py
git commit -m "feat(engine): terminal tool — execute commands in agent Docker containers"
```

---

### Task 10: Tool Registry

**Files:**
- Create: `prowlrbot-engine/src/engine/tools/registry.py`
- Create: `prowlrbot-engine/src/engine/tools/file_tool.py`
- Create: `prowlrbot-engine/src/engine/tools/barriers.py`

- [ ] **Step 1: Write barrier tools**

Write `prowlrbot-engine/src/engine/tools/barriers.py`:
```python
class DoneTool:
    """Barrier: agent declares task complete."""

    async def execute(self, args: dict) -> str:
        return args.get("result", "Task completed.")

    @staticmethod
    def schema() -> dict:
        return {
            "name": "done",
            "description": "Finish the current task with a success or failure report.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["success", "failure"]},
                    "result": {"type": "string", "description": "Final result summary"},
                },
                "required": ["status", "result"],
            },
        }


class AskTool:
    """Barrier: agent pauses and asks operator for input."""

    async def execute(self, args: dict) -> str:
        # The performer loop handles the actual pause/resume
        return f"WAITING: {args.get('question', 'Need input')}"

    @staticmethod
    def schema() -> dict:
        return {
            "name": "ask",
            "description": "Pause execution and ask the operator for input or approval.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["question"],
            },
        }
```

- [ ] **Step 2: Write file tool**

Write `prowlrbot-engine/src/engine/tools/file_tool.py`:
```python
from src.docker.client import DockerClient


class FileTool:
    """Read/write files in the agent's container workspace."""

    def __init__(self, container_id: str, docker_client: DockerClient):
        self.container_id = container_id
        self.docker = docker_client

    async def execute(self, args: dict) -> str:
        action = args["action"]
        path = args["path"]

        if action == "read":
            return await self.docker.exec_command(
                self.container_id, f"cat '{path}'"
            )
        elif action == "write":
            content = args.get("content", "")
            # Use heredoc to avoid escaping issues
            escaped = content.replace("'", "'\\''")
            return await self.docker.exec_command(
                self.container_id,
                f"mkdir -p $(dirname '{path}') && printf '%s' '{escaped}' > '{path}' && echo 'Written to {path}'",
            )
        elif action == "append":
            content = args.get("content", "")
            escaped = content.replace("'", "'\\''")
            return await self.docker.exec_command(
                self.container_id,
                f"printf '%s' '{escaped}' >> '{path}' && echo 'Appended to {path}'",
            )
        elif action == "delete":
            return await self.docker.exec_command(
                self.container_id, f"rm -f '{path}' && echo 'Deleted {path}'"
            )
        else:
            return f"Unknown file action: {action}"

    @staticmethod
    def schema() -> dict:
        return {
            "name": "file",
            "description": "Read, write, append, or delete files in the agent's /work directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["read", "write", "append", "delete"]},
                    "path": {"type": "string", "description": "File path relative to /work"},
                    "content": {"type": "string", "description": "Content for write/append"},
                },
                "required": ["action", "path"],
            },
        }
```

- [ ] **Step 3: Write tool registry**

Write `prowlrbot-engine/src/engine/tools/registry.py`:
```python
from src.docker.client import DockerClient
from src.engine.tools.barriers import AskTool, DoneTool
from src.engine.tools.file_tool import FileTool
from src.engine.tools.terminal import TerminalTool

# Tool types for observability
TOOL_TYPES = {
    "terminal": "environment",
    "file": "environment",
    "done": "barrier",
    "ask": "barrier",
}

BARRIER_TOOLS = {"done", "ask"}


class ToolExecutor:
    """Registry of available tools for an agent. Executes tool calls by name."""

    def __init__(
        self,
        allowed_tools: list[str],
        container_id: str | None = None,
        docker_client: DockerClient | None = None,
    ):
        self._tools: dict[str, object] = {}
        self._schemas: dict[str, dict] = {}

        # Always available
        done = DoneTool()
        ask = AskTool()
        self._tools["done"] = done
        self._tools["ask"] = ask
        self._schemas["done"] = done.schema()
        self._schemas["ask"] = ask.schema()

        # Container-dependent tools
        if container_id and docker_client:
            if "terminal" in allowed_tools:
                t = TerminalTool(container_id, docker_client)
                self._tools["terminal"] = t
                self._schemas["terminal"] = t.schema()

            if "file" in allowed_tools:
                f = FileTool(container_id, docker_client)
                self._tools["file"] = f
                self._schemas["file"] = f.schema()

    def get_tool_definitions(self) -> list[dict]:
        """Return LLM-compatible tool definitions."""
        return [
            {"type": "function", "function": schema}
            for schema in self._schemas.values()
        ]

    async def execute(self, tool_name: str, args: dict) -> str:
        """Execute a tool by name."""
        tool = self._tools.get(tool_name)
        if not tool:
            return f"Tool '{tool_name}' not found in available tools."
        return await tool.execute(args)

    def is_barrier(self, tool_name: str) -> bool:
        return tool_name in BARRIER_TOOLS

    def has_tool(self, tool_name: str) -> bool:
        return tool_name in self._tools
```

- [ ] **Step 4: Commit**

```bash
git add prowlrbot-engine/src/engine/tools/
git commit -m "feat(engine): tool registry with terminal, file, done, ask tools"
```

---

### Task 11: Execution Monitor (loop detection)

**Files:**
- Create: `prowlrbot-engine/src/engine/monitor.py`
- Create: `prowlrbot-engine/tests/test_monitor.py`

- [ ] **Step 1: Write the failing test**

Write `prowlrbot-engine/tests/test_monitor.py`:
```python
from src.engine.monitor import ExecutionMonitor


def test_monitor_allows_normal_calls():
    mon = ExecutionMonitor(same_tool_limit=5, total_limit=20)
    for _ in range(4):
        assert mon.check("terminal") == "ok"


def test_monitor_detects_same_tool_loop():
    mon = ExecutionMonitor(same_tool_limit=3, total_limit=20)
    mon.check("terminal")
    mon.check("terminal")
    assert mon.check("terminal") == "adviser"


def test_monitor_resets_on_different_tool():
    mon = ExecutionMonitor(same_tool_limit=3, total_limit=20)
    mon.check("terminal")
    mon.check("terminal")
    mon.check("file")  # Reset same-tool counter
    assert mon.check("terminal") == "ok"


def test_monitor_detects_total_limit():
    mon = ExecutionMonitor(same_tool_limit=100, total_limit=5)
    for i in range(4):
        assert mon.check(f"tool-{i}") == "ok"
    assert mon.check("tool-final") == "abort"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd prowlrbot-engine && pytest tests/test_monitor.py -v
```

Expected: FAIL — no module

- [ ] **Step 3: Write execution monitor**

Write `prowlrbot-engine/src/engine/monitor.py`:
```python
class ExecutionMonitor:
    """Detects agent loops and runaway execution. From PentAGI's helpers.go."""

    def __init__(self, same_tool_limit: int = 50, total_limit: int = 100):
        self.same_tool_limit = same_tool_limit
        self.total_limit = total_limit
        self._same_count = 0
        self._total_count = 0
        self._last_tool = ""

    def check(self, tool_name: str) -> str:
        """Check if tool call should proceed. Returns 'ok', 'adviser', or 'abort'."""
        self._total_count += 1

        if tool_name == self._last_tool:
            self._same_count += 1
        else:
            self._same_count = 1
            self._last_tool = tool_name

        if self._total_count >= self.total_limit:
            return "abort"

        if self._same_count >= self.same_tool_limit:
            self._same_count = 0  # Reset after intervention
            return "adviser"

        return "ok"

    @property
    def stats(self) -> dict:
        return {
            "total_calls": self._total_count,
            "same_tool_streak": self._same_count,
            "last_tool": self._last_tool,
        }
```

- [ ] **Step 4: Run tests**

```bash
cd prowlrbot-engine && pytest tests/test_monitor.py -v
```

Expected: 4 PASSED

- [ ] **Step 5: Commit**

```bash
git add prowlrbot-engine/src/engine/monitor.py prowlrbot-engine/tests/test_monitor.py
git commit -m "feat(engine): execution monitor — loop detection and runaway prevention"
```

---

### Task 12: Summarization Engine

**Files:**
- Create: `prowlrbot-engine/src/engine/summarizer.py`

- [ ] **Step 1: Write summarizer**

Write `prowlrbot-engine/src/engine/summarizer.py`:
```python
RESULT_SIZE_LIMIT = 16384  # 16KB
CHAIN_LENGTH_LIMIT = 50  # messages


async def summarize_output(output: str, tool_name: str, llm_fn=None) -> str:
    """Summarize large tool output to fit context window."""
    if len(output) <= RESULT_SIZE_LIMIT:
        return output

    if llm_fn is None:
        # Fallback: truncate with first+last chunks
        return (
            output[:RESULT_SIZE_LIMIT]
            + f"\n\n[... truncated {len(output) - RESULT_SIZE_LIMIT * 2} bytes ...]\n\n"
            + output[-RESULT_SIZE_LIMIT:]
        )

    prompt = (
        f"Summarize this {tool_name} output, preserving:\n"
        "- All findings, vulnerabilities, and security-relevant data\n"
        "- All IP addresses, hostnames, ports, and URLs\n"
        "- All error messages and their context\n"
        "- Key metrics and counts\n\n"
        f"Output ({len(output)} bytes):\n{output[:RESULT_SIZE_LIMIT * 2]}"
    )
    return await llm_fn(prompt)


async def summarize_chain(chain: list[dict], keep_recent: int = 10, llm_fn=None) -> list[dict]:
    """Compress long agent message chains, preserving recent context."""
    if len(chain) <= CHAIN_LENGTH_LIMIT:
        return chain

    old = chain[:-keep_recent]
    recent = chain[-keep_recent:]

    if llm_fn is None:
        # Fallback: keep system message + recent
        system_msgs = [m for m in old if m.get("role") == "system"]
        return system_msgs + recent

    old_text = "\n".join(
        f"[{m.get('role', '?')}]: {str(m.get('content', ''))[:500]}"
        for m in old
    )

    summary = await llm_fn(
        f"Summarize this agent conversation history, preserving all "
        f"findings, decisions, and tool results:\n\n{old_text}"
    )

    return [
        {"role": "system", "content": f"[Previous context summary]\n{summary}"},
        *recent,
    ]
```

- [ ] **Step 2: Commit**

```bash
git add prowlrbot-engine/src/engine/summarizer.py
git commit -m "feat(engine): summarization engine for large outputs and long chains"
```

---

### Task 13: ReAct Performer (core agent loop)

**Files:**
- Create: `prowlrbot-engine/src/engine/performer.py`
- Create: `prowlrbot-engine/tests/test_performer.py`

- [ ] **Step 1: Write the failing test**

Write `prowlrbot-engine/tests/test_performer.py`:
```python
import pytest
from unittest.mock import AsyncMock

from src.engine.performer import perform_agent_chain
from src.engine.tools.registry import ToolExecutor


class FakeLLM:
    """Mock LLM that returns predetermined tool calls."""

    def __init__(self, responses: list[dict]):
        self._responses = responses
        self._call_count = 0

    async def call_with_tools(self, chain, tools, model=None):
        if self._call_count >= len(self._responses):
            return {"tool_calls": [{"name": "done", "args": {"status": "success", "result": "Done"}}], "usage": {"input": 0, "output": 0}}
        resp = self._responses[self._call_count]
        self._call_count += 1
        return resp


@pytest.mark.asyncio
async def test_performer_executes_terminal_and_finishes():
    llm = FakeLLM([
        {"tool_calls": [{"name": "terminal", "args": {"command": "echo hi"}}], "usage": {"input": 10, "output": 10}},
        {"tool_calls": [{"name": "done", "args": {"status": "success", "result": "Found stuff"}}], "usage": {"input": 10, "output": 10}},
    ])

    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "hi\n"

    executor = ToolExecutor(
        allowed_tools=["terminal"],
        container_id="test-container",
        docker_client=mock_docker,
    )

    result = await perform_agent_chain(
        chain=[{"role": "system", "content": "You are a test agent"}],
        executor=executor,
        llm=llm,
        max_iterations=10,
    )

    assert result["status"] == "done"
    assert result["result"] == "Found stuff"


@pytest.mark.asyncio
async def test_performer_returns_waiting_on_ask():
    llm = FakeLLM([
        {"tool_calls": [{"name": "ask", "args": {"question": "Should I proceed?"}}], "usage": {"input": 10, "output": 10}},
    ])

    executor = ToolExecutor(allowed_tools=[])

    result = await perform_agent_chain(
        chain=[{"role": "system", "content": "You are a test agent"}],
        executor=executor,
        llm=llm,
        max_iterations=10,
    )

    assert result["status"] == "waiting"


@pytest.mark.asyncio
async def test_performer_fails_on_max_iterations():
    # LLM never calls done
    llm = FakeLLM([
        {"tool_calls": [{"name": "terminal", "args": {"command": "echo loop"}}], "usage": {"input": 10, "output": 10}},
    ] * 5)

    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "loop\n"

    executor = ToolExecutor(
        allowed_tools=["terminal"],
        container_id="test-container",
        docker_client=mock_docker,
    )

    result = await perform_agent_chain(
        chain=[{"role": "system", "content": "You are a test agent"}],
        executor=executor,
        llm=llm,
        max_iterations=3,
    )

    assert result["status"] == "failed"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd prowlrbot-engine && pytest tests/test_performer.py -v
```

Expected: FAIL — no module

- [ ] **Step 3: Write the performer**

Write `prowlrbot-engine/src/engine/performer.py`:
```python
import json
import time

from src.engine.monitor import ExecutionMonitor
from src.engine.summarizer import summarize_chain, summarize_output
from src.engine.tools.registry import ToolExecutor

RESULT_SIZE_LIMIT = 16384


async def perform_agent_chain(
    chain: list[dict],
    executor: ToolExecutor,
    llm,
    max_iterations: int = 100,
    model: str | None = None,
    on_action=None,
) -> dict:
    """Core ReAct loop. Reason -> Act -> Observe -> Repeat.

    Returns: {"status": "done"|"waiting"|"failed", "result": str, "chain": list}
    """
    monitor = ExecutionMonitor(
        same_tool_limit=max(max_iterations // 2, 5),
        total_limit=max_iterations,
    )

    total_tokens = {"input": 0, "output": 0}

    for iteration in range(max_iterations):
        # Call LLM with tools
        response = await llm.call_with_tools(
            chain, executor.get_tool_definitions(), model
        )

        # Track tokens
        usage = response.get("usage", {})
        total_tokens["input"] += usage.get("input", 0)
        total_tokens["output"] += usage.get("output", 0)

        tool_calls = response.get("tool_calls", [])

        # No tool calls — LLM is stuck
        if not tool_calls:
            # Append a nudge
            chain.append({
                "role": "system",
                "content": "You did not call any tool. You must call a tool to make progress, or call 'done' to finish.",
            })
            continue

        # Execute each tool call
        for tc in tool_calls:
            tool_name = tc["name"]
            tool_args = tc.get("args", {})

            # Execution monitor check
            check = monitor.check(tool_name)
            if check == "abort":
                return {
                    "status": "failed",
                    "result": f"Aborted: exceeded {max_iterations} total tool calls",
                    "chain": chain,
                    "tokens": total_tokens,
                }
            elif check == "adviser":
                chain.append({
                    "role": "system",
                    "content": f"WARNING: You have called '{tool_name}' repeatedly. Try a different approach or call 'done' to finish.",
                })
                continue

            # Execute the tool
            start = time.time()
            result = await executor.execute(tool_name, tool_args)
            duration = time.time() - start

            # Callback for observability
            if on_action:
                await on_action(tool_name, tool_args, result, duration)

            # Check barriers
            if tool_name == "done":
                return {
                    "status": "done",
                    "result": tool_args.get("result", result),
                    "chain": chain,
                    "tokens": total_tokens,
                }
            elif tool_name == "ask":
                return {
                    "status": "waiting",
                    "result": result,
                    "chain": chain,
                    "tokens": total_tokens,
                }

            # Summarize large output
            if len(result) > RESULT_SIZE_LIMIT:
                result = await summarize_output(result, tool_name)

            # Append tool result to chain
            chain.append({
                "role": "tool",
                "tool_call_id": tc.get("id", tool_name),
                "name": tool_name,
                "content": result,
            })

        # Summarize chain if too long
        if len(chain) > 50:
            chain = await summarize_chain(chain, keep_recent=10)

    # Max iterations reached
    return {
        "status": "failed",
        "result": f"Max iterations ({max_iterations}) reached without completion",
        "chain": chain,
        "tokens": total_tokens,
    }
```

- [ ] **Step 4: Run tests**

```bash
cd prowlrbot-engine && pytest tests/test_performer.py -v
```

Expected: 3 PASSED

- [ ] **Step 5: Commit**

```bash
git add prowlrbot-engine/src/engine/performer.py prowlrbot-engine/tests/test_performer.py
git commit -m "feat(engine): ReAct performer — core agent chain loop with tool execution"
```

---

### Task 14: Mission Execution Endpoint (wires it all together)

**Files:**
- Modify: `prowlrbot-engine/src/routers/missions.py`
- Create: `prowlrbot-engine/src/engine/executor.py`

- [ ] **Step 1: Write task executor**

Write `prowlrbot-engine/src/engine/executor.py`:
```python
import asyncio

from src.docker.client import DockerClient
from src.engine.performer import perform_agent_chain
from src.engine.tools.registry import ToolExecutor
from src.config import settings

# Agent config (subset — full config in Phase 2)
AGENT_CONFIG = {
    "PATHFINDER": {
        "tools": ["terminal", "file", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 100,
    },
    "BREACH": {
        "tools": ["terminal", "file", "done", "ask"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 100,
    },
    "SAM": {
        "tools": ["terminal", "file", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 100,
    },
    "SCRIBE": {
        "tools": ["done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 20,
    },
}

DEFAULT_CONFIG = {
    "tools": ["terminal", "file", "done"],
    "docker_image": "harbinger/base:latest",
    "max_iterations": 50,
}


async def execute_task(
    task_id: int,
    agent_codename: str,
    docker_image: str,
    mission_id: int,
    task_input: str,
    llm,
) -> dict:
    """Execute a single task: spawn container, run agent chain, return result."""
    config = AGENT_CONFIG.get(agent_codename, DEFAULT_CONFIG)
    docker = DockerClient()

    container_name = f"harbinger-m{mission_id}-{agent_codename.lower()}-t{task_id}"

    # Build and start container
    container_config = docker.build_container_config(
        image=docker_image or config["docker_image"],
        name=container_name,
        env={
            "MISSION_ID": str(mission_id),
            "TASK_ID": str(task_id),
            "AGENT": agent_codename,
        },
    )

    try:
        container_id = await docker.create_container(container_name, container_config)
        await docker.start_container(container_id)

        # Create tool executor with container
        executor = ToolExecutor(
            allowed_tools=config["tools"],
            container_id=container_id,
            docker_client=docker,
        )

        # Build agent chain
        system_prompt = (
            f"You are {agent_codename}, a Harbinger security agent.\n"
            f"You are working on mission {mission_id}, task {task_id}.\n"
            f"Execute the following task and report results using the 'done' tool.\n\n"
            f"Task: {task_input}"
        )

        chain = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": task_input},
        ]

        # Run ReAct loop
        result = await perform_agent_chain(
            chain=chain,
            executor=executor,
            llm=llm,
            max_iterations=config["max_iterations"],
        )

        return result

    except Exception as e:
        return {"status": "failed", "result": str(e), "chain": [], "tokens": {}}

    finally:
        # Cleanup: stop and remove container
        try:
            await docker.stop_container(container_id)
            await docker.remove_container(container_id)
        except Exception:
            pass
        await docker.close()
```

- [ ] **Step 2: Add execute endpoint to missions router**

Add to `prowlrbot-engine/src/routers/missions.py`:

```python
from fastapi import BackgroundTasks


class MissionExecuteRequest(BaseModel):
    """Start mission execution."""
    pass  # No extra params needed — mission already has all config


@router.post("/{mission_id}/execute", status_code=202)
async def execute_mission(mission_id: int, background_tasks: BackgroundTasks):
    """Start executing a mission. Returns immediately, runs in background."""
    if not db_available():
        raise HTTPException(503, "Database not available")

    async with async_session() as session:
        mission = await session.get(Mission, mission_id)
        if not mission:
            raise HTTPException(404, "Mission not found")
        if mission.status not in ("created", "failed"):
            raise HTTPException(400, f"Mission is {mission.status}, cannot execute")

        mission.status = "running"
        await session.commit()

    # Run in background (Phase 2 will add proper scheduler)
    background_tasks.add_task(run_mission_background, mission_id)

    return {"status": "started", "mission_id": mission_id}


async def run_mission_background(mission_id: int):
    """Background task: execute all tasks in a mission."""
    # Placeholder — Phase 2 will implement the full DAG scheduler
    # For now, just update status to show the endpoint works
    async with async_session() as session:
        mission = await session.get(Mission, mission_id)
        if mission:
            mission.status = "running"
            await session.commit()
```

- [ ] **Step 3: Test the endpoint**

```bash
# Create a mission
curl -s -X POST http://localhost:8980/api/v2/missions \
  -H "Content-Type: application/json" \
  -d '{"title":"Test execution","target":"example.com","mission_type":"full_pentest"}' | python3 -m json.tool

# Execute it
curl -s -X POST http://localhost:8980/api/v2/missions/1/execute | python3 -m json.tool
```

Expected: `{"status": "started", "mission_id": 1}`

- [ ] **Step 4: Commit**

```bash
git add prowlrbot-engine/src/engine/executor.py prowlrbot-engine/src/routers/missions.py
git commit -m "feat(engine): mission execution endpoint with task executor scaffold"
```

---

## Verification Checklist

After all 14 tasks:

- [ ] `docker compose up -d` — all services healthy (including backend-py)
- [ ] `curl http://localhost:8980/api/v2/health` — returns `{"status":"ok","service":"harbinger-engine"}`
- [ ] `curl http://localhost:8980/api/health` — Go backend still works
- [ ] `POST /api/v2/missions` — creates mission in PostgreSQL
- [ ] `GET /api/v2/missions` — lists missions
- [ ] `POST /api/v2/missions/{id}/execute` — returns 202, mission status changes to "running"
- [ ] All Python tests pass: `cd prowlrbot-engine && pytest -v`
- [ ] Go backend tests still pass: `cd backend && go test ./cmd/ -v`

---

## What Phase 2 Builds On This

Phase 2 (Agent System) adds:
- Agent prompts (ORCHESTRATOR + specialists)
- Agent delegation tools (pentester, coder, maintenance, search, memorist, advice)
- Full DAG scheduler (replaces the placeholder in Task 14)
- LLM integration (Ollama/OpenAI/Anthropic via model router)
- Subtask generation + refinement
- Real Docker agent images (pd-tools, kali-tools, etc.)
