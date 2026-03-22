"""
Document chunker — splits content into embeddable chunks with metadata.

Supports multiple input formats:
  - Plaintext / Markdown: recursive split on paragraphs, then sentences
  - JSONL (nuclei, httpx, etc.): one chunk per JSON line with structured metadata
  - MockHunter JSON: parse findings into structured chunks with severity/category
  - Nmap XML: extract host/service/vuln entities (future)

Chunk size targets ~512 tokens (~2048 chars) with 200-char overlap for context.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_CHUNK_SIZE = 2048  # chars (~512 tokens)
DEFAULT_OVERLAP = 200
MIN_CHUNK_SIZE = 100  # skip tiny fragments


@dataclass
class Chunk:
    """A single embeddable unit of content with metadata."""
    content: str
    source: str  # file path or URL
    chunk_index: int = 0
    total_chunks: int = 1
    format: str = "text"  # text, jsonl, mockhunter, scan
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "content": self.content,
            "source": self.source,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "format": self.format,
            "metadata": self.metadata,
        }


# ── Text/Markdown splitter ───────────────────────────────────────────────────

def chunk_text(
    text: str,
    source: str = "",
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
) -> list[Chunk]:
    """Split text into overlapping chunks, splitting on paragraph then sentence boundaries."""
    if len(text) <= chunk_size:
        return [Chunk(content=text.strip(), source=source, chunk_index=0, total_chunks=1)]

    # Split on double newlines (paragraphs) first
    paragraphs = re.split(r"\n\s*\n", text)
    chunks: list[Chunk] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current) + len(para) + 2 <= chunk_size:
            current = (current + "\n\n" + para).strip()
        else:
            if current and len(current) >= MIN_CHUNK_SIZE:
                chunks.append(Chunk(content=current, source=source))
            # Start new chunk with overlap from previous
            if overlap > 0 and current:
                tail = current[-overlap:]
                current = tail + "\n\n" + para
            else:
                current = para

    if current and len(current) >= MIN_CHUNK_SIZE:
        chunks.append(Chunk(content=current, source=source))

    # Assign indices
    for i, chunk in enumerate(chunks):
        chunk.chunk_index = i
        chunk.total_chunks = len(chunks)
        chunk.format = "text"

    return chunks


# ── JSONL parser (nuclei, httpx, subfinder, etc.) ────────────────────────────

def chunk_jsonl(
    text: str,
    source: str = "",
    tool_name: str = "unknown",
) -> list[Chunk]:
    """Parse JSONL tool output into one chunk per line with structured metadata."""
    chunks: list[Chunk] = []
    lines = text.strip().split("\n")

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue

        # Build human-readable content from common fields
        content_parts = []
        meta: dict[str, Any] = {"tool": tool_name, "raw": data}

        # Nuclei format
        if "template-id" in data:
            meta["tool"] = "nuclei"
            severity = data.get("info", {}).get("severity", "unknown")
            meta["severity"] = severity
            meta["template"] = data.get("template-id", "")
            host = data.get("host", data.get("matched-at", ""))
            name = data.get("info", {}).get("name", data.get("template-id", ""))
            content_parts.append(f"[{severity.upper()}] {name}")
            content_parts.append(f"Host: {host}")
            if data.get("matched-at"):
                content_parts.append(f"Match: {data['matched-at']}")
            if data.get("extracted-results"):
                content_parts.append(f"Evidence: {data['extracted-results']}")

        # httpx format
        elif "url" in data and "status_code" in data:
            meta["tool"] = "httpx"
            content_parts.append(f"URL: {data['url']}")
            content_parts.append(f"Status: {data['status_code']} | Title: {data.get('title', 'N/A')}")
            if data.get("tech"):
                content_parts.append(f"Tech: {', '.join(data['tech'])}")

        # subfinder format
        elif "host" in data and len(data) < 5:
            meta["tool"] = "subfinder"
            content_parts.append(f"Subdomain: {data['host']}")
            if data.get("source"):
                content_parts.append(f"Source: {data['source']}")

        # Generic JSONL
        else:
            content_parts.append(json.dumps(data, indent=2)[:DEFAULT_CHUNK_SIZE])

        content = "\n".join(content_parts)
        if len(content) >= MIN_CHUNK_SIZE or meta.get("severity") in ("critical", "high"):
            chunks.append(Chunk(
                content=content,
                source=source,
                chunk_index=i,
                total_chunks=len(lines),
                format="scan",
                metadata=meta,
            ))

    return chunks


# ── MockHunter output parser ────────────────────────────────────────────────

def chunk_mockhunter(
    text: str,
    source: str = "",
) -> list[Chunk]:
    """Parse MockHunter JSON output into structured chunks."""
    chunks: list[Chunk] = []

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Maybe it's line-by-line output — parse as text
        return chunk_mockhunter_text(text, source)

    findings = data if isinstance(data, list) else data.get("findings", [])

    for i, finding in enumerate(findings):
        severity = finding.get("severity", "low")
        category = finding.get("category", "unknown")
        rule = finding.get("rule", "")
        file_path = finding.get("file", "")
        line = finding.get("line", 0)
        message = finding.get("message", "")
        snippet = finding.get("snippet", "")
        fix = finding.get("fix", "")

        content_parts = [
            f"[{severity.upper()}] [{category}] {rule}",
            f"File: {file_path}:{line}",
            f"Issue: {message}",
        ]
        if snippet:
            content_parts.append(f"Code: {snippet[:500]}")
        if fix:
            content_parts.append(f"Fix: {fix}")

        chunks.append(Chunk(
            content="\n".join(content_parts),
            source=source,
            chunk_index=i,
            total_chunks=len(findings),
            format="mockhunter",
            metadata={
                "tool": "mockhunter",
                "severity": severity,
                "category": category,
                "rule": rule,
                "file": file_path,
                "line": line,
            },
        ))

    return chunks


def chunk_mockhunter_text(text: str, source: str) -> list[Chunk]:
    """Parse MockHunter's human-readable terminal output into chunks."""
    # Extract findings blocks between file headers
    chunks: list[Chunk] = []
    current_file = ""
    current_findings: list[str] = []

    for line in text.split("\n"):
        stripped = line.strip()
        # File header pattern: "📄 path/to/file"
        if stripped.startswith("📄") or (stripped.startswith("/") and stripped.endswith((".go", ".ts", ".tsx", ".py", ".js"))):
            if current_file and current_findings:
                chunks.append(Chunk(
                    content=f"File: {current_file}\n" + "\n".join(current_findings),
                    source=source,
                    format="mockhunter",
                    metadata={"tool": "mockhunter", "file": current_file},
                ))
            current_file = stripped.replace("📄 ", "").strip()
            current_findings = []
        elif stripped and ("CRIT" in stripped or "HIGH" in stripped or "MED" in stripped or "LOW" in stripped):
            current_findings.append(stripped)

    if current_file and current_findings:
        chunks.append(Chunk(
            content=f"File: {current_file}\n" + "\n".join(current_findings),
            source=source,
            format="mockhunter",
            metadata={"tool": "mockhunter", "file": current_file},
        ))

    for i, c in enumerate(chunks):
        c.chunk_index = i
        c.total_chunks = len(chunks)

    return chunks


