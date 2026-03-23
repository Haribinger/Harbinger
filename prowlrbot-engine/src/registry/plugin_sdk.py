"""Plugin SDK — define, package, and distribute Harbinger plugins.

A plugin can contain:
  - Custom tools (CLI wrappers, scripts)
  - Custom agents (new roles with prompts)
  - Custom knowledge sources
  - Custom mission templates
  - Custom CVE sources
"""
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class PluginManifest:
    """Plugin definition — everything needed to install and use a plugin."""
    id: str
    name: str
    version: str
    author: str
    description: str
    homepage: str = ""
    license: str = "MIT"

    # What the plugin provides
    tools: list[dict] = field(default_factory=list)
    agents: list[dict] = field(default_factory=list)
    knowledge_sources: list[dict] = field(default_factory=list)
    templates: list[dict] = field(default_factory=list)
    cve_sources: list[dict] = field(default_factory=list)

    # Requirements
    docker_images: list[str] = field(default_factory=list)
    pip_packages: list[str] = field(default_factory=list)

    # Metadata
    tags: list[str] = field(default_factory=list)
    installed_at: float = 0
    enabled: bool = True

    def to_dict(self) -> dict:
        return {
            "id": self.id, "name": self.name, "version": self.version,
            "author": self.author, "description": self.description,
            "homepage": self.homepage, "license": self.license,
            "tools": len(self.tools), "agents": len(self.agents),
            "knowledge_sources": len(self.knowledge_sources),
            "templates": len(self.templates),
            "tags": self.tags, "enabled": self.enabled,
        }


class PluginManager:
    """Install, manage, and query plugins."""

    def __init__(self):
        self._plugins: dict[str, PluginManifest] = {}

    def install(self, manifest: PluginManifest):
        """Install a plugin — registers all its components."""
        manifest.installed_at = time.time()
        self._plugins[manifest.id] = manifest

        # Register tools
        from src.engine.tools.user_tools import user_tool_registry, UserTool
        for tool in manifest.tools:
            try:
                user_tool_registry.register(UserTool(
                    name=tool["name"],
                    description=tool.get("description", ""),
                    command=tool.get("command", ""),
                    docker_image=tool.get("docker_image", "harbinger/base:latest"),
                    input_schema=tool.get("input_schema", {}),
                    tags=tool.get("tags", []) + [f"plugin:{manifest.id}"],
                ))
            except ValueError:
                pass  # Tool already registered — idempotent install

        # Register agents
        from src.registry.agents import agent_registry, AgentDefinition
        for agent in manifest.agents:
            try:
                agent_registry.register(AgentDefinition(
                    codename=agent["codename"].upper(),
                    display_name=agent.get("display_name", agent["codename"]),
                    description=agent.get("description", ""),
                    tools=agent.get("tools", ["terminal", "file", "done"]),
                    docker_image=agent.get("docker_image", "harbinger/base:latest"),
                    tags=agent.get("tags", []) + [f"plugin:{manifest.id}"],
                    created_by=f"plugin:{manifest.id}",
                ))
            except ValueError:
                pass  # Agent already registered — skip silently

        # Register knowledge sources
        from src.memory.knowledge_sources import knowledge_registry, KnowledgeSource
        for ks in manifest.knowledge_sources:
            knowledge_registry.add(KnowledgeSource(
                id=ks["id"],
                name=ks.get("name", ks["id"]),
                url=ks.get("url", ""),
                source_type=ks.get("source_type", "github"),
                categories=ks.get("categories", []),
                created_by=f"plugin:{manifest.id}",
            ))

        # Register templates
        from src.registry.templates import template_registry, MissionTemplate
        for tmpl in manifest.templates:
            template_registry.register(MissionTemplate(
                id=tmpl["id"],
                name=tmpl.get("name", tmpl["id"]),
                description=tmpl.get("description", ""),
                tasks=tmpl.get("tasks", []),
                created_by=f"plugin:{manifest.id}",
            ))

        logger.info("Installed plugin '%s' v%s (%d tools, %d agents, %d sources)",
                    manifest.id, manifest.version, len(manifest.tools),
                    len(manifest.agents), len(manifest.knowledge_sources))

    def uninstall(self, plugin_id: str):
        manifest = self._plugins.pop(plugin_id, None)
        if not manifest:
            raise ValueError(f"Plugin '{plugin_id}' not found")
        # TODO: unregister components tagged with plugin:{id}
        logger.info("Uninstalled plugin '%s'", plugin_id)

    def get(self, plugin_id: str) -> PluginManifest | None:
        return self._plugins.get(plugin_id)

    def list_all(self) -> list[dict]:
        return [p.to_dict() for p in self._plugins.values()]

    def load_from_file(self, path: Path) -> PluginManifest:
        """Load plugin manifest from JSON file."""
        data = json.loads(path.read_text())
        manifest = PluginManifest(**data)
        self.install(manifest)
        return manifest


# Singleton
plugin_manager = PluginManager()
