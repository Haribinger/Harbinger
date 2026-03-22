import pytest
from src.memory.ingest import extract_entities


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
