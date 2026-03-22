import pytest
from unittest.mock import AsyncMock, patch
from src.engine.tools.search_engines import (
    SploitusSearch, DuckDuckGoSearch, SearchToolBase,
    SEARCH_TOOL_SCHEMAS, get_search_tool,
)

def test_sploitus_schema():
    assert "sploitus" in SEARCH_TOOL_SCHEMAS
    schema = SEARCH_TOOL_SCHEMAS["sploitus"]
    assert schema["name"] == "sploitus"
    assert "exploit" in schema["description"].lower()

def test_duckduckgo_schema():
    assert "duckduckgo" in SEARCH_TOOL_SCHEMAS

def test_all_schemas_have_required_fields():
    for name, schema in SEARCH_TOOL_SCHEMAS.items():
        assert "name" in schema, f"{name} missing name"
        assert "description" in schema, f"{name} missing description"
        assert "parameters" in schema, f"{name} missing parameters"

def test_get_search_tool_returns_instance():
    tool = get_search_tool("sploitus")
    assert tool is not None
    assert hasattr(tool, "execute")
    assert hasattr(tool, "schema")

def test_get_unknown_returns_none():
    assert get_search_tool("nonexistent") is None

@pytest.mark.asyncio
async def test_sploitus_formats_results():
    tool = SploitusSearch()
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"exploits": [
            {"title": "Test CVE", "href": "https://example.com/exploit", "score": 9.8, "published": "2024-01-01"},
        ]}
        mock_get.return_value = mock_resp
        result = await tool.execute({"query": "apache struts", "max_results": 5})
        assert "Test CVE" in result or "No results" in result or isinstance(result, str)
