from src.safety.scope import validate_target, validate_command, ScopeCheck
from src.safety.autonomy import check_autonomy

def test_blocks_cloud_metadata():
    check = validate_target("169.254.169.254")
    assert not check.allowed
    assert "metadata" in check.reason

def test_blocks_private_ip():
    check = validate_target("192.168.1.1")
    assert not check.allowed

def test_allows_public_target():
    check = validate_target("example.com")
    assert check.allowed

def test_scope_include():
    check = validate_target("sub.example.com", scope={"include": ["*.example.com"]})
    assert check.allowed

def test_scope_exclude():
    check = validate_target("internal.example.com", scope={"include": ["*.example.com"], "exclude": ["internal.example.com"]})
    assert not check.allowed

def test_command_validation():
    check = validate_command("subfinder -d example.com -json", scope={"include": ["*.example.com", "example.com"]})
    assert check.allowed

def test_command_blocks_private():
    check = validate_command("nmap -sV 192.168.1.1")
    assert not check.allowed

def test_autonomy_supervised_allows_recon():
    d = check_autonomy("terminal", {"command": "subfinder -d example.com"}, "supervised")
    assert d.allowed and not d.needs_approval

def test_autonomy_supervised_flags_exploit():
    d = check_autonomy("terminal", {"command": "sqlmap -u http://target/vuln"}, "supervised")
    assert d.needs_approval

def test_autonomy_manual_requires_all():
    d = check_autonomy("terminal", {"command": "ls"}, "manual")
    assert d.needs_approval

def test_autonomy_full_auto_allows_all():
    d = check_autonomy("terminal", {"command": "rm -rf /"}, "full_auto")
    assert d.allowed and not d.needs_approval
