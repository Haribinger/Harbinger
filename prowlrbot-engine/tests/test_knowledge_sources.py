"""Tests for the bug bounty knowledge sources registry and parsers."""
import pytest

from src.memory.knowledge_sources import (
    KnowledgeSource,
    KnowledgeRegistry,
    BUILTIN_SOURCES,
    parse_howtohunt_entry,
    parse_payloads_entry,
)


def test_builtin_sources_exist():
    assert len(BUILTIN_SOURCES) >= 5
    names = {s.id for s in BUILTIN_SOURCES}
    assert "howtohunt" in names
    assert "payloadsallthethings" in names
    assert "hacktricks" in names


def test_parse_howtohunt():
    content = "# SQL Injection\n\n## Description\nSQLi occurs when...\n\n## Payloads\n- ' OR 1=1--\n- \" OR \"\"=\""
    entries = parse_howtohunt_entry(content, "sqli.md")
    assert len(entries) >= 1
    assert entries[0]["title"] == "SQL Injection — Description"
    assert "collection" in entries[0]


def test_parse_payloads():
    content = "# XSS Injection\n\n## Polyglot\n```\njaVasCript:/*-/*`/*\\`/*'/*\"/**/(/* */oNcLiCk=alert() )//\n```"
    entries = parse_payloads_entry(content, "xss.md")
    assert len(entries) >= 1


def test_registry_add_custom():
    reg = KnowledgeRegistry()
    reg.add(KnowledgeSource(
        id="my-payloads",
        name="My Payloads",
        url="https://github.com/user/payloads",
        source_type="github",
        categories=["payloads"],
    ))
    assert reg.get("my-payloads") is not None
    assert len(reg.list_all()) >= len(BUILTIN_SOURCES) + 1


def test_registry_list_by_category():
    reg = KnowledgeRegistry()
    recon = reg.list_by_category("recon")
    assert all("recon" in s["categories"] for s in recon)


def test_registry_remove_custom():
    reg = KnowledgeRegistry()
    reg.add(KnowledgeSource(
        id="temp-source",
        name="Temp",
        url="https://example.com",
        source_type="url",
        categories=["web"],
    ))
    assert reg.get("temp-source") is not None
    reg.remove("temp-source")
    assert reg.get("temp-source") is None


def test_registry_remove_builtin_raises():
    reg = KnowledgeRegistry()
    with pytest.raises(ValueError, match="Cannot remove built-in source"):
        reg.remove("howtohunt")


def test_source_to_dict():
    src = KnowledgeSource(
        id="test",
        name="Test Source",
        url="https://example.com",
        source_type="url",
        description="A test source",
        categories=["web", "recon"],
    )
    d = src.to_dict()
    assert d["id"] == "test"
    assert d["name"] == "Test Source"
    assert d["categories"] == ["web", "recon"]
    assert d["enabled"] is True
    assert d["created_by"] == "system"


def test_parse_howtohunt_no_sections():
    # File with only a top-level heading and no ## sections — single entry returned
    content = "# SSRF Basics\n\nServer-Side Request Forgery allows attackers to make the server fetch internal resources."
    entries = parse_howtohunt_entry(content, "ssrf.md")
    assert len(entries) == 1
    assert entries[0]["title"] == "SSRF Basics"
    assert entries[0]["source"] == "howtohunt"
    assert entries[0]["collection"] == "guide"


def test_parse_howtohunt_filename_fallback():
    # No heading in content — title derived from filename
    content = "Some content without a heading."
    entries = parse_howtohunt_entry(content, "open-redirect.md")
    assert len(entries) == 1
    assert "Open Redirect" in entries[0]["title"]


def test_parse_payloads_extracts_code_blocks():
    content = (
        "# SSTI\n\n"
        "## Jinja2\n"
        "```\n{{7*7}}\n```\n\n"
        "## Twig\n"
        "```\n{{7*'7'}}\n```\n"
    )
    entries = parse_payloads_entry(content, "ssti.md")
    # Should have the main entry + 2 code block entries
    assert len(entries) >= 3
    code_entries = [e for e in entries if e["collection"] == "code"]
    assert len(code_entries) == 2
    assert all(e["source"] == "payloadsallthethings" for e in entries)


def test_registry_list_enabled():
    reg = KnowledgeRegistry()
    # Disable one source
    reg._sources["seclists"].enabled = False
    enabled = reg.list_enabled()
    ids = {s["id"] for s in enabled}
    assert "seclists" not in ids
    assert "howtohunt" in ids


def test_builtin_sources_have_required_fields():
    for src in BUILTIN_SOURCES:
        assert src.id, f"Source missing id: {src}"
        assert src.name, f"Source missing name: {src.id}"
        assert src.url.startswith("https://"), f"Source URL not HTTPS: {src.id}"
        assert len(src.categories) >= 1, f"Source has no categories: {src.id}"
        assert src.source_type in ("github", "url", "local"), f"Unknown source_type: {src.id}"
