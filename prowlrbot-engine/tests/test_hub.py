"""Agent Hub tests — catalog, trust engine, MCP bridge, and API endpoints."""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient


# ---------------------------------------------------------------------------
# 1. Catalog loads from disk and has entries
# ---------------------------------------------------------------------------

def test_catalog_load():
    from src.hub.catalog import AgentCatalog
    catalog = AgentCatalog()
    entries = catalog.list_all()
    assert len(entries) > 0, "Expected at least one catalog entry"
    # Verify required fields exist on the first entry
    entry = entries[0]
    for field in ("id", "name", "description", "docker_image", "integration_type"):
        assert field in entry, f"Missing field '{field}' in catalog entry"


# ---------------------------------------------------------------------------
# 2. search(capability="recon") returns only agents with that capability
# ---------------------------------------------------------------------------

def test_catalog_search_by_capability():
    from src.hub.catalog import AgentCatalog
    catalog = AgentCatalog()
    results = catalog.search(capability="recon")
    assert len(results) > 0, "Expected at least one agent with 'recon' capability"
    for r in results:
        assert "recon" in r["capabilities"], f"Agent {r['id']} missing 'recon' in capabilities"


# ---------------------------------------------------------------------------
# 3. search(query="PentAGI") returns the PentAGI entry
# ---------------------------------------------------------------------------

def test_catalog_search_by_query():
    from src.hub.catalog import AgentCatalog
    catalog = AgentCatalog()
    results = catalog.search(query="PentAGI")
    assert len(results) >= 1, "Expected PentAGI to appear in query results"
    ids = [r["id"] for r in results]
    assert "pentagi" in ids, f"PentAGI not found in results: {ids}"


# ---------------------------------------------------------------------------
# 4. Built-in agents start with a trust score of 100
# ---------------------------------------------------------------------------

def test_trust_engine_builtin_score():
    from src.hub.trust import TrustEngine
    engine = TrustEngine()
    # ORCHESTRATOR is always a built-in
    record = engine.get("ORCHESTRATOR")
    assert record is not None, "ORCHESTRATOR should have a trust record"
    assert record.tier == "builtin"
    assert record.score == 100


# ---------------------------------------------------------------------------
# 5. Three successes yield a +9 performance bonus (3x per success, spec formula)
# ---------------------------------------------------------------------------

def test_trust_record_success():
    from src.hub.trust import TrustEngine
    engine = TrustEngine()
    engine.register("TEST_SUCCESS_AGENT", tier="community")  # base = 50
    engine.record_success("TEST_SUCCESS_AGENT")
    engine.record_success("TEST_SUCCESS_AGENT")
    engine.record_success("TEST_SUCCESS_AGENT")
    record = engine.get("TEST_SUCCESS_AGENT")
    assert record.successful_tasks == 3
    assert record.performance_bonus == 9   # 3 * 3 = 9
    assert record.score == 59              # 50 base + 9 bonus


# ---------------------------------------------------------------------------
# 5b. Performance bonus is capped at 30 (requires 10+ successes)
# ---------------------------------------------------------------------------

def test_trust_record_success_cap():
    from src.hub.trust import TrustEngine
    engine = TrustEngine()
    engine.register("TEST_CAP_AGENT", tier="community")  # base = 50
    for _ in range(15):
        engine.record_success("TEST_CAP_AGENT")
    record = engine.get("TEST_CAP_AGENT")
    assert record.performance_bonus == 30  # capped at 30 regardless of 15 * 3 = 45
    assert record.score == 80              # 50 + 30


# ---------------------------------------------------------------------------
# 6. Failures reduce score via the failure penalty — no cap on penalty
# ---------------------------------------------------------------------------

def test_trust_record_failure():
    from src.hub.trust import TrustEngine
    engine = TrustEngine()
    engine.register("TEST_FAIL_AGENT", tier="community")  # base = 50
    engine.record_failure("TEST_FAIL_AGENT")
    engine.record_failure("TEST_FAIL_AGENT")
    record = engine.get("TEST_FAIL_AGENT")
    assert record.failed_tasks == 2
    assert record.failure_penalty == 20
    assert record.score == 30  # 50 base - 20 penalty


# ---------------------------------------------------------------------------
# 6b. Failure penalty has no cap — many failures can drive score to zero
# ---------------------------------------------------------------------------

def test_trust_record_failure_no_cap():
    from src.hub.trust import TrustEngine
    engine = TrustEngine()
    engine.register("TEST_NOCAP_AGENT", tier="verified")  # base = 80
    for _ in range(10):
        engine.record_failure("TEST_NOCAP_AGENT")
    record = engine.get("TEST_NOCAP_AGENT")
    assert record.failure_penalty == 100  # 10 * 10, no cap
    assert record.score == 0             # clamped to 0


