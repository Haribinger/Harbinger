"""Agent catalog — local registry of known external agents.

Ships with built-in entries, updatable via JSON file.
"""
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

CATALOG_PATH = Path(__file__).parent / "catalog.json"


@dataclass
class CatalogEntry:
    id: str
    name: str
    description: str
    author: str
    repo: str
    docker_image: str
    integration_type: str  # "roar" | "mcp" | "docker"
    capabilities: list[str] = field(default_factory=list)
    roar_endpoint: str | None = None
    mcp_endpoint: str | None = None
    trust_tier: str = "community"  # builtin, verified, community, unknown, restricted
    min_harbinger_version: str = "2.0.0"
    installed: bool = False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "author": self.author,
            "repo": self.repo,
            "docker_image": self.docker_image,
            "integration_type": self.integration_type,
            "capabilities": self.capabilities,
            "roar_endpoint": self.roar_endpoint,
            "mcp_endpoint": self.mcp_endpoint,
            "trust_tier": self.trust_tier,
            "min_harbinger_version": self.min_harbinger_version,
            "installed": self.installed,
        }


class AgentCatalog:
    """Browse and search available agents."""

    def __init__(self):
        self._entries: dict[str, CatalogEntry] = {}
        self._load()

    def _load(self):
        if not CATALOG_PATH.exists():
            logger.warning("Catalog file not found: %s", CATALOG_PATH)
            return
        try:
            data = json.loads(CATALOG_PATH.read_text())
            for item in data:
                entry = CatalogEntry(**item)
                self._entries[entry.id] = entry
            logger.info("Loaded %d catalog entries", len(self._entries))
        except Exception as e:
            logger.error("Failed to load catalog: %s", e)

    def list_all(self) -> list[dict]:
        return [e.to_dict() for e in self._entries.values()]

    def search(self, query: str = "", capability: str = "", integration_type: str = "") -> list[dict]:
        results = []
        for e in self._entries.values():
            if query and query.lower() not in (e.name + e.description).lower():
                continue
            if capability and capability not in e.capabilities:
                continue
            if integration_type and e.integration_type != integration_type:
                continue
            results.append(e.to_dict())
        return results

    def get(self, agent_id: str) -> CatalogEntry | None:
        return self._entries.get(agent_id)

    def mark_installed(self, agent_id: str):
        entry = self._entries.get(agent_id)
        if entry:
            entry.installed = True

    def mark_uninstalled(self, agent_id: str):
        entry = self._entries.get(agent_id)
        if entry:
            entry.installed = False

    def add_custom(self, entry: CatalogEntry):
        """Add a custom catalog entry (user-provided agent)."""
        self._entries[entry.id] = entry


# Singleton
agent_catalog = AgentCatalog()
