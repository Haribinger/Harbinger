from src.cli_onboard import check_docker, check_ollama, check_postgres, DoctorCheck


def test_doctor_check_structure():
    c = DoctorCheck(name="Docker", status="ok", message="Running")
    assert c.name == "Docker"
    assert c.passed


def test_doctor_check_fail():
    c = DoctorCheck(name="Ollama", status="fail", message="Not running")
    assert not c.passed


def test_doctor_check_warn_not_passed():
    c = DoctorCheck(name="Redis", status="warn", message="redis-cli not found")
    assert not c.passed


def test_doctor_check_fix_hint_default():
    c = DoctorCheck(name="Neo4j", status="ok", message="Web interface accessible")
    assert c.fix_hint == ""


def test_check_docker_returns_doctor_check():
    result = check_docker()
    assert isinstance(result, DoctorCheck)
    assert result.name == "Docker"
    assert result.status in ("ok", "warn", "fail")
    assert result.message


def test_check_ollama_returns_doctor_check():
    result = check_ollama()
    assert isinstance(result, DoctorCheck)
    assert result.name == "Ollama"
    assert result.status in ("ok", "warn", "fail")


def test_check_postgres_returns_doctor_check():
    result = check_postgres()
    assert isinstance(result, DoctorCheck)
    assert result.name == "PostgreSQL"
    assert result.status in ("ok", "warn", "fail")
