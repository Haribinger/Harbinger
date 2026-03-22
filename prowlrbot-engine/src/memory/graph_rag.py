"""
Graph-enhanced RAG — combines pgvector semantic search with Neo4j graph traversal.

This is Harbinger's LightRAG-style retrieval:
  1. Query → embed → pgvector cosine search (semantic)
  2. Query → entity extraction → Neo4j graph expansion (structural)
  3. Merge + rerank results by combined relevance

Why this matters: "What vulns affect hosts with exposed SSH on port 22?"
  - Vector search finds docs mentioning SSH vulnerabilities
  - Graph traversal finds Host→Service(port=22)→Vulnerability chains
  - Combined: you get both semantic matches AND structural relationships

No external LightRAG dependency needed — we implement the pattern directly
against our existing pgvector + Neo4j infrastructure.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from src.memory.ingest import extract_entities

logger = logging.getLogger(__name__)


@dataclass
class RAGResult:
    """A single retrieval result with provenance tracking."""
    content: str
    score: float  # 0.0-1.0, higher = more relevant
    source: str  # "vector", "graph", or "combined"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class GraphRAGResponse:
    """Combined results from graph-enhanced retrieval."""
    results: list[RAGResult]
    vector_count: int = 0
    graph_count: int = 0
    query_entities: dict[str, list[str]] = field(default_factory=dict)


async def graph_rag_search(
    query: str,
    collection: str | None = None,
    mission_id: str | None = None,
    limit: int = 10,
    vector_weight: float = 0.6,
    graph_weight: float = 0.4,
) -> GraphRAGResponse:
    """
    Graph-enhanced RAG retrieval.

    1. Run pgvector semantic search in parallel with entity extraction
    2. For extracted entities, traverse Neo4j to find related content
    3. Merge and rerank by weighted score
    """
    from src.memory import store as vector_store
    from src.memory import graph as graph_store

    # Phase 1: Parallel — vector search + entity extraction
    vector_task = asyncio.create_task(
        vector_store.search(
            query=query,
            collection=collection,
            mission_id=mission_id,
            limit=limit * 2,  # over-fetch for reranking
            threshold=0.2,
        )
    )

    entities = extract_entities(query)

    vector_results = await vector_task

    # Phase 2: Graph expansion for extracted entities
    graph_results: list[RAGResult] = []

    if graph_store.graph_available():
        graph_results = await _graph_expand(graph_store, entities, limit)

    # Phase 3: Merge and rerank
    merged = _merge_results(
        vector_results, graph_results,
        vector_weight=vector_weight,
        graph_weight=graph_weight,
        limit=limit,
    )

    return GraphRAGResponse(
        results=merged,
        vector_count=len(vector_results),
        graph_count=len(graph_results),
        query_entities=entities,
    )


async def _graph_expand(
    graph_store,
    entities: dict[str, list[str]],
    limit: int,
) -> list[RAGResult]:
    """Expand entities through the knowledge graph."""
    results: list[RAGResult] = []

    try:
        # Search for hosts and their connected vulnerabilities
        for host in entities.get("hosts", []) + entities.get("domains", []):
            try:
                host_data = await graph_store.search_graph(
                    query=host, search_type="host"
                )
                for item in (host_data if isinstance(host_data, list) else [host_data]):
                    if item:
                        results.append(RAGResult(
                            content=_format_graph_result(item),
                            score=0.8,  # graph hits are high confidence
                            source="graph",
                            metadata={"entity_type": "host", "entity": host, **_safe_dict(item)},
                        ))
            except Exception:
                pass

        # Search for CVE details
        for cve in entities.get("cves", []):
            try:
                cve_data = await graph_store.search_graph(
                    query=cve, search_type="vulnerability"
                )
                for item in (cve_data if isinstance(cve_data, list) else [cve_data]):
                    if item:
                        results.append(RAGResult(
                            content=_format_graph_result(item),
                            score=0.9,  # exact CVE match
                            source="graph",
                            metadata={"entity_type": "vulnerability", "entity": cve, **_safe_dict(item)},
                        ))
            except Exception:
                pass

        # Search for techniques
        for technique in entities.get("techniques", []):
            try:
                tech_data = await graph_store.search_graph(
                    query=technique, search_type="technique"
                )
                for item in (tech_data if isinstance(tech_data, list) else [tech_data]):
                    if item:
                        results.append(RAGResult(
                            content=_format_graph_result(item),
                            score=0.7,
                            source="graph",
                            metadata={"entity_type": "technique", "entity": technique, **_safe_dict(item)},
                        ))
            except Exception:
                pass

    except Exception as exc:
        logger.debug("graph expansion failed (non-fatal): %s", exc)

    return results[:limit]


def _format_graph_result(data: Any) -> str:
    """Format a graph result into readable text."""
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        parts = []
        for key, val in data.items():
            if val and key not in ("_id", "element_id"):
                parts.append(f"{key}: {val}")
        return "\n".join(parts)
    return str(data)


def _safe_dict(data: Any) -> dict:
    """Safely convert to dict for metadata."""
    if isinstance(data, dict):
        return {k: v for k, v in data.items() if isinstance(v, (str, int, float, bool, type(None)))}
    return {}


def _merge_results(
    vector_results: list[dict],
    graph_results: list[RAGResult],
    vector_weight: float,
    graph_weight: float,
    limit: int,
) -> list[RAGResult]:
    """Merge vector + graph results with weighted scoring and deduplication."""
    seen_content: set[str] = set()
    merged: list[RAGResult] = []

    # Convert vector results to RAGResult
    for vr in vector_results:
        content = vr.get("content", "")
        content_key = content[:200]  # dedup key
        if content_key in seen_content:
            continue
        seen_content.add(content_key)

        merged.append(RAGResult(
            content=content,
            score=vr.get("score", 0.5) * vector_weight,
            source="vector",
            metadata={
                "collection": vr.get("collection"),
                "agent_id": vr.get("agent_id"),
                "original_score": vr.get("score"),
            },
        ))

    # Add graph results
    for gr in graph_results:
        content_key = gr.content[:200]
        if content_key in seen_content:
            # Boost existing vector result if graph also found it
            for m in merged:
                if m.content[:200] == content_key:
                    m.score += gr.score * graph_weight
                    m.source = "combined"
                    break
            continue
        seen_content.add(content_key)

        gr.score *= graph_weight
        merged.append(gr)

    # Sort by score descending
    merged.sort(key=lambda r: r.score, reverse=True)
    return merged[:limit]
