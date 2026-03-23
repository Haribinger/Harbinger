"""CLI onboarding — harbinger onboard, configure, doctor.

onboard: First-time setup wizard
configure: Interactive configuration
doctor: Health check all dependencies
"""
import os
import json
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class DoctorCheck:
    name: str
    status: str  # "ok", "warn", "fail"
    message: str
    fix_hint: str = ""

    @property
    def passed(self) -> bool:
        return self.status == "ok"


def check_docker() -> DoctorCheck:
    """Check if Docker is accessible."""
    import subprocess
    try:
        result = subprocess.run(["docker", "info"], capture_output=True, timeout=10)
        if result.returncode == 0:
            return DoctorCheck("Docker", "ok", "Docker daemon running")
        return DoctorCheck("Docker", "fail", "Docker not responding", "Start Docker: sudo systemctl start docker")
    except FileNotFoundError:
        return DoctorCheck("Docker", "fail", "Docker not installed", "Install: https://docs.docker.com/get-docker/")
    except Exception as e:
        return DoctorCheck("Docker", "fail", str(e))


def check_ollama() -> DoctorCheck:
    """Check if Ollama is running."""
    import subprocess
    try:
        result = subprocess.run(["curl", "-s", "http://localhost:11434/api/tags"], capture_output=True, timeout=5)
        if result.returncode == 0 and b"models" in result.stdout:
            data = json.loads(result.stdout)
            model_count = len(data.get("models", []))
            return DoctorCheck("Ollama", "ok", f"Running with {model_count} models")
        return DoctorCheck("Ollama", "warn", "Ollama running but no models", "Pull a model: ollama pull llama3.1:8b")
    except Exception:
        return DoctorCheck("Ollama", "warn", "Ollama not running (optional)", "Install: https://ollama.com")


def check_postgres() -> DoctorCheck:
    """Check PostgreSQL connectivity."""
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    import subprocess
    try:
        result = subprocess.run(
            ["pg_isready", "-h", db_host, "-p", db_port],
            capture_output=True, timeout=5,
        )
        if result.returncode == 0:
            return DoctorCheck("PostgreSQL", "ok", f"Accepting connections on {db_host}:{db_port}")
        return DoctorCheck("PostgreSQL", "fail", "Not responding", "Start: docker compose up -d postgres")
    except FileNotFoundError:
        return DoctorCheck("PostgreSQL", "warn", "pg_isready not found (checking via docker)")
    except Exception as e:
        return DoctorCheck("PostgreSQL", "fail", str(e))


def check_redis() -> DoctorCheck:
    """Check Redis connectivity."""
    import subprocess
    try:
        result = subprocess.run(
            ["redis-cli", "-h", os.getenv("REDIS_HOST", "localhost"), "ping"],
            capture_output=True, timeout=5,
        )
        if result.returncode == 0 and b"PONG" in result.stdout:
            return DoctorCheck("Redis", "ok", "Connected")
        return DoctorCheck("Redis", "fail", "Not responding", "Start: docker compose up -d redis")
    except FileNotFoundError:
        return DoctorCheck("Redis", "warn", "redis-cli not found")
    except Exception as e:
        return DoctorCheck("Redis", "fail", str(e))


def check_neo4j() -> DoctorCheck:
    """Check Neo4j connectivity."""
    import subprocess
    try:
        result = subprocess.run(
            ["curl", "-s", f"http://{os.getenv('NEO4J_HOST', 'localhost')}:7474"],
            capture_output=True, timeout=5,
        )
        if result.returncode == 0:
            return DoctorCheck("Neo4j", "ok", "Web interface accessible")
        return DoctorCheck("Neo4j", "warn", "Not responding (optional)", "Start: docker compose up -d neo4j")
    except Exception:
        return DoctorCheck("Neo4j", "warn", "Not reachable (optional)")


def check_agent_images() -> DoctorCheck:
    """Check if agent Docker images are built."""
    import subprocess
    images = ["harbinger/pd-tools", "harbinger/kali-tools", "harbinger/dev-tools",
              "harbinger/osint-tools", "harbinger/base"]
    found = 0
    for img in images:
        result = subprocess.run(["docker", "images", "-q", img], capture_output=True, timeout=5)
        if result.stdout.strip():
            found += 1
    if found == len(images):
        return DoctorCheck("Agent Images", "ok", f"All {found}/{len(images)} images built")
    elif found > 0:
        return DoctorCheck("Agent Images", "warn", f"{found}/{len(images)} images built", "Build missing: docker compose -f docker-compose.agents.yml build")
    return DoctorCheck("Agent Images", "fail", "No agent images built", "Build: cd docker && for d in */; do docker build -t harbinger/${d%/} $d; done")


def check_api_keys() -> DoctorCheck:
    """Check if any LLM API keys are configured."""
    keys = {
        "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY", ""),
        "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", ""),
        "GOOGLE_API_KEY": os.getenv("GOOGLE_API_KEY", ""),
    }
    configured = {k: v for k, v in keys.items() if v}
    ollama = check_ollama()
    if configured:
        return DoctorCheck("LLM Provider", "ok", f"{len(configured)} API key(s) configured + Ollama")
    elif ollama.passed:
        return DoctorCheck("LLM Provider", "ok", "Ollama available (no cloud API keys)")
    return DoctorCheck("LLM Provider", "warn", "No LLM configured", "Set ANTHROPIC_API_KEY or install Ollama")


def run_doctor() -> list[DoctorCheck]:
    """Run all health checks."""
    checks = [
        check_docker(),
        check_postgres(),
        check_redis(),
        check_neo4j(),
        check_ollama(),
        check_agent_images(),
        check_api_keys(),
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
            })

    if not steps:
        steps.append({
            "component": "All Systems",
            "status": "ok",
            "action": "Ready to go! Try: harbinger mission start 'pentest example.com'",
            "priority": "done",
        })

    return steps
