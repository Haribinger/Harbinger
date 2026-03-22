"""Mission template registry — users can add custom mission templates."""
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class MissionTemplate:
    id: str
    name: str
    description: str
    default_autonomy: str = "supervised"
    continuous: bool = False
    scan_interval: int = 3600
    tasks: list[dict] = field(default_factory=list)
    created_by: str = "system"
    updated_at: float = 0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "default_autonomy": self.default_autonomy,
            "continuous": self.continuous,
            "scan_interval": self.scan_interval,
            "tasks": self.tasks,
            "task_count": len(self.tasks),
            "created_by": self.created_by,
        }


class TemplateRegistry:
    """Registry of mission templates. Users can add custom ones."""

    def __init__(self):
        self._templates: dict[str, MissionTemplate] = {}
        self._builtin: set[str] = set()

    def get(self, template_id: str) -> MissionTemplate | None:
        return self._templates.get(template_id)

    def list_all(self) -> list[dict]:
        return [t.to_dict() for t in self._templates.values()]

    def register(self, template: MissionTemplate):
        self._templates[template.id] = template

    def register_builtin(self, template: MissionTemplate):
        self._templates[template.id] = template
        self._builtin.add(template.id)

    def unregister(self, template_id: str):
        if template_id in self._builtin:
            raise ValueError(f"Cannot delete built-in template '{template_id}'")
        self._templates.pop(template_id, None)

    def is_builtin(self, template_id: str) -> bool:
        return template_id in self._builtin


# Singleton
template_registry = TemplateRegistry()
