from src.license import generate_key, validate_key, TIERS


def test_generate_key_format():
    key = generate_key("test@example.com", "PRO")
    assert key.startswith("HBG-PRO-")
    parts = key.split("-")
    assert len(parts) == 4


def test_validate_valid_key():
    key = generate_key("test@example.com", "PRO")
    result = validate_key(key)
    assert result.valid
    assert result.tier == "PRO"


def test_validate_invalid_key():
    result = validate_key("garbage-key-here")
    assert not result.valid


def test_validate_unknown_tier():
    result = validate_key("HBG-MEGA-abc123-deadbeef01234567")
    assert not result.valid


def test_free_tier_limits():
    assert TIERS["FREE"]["agents"] == 3
    assert TIERS["PRO"]["agents"] == 12


def test_all_tiers_exist():
    assert set(TIERS.keys()) == {"FREE", "TRIAL", "PRO", "TEAM", "ENTERPRISE"}


def test_trial_key_valid_when_fresh():
    key = generate_key("test@example.com", "TRIAL")
    result = validate_key(key)
    assert result.valid
    assert result.tier == "TRIAL"
    assert result.limits.get("trial_days") == 14


def test_free_tier_is_limited():
    assert TIERS["FREE"]["competitive_mode"] is False
    assert TIERS["PRO"]["competitive_mode"] is True
