"""Bug bounty & cybersecurity knowledge sources — HowToHunt, PayloadsAllTheThings, etc.

Provides a registry of knowledge bases that can be ingested into Harbinger's
memory system (pgvector + Neo4j). Users can add custom sources.
"""
import logging
import re
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class KnowledgeSource:
    id: str
    name: str
    url: str
    source_type: str  # "github", "url", "local"
    description: str = ""
    categories: list[str] = field(default_factory=list)
    enabled: bool = True
    last_synced: float = 0
    created_by: str = "system"

    def to_dict(self) -> dict:
        return {
            "id": self.id, "name": self.name, "url": self.url,
            "source_type": self.source_type, "description": self.description,
            "categories": self.categories, "enabled": self.enabled,
            "last_synced": self.last_synced, "created_by": self.created_by,
        }


BUILTIN_SOURCES = [
    KnowledgeSource(
        id="howtohunt",
        name="HowToHunt",
        url="https://github.com/KathanP19/HowToHunt",
        source_type="github",
        description="Bug bounty hunting methodology — categorized techniques for finding vulns",
        categories=["methodology", "web", "recon", "exploitation"],
    ),
    KnowledgeSource(
        id="payloadsallthethings",
        name="PayloadsAllTheThings",
        url="https://github.com/swisskyrepo/PayloadsAllTheThings",
        source_type="github",
        description="Comprehensive payload lists for web application security testing",
        categories=["payloads", "web", "exploitation"],
    ),
    KnowledgeSource(
        id="hacktricks",
        name="HackTricks",
        url="https://github.com/HackTricks-wiki/hacktricks",
        source_type="github",
        description="Pentesting methodology and techniques wiki",
        categories=["methodology", "web", "network", "cloud", "exploitation"],
    ),
    KnowledgeSource(
        id="seclists",
        name="SecLists",
        url="https://github.com/danielmiessler/SecLists",
        source_type="github",
        description="Collection of wordlists for security assessments",
        categories=["wordlists", "recon", "fuzzing"],
    ),
    KnowledgeSource(
        id="nuclei-templates",
        name="Nuclei Templates",
        url="https://github.com/projectdiscovery/nuclei-templates",
        source_type="github",
        description="Community-curated nuclei vulnerability scanning templates",
        categories=["templates", "scanning", "detection"],
    ),
    KnowledgeSource(
        id="bugbounty-cheatsheet",
        name="Bug Bounty Cheatsheet",
        url="https://github.com/EdOverflow/bugbounty-cheatsheet",
        source_type="github",
        description="Bug bounty tips and cheatsheets organized by vulnerability type",
        categories=["methodology", "web", "recon"],
    ),
    KnowledgeSource(
        id="owasp-testing-guide",
        name="OWASP Testing Guide",
        url="https://github.com/OWASP/wstg",
        source_type="github",
        description="OWASP Web Security Testing Guide — comprehensive testing methodology",
        categories=["methodology", "web", "compliance"],
    ),
    KnowledgeSource(
        id="allaboutbugbounty",
        name="AllAboutBugBounty",
        url="https://github.com/daffainfo/AllAboutBugBounty",
        source_type="github",
        description="Bug bounty tips organized by vulnerability class with real-world examples",
        categories=["methodology", "web", "exploitation"],
    ),
    KnowledgeSource(
        id="keyhacks",
        name="KeyHacks",
        url="https://github.com/streaak/keyhacks",
        source_type="github",
        description="Shows ways to check if API keys are valid and exploitable",
        categories=["recon", "api", "exploitation"],
    ),
    KnowledgeSource(
        id="cloud-security",
        name="CloudSecDocs",
        url="https://github.com/hashishrajan/cloud-security-encyclopedia",
        source_type="github",
        description="Cloud security encyclopedia — AWS, GCP, Azure attack techniques",
        categories=["cloud", "methodology"],
    ),
]


def parse_howtohunt_entry(content: str, filename: str) -> list[dict]:
    """Parse a HowToHunt markdown file into memory entries."""
    entries = []
    title = filename.replace(".md", "").replace("-", " ").title()

    # Extract title from first heading
    heading_match = re.match(r"#\s+(.+)", content)
    if heading_match:
        title = heading_match.group(1).strip()

    # Split by ## headings for sub-sections
    sections = re.split(r"\n##\s+", content)
    if len(sections) <= 1:
        entries.append({
            "title": title,
            "content": content[:4000],
            "collection": "guide",
            "source": "howtohunt",
            "filename": filename,
        })
    else:
        for section in sections[1:]:
            lines = section.strip().split("\n")
            section_title = lines[0].strip() if lines else "Untitled"
            section_content = "\n".join(lines[1:]).strip()
            if section_content:
                entries.append({
                    "title": f"{title} — {section_title}",
                    "content": section_content[:4000],
                    "collection": "guide",
                    "source": "howtohunt",
                    "filename": filename,
                })

    return entries


def parse_payloads_entry(content: str, filename: str) -> list[dict]:
    """Parse a PayloadsAllTheThings markdown file into memory entries."""
    entries = []
    title = filename.replace(".md", "").replace("-", " ").title()

    heading_match = re.match(r"#\s+(.+)", content)
    if heading_match:
        title = heading_match.group(1).strip()

    # Store the whole file as one entry (payloads are meant to be used together)
    entries.append({
        "title": title,
        "content": content[:8000],
        "collection": "guide",
        "source": "payloadsallthethings",
        "filename": filename,
    })

    # Also extract individual code blocks as code entries
    code_blocks = re.findall(r"```[\w]*\n(.*?)```", content, re.DOTALL)
    for i, block in enumerate(code_blocks[:10]):  # Max 10 code blocks
        if len(block.strip()) > 4:
            entries.append({
                "title": f"{title} — Payload {i+1}",
                "content": block.strip()[:2000],
                "collection": "code",
                "source": "payloadsallthethings",
                "filename": filename,
            })

    return entries


class KnowledgeRegistry:
    """Registry of knowledge sources — built-in + user-addable."""

    def __init__(self):
        self._sources: dict[str, KnowledgeSource] = {}
        self._builtin: set[str] = set()
        for src in BUILTIN_SOURCES:
            self._sources[src.id] = src
            self._builtin.add(src.id)

    def get(self, source_id: str) -> KnowledgeSource | None:
        return self._sources.get(source_id)

    def add(self, source: KnowledgeSource):
        self._sources[source.id] = source

    def remove(self, source_id: str):
        if source_id in self._builtin:
            raise ValueError(f"Cannot remove built-in source '{source_id}'")
        self._sources.pop(source_id, None)

    def list_all(self) -> list[dict]:
        return [s.to_dict() for s in self._sources.values()]

    def list_by_category(self, category: str) -> list[dict]:
        return [s.to_dict() for s in self._sources.values() if category in s.categories]

    def list_enabled(self) -> list[dict]:
        return [s.to_dict() for s in self._sources.values() if s.enabled]


# Singleton
knowledge_registry = KnowledgeRegistry()
