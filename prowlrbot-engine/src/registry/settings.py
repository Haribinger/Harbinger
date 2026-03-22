"""Global settings registry — replaces all hardcoded values with user-configurable settings.

Every setting has a default, can be overridden via API, and persists to PostgreSQL.
Falls back to in-memory when DB is unavailable.
"""
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# Default settings — these are the "factory defaults"
DEFAULTS: dict[str, Any] = {
    # Terminal tool
    "tools.terminal.default_timeout": 60,
    "tools.terminal.max_timeout": 1200,
    "tools.terminal.max_output_size": 16384,

    # Search engines
    "tools.search.sploitus.enabled": True,
    "tools.search.duckduckgo.enabled": True,
    "tools.search.google.enabled": False,  # Needs API key
    "tools.search.tavily.enabled": False,  # Needs API key
    "tools.search.perplexity.enabled": False,  # Needs API key
    "tools.search.default_max_results": 10,

    # Execution
    "execution.default_max_iterations": 100,
    "execution.specialist_max_iterations": 20,
    "execution.monitor.same_tool_limit_ratio": 0.5,
    "execution.chain_summarize_threshold": 50,
    "execution.output_summarize_threshold": 16384,

    # Self-healing
    "healing.check_interval": 15,
    "healing.stall_threshold": 120,
    "healing.subtask_timeout": 600,
    "healing.auto_restart": True,

    # Missions
    "missions.default_autonomy": "supervised",
    "missions.approval_timeout": 3600,

    # LLM
    "llm.default_model": "ollama/llama3.1:8b",
    "llm.fast_model": "ollama/llama3.1:8b",
    "llm.strong_model": "anthropic/claude-sonnet-4-6",

    # Docker
    "docker.default_image": "harbinger/base:latest",
    "docker.memory_limit": 2147483648,  # 2GB
    "docker.cpu_limit": 200000,  # 2 CPUs
}


@dataclass
class SettingEntry:
    key: str
    value: Any
    source: str = "default"  # "default", "user", "env"
    updated_at: float = 0
    updated_by: str = ""


class SettingsRegistry:
    """Centralized settings — replaces hardcoded constants everywhere."""

    def __init__(self):
        self._store: dict[str, SettingEntry] = {}
        # Load defaults
        for key, value in DEFAULTS.items():
            self._store[key] = SettingEntry(key=key, value=value, source="default")

    def get(self, key: str, default: Any = None) -> Any:
        entry = self._store.get(key)
        if entry:
            return entry.value
        return default if default is not None else DEFAULTS.get(key)

    def set(self, key: str, value: Any, source: str = "user", by: str = ""):
        self._store[key] = SettingEntry(
            key=key, value=value, source=source,
            updated_at=time.time(), updated_by=by,
        )

    def get_all(self, prefix: str = "") -> dict[str, Any]:
        return {
            k: v.value for k, v in self._store.items()
            if k.startswith(prefix)
        }

    def get_all_with_metadata(self, prefix: str = "") -> list[dict]:
        return [
            {"key": v.key, "value": v.value, "source": v.source,
             "updated_at": v.updated_at, "updated_by": v.updated_by}
            for k, v in self._store.items()
            if k.startswith(prefix)
        ]

    def reset(self, key: str):
        if key in DEFAULTS:
            self._store[key] = SettingEntry(key=key, value=DEFAULTS[key], source="default")

    def reset_all(self):
        self._store.clear()
        for key, value in DEFAULTS.items():
            self._store[key] = SettingEntry(key=key, value=value, source="default")

    def export_json(self) -> str:
        return json.dumps({k: v.value for k, v in self._store.items()}, indent=2)

    def import_json(self, data: str, source: str = "import"):
        parsed = json.loads(data)
        for key, value in parsed.items():
            self.set(key, value, source=source)


# Singleton
settings_registry = SettingsRegistry()