# ---------------------------------------------------------------------------
# 6c. Timeout penalty: -5 per timed-out task
# ---------------------------------------------------------------------------

def test_trust_record_timeout():
    from src.hub.trust import TrustEngine
    engine = TrustEngine()
    engine.register("TEST_TIMEOUT_AGENT", tier="community")  # base = 50
    engine.record_timeout("TEST_TIMEOUT_AGENT")
    engine.record_timeout("TEST_TIMEOUT_AGENT")
    record = engine.get("TEST_TIMEOUT_AGENT")
    assert record.timed_out_tasks == 2
    assert record.timeout_penalty == 10   # 2 * 5
    assert record.score == 40             # 50 base - 10 timeout penalty
    assert record.total_tasks == 2


# ---------------------------------------------------------------------------
# 6d. Combined: successes + failures + timeouts interact correctly
# ---------------------------------------------------------------------------

def test_trust_record_combined():
    from src.hub.trust import TrustEngine
    engine = TrustEngine()
    engine.register("TEST_COMBINED_AGENT", tier="community")  # base = 50
    for _ in range(4):
        engine.record_success("TEST_COMBINED_AGENT")   # +12 bonus (4*3)
    engine.record_failure("TEST_COMBINED_AGENT")       # -10
    engine.record_timeout("TEST_COMBINED_AGENT")       # -5
    record = engine.get("TEST_COMBINED_AGENT")
    assert record.performance_bonus == 12
    assert record.failure_penalty == 10
    assert record.timeout_penalty == 5
    assert record.score == 47  # 50 + 12 - 10 - 5


# ---------------------------------------------------------------------------
# 7. needs_approval: unknown requires approval; builtin does not
# ---------------------------------------------------------------------------

def test_trust_needs_approval():
    from src.hub.trust import TrustEngine
    engine = TrustEngine()
    engine.register("COMMUNITY_AGENT", tier="community")
    engine.register("VERIFIED_AGENT", tier="verified")

    # Unknown → no record → needs approval
    assert engine.needs_approval("DOES_NOT_EXIST") is True

    # Community without operator approval → needs approval
    assert engine.needs_approval("COMMUNITY_AGENT") is True

    # Verified → no approval needed
    assert engine.needs_approval("VERIFIED_AGENT") is False

    # Built-in → no approval needed
    assert engine.needs_approval("ORCHESTRATOR") is False

    # Community + operator approval → no approval needed
    engine.approve("COMMUNITY_AGENT")
    assert engine.needs_approval("COMMUNITY_AGENT") is False


# ---------------------------------------------------------------------------
# 8. rank_candidates returns highest-scoring agent first
# ---------------------------------------------------------------------------

def test_trust_rank_candidates():
    from src.hub.trust import TrustEngine
    engine = TrustEngine()
    engine.register("LOW_SCORE", tier="unknown")    # base 20
    engine.register("HIGH_SCORE", tier="verified")  # base 80
    engine.register("MID_SCORE", tier="community")  # base 50

    ranked = engine.rank_candidates(["LOW_SCORE", "HIGH_SCORE", "MID_SCORE"])
    assert len(ranked) == 3
    assert ranked[0]["agent_id"] == "HIGH_SCORE"
    assert ranked[-1]["agent_id"] == "LOW_SCORE"


# ---------------------------------------------------------------------------
# 9. MCPBridge register + is_mcp_agent works correctly
# ---------------------------------------------------------------------------

def test_mcp_bridge_register():
    from src.hub.mcp_bridge import MCPBridge
    bridge = MCPBridge()

    assert bridge.is_mcp_agent("NANOCLAW") is False

    bridge.register("NANOCLAW", "http://nanoclaw:3000/mcp")
    assert bridge.is_mcp_agent("NANOCLAW") is True
    # Case-insensitive lookup
    assert bridge.is_mcp_agent("nanoclaw") is True

    registered = bridge.list_registered()
    assert any(r["agent_id"] == "NANOCLAW" for r in registered)

    bridge.unregister("nanoclaw")
    assert bridge.is_mcp_agent("NANOCLAW") is False


# ---------------------------------------------------------------------------
# Shared test app fixture (hub router only, no DB required)
# ---------------------------------------------------------------------------

@pytest.fixture
def hub_app():
    """Minimal FastAPI app with only the hub router — no DB, no lifespan."""
    from fastapi import FastAPI
    from src.routers.hub import router as hub_router
    app = FastAPI()
    app.include_router(hub_router)
    return app


