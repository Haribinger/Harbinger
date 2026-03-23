"""Nuclei Template IDE — create, edit, test, and manage nuclei templates."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
import time
import re

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2/nuclei-ide", tags=["nuclei-ide"])


# In-memory template store (persists to DB when available)
_templates: dict[str, dict] = {}
_test_results: list[dict] = []


class TemplateCreate(BaseModel):
    name: str
    description: str = ""
    severity: str = "info"  # info, low, medium, high, critical
    author: str = ""
    tags: list[str] = []
    yaml_content: str  # The actual nuclei template YAML


class TemplateTest(BaseModel):
    target: str  # URL or host to test against
    yaml_content: str  # Template YAML to test
    timeout: int = 30


class TemplateValidation(BaseModel):
    yaml_content: str


# === CRUD ===

@router.post("/templates", status_code=201)
async def create_template(body: TemplateCreate):
    template_id = f"harbinger-{body.name.lower().replace(' ', '-')}-{int(time.time())}"
    template = {
        "id": template_id,
        "name": body.name,
        "description": body.description,
        "severity": body.severity,
        "author": body.author,
        "tags": body.tags,
        "yaml_content": body.yaml_content,
        "created_at": time.time(),
        "updated_at": time.time(),
        "test_count": 0,
        "last_test_result": None,
    }
    _templates[template_id] = template
    return template


@router.get("/templates")
async def list_templates(severity: str = "", tag: str = ""):
    templates = list(_templates.values())
    if severity:
        templates = [t for t in templates if t["severity"] == severity]
    if tag:
        templates = [t for t in templates if tag in t.get("tags", [])]
    return {"templates": templates, "total": len(templates)}


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    t = _templates.get(template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    return t


@router.put("/templates/{template_id}")
async def update_template(template_id: str, body: TemplateCreate):
    if template_id not in _templates:
        raise HTTPException(404, "Template not found")
    _templates[template_id].update({
        "name": body.name,
        "description": body.description,
        "severity": body.severity,
        "author": body.author,
        "tags": body.tags,
        "yaml_content": body.yaml_content,
        "updated_at": time.time(),
    })
    return _templates[template_id]


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    if template_id not in _templates:
        raise HTTPException(404, "Template not found")
    del _templates[template_id]
    return {"status": "deleted", "id": template_id}


# === Validation ===

@router.post("/validate")
async def validate_template(body: TemplateValidation):
    """Validate a nuclei template YAML without running it."""
    errors = []
    warnings = []
    yaml_content = body.yaml_content

    # Check required fields
    if "id:" not in yaml_content:
        errors.append({"field": "id", "message": "Template must have an 'id' field"})
    if "info:" not in yaml_content:
        errors.append({"field": "info", "message": "Template must have an 'info' section"})
    if "name:" not in yaml_content:
        errors.append({"field": "info.name", "message": "Template must have a 'name' in info"})
    if "severity:" not in yaml_content:
        errors.append({"field": "info.severity", "message": "Template must have a 'severity' in info"})

    # Check for at least one protocol
    protocols = ["http:", "dns:", "network:", "file:", "headless:", "code:", "javascript:", "ssl:", "websocket:", "whois:"]
    has_protocol = any(p in yaml_content for p in protocols)
    if not has_protocol:
        errors.append({"field": "protocol", "message": f"Template must have at least one protocol section ({', '.join(p.rstrip(':') for p in protocols)})"})

    # Check matchers
    if "matchers:" not in yaml_content and "matchers-condition:" not in yaml_content:
        warnings.append({"field": "matchers", "message": "Template has no matchers — it will match everything"})

    # Severity validation
    severity_match = re.search(r"severity:\s*(\w+)", yaml_content)
    if severity_match:
        sev = severity_match.group(1).lower()
        if sev not in ("info", "low", "medium", "high", "critical"):
            errors.append({"field": "info.severity", "message": f"Invalid severity '{sev}' — must be info/low/medium/high/critical"})

    # Check for common mistakes
    if "{{BaseURL}}" not in yaml_content and "{{Hostname}}" not in yaml_content and "http:" in yaml_content:
        warnings.append({"field": "path", "message": "HTTP template doesn't use {{BaseURL}} or {{Hostname}} — target won't be substituted"})

    if "{{interactsh-url}}" in yaml_content and "oast" not in yaml_content.lower():
        warnings.append({"field": "tags", "message": "Template uses interactsh but doesn't have 'oast' tag"})

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "protocol_detected": next((p.rstrip(":") for p in protocols if p in yaml_content), None),
    }


# === Testing ===

@router.post("/test")
async def test_template(body: TemplateTest):
    """Test a template against a target using nuclei (requires Docker)."""
    # First validate
    validation = await validate_template(TemplateValidation(yaml_content=body.yaml_content))
    if not validation["valid"]:
        return {"status": "validation_failed", "errors": validation["errors"]}

    # Execution requires a running agent container with nuclei installed.
    # We cannot mount host temp files into Docker containers without privileged access,
    # so return an honest "not_implemented" with the validated template and a CLI hint.
    result = {
        "status": "not_implemented",
        "message": (
            "Template passed validation but live execution is not yet available from the IDE. "
            "Use an agent container with nuclei installed to run the template."
        ),
        "validation": validation,
        "target": body.target,
        "hint": f"To test manually: nuclei -t template.yaml -u {body.target} -jsonl",
    }

    _test_results.append({**result, "timestamp": time.time()})
    return result


# === Scaffold ===

@router.get("/scaffold/{protocol}")
async def scaffold_template(protocol: str, vuln_type: str = "detect"):
    """Generate a template scaffold for a given protocol."""
    scaffolds = {
        "http": {
            "detect": '''id: harbinger-{name}

info:
  name: {name}
  author: harbinger
  severity: info
  description: |
    Detects {name} on the target.
  tags: detect,harbinger

http:
  - method: GET
    path:
      - "{{{{BaseURL}}}}/"
    matchers-condition: and
    matchers:
      - type: word
        words:
          - "CHANGE_ME"
      - type: status
        status:
          - 200
''',
            "exploit": '''id: harbinger-{name}

info:
  name: {name}
  author: harbinger
  severity: high
  description: |
    Exploits {name} vulnerability.
  tags: exploit,harbinger
  classification:
    cve-id: CVE-YYYY-XXXXX
    cwe-id: CWE-XX

http:
  - method: POST
    path:
      - "{{{{BaseURL}}}}/vulnerable-endpoint"
    headers:
      Content-Type: application/x-www-form-urlencoded
    body: "param=PAYLOAD"
    matchers-condition: and
    matchers:
      - type: word
        words:
          - "SUCCESS_INDICATOR"
      - type: status
        status:
          - 200
    extractors:
      - type: regex
        regex:
          - 'sensitive_data_pattern'
''',
        },
        "dns": {
            "detect": '''id: harbinger-{name}

info:
  name: {name}
  author: harbinger
  severity: info
  tags: dns,harbinger

dns:
  - name: "{{{{FQDN}}}}"
    type: A
    matchers:
      - type: word
        words:
          - "EXPECTED_RESPONSE"
''',
        },
        "network": {
            "detect": '''id: harbinger-{name}

info:
  name: {name}
  author: harbinger
  severity: info
  tags: network,harbinger

network:
  - inputs:
      - data: "BANNER_GRAB\\r\\n"
    host:
      - "{{{{Hostname}}}}"
    port: 80
    matchers:
      - type: word
        words:
          - "SERVICE_BANNER"
''',
        },
    }

    if protocol not in scaffolds:
        raise HTTPException(400, f"Unknown protocol '{protocol}'. Available: {list(scaffolds.keys())}")
    if vuln_type not in scaffolds[protocol]:
        raise HTTPException(400, f"Unknown type '{vuln_type}'. Available: {list(scaffolds[protocol].keys())}")

    return {
        "protocol": protocol,
        "type": vuln_type,
        "yaml": scaffolds[protocol][vuln_type],
        "instructions": [
            "1. Replace {name} with your template name",
            "2. Update the matchers to match your target",
            "3. Use /validate to check syntax",
            "4. Use /test to verify against a target",
        ],
    }


# === Stats ===

@router.get("/stats")
async def ide_stats():
    return {
        "templates": len(_templates),
        "by_severity": {
            sev: len([t for t in _templates.values() if t["severity"] == sev])
            for sev in ["critical", "high", "medium", "low", "info"]
        },
        "recent_tests": len(_test_results),
    }
