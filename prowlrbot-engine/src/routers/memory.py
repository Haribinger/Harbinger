"""
Memory router — REST endpoints for semantic memory and knowledge graph.

GET  /api/v2/memory/search  — semantic search across vector memories
GET  /api/v2/memory/graph   — knowledge graph query
POST /api/v2/memory/store   — manual memory entry
GET  /api/v2/memory/surface/{mission_id} — attack surface summary
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────


class MemoryStoreRequest(BaseModel):
    content: str
    collection: str = "general"
    agent_id: str = ""
    mission_id: str = ""
    task_id: str = ""
    metadata: dict | None = None


class MemorySearchResult(BaseModel):
    id: int
    content: str
    collection: str
    agent_id: str
    mission_id: str
    metadata: dict
    score: float
    created_at: str | None

    model_config = {"from_attributes": True}


# ── Semantic memory endpoints ────────────────────────────────────────────────


@router.get("/api/v2/memory/search")
async def search_memory(
    query: str = Query(..., description="Search query"),
    collection: str | None = Query(None, description="Filter by collection"),
    agent_id: str | None = Query(None, description="Filter by agent"),
    mission_id: str | None = Query(None, description="Filter by mission"),
    limit: int = Query(10, ge=1, le=100),
    threshold: float = Query(0.2, ge=0.0, le=1.0),
):
    """Semantic search across vector memories."""
    try:
        from src.memory.store import search
        results = await search(
            query=query,
            collection=collection,
            agent_id=agent_id,
            mission_id=mission_id,
            limit=limit,
            threshold=threshold,
        )
        return {"ok": True, "results": results, "count": len(results)}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"memory search failed: {exc}")


@router.post("/api/v2/memory/store")
async def store_memory(payload: MemoryStoreRequest):
    """Store content in the vector memory."""
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="content is required")

    try:
        from src.memory.store import store
        row_id = await store(
            content=payload.content,
            collection=payload.collection,
            agent_id=payload.agent_id,
            mission_id=payload.mission_id,
            task_id=payload.task_id,
            metadata=payload.metadata,
        )
        return {"ok": True, "id": row_id, "collection": payload.collection}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"memory store failed: {exc}")


@router.delete("/api/v2/memory/{memory_id}")
async def delete_memory(memory_id: int):
    """Delete a memory entry by ID."""
    try:
        from src.memory.store import delete
        deleted = await delete(memory_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="memory not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"memory delete failed: {exc}")


# ── Knowledge graph endpoints ────────────────────────────────────────────────


@router.get("/api/v2/memory/graph")
async def query_graph(
    query: str = Query("", description="Search query"),
    search_type: str = Query("general", description="hosts, vulns, credentials, techniques, general"),
    limit: int = Query(20, ge=1, le=200),
):
    """Query the Neo4j knowledge graph."""
    try:
        from src.memory.graph import search_graph
        results = await search_graph(query=query, search_type=search_type, limit=limit)
        return {"ok": True, "results": results, "count": len(results), "search_type": search_type}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"graph query failed: {exc}")


@router.get("/api/v2/memory/surface/{mission_id}")
async def attack_surface(mission_id: int):
    """Get the attack surface summary for a mission."""
    try:
        from src.memory.graph import get_attack_surface
        surface = await get_attack_surface(mission_id)
        return {"ok": True, **surface}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"attack surface query failed: {exc}")


# ── Graph entity creation (for internal use / testing) ───────────────────────


class HostCreate(BaseModel):
    ip: str
    hostname: str = ""
    mission_id: int | None = None


class ServiceCreate(BaseModel):
    host_ip: str
    port: int
    protocol: str = "tcp"
    product: str = ""


class VulnCreate(BaseModel):
    host_ip: str
    port: int
    vuln_id: str
    severity: str
    title: str
    evidence: str = ""


@router.post("/api/v2/memory/graph/host")
async def create_host(payload: HostCreate):
    """Create or merge a Host node in the knowledge graph."""
    try:
        from src.memory.graph import store_host
        result = await store_host(payload.ip, payload.hostname, payload.mission_id)
        return {"ok": True, "host": result}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"graph operation failed: {exc}")


@router.post("/api/v2/memory/graph/service")
async def create_service(payload: ServiceCreate):
    """Create or merge a Service node linked to a Host."""
    try:
        from src.memory.graph import store_service
        result = await store_service(payload.host_ip, payload.port, payload.protocol, payload.product)
        return {"ok": True, "service": result}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"graph operation failed: {exc}")


@router.post("/api/v2/memory/graph/vuln")
async def create_vuln(payload: VulnCreate):
    """Create or merge a Vulnerability node linked to a Service."""
    try:
        from src.memory.graph import store_vulnerability
        result = await store_vulnerability(
            payload.host_ip, payload.port, payload.vuln_id,
            payload.severity, payload.title, payload.evidence,
        )
        return {"ok": True, "vuln": result}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"graph operation failed: {exc}")
