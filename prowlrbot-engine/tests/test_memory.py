"""Tests for memory store, knowledge graph, and memory tools."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.engine.tools.memory_tools import (
    MemoryTool,
    MEMORY_SCHEMAS,
    MEMORY_TOOL_NAMES,
)
from src.engine.tools.registry import ToolExecutor
from src.memory.graph import (
    search_graph,
    store_host,
    store_service,
    store_vulnerability,
    store_credential,
    store_technique,
    store_execution,
    get_attack_surface,
)
from src.memory.store import VALID_COLLECTIONS, EMBEDDING_DIM


# ── Memory tool schema tests ────────────────────────────────────────────────


class TestMemoryToolSchemas:
    def test_all_memory_tools_have_schemas(self):
        expected = {
            "search_in_memory", "search_guide", "store_guide",
            "search_answer", "store_answer", "search_code", "store_code",
            "graphiti_search",
        }
        assert set(MEMORY_SCHEMAS.keys()) == expected

    def test_search_in_memory_has_query_required(self):
        schema = MEMORY_SCHEMAS["search_in_memory"]
        assert "query" in schema["parameters"]["required"]

    def test_store_guide_has_content_required(self):
        schema = MEMORY_SCHEMAS["store_guide"]
        assert "content" in schema["parameters"]["required"]

    def test_store_answer_has_question_and_answer_required(self):
        schema = MEMORY_SCHEMAS["store_answer"]
        assert "question" in schema["parameters"]["required"]
        assert "answer" in schema["parameters"]["required"]

    def test_store_code_has_content_required(self):
        schema = MEMORY_SCHEMAS["store_code"]
        assert "content" in schema["parameters"]["required"]
        assert "language" in schema["parameters"]["properties"]

    def test_search_guide_has_query_required(self):
        schema = MEMORY_SCHEMAS["search_guide"]
        assert "query" in schema["parameters"]["required"]


class TestMemoryTool:
    def test_create_valid_tool(self):
        mt = MemoryTool("search_in_memory")
        assert mt.tool_name == "search_in_memory"

    def test_create_invalid_tool(self):
        with pytest.raises(ValueError, match="Unknown memory tool"):
            MemoryTool("nonexistent_tool")

    def test_schema_returns_correct_structure(self):
        mt = MemoryTool("store_code")
        schema = mt.schema()
        assert schema["name"] == "store_code"
        assert "parameters" in schema


class TestMemoryToolExecution:
    @pytest.mark.asyncio
    async def test_search_empty_query(self):
        mt = MemoryTool("search_in_memory")
        with patch("src.memory.store.search", new_callable=AsyncMock) as mock_search:
            result = await mt.execute({"query": ""})
            assert "No query" in result

    @pytest.mark.asyncio
    async def test_store_empty_content(self):
        mt = MemoryTool("store_guide")
        with patch("src.memory.store.store", new_callable=AsyncMock):
            result = await mt.execute({"content": ""})
            assert "No content" in result

    @pytest.mark.asyncio
    async def test_search_returns_results(self):
        mt = MemoryTool("search_in_memory")
        mock_results = [
            {"id": 1, "content": "test finding", "collection": "general",
             "agent_id": "", "mission_id": "", "metadata": {},
             "score": 0.85, "created_at": None}
        ]
        with patch("src.memory.store.search", new_callable=AsyncMock, return_value=mock_results):
            result = await mt.execute({"query": "test"})
            assert "1 result" in result
            assert "test finding" in result
            assert "85%" in result

    @pytest.mark.asyncio
    async def test_search_no_results(self):
        mt = MemoryTool("search_in_memory")
        with patch("src.memory.store.search", new_callable=AsyncMock, return_value=[]):
            result = await mt.execute({"query": "nonexistent"})
            assert "No relevant" in result

    @pytest.mark.asyncio
    async def test_store_guide_success(self):
        mt = MemoryTool("store_guide")
        with patch("src.memory.store.store", new_callable=AsyncMock, return_value=42):
            result = await mt.execute({"content": "How to exploit SQLi", "title": "SQLi Guide"})
            assert "guide" in result
            assert "42" in result

    @pytest.mark.asyncio
    async def test_store_answer_combines_q_and_a(self):
        mt = MemoryTool("store_answer")
        with patch("src.memory.store.store", new_callable=AsyncMock, return_value=7) as mock:
            result = await mt.execute({"question": "What is XSS?", "answer": "Cross-site scripting"})
            assert "answer" in result
            # Verify Q&A was combined into content
            stored_content = mock.call_args.kwargs.get("content", "")
            assert "Q: What is XSS?" in stored_content
            assert "A: Cross-site scripting" in stored_content

    @pytest.mark.asyncio
    async def test_store_code_wraps_in_codeblock(self):
        mt = MemoryTool("store_code")
        with patch("src.memory.store.store", new_callable=AsyncMock, return_value=99) as mock:
            result = await mt.execute({
                "content": "print('hello')",
                "language": "python",
                "description": "Simple hello world",
            })
            assert "code" in result
            stored_content = mock.call_args.kwargs.get("content", "")
            assert "```python" in stored_content

    @pytest.mark.asyncio
    async def test_search_guide_filters_collection(self):
        mt = MemoryTool("search_guide")
        with patch("src.memory.store.search", new_callable=AsyncMock, return_value=[]) as mock:
            await mt.execute({"query": "nuclei"})
            mock.assert_called_once()
            assert mock.call_args.kwargs["collection"] == "guide"


# ── ToolExecutor memory registration tests ───────────────────────────────────


class TestToolExecutorMemory:
    def test_memory_tools_registered_when_allowed(self):
        executor = ToolExecutor(
            allowed_tools=["search_in_memory", "store_answer", "done"],
        )
        assert executor.has_tool("search_in_memory")
        assert executor.has_tool("store_answer")
        assert executor.has_tool("done")
        # Not requested
        assert not executor.has_tool("store_code")

    def test_memory_tools_not_in_default(self):
        executor = ToolExecutor(allowed_tools=["terminal", "file"])
        assert not executor.has_tool("search_in_memory")

    def test_tool_definitions_include_memory(self):
        executor = ToolExecutor(
            allowed_tools=["search_in_memory", "done"],
        )
        defs = executor.get_tool_definitions()
        names = [d["function"]["name"] for d in defs]
        assert "search_in_memory" in names


# ── Memory store constants tests ─────────────────────────────────────────────


class TestMemoryStoreConstants:
    def test_valid_collections(self):
        assert "answer" in VALID_COLLECTIONS
        assert "guide" in VALID_COLLECTIONS
        assert "code" in VALID_COLLECTIONS
        assert "general" in VALID_COLLECTIONS

    def test_embedding_dim(self):
        assert EMBEDDING_DIM == 1536


# ── Graph client tests (mocked Neo4j) ───────────────────────────────────────


class TestGraphClient:
    @pytest.mark.asyncio
    async def test_search_graph_hosts(self):
        mock_records = [
            {"ip": "10.0.0.1", "hostname": "target.com", "services": []}
        ]
        with patch("src.memory.graph._run_query", new_callable=AsyncMock, return_value=mock_records):
            results = await search_graph("", search_type="hosts")
            assert len(results) == 1
            assert results[0]["ip"] == "10.0.0.1"

    @pytest.mark.asyncio
    async def test_search_graph_vulns(self):
        mock_records = [
            {"vuln_id": "CVE-2024-1234", "severity": "critical",
             "title": "RCE", "host": "10.0.0.1", "port": 80}
        ]
        with patch("src.memory.graph._run_query", new_callable=AsyncMock, return_value=mock_records):
            results = await search_graph("", search_type="vulns")
            assert results[0]["severity"] == "critical"

    @pytest.mark.asyncio
    async def test_search_graph_credentials(self):
        mock_records = [
            {"host": "10.0.0.1", "username": "admin", "valid": True}
        ]
        with patch("src.memory.graph._run_query", new_callable=AsyncMock, return_value=mock_records):
            results = await search_graph("", search_type="credentials")
            assert results[0]["username"] == "admin"

    @pytest.mark.asyncio
    async def test_search_graph_general(self):
        mock_records = [
            {"type": "host", "id": "10.0.0.1", "label": "target.com"}
        ]
        with patch("src.memory.graph._run_query", new_callable=AsyncMock, return_value=mock_records):
            results = await search_graph("target", search_type="general")
            assert results[0]["type"] == "host"

    @pytest.mark.asyncio
    async def test_store_host(self):
        with patch("src.memory.graph._run_query", new_callable=AsyncMock, return_value=[{"host": {"ip": "10.0.0.1"}}]):
            result = await store_host("10.0.0.1", "target.com")
            assert "host" in result

    @pytest.mark.asyncio
    async def test_attack_surface(self):
        mock_hosts = [
            {"ip": "10.0.0.1", "hostname": "a.com", "services": 3, "vulnerabilities": 2},
            {"ip": "10.0.0.2", "hostname": "b.com", "services": 1, "vulnerabilities": 0},
        ]
        with patch("src.memory.graph._run_query", new_callable=AsyncMock, return_value=mock_hosts):
            surface = await get_attack_surface(123)
            assert surface["total_hosts"] == 2
            assert surface["total_services"] == 4
            assert surface["total_vulns"] == 2

    @pytest.mark.asyncio
    async def test_graph_unavailable_returns_empty(self):
        with patch("src.memory.graph._run_query", new_callable=AsyncMock, return_value=[]):
            results = await search_graph("anything", search_type="hosts")
            assert results == []

    @pytest.mark.asyncio
    async def test_store_execution_records_agent(self):
        with patch("src.memory.graph._run_query", new_callable=AsyncMock) as mock:
            await store_execution("BREACH", "nuclei", "-u http://target.com", "3 vulns found", 12.5)
            mock.assert_called_once()
            query = mock.call_args[0][0]
            assert "Agent" in query
            assert "PERFORMED" in query
