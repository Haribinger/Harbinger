import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from src.memory.ingest import extract_entities, IngestResult
from src.memory.chunker import chunk_text, chunk_jsonl, auto_chunk


def test_extract_ips():
    text = "Found open port on 192.168.1.1 and 10.0.0.5"
    entities = extract_entities(text)
    assert "192.168.1.1" in entities["hosts"]
    assert "10.0.0.5" in entities["hosts"]


def test_extract_domains():
    text = "Subdomains found: api.megacorp.com, admin.target.org"
    entities = extract_entities(text)
    assert "api.megacorp.com" in entities["domains"]
    assert "admin.target.org" in entities["domains"]


def test_extract_cves():
    text = "CVE-2024-3400 critical vulnerability in PAN-OS, also CVE-2023-44487"
    entities = extract_entities(text)
    assert "CVE-2024-3400" in entities["cves"]
    assert "CVE-2023-44487" in entities["cves"]


def test_extract_ports():
    text = "port: 443 is open, port: 22 running SSH"
    entities = extract_entities(text)
    assert "443" in entities["ports"]
    assert "22" in entities["ports"]


def test_extract_urls():
    text = "Vulnerable endpoint at https://target.com/api/login"
    entities = extract_entities(text)
    assert any("target.com" in u for u in entities["urls"])


def test_extract_severities():
    text = "Found a CRITICAL vulnerability and a medium-severity issue"
    entities = extract_entities(text)
    assert "critical" in entities["severities"]
    assert "medium" in entities["severities"]


def test_extract_tool_from_metadata():
    entities = extract_entities("some output", {"tool": "nuclei", "template": "cve-2024-1234"})
    assert "nuclei" in entities["tools"]
    assert "cve-2024-1234" in entities["techniques"]


def test_filters_file_extensions():
    text = "import utils.py and config.json"
    entities = extract_entities(text)
    assert not any(d.endswith(".py") for d in entities["domains"])
    assert not any(d.endswith(".json") for d in entities["domains"])


# ── Ingest pipeline tests (mocked DB) ────────────────────────────────────────

@pytest.mark.asyncio
async def test_ingest_chunks_stores_in_vector():
    """ingest_chunks should call vector_store.store for each chunk."""
    from src.memory.ingest import ingest_chunks
    from src.memory.chunker import Chunk

    chunks = [
        Chunk(content="Finding: SQL injection on /api/users", source="test.txt", format="text",
              metadata={"tool": "nuclei"}),
        Chunk(content="Finding: XSS in search parameter", source="test.txt", format="text",
              metadata={"tool": "nuclei"}),
    ]

    mock_store = AsyncMock(return_value=1)

    with patch("src.memory.store.store", mock_store), \
         patch("src.memory.store.VALID_COLLECTIONS", {"answer", "guide", "code", "general"}), \
         patch("src.memory.graph.graph_available", return_value=False):
        result = await ingest_chunks(chunks, collection="answer")

    assert result.chunks_stored == 2
    assert result.entities_extracted > 0
    assert mock_store.call_count == 2


@pytest.mark.asyncio
async def test_ingest_chunks_extracts_entities():
    """ingest_chunks should extract security entities from content."""
    from src.memory.ingest import ingest_chunks
    from src.memory.chunker import Chunk

    chunks = [
        Chunk(
            content="CVE-2024-3400 affects 10.0.0.1 on port: 443",
            source="scan.jsonl",
            format="scan",
            metadata={"tool": "nuclei", "severity": "critical"},
        ),
    ]

    mock_store = AsyncMock(return_value=1)

    with patch("src.memory.store.store", mock_store), \
         patch("src.memory.store.VALID_COLLECTIONS", {"answer", "guide", "code", "general"}), \
         patch("src.memory.graph.graph_available", return_value=False):
        result = await ingest_chunks(chunks, collection="answer")

    assert result.entities_extracted > 0
    assert result.chunks_stored == 1


@pytest.mark.asyncio
async def test_ingest_chunks_handles_errors_gracefully():
    """ingest_chunks should continue on individual chunk errors."""
    from src.memory.ingest import ingest_chunks
    from src.memory.chunker import Chunk

    chunks = [
        Chunk(content="Good chunk", source="test.txt"),
        Chunk(content="Bad chunk", source="test.txt"),
        Chunk(content="Another good chunk", source="test.txt"),
    ]

    call_count = 0
    async def store_with_error(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise RuntimeError("DB connection lost")
        return call_count

    with patch("src.memory.store.store", store_with_error), \
         patch("src.memory.store.VALID_COLLECTIONS", {"answer", "guide", "code", "general"}), \
         patch("src.memory.graph.graph_available", return_value=False):
        result = await ingest_chunks(chunks)

    assert result.chunks_stored == 2  # 1st and 3rd succeeded
    assert len(result.errors) == 1  # 2nd failed


def test_ingest_result_to_dict():
    result = IngestResult()
    result.chunks_stored = 5
    result.entities_extracted = 12
    result.graph_nodes_created = 3
    result.errors = ["chunk 2: timeout"]
    result.sources = ["report.md"]

    d = result.to_dict()
    assert d["chunks_stored"] == 5
    assert d["entities_extracted"] == 12
    assert d["graph_nodes_created"] == 3
    assert len(d["errors"]) == 1
    assert d["sources"] == ["report.md"]


# ── Chunker + ingest integration ─────────────────────────────────────────────

def test_chunk_file_text(tmp_path):
    """chunk_file should read and chunk a text file."""
    from src.memory.chunker import chunk_file

    f = tmp_path / "report.md"
    f.write_text("# Findings\n\nSQL injection found.\n\n" * 20)

    chunks = chunk_file(str(f))
    assert len(chunks) >= 1
    assert all(c.source == str(f.resolve()) for c in chunks)


def test_chunk_file_jsonl(tmp_path):
    """chunk_file should detect JSONL format from extension."""
    from src.memory.chunker import chunk_file

    lines = [
        json.dumps({"template-id": "cve-2024-1234", "host": "https://target.com",
                     "matched-at": "https://target.com/api", "info": {"name": "Test", "severity": "high"}}),
        json.dumps({"template-id": "cve-2024-5678", "host": "https://target.com",
                     "matched-at": "https://target.com/login", "info": {"name": "Auth Bypass", "severity": "critical"}}),
    ]
    f = tmp_path / "nuclei.jsonl"
    f.write_text("\n".join(lines))

    chunks = chunk_file(str(f))
    assert len(chunks) >= 1
    assert all(c.format == "scan" for c in chunks)


def test_chunk_file_not_found():
    """chunk_file should raise FileNotFoundError."""
    from src.memory.chunker import chunk_file

    with pytest.raises(FileNotFoundError):
        chunk_file("/nonexistent/path.txt")