# ── Auto-detect and chunk ────────────────────────────────────────────────────

def auto_chunk(
    content: str,
    source: str = "",
    format_hint: str | None = None,
) -> list[Chunk]:
    """Auto-detect format and chunk accordingly."""
    if format_hint == "mockhunter":
        return chunk_mockhunter(content, source)

    if format_hint in ("nuclei", "httpx", "subfinder", "jsonl", "scan"):
        return chunk_jsonl(content, source, tool_name=format_hint or "unknown")

    # Auto-detect JSONL
    first_line = content.strip().split("\n")[0] if content.strip() else ""
    if first_line.startswith("{"):
        try:
            json.loads(first_line)
            # Looks like JSONL
            return chunk_jsonl(content, source)
        except json.JSONDecodeError:
            pass

    # Auto-detect JSON array
    if content.strip().startswith("["):
        try:
            data = json.loads(content)
            if isinstance(data, list) and data and isinstance(data[0], dict):
                # Check if it's mockhunter output
                if any("severity" in item and "category" in item for item in data[:3]):
                    return chunk_mockhunter(content, source)
                # Generic JSON array → JSONL
                return chunk_jsonl(
                    "\n".join(json.dumps(item) for item in data),
                    source,
                )
        except json.JSONDecodeError:
            pass

    # Default: text/markdown
    return chunk_text(content, source)


def chunk_file(path: str | Path, format_hint: str | None = None) -> list[Chunk]:
    """Read a file and chunk it."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"File not found: {path}")

    content = p.read_text(errors="replace")
    source = str(p.resolve())

    # Infer format from extension
    if format_hint is None:
        ext = p.suffix.lower()
        if ext in (".jsonl", ".ndjson"):
            format_hint = "jsonl"
        elif ext == ".json":
            format_hint = None  # let auto_chunk decide
        # else: text/markdown default

    return auto_chunk(content, source=source, format_hint=format_hint)
