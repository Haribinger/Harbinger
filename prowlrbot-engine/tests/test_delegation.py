"""Tests for delegation tools and DAG scheduler."""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.engine.tools.delegation import (
    DelegationTool,
    DELEGATION_SCHEMAS,
    DELEGATION_AGENTS,
    SPECIALIST_MAX_ITERATIONS,
)
from src.engine.tools.registry import ToolExecutor, DELEGATION_TOOL_NAMES
from src.engine.scheduler import topological_sort, MissionScheduler, ApprovalGate


# ── Delegation tool schema tests ─────────────────────────────────────────────


class TestDelegationSchemas:
    def test_all_delegation_tools_have_schemas(self):
        expected = {"pentester", "coder", "maintenance", "search", "memorist", "advice"}
        assert set(DELEGATION_SCHEMAS.keys()) == expected

    def test_all_delegation_tools_have_agent_mapping(self):
        for tool_name in DELEGATION_SCHEMAS:
            assert tool_name in DELEGATION_AGENTS

    def test_pentester_schema_has_required_fields(self):
        schema = DELEGATION_SCHEMAS["pentester"]
        assert schema["name"] == "pentester"
        assert "task" in schema["parameters"]["properties"]
        assert "task" in schema["parameters"]["required"]

    def test_coder_schema_has_language_field(self):
        schema = DELEGATION_SCHEMAS["coder"]
        assert "language" in schema["parameters"]["properties"]

    def test_search_schema_uses_query_not_task(self):
        schema = DELEGATION_SCHEMAS["search"]
        assert "query" in schema["parameters"]["properties"]
        assert "query" in schema["parameters"]["required"]

    def test_advice_schema_uses_situation(self):
        schema = DELEGATION_SCHEMAS["advice"]
        assert "situation" in schema["parameters"]["properties"]
        assert "situation" in schema["parameters"]["required"]

    def test_specialist_iterations_capped(self):
        for tool_name, max_iter in SPECIALIST_MAX_ITERATIONS.items():
            # Specialists should have fewer iterations than ORCHESTRATOR (100)
            assert max_iter <= 50


class TestDelegationTool:
    def test_create_valid_tool(self):
        dt = DelegationTool("pentester")
        assert dt.agent_codename == "BREACH"
        assert dt.max_iterations == 50

    def test_create_invalid_tool(self):
        with pytest.raises(ValueError, match="Unknown delegation tool"):
            DelegationTool("nonexistent")

    def test_schema_returns_correct_structure(self):
        dt = DelegationTool("coder")
        schema = dt.schema()
        assert schema["name"] == "coder"
        assert "parameters" in schema

    @pytest.mark.asyncio
    async def test_execute_without_llm_returns_error(self):
        dt = DelegationTool("pentester", llm=None)
        result = await dt.execute({"task": "scan target"})
        assert "No LLM configured" in result

    @pytest.mark.asyncio
    async def test_execute_with_mock_llm(self):
        mock_llm = AsyncMock()
        mock_llm.call_with_tools = AsyncMock(return_value={
            "usage": {"input": 10, "output": 20},
            "tool_calls": [{"name": "done", "args": {"result": "scan complete"}, "id": "1"}],
        })

        dt = DelegationTool("pentester", llm=mock_llm)
        result = await dt.execute({"task": "scan 10.0.0.1", "context": "port 80 open"})
        assert "BREACH" in result
        assert "done" in result.lower() or "scan complete" in result.lower()


# ── ToolExecutor registration tests ──────────────────────────────────────────


class TestToolExecutorDelegation:
    def test_delegation_tools_not_registered_by_default(self):
        executor = ToolExecutor(allowed_tools=["terminal", "file"])
        assert not executor.has_tool("pentester")
        assert not executor.has_tool("coder")

    def test_delegation_tools_registered_when_allowed(self):
        mock_llm = MagicMock()
        executor = ToolExecutor(
            allowed_tools=["pentester", "coder", "done"],
            llm=mock_llm,
        )
        assert executor.has_tool("pentester")
        assert executor.has_tool("coder")
        assert executor.is_delegation("pentester")
        assert not executor.is_delegation("done")

    def test_tool_definitions_include_delegation(self):
        mock_llm = MagicMock()
        executor = ToolExecutor(
            allowed_tools=["pentester", "done"],
            llm=mock_llm,
        )
        defs = executor.get_tool_definitions()
        names = [d["function"]["name"] for d in defs]
        assert "pentester" in names
        assert "done" in names


