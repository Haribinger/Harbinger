"""Registry sync — keeps Python AgentRegistry and Go ROAR directory in sync.

Called at startup and periodically. Python is source of truth for config,
Go is source of truth for messaging/DID.
"""
import logging
import httpx
from src.config import settings
from src.registry.agents import agent_registry
from src.hub.trust import trust_engine

logger = logging.getLogger(__name__)

GO_BACKEND_URL = getattr(settings, "GO_BACKEND_URL", "http://localhost:8080")


async def sync_registries() -> dict:
    """Sync Python registry with Go ROAR directory.

    1. Read all agents from Go ROAR
    2. For any in ROAR but not in Python → add to Python with trust_tier=unknown
    3. For any in Python (external) but not in ROAR → register in ROAR
    """
    stats = {"synced": 0, "added_to_python": 0, "added_to_roar": 0, "errors": 0}

    # Get Go ROAR agents
    roar_agents = {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{GO_BACKEND_URL}/api/roar/agents",
                headers=_auth_headers(),
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data if isinstance(data, list) else data.get("items", [])
                for agent in items:
                    codename = agent.get("codename", "").upper()
                    if codename:
                        roar_agents[codename] = agent
    except httpx.HTTPError as e:
        logger.warning("Cannot reach Go ROAR for sync: %s", e)
        return {**stats, "errors": 1, "error": str(e)}

    # Python registry agents
    python_agents = {a["codename"].upper(): a for a in agent_registry.list_all()}

    # Agents in ROAR but not Python → add
    # Go-side agents are considered built-in — trust_level=builtin per spec reconciliation rules
    for codename, roar_data in roar_agents.items():
        if codename not in python_agents and not agent_registry.is_builtin(codename):
            from src.registry.agents import AgentDefinition
            # integration_type from ROAR data, default to "roar" for Go-originated agents
            int_type = roar_data.get("integration_type", "roar")
            agent_def = AgentDefinition(
                codename=codename,
                display_name=roar_data.get("display_name", codename),
                description=roar_data.get("description", "Synced from ROAR"),
                tools=["done"],
                created_by="roar_sync",
                trust_level="builtin",
                integration_type=int_type,
                roar_endpoint=roar_data.get("endpoint") or None,
            )
            try:
                agent_registry.register(agent_def)
                trust_engine.register(codename, tier="builtin")
                stats["added_to_python"] += 1
            except Exception:
                stats["errors"] += 1

    # External Python agents not in ROAR → register
    # Python-wins for external agents on conflict, Go-wins for built-ins
    for codename, py_data in python_agents.items():
        if codename not in roar_agents and not agent_registry.is_builtin(codename):
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{GO_BACKEND_URL}/api/roar/register",
                        json={
                            "codename": codename,
                            "display_name": py_data.get("display_name", codename),
                            "capabilities": py_data.get("tags", []),
                            "integration_type": py_data.get("integration_type", "roar"),
                            "endpoint": py_data.get("roar_endpoint") or "",
                        },
                        headers=_auth_headers(),
                    )
                    stats["added_to_roar"] += 1
            except Exception:
                stats["errors"] += 1

    stats["synced"] = len(roar_agents)
    logger.info("Registry sync complete: %s", stats)
    return stats


def _auth_headers() -> dict:
    """Sign a short-lived JWT for Go backend auth."""
    secret = getattr(settings, "jwt_secret", "")
    if not secret:
        return {}
    try:
        import jwt
        import time
        payload = {
            "sub": "prowlrbot-engine",
            "iss": "harbinger",
            "iat": int(time.time()),
            "exp": int(time.time()) + 300,
        }
        token = jwt.encode(payload, secret, algorithm="HS256")
        return {"Authorization": f"Bearer {token}"}
    except ImportError:
        import logging
        logging.getLogger(__name__).warning("PyJWT not installed — falling back to no auth")
        return {}
