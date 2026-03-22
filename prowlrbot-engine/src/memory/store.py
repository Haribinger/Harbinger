"""
Semantic vector memory store — pgvector-backed embedding search + storage.

Three collections mirror the v2.0 layered memory spec:
  - "answer"  → Q&A pairs from completed subtasks (Layer 2/3)
  - "guide"   → How-to guides, techniques, runbooks (Layer 3)
  - "code"    → Code samples, exploit snippets (Layer 3)

Embeddings are generated via litellm (provider-agnostic). Searches use
cosine distance for relevance ranking.

Table: vector_memories (created by Phase 1 migration or ensured here)
"""

import json
import logging
import time
from typing import Any

import asyncpg

from src.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
VALID_COLLECTIONS = {"answer", "guide", "code", "general"}

# Connection pool — lazily initialized
_pool: asyncpg.Pool | None = None


async def _get_pool() -> asyncpg.Pool:
    """Get or create the asyncpg connection pool."""
    global _pool
    if _pool is None:
        dsn = (
            f"postgresql://{settings.db_user}:{settings.db_password}"
            f"@{settings.db_host}:{settings.db_port}/{settings.db_name}"
        )
        try:
            _pool = await asyncpg.create_pool(dsn, min_size=2, max_size=10)
        except Exception as exc:
            logger.error("pgvector pool creation failed: %s", exc)
            raise
    return _pool


async def close_pool():
    """Shutdown the pool gracefully."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def ensure_table():
    """Create vector_memories table + pgvector extension if they don't exist."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.execute(f"""
            CREATE TABLE IF NOT EXISTS vector_memories (
                id SERIAL PRIMARY KEY,
                agent_id TEXT NOT NULL DEFAULT '',
                mission_id TEXT DEFAULT '',
                task_id TEXT DEFAULT '',
                collection TEXT NOT NULL DEFAULT 'general',
                content TEXT NOT NULL,
                embedding vector({EMBEDDING_DIM}),
                metadata JSONB DEFAULT '{{}}'::jsonb,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_vm_embedding
            ON vector_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_vm_collection ON vector_memories (collection)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_vm_agent ON vector_memories (agent_id)"
        )


async def embed(text: str) -> list[float]:
    """Generate an embedding vector for the given text.

    Uses litellm for provider-agnostic embedding. Falls back to a zero
    vector if embedding fails (graceful degradation — search will still
    work but without semantic ranking).
    """
    try:
        import litellm
        response = await litellm.aembedding(
            model=EMBEDDING_MODEL,
            input=[text],
        )
        return response.data[0]["embedding"]
    except Exception as exc:
        logger.warning("embedding failed (using zero vector): %s", exc)
        return [0.0] * EMBEDDING_DIM


async def store(
    content: str,
    collection: str = "general",
    agent_id: str = "",
    mission_id: str = "",
    task_id: str = "",
    metadata: dict[str, Any] | None = None,
) -> int:
    """Embed and store content in the vector memory.

    Returns the row ID of the inserted record.
    """
    if collection not in VALID_COLLECTIONS:
        collection = "general"

    embedding = await embed(content)
    meta_json = json.dumps(metadata or {})

    pool = await _get_pool()
    async with pool.acquire() as conn:
        row_id = await conn.fetchval(
            """
            INSERT INTO vector_memories
                (agent_id, mission_id, task_id, collection, content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb)
            RETURNING id
            """,
            agent_id, mission_id, task_id, collection, content,
            str(embedding), meta_json,
        )
    logger.debug(
        "stored memory id=%d collection=%s agent=%s len=%d",
        row_id, collection, agent_id, len(content),
    )
    return row_id


async def search(
    query: str,
    collection: str | None = None,
    agent_id: str | None = None,
    mission_id: str | None = None,
    limit: int = 10,
    threshold: float = 0.3,
) -> list[dict[str, Any]]:
    """Semantic search across vector memories.

    Returns a list of dicts with keys: id, content, collection, agent_id,
    mission_id, metadata, score, created_at.
    Score is cosine similarity (1.0 = identical, 0.0 = orthogonal).
    """
    query_embedding = await embed(query)

    # Build WHERE clause dynamically
    conditions = []
    params: list[Any] = [str(query_embedding)]
    param_idx = 2

    if collection:
        conditions.append(f"collection = ${param_idx}")
        params.append(collection)
        param_idx += 1

    if agent_id:
        conditions.append(f"agent_id = ${param_idx}")
        params.append(agent_id)
        param_idx += 1

    if mission_id:
        conditions.append(f"mission_id = ${param_idx}")
        params.append(mission_id)
        param_idx += 1

    where = ""
    if conditions:
        where = "WHERE " + " AND ".join(conditions)

    # Bind LIMIT as a parameter — never interpolate user-supplied integers into SQL
    # even though `limit` is typed as int, defense-in-depth prevents injection if
    # the type annotation is bypassed at a call site.
    limit_param = f"${param_idx}"
    params.append(limit)

    # Cosine distance: 1 - distance = similarity
    sql = f"""
        SELECT id, content, collection, agent_id, mission_id, metadata,
               1 - (embedding <=> $1::vector) AS score,
               created_at
        FROM vector_memories
        {where}
        ORDER BY embedding <=> $1::vector
        LIMIT {limit_param}
    """

    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    results = []
    for row in rows:
        score = float(row["score"])
        if score < threshold:
            continue
        results.append({
            "id": row["id"],
            "content": row["content"],
            "collection": row["collection"],
            "agent_id": row["agent_id"],
            "mission_id": row["mission_id"],
            "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
            "score": round(score, 4),
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        })

    return results


async def delete(memory_id: int) -> bool:
    """Delete a memory entry by ID."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM vector_memories WHERE id = $1", memory_id
        )
        return result == "DELETE 1"