# ── Topological sort tests ───────────────────────────────────────────────────


class MockTask:
    """Minimal mock for topological sort testing."""
    def __init__(self, id, depends_on=None, priority=0, status="created"):
        self.id = id
        self.depends_on = depends_on or []
        self.priority = priority
        self.status = status


class TestTopologicalSort:
    def test_no_dependencies(self):
        tasks = [MockTask(1), MockTask(2), MockTask(3)]
        layers = topological_sort(tasks)
        assert len(layers) == 1
        assert set(layers[0]) == {1, 2, 3}

    def test_linear_chain(self):
        tasks = [
            MockTask(1),
            MockTask(2, depends_on=[1]),
            MockTask(3, depends_on=[2]),
        ]
        layers = topological_sort(tasks)
        assert len(layers) == 3
        assert layers[0] == [1]
        assert layers[1] == [2]
        assert layers[2] == [3]

    def test_diamond_dependency(self):
        #   1
        #  / \
        # 2   3
        #  \ /
        #   4
        tasks = [
            MockTask(1),
            MockTask(2, depends_on=[1]),
            MockTask(3, depends_on=[1]),
            MockTask(4, depends_on=[2, 3]),
        ]
        layers = topological_sort(tasks)
        assert len(layers) == 3
        assert layers[0] == [1]
        assert set(layers[1]) == {2, 3}
        assert layers[2] == [4]

    def test_priority_ordering_within_layer(self):
        tasks = [
            MockTask(1, priority=1),
            MockTask(2, priority=10),  # higher priority
            MockTask(3, priority=5),
        ]
        layers = topological_sort(tasks)
        assert len(layers) == 1
        # Higher priority first
        assert layers[0][0] == 2
        assert layers[0][1] == 3
        assert layers[0][2] == 1

    def test_empty_task_list(self):
        layers = topological_sort([])
        assert layers == []

    def test_single_task(self):
        layers = topological_sort([MockTask(1)])
        assert layers == [[1]]

    def test_complex_dag(self):
        # Layer 0: A, B
        # Layer 1: C(depends A), D(depends B)
        # Layer 2: E(depends C, D)
        tasks = [
            MockTask(1),            # A
            MockTask(2),            # B
            MockTask(3, [1]),       # C
            MockTask(4, [2]),       # D
            MockTask(5, [3, 4]),    # E
        ]
        layers = topological_sort(tasks)
        assert len(layers) == 3
        assert set(layers[0]) == {1, 2}
        assert set(layers[1]) == {3, 4}
        assert layers[2] == [5]


# ── Approval gate tests ─────────────────────────────────────────────────────


class TestApprovalGate:
    @pytest.mark.asyncio
    async def test_approve_task(self):
        gate = ApprovalGate()

        async def approve_later():
            await asyncio.sleep(0.1)
            gate.respond(42, True)

        asyncio.create_task(approve_later())
        result = await gate.request_approval(42, timeout=5)
        assert result is True

    @pytest.mark.asyncio
    async def test_deny_task(self):
        gate = ApprovalGate()

        async def deny_later():
            await asyncio.sleep(0.1)
            gate.respond(42, False)

        asyncio.create_task(deny_later())
        result = await gate.request_approval(42, timeout=5)
        assert result is False

    @pytest.mark.asyncio
    async def test_timeout_returns_false(self):
        gate = ApprovalGate()
        result = await gate.request_approval(99, timeout=0.1)
        assert result is False

    def test_respond_without_pending(self):
        gate = ApprovalGate()
        assert gate.respond(999, True) is False

    def test_pending_tasks(self):
        gate = ApprovalGate()
        assert gate.pending_tasks == []
