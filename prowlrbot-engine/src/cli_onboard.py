"""CLI onboarding — harbinger onboard, configure, doctor.

Checks:
1. Docker API (via httpx, not subprocess)
2. PostgreSQL (via asyncpg or psycopg2)
3. Redis (via redis-py)
4. Neo4j (via HTTP API)
5. Ollama (via HTTP API)
6. Agent Docker images (via Docker API)
7. LLM providers (API key validation)
8. prowlr-doctor integration (Claude Code environment)
9. MockHunter (code quality)
10. Python engine (import check)
"""
import os
import json
import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class DoctorCheck:
    name: str
    status: str  # "ok", "warn", "fail"
    message: str
    fix_hint: str = ""
    category: str = "infrastructure"  # infrastructure, security, code, environment

    @property
    def passed(self) -> bool:
        return self.status == "ok"

    @property
    def icon(self) -> str:
        return {"ok": "✅", "warn": "⚠️", "fail": "❌"}.get(self.status, "?")


def check_docker() -> DoctorCheck:
    """Check Docker via HTTP API (works inside containers too)."""
    docker_host = os.getenv("DOCKER_HOST", "")

    if docker_host.startswith("tcp://"):
        # Docker socket proxy — use HTTP
        url = docker_host.replace("tcp://", "http://") + "/_ping"
        try:
            import httpx
            resp = httpx.get(url, timeout=5)
            if resp.status_code == 200:
                return DoctorCheck("Docker", "ok", f"Docker API reachable at {docker_host}", category="infrastructure")
        except Exception as e:
            return DoctorCheck("Docker", "fail", f"Docker API unreachable: {e}",
                               fix_hint="Check DOCKER_HOST env var or start Docker", category="infrastructure")

    # Try local socket
    try:
        result = subprocess.run(["docker", "info", "--format", "{{.ServerVersion}}"],
                                capture_output=True, timeout=10, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            return DoctorCheck("Docker", "ok", f"Docker {version} running", category="infrastructure")
        return DoctorCheck("Docker", "fail", "Docker not responding",
                           fix_hint="Start Docker: sudo systemctl start docker", category="infrastructure")
    except FileNotFoundError:
        return DoctorCheck("Docker", "fail", "Docker not installed",
                           fix_hint="Install: https://docs.docker.com/get-docker/", category="infrastructure")
    except Exception as e:
        return DoctorCheck("Docker", "fail", str(e), category="infrastructure")


def check_postgres() -> DoctorCheck:
    """Check PostgreSQL via Python connection (not pg_isready)."""
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    user = os.getenv("DB_USER", "harbinger")
    password = os.getenv("DB_PASSWORD", "")
    dbname = os.getenv("DB_NAME", "harbinger")

    try:
        import psycopg2
        conn = psycopg2.connect(host=host, port=port, user=user, password=password,
                                dbname=dbname, connect_timeout=5)
        conn.close()
        return DoctorCheck("PostgreSQL", "ok", f"Connected to {host}:{port}/{dbname}", category="infrastructure")
    except ImportError:
        # Try asyncpg via subprocess
        try:
            result = subprocess.run(
                ["python3", "-c",
                 f"import asyncio,asyncpg;asyncio.run(asyncpg.connect('postgresql://{user}:{password}@{host}:{port}/{dbname}',timeout=5))"],
                capture_output=True, timeout=10, text=True
            )
            if result.returncode == 0:
                return DoctorCheck("PostgreSQL", "ok", f"Connected to {host}:{port}", category="infrastructure")
        except Exception:
            pass

        # TCP connection as fallback — at least proves the port is open
        import socket
        try:
            s = socket.create_connection((host, int(port)), timeout=5)
            s.close()
            return DoctorCheck("PostgreSQL", "ok", f"Port {host}:{port} open (no auth check)", category="infrastructure")
        except Exception:
            return DoctorCheck("PostgreSQL", "fail", f"Cannot connect to {host}:{port}",
                               fix_hint="Start: docker compose up -d postgres", category="infrastructure")
    except Exception as e:
        msg = str(e).split('\n')[0]
        if "password authentication failed" in msg:
            return DoctorCheck("PostgreSQL", "warn", f"Connected but auth failed on {host}:{port}",
                               fix_hint="Check DB_PASSWORD env var", category="infrastructure")
        return DoctorCheck("PostgreSQL", "fail", f"Connection failed: {msg}",
                           fix_hint="Start: docker compose up -d postgres", category="infrastructure")


def check_redis() -> DoctorCheck:
    """Check Redis via Python (not redis-cli)."""
    host = os.getenv("REDIS_HOST", "localhost")
    port = os.getenv("REDIS_PORT", "6379")
    password = os.getenv("REDIS_PASSWORD", "")

    try:
        import redis
        r = redis.Redis(host=host, port=int(port), password=password or None, socket_timeout=5)
        r.ping()
        return DoctorCheck("Redis", "ok", f"Connected to {host}:{port}", category="infrastructure")
    except ImportError:
        # TCP fallback
        import socket
        try:
            s = socket.create_connection((host, int(port)), timeout=5)
            s.close()
            return DoctorCheck("Redis", "ok", f"Port {host}:{port} open", category="infrastructure")
        except Exception:
            return DoctorCheck("Redis", "fail", f"Cannot connect to {host}:{port}",
                               fix_hint="Start: docker compose up -d redis", category="infrastructure")
    except Exception as e:
        return DoctorCheck("Redis", "fail", str(e),
                           fix_hint="Start: docker compose up -d redis", category="infrastructure")


def check_neo4j() -> DoctorCheck:
    """Check Neo4j via HTTP API."""
    host = os.getenv("NEO4J_HOST", "localhost")
    port = "7474"  # HTTP port

    try:
        import httpx
        resp = httpx.get(f"http://{host}:{port}", timeout=5)
        if resp.status_code == 200:
            return DoctorCheck("Neo4j", "ok", f"Web interface at {host}:{port}", category="infrastructure")
        return DoctorCheck("Neo4j", "warn", f"Responded with {resp.status_code}", category="infrastructure")
    except ImportError:
        import socket
        try:
            s = socket.create_connection((host, int(port)), timeout=5)
            s.close()
            return DoctorCheck("Neo4j", "ok", f"Port {host}:{port} open", category="infrastructure")
        except Exception:
            return DoctorCheck("Neo4j", "warn", "Not reachable (optional)",
                               fix_hint="Start: docker compose up -d neo4j", category="infrastructure")
    except Exception:
        return DoctorCheck("Neo4j", "warn", "Not reachable (optional)", category="infrastructure")


def check_ollama() -> DoctorCheck:
    """Check Ollama via HTTP API."""
    url = os.getenv("OLLAMA_URL", "http://localhost:11434")

    try:
        import httpx
        resp = httpx.get(f"{url}/api/tags", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            models = data.get("models", [])
            if models:
                names = [m.get("name", "?") for m in models[:3]]
                return DoctorCheck("Ollama", "ok", f"{len(models)} models: {', '.join(names)}", category="infrastructure")
            return DoctorCheck("Ollama", "warn", "Running but no models pulled",
                               fix_hint="Pull a model: ollama pull llama3.1:8b", category="infrastructure")
    except Exception:
        pass
    return DoctorCheck("Ollama", "warn", "Not running (optional — can use API keys instead)",
                       fix_hint="Install: https://ollama.com", category="infrastructure")


def check_agent_images() -> DoctorCheck:
    """Check if agent Docker images are built."""
    images = ["harbinger/pd-tools", "harbinger/kali-tools", "harbinger/dev-tools",
              "harbinger/osint-tools", "harbinger/base"]

    docker_host = os.getenv("DOCKER_HOST", "")
    found = 0

    if docker_host.startswith("tcp://"):
        try:
            import httpx
            base = docker_host.replace("tcp://", "http://")
            for img in images:
                resp = httpx.get(f"{base}/v1.41/images/json",
                                 params={"filters": json.dumps({"reference": [img]})}, timeout=5)
                if resp.status_code == 200 and resp.json():
                    found += 1
        except Exception:
            pass
    else:
        for img in images:
            try:
                result = subprocess.run(["docker", "images", "-q", img],
                                        capture_output=True, timeout=5, text=True)
                if result.stdout.strip():
                    found += 1
            except Exception:
                pass

    if found == len(images):
        return DoctorCheck("Agent Images", "ok", f"All {found}/{len(images)} images built", category="infrastructure")
    elif found > 0:
        return DoctorCheck("Agent Images", "warn", f"{found}/{len(images)} images built",
                           fix_hint="Build missing: cd docker && for d in */; do docker build -t harbinger/${d%/} $d; done",
                           category="infrastructure")
    return DoctorCheck("Agent Images", "fail", "No agent images built",
                       fix_hint="Build: cd docker && for d in */; do docker build -t harbinger/${d%/} $d; done",
                       category="infrastructure")


def check_api_keys() -> DoctorCheck:
    """Check LLM provider configuration."""
    providers = {
        "ANTHROPIC_API_KEY": "Anthropic (Claude)",
        "OPENAI_API_KEY": "OpenAI (GPT)",
        "GOOGLE_API_KEY": "Google (Gemini)",
    }
    configured = {name: desc for key, desc in providers.items() if (name := os.getenv(key, ""))}

    # Also check Ollama as a provider
    ollama_check = check_ollama()
    has_ollama = ollama_check.passed

    if configured:
        return DoctorCheck("LLM Provider", "ok",
                           f"{len(configured)} API key(s) + {'Ollama' if has_ollama else 'no Ollama'}",
                           category="security")
    elif has_ollama:
        return DoctorCheck("LLM Provider", "ok", "Ollama available (no cloud API keys needed)", category="security")
    return DoctorCheck("LLM Provider", "warn", "No LLM configured",
                       fix_hint="Set ANTHROPIC_API_KEY or install Ollama", category="security")


def check_license() -> DoctorCheck:
    """Check license status."""
    try:
        from src.license import load_license
        lic = load_license()
        if lic.valid:
            return DoctorCheck("License", "ok", f"{lic.tier} — {lic.limits.get('description', '')}", category="security")
        return DoctorCheck("License", "warn", f"Invalid or expired ({lic.tier})",
                           fix_hint="Activate: harbinger license --key YOUR_KEY", category="security")
    except Exception:
        return DoctorCheck("License", "ok", "FREE tier (Community)", category="security")


def check_python_engine() -> DoctorCheck:
    """Check that the Python engine imports correctly."""
    try:
        from src.main import create_app
        from src.engine.performer import perform_agent_chain
        from src.engine.tools.registry import ToolExecutor
        return DoctorCheck("Python Engine", "ok", "All core modules importable", category="code")
    except ImportError as e:
        return DoctorCheck("Python Engine", "fail", f"Import error: {e}",
                           fix_hint="Run: cd prowlrbot-engine && pip install -e .", category="code")
    except Exception as e:
        return DoctorCheck("Python Engine", "warn", f"Import warning: {e}", category="code")


def check_mockhunter() -> DoctorCheck:
    """Check MockHunter availability."""
    try:
        result = subprocess.run(["mockhunter", "scan", "--help"], capture_output=True, timeout=5)
        if result.returncode == 0:
            return DoctorCheck("MockHunter", "ok", "Available for code scanning", category="code")
    except FileNotFoundError:
        return DoctorCheck("MockHunter", "warn", "Not installed",
                           fix_hint="Build: cd tools/mockhunter && go build -o ~/go/bin/mockhunter .", category="code")
    except Exception:
        pass
    return DoctorCheck("MockHunter", "warn", "Not available", category="code")


def check_prowlr_doctor() -> DoctorCheck:
    """Check prowlr-doctor integration (Claude Code environment)."""
    try:
        from prowlr_doctor.scanner import load_snapshot, run_audit
        env = load_snapshot()
        findings, budget = run_audit(env)
        critical = [f for f in findings if f.severity == "critical"]
        high = [f for f in findings if f.severity == "high"]
        if critical:
            return DoctorCheck("Environment", "fail",
                               f"{len(critical)} critical + {len(high)} high findings in Claude Code config",
                               fix_hint="Run: prowlr doctor --write-plan && prowlr doctor --apply",
                               category="environment")
        elif high:
            return DoctorCheck("Environment", "warn",
                               f"{len(high)} high findings in Claude Code config",
                               fix_hint="Run: prowlr doctor for details",
                               category="environment")
        return DoctorCheck("Environment", "ok",
                           f"Clean — {len(findings)} minor findings, {budget.estimated_tokens:,} tokens/session",
                           category="environment")
    except ImportError:
        return DoctorCheck("Environment", "warn", "prowlr-doctor not installed (optional)",
                           fix_hint="Install: pip install prowlr-doctor", category="environment")
    except Exception as e:
        return DoctorCheck("Environment", "warn", f"Check failed: {e}", category="environment")


def run_doctor() -> list[DoctorCheck]:
    """Run all health checks grouped by category."""
    checks = [
        # Infrastructure
        check_docker(),
        check_postgres(),
        check_redis(),
        check_neo4j(),
        check_ollama(),
        check_agent_images(),
        # Security
        check_api_keys(),
        check_license(),
        # Code
        check_python_engine(),
        check_mockhunter(),
        # Environment
        check_prowlr_doctor(),
    ]
    return checks


def get_onboard_steps() -> list[dict]:
    """Return onboarding checklist based on current state."""
    checks = run_doctor()
    steps = []

    for check in checks:
        if not check.passed:
            steps.append({
                "component": check.name,
                "status": check.status,
                "action": check.fix_hint or check.message,
                "priority": "required" if check.status == "fail" else "recommended",
                "category": check.category,
            })

    if not steps:
        steps.append({
            "component": "All Systems",
            "status": "ok",
            "action": "Ready to go! Try: harbinger mission start 'pentest example.com'",
            "priority": "done",
            "category": "all",
        })

    return steps
