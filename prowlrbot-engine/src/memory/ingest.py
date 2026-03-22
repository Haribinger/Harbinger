"""
Ingest pipeline — parse → chunk → embed → store in pgvector + extract entities → Neo4j.

This is the core pipeline that both the CLI and API use to load knowledge.
Supports batch embedding for efficiency and entity extraction for graph population.
"""

import json
import logging
import os
import re
import subprocess
from pathlib import Path
from typing import Any

from src.memory.chunker import Chunk, auto_chunk, chunk_file

logger = logging.getLogger(__name__)

# ── Entity extraction (lightweight, no LLM needed) ──────────────────────────

# Patterns for extracting security entities from text
IP_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
DOMAIN_PATTERN = re.compile(r"\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b")
PORT_PATTERN = re.compile(r"\bport[:\s]+(\d{1,5})\b", re.IGNORECASE)
CVE_PATTERN = re.compile(r"\bCVE-\d{4}-\d{4,}\b")
URL_PATTERN = re.compile(r"https?://[^\s<>\"']+")
SEVERITY_PATTERN = re.compile(r"\b(critical|high|medium|low|info)\b", re.IGNORECASE)


def extract_entities(text: str, metadata: dict[str, Any] | None = None) -> dict[str, list[str]]:
    """Extract security-relevant entities from text without an LLM."""
    meta = metadata or {}
    entities: dict[str, list[str]] = {
        "hosts": [],
        "domains": [],
        "ports": [],
        "cves": [],
        "urls": [],
        "severities": [],
        "tools": [],
        "techniques": [],
    }

    entities["hosts"] = list(set(IP_PATTERN.findall(text)))
    entities["domains"] = list(set(DOMAIN_PATTERN.findall(text)))
    entities["ports"] = list(set(PORT_PATTERN.findall(text)))
    entities["cves"] = list(set(CVE_PATTERN.findall(text)))
    entities["urls"] = list(set(URL_PATTERN.findall(text)))
    entities["severities"] = list(set(s.lower() for s in SEVERITY_PATTERN.findall(text)))

    # From metadata
    if meta.get("tool"):
        entities["tools"].append(meta["tool"])
    if meta.get("template"):
        entities["techniques"].append(meta["template"])

    # Filter out common false positives
    entities["domains"] = [
        d for d in entities["domains"]
        if not d.endswith((".py", ".go", ".js", ".ts", ".tsx", ".css", ".md", ".txt", ".json"))
        and "example.com" not in d
    ]

    return entities


# ── Ingest pipeline ──────────────────────────────────────────────────────────

class IngestResult:
    """Tracks results of an ingest operation."""
    def __init__(self):
        self.chunks_stored: int = 0
        self.entities_extracted: int = 0
        self.graph_nodes_created: int = 0
        self.errors: list[str] = []
        self.sources: list[str] = []

    def to_dict(self) -> dict[str, Any]:
        return {
            "chunks_stored": self.chunks_stored,
            "entities_extracted": self.entities_extracted,
            "graph_nodes_created": self.graph_nodes_created,
            "errors": self.errors,
            "sources": self.sources,
        }


async def ingest_chunks(
    chunks: list[Chunk],
    collection: str = "general",
    agent_id: str = "ingest",
    mission_id: str = "",
) -> IngestResult:
    """Store chunks in pgvector and extract entities to Neo4j."""
    from src.memory import store as vector_store
    from src.memory import graph as graph_store

    result = IngestResult()

    for chunk in chunks:
        try:
            # Store in pgvector
            meta = {
                **chunk.metadata,
                "source": chunk.source,
                "chunk_index": chunk.chunk_index,
                "total_chunks": chunk.total_chunks,
                "format": chunk.format,
            }

            await vector_store.store(
                content=chunk.content,
                collection=collection if collection in vector_store.VALID_COLLECTIONS else "general",
                agent_id=agent_id,
                mission_id=mission_id,
                metadata=meta,
            )
            result.chunks_stored += 1

            # Extract entities and store in graph
            entities = extract_entities(chunk.content, chunk.metadata)
            entity_count = sum(len(v) for v in entities.values())
            result.entities_extracted += entity_count

            # Store graph relationships
            if entity_count > 0:
                nodes = await _store_entities_in_graph(
                    graph_store, entities, chunk, mission_id
                )
                result.graph_nodes_created += nodes

        except Exception as exc:
            result.errors.append(f"chunk {chunk.chunk_index}: {exc}")
            logger.warning("ingest chunk %d failed: %s", chunk.chunk_index, exc)

    if chunks:
        result.sources.append(chunks[0].source)

    return result


