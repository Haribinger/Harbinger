from src.cli_onboard import (
    DoctorCheck,
    check_docker,
    check_ollama,
    check_postgres,
    check_redis,
    check_neo4j,
    check_agent_images,
    check_api_keys,
    check_license,
    check_python_engine,
    check_mockhunter,
    check_prowlr_doctor,
    run_doctor,
    get_onboard_steps,
)


# --- DoctorCheck dataclass ---

def test_doctor_check_structure():
    c = DoctorCheck(name="Docker", status="ok", message="Running")
    assert c.name == "Docker"
    assert c.passed


def test_doctor_check_fail():
    c = DoctorCheck(name="Ollama", status="fail", message="Not running")
    assert not c.passed


def test_doctor_check_warn_not_passed():
    c = DoctorCheck(name="Redis", status="warn", message="Not reachable")
    assert not c.passed


def test_doctor_check_fix_hint_default():
    c = DoctorCheck(name="Neo4j", status="ok", message="Web interface accessible")
    assert c.fix_hint == ""


def test_doctor_check_category_default():
    c = DoctorCheck(name="Test", status="ok", message="Fine")
    assert c.category == "infrastructure"


def test_doctor_check_category_custom():
    c = DoctorCheck(name="License", status="ok", message="Active", category="security")
    assert c.category == "security"


def test_doctor_check_icon_ok():
    c = DoctorCheck(name="X", status="ok", message="")
    assert c.icon == "✅"


def test_doctor_check_icon_warn():
    c = DoctorCheck(name="X", status="warn", message="")
    assert c.icon == "⚠️"


def test_doctor_check_icon_fail():
    c = DoctorCheck(name="X", status="fail", message="")
    assert c.icon == "❌"


# --- Individual check functions ---

def test_check_docker_returns_doctor_check():
    result = check_docker()
    assert isinstance(result, DoctorCheck)
    assert result.name == "Docker"
    assert result.status in ("ok", "warn", "fail")
    assert result.message
    assert result.category == "infrastructure"


def test_check_ollama_returns_doctor_check():
    result = check_ollama()
    assert isinstance(result, DoctorCheck)
    assert result.name == "Ollama"
    assert result.status in ("ok", "warn", "fail")
    assert result.category == "infrastructure"


def test_check_postgres_returns_doctor_check():
    result = check_postgres()
    assert isinstance(result, DoctorCheck)
    assert result.name == "PostgreSQL"
    assert result.status in ("ok", "warn", "fail")
    assert result.category == "infrastructure"


def test_check_redis_returns_doctor_check():
    result = check_redis()
    assert isinstance(result, DoctorCheck)
    assert result.name == "Redis"
    assert result.status in ("ok", "warn", "fail")
    assert result.category == "infrastructure"


def test_check_neo4j_returns_doctor_check():
    result = check_neo4j()
    assert isinstance(result, DoctorCheck)
    assert result.name == "Neo4j"
    assert result.status in ("ok", "warn", "fail")
    assert result.category == "infrastructure"


def test_check_agent_images_returns_doctor_check():
    result = check_agent_images()
    assert isinstance(result, DoctorCheck)
    assert result.name == "Agent Images"
    assert result.status in ("ok", "warn", "fail")
    assert result.category == "infrastructure"


def test_check_api_keys_returns_doctor_check():
    result = check_api_keys()
    assert isinstance(result, DoctorCheck)
    assert result.name == "LLM Provider"
    assert result.status in ("ok", "warn", "fail")
    assert result.category == "security"


def test_check_license_returns_doctor_check():
    result = check_license()
    assert isinstance(result, DoctorCheck)
    assert result.name == "License"
    assert result.status in ("ok", "warn", "fail")
    assert result.category == "security"


def test_check_python_engine_returns_doctor_check():
    result = check_python_engine()
    assert isinstance(result, DoctorCheck)
    assert result.name == "Python Engine"
    assert result.status in ("ok", "warn", "fail")
    assert result.category == "code"


def test_check_mockhunter_returns_doctor_check():
    result = check_mockhunter()
    assert isinstance(result, DoctorCheck)
    assert result.name == "MockHunter"
    assert result.status in ("ok", "warn", "fail")
    assert result.category == "code"


def test_check_prowlr_doctor_returns_doctor_check():
    result = check_prowlr_doctor()
    assert isinstance(result, DoctorCheck)
    assert result.name == "Environment"
    assert result.status in ("ok", "warn", "fail")
    assert result.category == "environment"


# --- run_doctor ---

def test_run_doctor_returns_list():
    results = run_doctor()
    assert isinstance(results, list)
    assert len(results) == 11  # all checks present


def test_run_doctor_all_doctor_checks():
    results = run_doctor()
    for r in results:
        assert isinstance(r, DoctorCheck)
        assert r.status in ("ok", "warn", "fail")
        assert r.name
        assert r.message


def test_run_doctor_covers_all_categories():
    results = run_doctor()
    categories = {r.category for r in results}
    assert "infrastructure" in categories
    assert "security" in categories
    assert "code" in categories
    assert "environment" in categories


# --- get_onboard_steps ---

def test_get_onboard_steps_returns_list():
    steps = get_onboard_steps()
    assert isinstance(steps, list)
    assert len(steps) >= 1


def test_get_onboard_steps_have_category():
    steps = get_onboard_steps()
    for step in steps:
        assert "category" in step


def test_get_onboard_steps_have_required_keys():
    steps = get_onboard_steps()
    for step in steps:
        assert "component" in step
        assert "status" in step
        assert "action" in step
        assert "priority" in step
