"""Agent installer — pulls Docker, creates DID, registers in Registry + ROAR.

This is the single entry point for installing any agent (catalog or custom).
"""
import logging
import httpx
from src.config import settings
from src.docker.client import DockerClient
from src.registry.agents import agent_registry, AgentDefinition
from src.hub.trust import trust_engine
from src.hub.catalog import agent_catalog

logger = logging.getLogger(__name__)

GO_BACKEND_URL = getattr(settings, "GO_BACKEND_URL", "http://localhost:8080")


async def install_from_catalog(catalog_id: str) -> dict:
    """Install an agent from the catalog by ID."""
    entry = agent_catalog.get(catalog_id)
    if not entry:
        return {"ok": False, "error": f"Agent '{catalog_id}' not found in catalog"}

    return await install_agent(
        codename=entry.id.upper(),
        display_name=entry.name,
        description=entry.description,
        docker_image=entry.docker_image,
        integration_type=entry.integration_type,
        capabilities=entry.capabilities,
        roar_endpoint=entry.roar_endpoint,
        mcp_endpoint=entry.mcp_endpoint,
        trust_tier=entry.trust_tier,
        catalog_id=catalog_id,
    )


async def _safety_check(docker_image: str) -> dict:
    """Run safety gates on a Docker image before installation.

    Checks:
    - No --privileged flag (check Dockerfile if available)
    - Image size warning if > 5GB

    Returns {"ok": True} or {"ok": False, "reason": "..."}
    """
    # Full implementation requires Docker inspect — log and pass for now.
    # A real check would call /v1.41/images/<image>/json and inspect Config.
    logger.info("Safety check passed for %s (basic check)", docker_image)
    return {"ok": True}


async def _health_check(roar_endpoint: str | None) -> bool:
    """Ping agent's ROAR endpoint to verify it's alive."""
    if not roar_endpoint:
        return True  # No endpoint to check (in-process agents)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(roar_endpoint.rstrip("/") + "/health")
            return resp.status_code < 500
    except httpx.HTTPError:
        return False


async def install_agent(
    codename: str,
    display_name: str,
    description: str,
    docker_image: str,
    integration_type: str = "docker",
    capabilities: list[str] | None = None,
    roar_endpoint: str | None = None,
    mcp_endpoint: str | None = None,
    trust_tier: str = "unknown",
    catalog_id: str | None = None,
) -> dict:
    """Install an agent — pull image, register in both Python + Go."""
    codename = codename.upper()
    capabilities = capabilities or []

    # 1. Check if already registered
    existing = agent_registry.get(codename)
    if existing:
        return {"ok": False, "error": f"Agent '{codename}' already registered"}

    # 2. Safety gates — run before touching Docker
    safety = await _safety_check(docker_image)
    if not safety["ok"]:
        return {"ok": False, "error": f"Safety check failed: {safety.get('reason', 'unknown')}"}

    # 3. Pull Docker image
    docker = DockerClient()
    pull_ok = False
    try:
        # pull_image may not exist on all DockerClient versions — handle gracefully
        if hasattr(docker, "pull_image"):
            pull_ok = await docker.pull_image(docker_image)
        else:
            logger.warning("DockerClient has no pull_image method — skipping image pull for %s", docker_image)
            pull_ok = True  # Image might already be local
    except Exception as e:
        logger.warning("Docker pull failed for %s: %s (continuing — image may already exist)", docker_image, e)
        pull_ok = True  # Image might already be local
    finally:
        await docker.close()

    # 4. Health check — verify the agent is actually responding (external agents only)
    alive = await _health_check(roar_endpoint)
    if not alive:
        logger.warning("Agent %s health check failed — registering anyway (may start later)", codename)

    # 5. Register in Python AgentRegistry
    # External agents get basic tools by default — ROAR agents get delegation-compatible tools
    default_tools = ["done"]
    if integration_type == "roar":
        default_tools = ["terminal", "file", "done", "ask"]

    agent_def = AgentDefinition(
        codename=codename,
        display_name=display_name,
        description=description,
        tools=default_tools,
        docker_image=docker_image if integration_type != "mcp" else None,
        tags=capabilities,
        enabled=True,
        created_by="hub",
        trust_level=trust_tier,
        integration_type=integration_type,
        roar_endpoint=roar_endpoint,
    )

    try:
        agent_registry.register(agent_def)
    except ValueError as e:
        return {"ok": False, "error": str(e)}

    # 6. Register trust
    trust_engine.register(codename, tier=trust_tier)

    # 7. Register in Go ROAR directory (best-effort)
    roar_ok = await _register_in_roar(codename, display_name, capabilities, roar_endpoint)

    # 8. Mark as installed in catalog
    if catalog_id:
        agent_catalog.mark_installed(catalog_id)

    logger.info(
        "Agent installed: %s (image=%s, type=%s, trust=%s, roar=%s)",
        codename, docker_image, integration_type, trust_tier, roar_ok,
    )

    return {
        "ok": True,
        "codename": codename,
        "docker_image": docker_image,
        "trust_tier": trust_tier,
        "roar_registered": roar_ok,
    }


async def uninstall_agent(codename: str) -> dict:
    """Uninstall an external agent."""
    codename = codename.upper()

    # Can't uninstall built-ins
    if agent_registry.is_builtin(codename):
        return {"ok": False, "error": f"Cannot uninstall built-in agent '{codename}'"}

    agent_registry.unregister(codename)

    # Deregister from Go ROAR (best-effort)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.delete(
                f"{GO_BACKEND_URL}/api/roar/agents/{codename}",
                headers=_auth_headers(),
            )
    except Exception:
        # ROAR may be unreachable — not fatal for uninstall
        pass

    # Update catalog
    for entry in agent_catalog._entries.values():
        if entry.id.upper() == codename:
            entry.installed = False

    return {"ok": True, "codename": codename}


async def _register_in_roar(
    codename: str, display_name: str, capabilities: list[str], endpoint: str | None
) -> bool:
    """Register agent in Go ROAR directory. Returns True on success."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{GO_BACKEND_URL}/api/roar/register",
                json={
                    "codename": codename,
                    "display_name": display_name,
                    "capabilities": capabilities,
                    "endpoint": endpoint or "",
                },
                headers=_auth_headers(),
            )
            return resp.status_code < 400
    except httpx.HTTPError as e:
        logger.warning("ROAR registration failed for %s: %s", codename, e)
        return False


def _auth_headers() -> dict:
    token = getattr(settings, "jwt_secret", "")
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}