async def _store_entities_in_graph(
    graph_store,
    entities: dict[str, list[str]],
    chunk: Chunk,
    mission_id: str,
) -> int:
    """Store extracted entities as Neo4j nodes/relationships."""
    if not graph_store.graph_available():
        return 0

    nodes_created = 0

    try:
        # Store hosts
        for ip in entities["hosts"]:
            await graph_store.store_host(ip, source=chunk.metadata.get("tool", "ingest"))
            nodes_created += 1

        # Store domains as hosts
        for domain in entities["domains"]:
            await graph_store.store_host(domain, hostname=domain, source=chunk.metadata.get("tool", "ingest"))
            nodes_created += 1

        # Store CVEs as vulnerabilities
        for cve in entities["cves"]:
            severity = entities["severities"][0] if entities["severities"] else "unknown"
            await graph_store.store_vulnerability(
                cve_id=cve,
                severity=severity,
                title=cve,
                evidence=chunk.content[:500],
            )
            nodes_created += 1

        # Link techniques to tools
        for technique in entities["techniques"]:
            tool_name = entities["tools"][0] if entities["tools"] else "unknown"
            await graph_store.store_technique(
                tool=tool_name,
                technique=technique,
                success=True,
            )
            nodes_created += 1

    except Exception as exc:
        logger.debug("graph storage failed (non-fatal): %s", exc)

    return nodes_created


# ── High-level ingest functions ──────────────────────────────────────────────

async def ingest_file(
    path: str | Path,
    collection: str = "general",
    format_hint: str | None = None,
    agent_id: str = "ingest",
    mission_id: str = "",
) -> IngestResult:
    """Ingest a single file: read → chunk → embed → store."""
    chunks = chunk_file(path, format_hint=format_hint)
    return await ingest_chunks(chunks, collection, agent_id, mission_id)


async def ingest_directory(
    path: str | Path,
    collection: str = "general",
    extensions: set[str] | None = None,
    agent_id: str = "ingest",
    mission_id: str = "",
    recursive: bool = True,
) -> IngestResult:
    """Ingest all files in a directory."""
    allowed_ext = extensions or {
        ".txt", ".md", ".json", ".jsonl", ".ndjson",
        ".xml", ".csv", ".log", ".yml", ".yaml",
    }

    p = Path(path)
    if not p.is_dir():
        raise NotADirectoryError(f"Not a directory: {path}")

    pattern = "**/*" if recursive else "*"
    files = [f for f in p.glob(pattern) if f.is_file() and f.suffix.lower() in allowed_ext]

    combined = IngestResult()
    for file_path in sorted(files):
        try:
            result = await ingest_file(file_path, collection, agent_id=agent_id, mission_id=mission_id)
            combined.chunks_stored += result.chunks_stored
            combined.entities_extracted += result.entities_extracted
            combined.graph_nodes_created += result.graph_nodes_created
            combined.errors.extend(result.errors)
            combined.sources.append(str(file_path))
        except Exception as exc:
            combined.errors.append(f"{file_path}: {exc}")

    return combined


async def ingest_mockhunter(
    target_path: str | Path,
    collection: str = "code",
    agent_id: str = "mockhunter",
    mission_id: str = "",
) -> IngestResult:
    """Run MockHunter on a path and ingest its findings."""
    mockhunter_bin = os.environ.get("MOCKHUNTER_BIN", "mockhunter")
    target = str(Path(target_path).resolve())

    try:
        proc = subprocess.run(
            [mockhunter_bin, "scan", "--json", target],
            capture_output=True,
            text=True,
            timeout=300,
        )
        output = proc.stdout
    except FileNotFoundError:
        # Try common locations
        for alt in ["/home/anon/go/bin/mockhunter", "/usr/local/bin/mockhunter"]:
            if Path(alt).exists():
                proc = subprocess.run(
                    [alt, "scan", "--json", target],
                    capture_output=True,
                    text=True,
                    timeout=300,
                )
                output = proc.stdout
                break
        else:
            return IngestResult()
    except subprocess.TimeoutExpired:
        result = IngestResult()
        result.errors.append("mockhunter timed out after 300s")
        return result

    if not output.strip():
        # No JSON output — try parsing stderr/stdout as text
        output = proc.stderr or proc.stdout
        if not output.strip():
            result = IngestResult()
            result.errors.append("mockhunter produced no output")
            return result

    chunks = auto_chunk(output, source=f"mockhunter:{target}", format_hint="mockhunter")
    return await ingest_chunks(chunks, collection, agent_id, mission_id)


async def ingest_scan_output(
    path: str | Path,
    tool_name: str = "unknown",
    collection: str = "answer",
    agent_id: str = "ingest",
    mission_id: str = "",
) -> IngestResult:
    """Ingest tool output (nuclei, httpx, etc.) from a JSONL file."""
    from src.memory.chunker import chunk_jsonl

    p = Path(path)
    content = p.read_text(errors="replace")
    chunks = chunk_jsonl(content, source=str(p.resolve()), tool_name=tool_name)
    return await ingest_chunks(chunks, collection, agent_id, mission_id)
