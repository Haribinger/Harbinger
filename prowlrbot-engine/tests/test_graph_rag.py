"""Tests for graph-enhanced RAG — the merge/rerank logic and entity extraction."""

import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from src.memory.graph_rag import (
    graph_rag_search,
    _merge_results,
    _format_graph_result,
    RAGResult,
    GraphRAGResponse,
)


# ── Unit tests for merge/rerank ──────────────────────────────────────────────

def test_merge_vector_only():
    vector_results = [
        {"content": "SQL injection on port 443", "score": 0.9, "collection": "answer"},
        {"content": "XSS in search parameter", "score": 0.7, "collection": "answer"},
    ]
    merged = _merge_results(vector_results, [], vector_weight=0.6, graph_weight=0.4, limit=10)
    assert len(merged) == 2
    assert merged[0].source == "vector"
    assert merged[0].score == pytest.approx(0.54, abs=0.01)  # 0.9 * 0.6


def test_merge_graph_only():
    graph_results = [
        RAGResult(content="Host 10.0.0.1 has SSH", score=0.8, source="graph", metadata={}),
    ]
    merged = _merge_results([], graph_results, vector_weight=0.6, graph_weight=0.4, limit=10)
    assert len(merged) == 1
    assert merged[0].source == "graph"
    assert merged[0].score == pytest.approx(0.32, abs=0.01)  # 0.8 * 0.4


def test_merge_combined_boost():
    """When both vector and graph find the same content, score gets boosted."""
    vector_results = [
        {"content": "CVE-2024-3400 on PAN-OS gateway", "score": 0.8, "collection": "answer"},
    ]
    graph_results = [
        RAGResult(content="CVE-2024-3400 on PAN-OS gateway", score=0.9, source="graph", metadata={}),
    ]
    merged = _merge_results(vector_results, graph_results, vector_weight=0.6, graph_weight=0.4, limit=10)
    assert len(merged) == 1
    assert merged[0].source == "combined"
    # Vector: 0.8 * 0.6 = 0.48, Graph boost: 0.9 * 0.4 = 0.36, Total: 0.84
    assert merged[0].score == pytest.approx(0.84, abs=0.01)


def test_merge_deduplication():
    """Same content from both sources should be deduped."""
    vector_results = [
        {"content": "Same content here", "score": 0.8, "collection": "guide"},
    ]
    graph_results = [
        RAGResult(content="Same content here", score=0.7, source="graph", metadata={}),
    ]
    merged = _merge_results(vector_results, graph_results, vector_weight=0.6, graph_weight=0.4, limit=10)
    assert len(merged) == 1  # Not 2


def test_merge_respects_limit():
    vector_results = [
        {"content": f"result {i}", "score": 0.5, "collection": "answer"}
        for i in range(20)
    ]
    merged = _merge_results(vector_results, [], vector_weight=0.6, graph_weight=0.4, limit=5)
    assert len(merged) == 5


def test_merge_sorted_by_score():
    vector_results = [
        {"content": "low score", "score": 0.3, "collection": "answer"},
        {"content": "high score", "score": 0.9, "collection": "answer"},
        {"content": "mid score", "score": 0.6, "collection": "answer"},
    ]
    merged = _merge_results(vector_results, [], vector_weight=1.0, graph_weight=0.0, limit=10)
    scores = [r.score for r in merged]
    assert scores == sorted(scores, reverse=True)


# ── Format helpers ───────────────────────────────────────────────────────────

def test_format_graph_result_dict():
    result = _format_graph_result({"ip": "10.0.0.1", "hostname": "server1", "_id": "internal"})
    assert "10.0.0.1" in result
    assert "server1" in result
    assert "_id" not in result  # filtered out


def test_format_graph_result_string():
    assert _format_graph_result("plain text") == "plain text"


def test_format_graph_result_other():
    assert _format_graph_result(42) == "42"


# ── Integration test with mocked backends ────────────────────────────────────

@pytest.mark.asyncio
async def test_graph_rag_search_vector_only():
    """Test full search pipeline with only vector results (graph unavailable)."""
    mock_vector_search = AsyncMock(return_value=[
        {"content": "Found XSS on example.com", "score": 0.85, "collection": "answer",
         "agent_id": "BREACH", "mission_id": "1"},
    ])

    with patch("src.memory.store.search", mock_vector_search), \
         patch("src.memory.graph.graph_available", return_value=False):
        response = await graph_rag_search("XSS vulnerabilities", limit=5)

    assert isinstance(response, GraphRAGResponse)
    assert response.graph_count == 0


@pytest.mark.asyncio
async def test_graph_rag_search_with_entities():
    """Test that entity extraction works on the query."""
    from src.memory.ingest import extract_entities

    entities = extract_entities("What vulnerabilities affect 192.168.1.1 with CVE-2024-3400?")
    assert "192.168.1.1" in entities["hosts"]
    assert "CVE-2024-3400" in entities["cves"]