@pytest.fixture
async def hub_client(hub_app):
    transport = ASGITransport(app=hub_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# 10. GET /api/v2/hub/catalog returns catalog entries
# ---------------------------------------------------------------------------

async def test_hub_api_catalog(hub_client):
    resp = await hub_client.get("/api/v2/hub/catalog")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert isinstance(data["items"], list)
    assert len(data["items"]) > 0


# ---------------------------------------------------------------------------
# 11. GET /api/v2/hub/trust returns trust records for built-in agents
# ---------------------------------------------------------------------------

async def test_hub_api_trust(hub_client):
    resp = await hub_client.get("/api/v2/hub/trust")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert isinstance(data["items"], list)
    # At minimum the built-in agents should be present
    ids = [r["agent_id"] for r in data["items"]]
    assert "ORCHESTRATOR" in ids


# ---------------------------------------------------------------------------
# 12. GET /api/v2/hub/overview returns expected shape
# ---------------------------------------------------------------------------

async def test_hub_api_overview(hub_client):
    resp = await hub_client.get("/api/v2/hub/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    for key in ("total_agents", "builtin_agents", "external_agents", "catalog_entries",
                "installed_from_catalog", "mcp_bridges", "trust_records"):
        assert key in data, f"Missing key '{key}' in overview response"
    # Built-in agents should outnumber external at a fresh start
    assert data["builtin_agents"] > 0
    assert data["catalog_entries"] > 0


# ---------------------------------------------------------------------------
# 13. AgentDefinition new fields have correct defaults and appear in to_dict
# ---------------------------------------------------------------------------

def test_agent_definition_new_fields_defaults():
    from src.registry.agents import AgentDefinition
    agent = AgentDefinition(
        codename="TEST_NEW",
        display_name="Test New",
        description="Testing new fields",
        tools=["done"],
    )
    assert agent.trust_level == "builtin"
    assert agent.integration_type == "roar"
    assert agent.roar_did is None
    assert agent.roar_endpoint is None
    assert agent.successful_tasks == 0
    assert agent.failed_tasks == 0
    assert agent.timed_out_tasks == 0


def test_agent_definition_to_dict_includes_new_fields():
    from src.registry.agents import AgentDefinition
    agent = AgentDefinition(
        codename="TEST_DICT",
        display_name="Test Dict",
        description="to_dict coverage",
        tools=["done"],
        trust_level="community",
        integration_type="mcp",
        roar_did="did:harbinger:abc123",
        roar_endpoint="http://agent:9000",
        successful_tasks=5,
        failed_tasks=1,
        timed_out_tasks=2,
    )
    d = agent.to_dict()
    assert d["trust_level"] == "community"
    assert d["integration_type"] == "mcp"
    assert d["roar_did"] == "did:harbinger:abc123"
    assert d["roar_endpoint"] == "http://agent:9000"
    assert d["successful_tasks"] == 5
    assert d["failed_tasks"] == 1
    assert d["timed_out_tasks"] == 2


def test_agent_registry_get_config_includes_trust_fields():
    from src.registry.agents import AgentRegistry
    registry = AgentRegistry()
    config = registry.get_config("ORCHESTRATOR")
    assert "trust_level" in config
    assert "integration_type" in config
    assert config["trust_level"] == "builtin"
    assert config["integration_type"] == "roar"


# ---------------------------------------------------------------------------
# 14. TrustRecord to_dict includes new timeout fields
# ---------------------------------------------------------------------------

def test_trust_record_to_dict_includes_timeout():
    from src.hub.trust import TrustRecord
    record = TrustRecord(agent_id="TOTEST", tier="community", base_score=50, timed_out_tasks=3)
    d = record.to_dict()
    assert "timed_out_tasks" in d
    assert "timeout_penalty" in d
    assert d["timed_out_tasks"] == 3
    assert d["timeout_penalty"] == 15  # 3 * 5


# ---------------------------------------------------------------------------
# 15. Installer: _safety_check returns ok=True for a normal image
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_safety_check_passes():
    from src.hub.installer import _safety_check
    result = await _safety_check("harbinger/pd-tools:latest")
    assert result["ok"] is True


# ---------------------------------------------------------------------------
# 16. Installer: _health_check returns True when no endpoint given
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_check_no_endpoint():
    from src.hub.installer import _health_check
    result = await _health_check(None)
    assert result is True


# ---------------------------------------------------------------------------
# 17. Installer: _health_check returns False on HTTP error
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_check_http_error():
    import httpx
    from src.hub.installer import _health_check
    with patch("src.hub.installer.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
        mock_client_cls.return_value = mock_client
        result = await _health_check("http://unreachable:9999")
    assert result is False
