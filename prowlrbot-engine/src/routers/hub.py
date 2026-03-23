"""Agent Hub API — single control surface for the agent ecosystem."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.hub.catalog import agent_catalog
from src.hub.installer import install_from_catalog, install_agent, uninstall_agent
from src.hub.trust import trust_engine
from src.hub.sync import sync_registries
from src.hub.mcp_bridge import mcp_bridge

router = APIRouter(prefix="/api/v2/hub", tags=["agent-hub"])


# ── Catalog ──────────────────────────────────────────────────

@router.get("/catalog")
async def list_catalog(query: str = "", capability: str = "", integration_type: str = ""):
    results = agent_catalog.search(query=query, capability=capability, integration_type=integration_type)
    return {"ok": True, "items": results}

@router.get("/catalog/{agent_id}")
async def get_catalog_entry(agent_id: str):
    entry = agent_catalog.get(agent_id)
    if not entry:
        raise HTTPException(404, detail=f"Agent '{agent_id}' not in catalog")
    return {"ok": True, "agent": entry.to_dict()}


# ── Install / Uninstall ─────────────────────────────────────

class InstallRequest(BaseModel):
    catalog_id: str

class CustomInstallRequest(BaseModel):
    codename: str
    display_name: str
    description: str = ""
    docker_image: str
    integration_type: str = "docker"
    capabilities: list[str] = []
    roar_endpoint: str | None = None
    mcp_endpoint: str | None = None

@router.post("/install")
async def install_catalog_agent(body: InstallRequest):
    result = await install_from_catalog(body.catalog_id)
    if not result["ok"]:
        raise HTTPException(400, detail=result["error"])
    return result

@router.post("/install/custom")
async def install_custom_agent(body: CustomInstallRequest):
    result = await install_agent(
        codename=body.codename,
        display_name=body.display_name,
        description=body.description,
        docker_image=body.docker_image,
        integration_type=body.integration_type,
        capabilities=body.capabilities,
        roar_endpoint=body.roar_endpoint,
        mcp_endpoint=body.mcp_endpoint,
        trust_tier="unknown",
    )
    if not result["ok"]:
        raise HTTPException(400, detail=result["error"])
    return result

@router.delete("/agents/{codename}")
async def uninstall_hub_agent(codename: str):
    result = await uninstall_agent(codename)
    if not result["ok"]:
        raise HTTPException(400, detail=result["error"])
    return result


# ── Trust ────────────────────────────────────────────────────

@router.get("/trust")
async def list_trust_scores():
    return {"ok": True, "items": trust_engine.list_all()}

@router.get("/trust/{agent_id}")
async def get_trust_score(agent_id: str):
    record = trust_engine.get(agent_id)
    if not record:
        raise HTTPException(404, detail=f"No trust record for '{agent_id}'")
    return {"ok": True, "trust": record.to_dict()}

class SetTierRequest(BaseModel):
    tier: str

@router.put("/trust/{agent_id}/tier")
async def set_trust_tier(agent_id: str, body: SetTierRequest):
    trust_engine.set_tier(agent_id, body.tier)
    return {"ok": True, "agent_id": agent_id, "tier": body.tier}

@router.post("/trust/{agent_id}/approve")
async def approve_agent(agent_id: str):
    trust_engine.approve(agent_id)
    return {"ok": True, "agent_id": agent_id}

class RankRequest(BaseModel):
    candidates: list[str]

@router.post("/trust/rank")
async def rank_candidates(body: RankRequest):
    ranked = trust_engine.rank_candidates(body.candidates)
    return {"ok": True, "ranked": ranked}


# ── Sync ─────────────────────────────────────────────────────

@router.post("/sync")
async def trigger_sync():
    stats = await sync_registries()
    return {"ok": True, **stats}


# ── MCP Bridge ───────────────────────────────────────────────

@router.get("/mcp")
async def list_mcp_agents():
    return {"ok": True, "items": mcp_bridge.list_registered()}

class MCPToolCallRequest(BaseModel):
    tool_name: str
    args: dict = {}

@router.post("/mcp/{agent_id}/call")
async def call_mcp_tool(agent_id: str, body: MCPToolCallRequest):
    if not mcp_bridge.is_mcp_agent(agent_id):
        raise HTTPException(404, detail=f"No MCP bridge for '{agent_id}'")
    result = await mcp_bridge.execute_tool(agent_id, body.tool_name, body.args)
    return {"ok": True, "result": result}

@router.get("/mcp/{agent_id}/tools")
async def list_mcp_tools(agent_id: str):
    tools = await mcp_bridge.list_tools(agent_id)
    return {"ok": True, "tools": tools}


# ── Overview ─────────────────────────────────────────────────

@router.get("/overview")
async def hub_overview():
    from src.registry.agents import agent_registry
    all_agents = agent_registry.list_all()
    catalog = agent_catalog.list_all()
    trust = trust_engine.list_all()
    mcp = mcp_bridge.list_registered()

    return {
        "ok": True,
        "total_agents": len(all_agents),
        "builtin_agents": sum(1 for a in all_agents if agent_registry.is_builtin(a["codename"])),
        "external_agents": sum(1 for a in all_agents if not agent_registry.is_builtin(a["codename"])),
        "catalog_entries": len(catalog),
        "installed_from_catalog": sum(1 for c in catalog if c.get("installed")),
        "mcp_bridges": len(mcp),
        "trust_records": len(trust),
    }
