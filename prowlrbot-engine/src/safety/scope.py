"""Scope validation — ensure tool calls stay within authorized targets."""
import ipaddress
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# RFC 1918 private ranges (block by default)
PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
]

# Cloud metadata endpoints (always block)
BLOCKED_HOSTS = {
    "169.254.169.254",  # AWS/GCP metadata
    "metadata.google.internal",
    "100.100.100.200",  # Alibaba metadata
}


@dataclass
class ScopeCheck:
    allowed: bool
    reason: str = ""
    needs_approval: bool = False


def validate_target(target: str, scope: dict | None = None,
                     allow_private: bool = False) -> ScopeCheck:
    """Check if a target is within scope."""
    if not target:
        return ScopeCheck(allowed=True)

    # Always block cloud metadata
    if target in BLOCKED_HOSTS:
        return ScopeCheck(allowed=False, reason=f"Blocked: cloud metadata endpoint {target}")

    # Check private IP ranges
    try:
        ip = ipaddress.ip_address(target)
        if not allow_private:
            for network in PRIVATE_RANGES:
                if ip in network:
                    return ScopeCheck(allowed=False, reason=f"Blocked: private IP {target}")
    except ValueError:
        pass  # Not an IP — it's a hostname, check scope rules

    if not scope:
        return ScopeCheck(allowed=True)

    # Check include rules
    includes = scope.get("include", [])
    excludes = scope.get("exclude", [])

    # Check excludes first
    for pattern in excludes:
        if _matches(target, pattern):
            return ScopeCheck(allowed=False, reason=f"Excluded by pattern: {pattern}")

    # If includes specified, target must match at least one
    if includes:
        for pattern in includes:
            if _matches(target, pattern):
                return ScopeCheck(allowed=True)
        return ScopeCheck(allowed=False, reason=f"Not in scope (no include matched)")

    return ScopeCheck(allowed=True)


def validate_command(command: str, scope: dict | None = None) -> ScopeCheck:
    """Extract targets from a command and validate each."""
    # Extract hostnames/IPs from common tool patterns
    targets = _extract_targets(command)
    for target in targets:
        check = validate_target(target, scope)
        if not check.allowed:
            return check
    return ScopeCheck(allowed=True)


def _matches(target: str, pattern: str) -> bool:
    """Check if target matches a scope pattern (supports wildcards)."""
    if pattern.startswith("*."):
        # Wildcard subdomain: *.example.com matches sub.example.com
        suffix = pattern[1:]  # .example.com
        return target.endswith(suffix) or target == pattern[2:]
    return target == pattern


def _extract_targets(command: str) -> list[str]:
    """Extract potential targets from a shell command."""
    targets = []
    # Common flags that take a target
    for flag in ["-d ", "-u ", "-host ", "-target ", "--url ", "-l "]:
        idx = command.find(flag)
        if idx >= 0:
            rest = command[idx + len(flag):].strip()
            target = rest.split()[0] if rest else ""
            # Strip protocol prefix
            target = re.sub(r"^https?://", "", target).rstrip("/")
            if target:
                targets.append(target)
    # Also check for bare IPs
    ip_pattern = r'\b(?:\d{1,3}\.){3}\d{1,3}\b'
    targets.extend(re.findall(ip_pattern, command))
    return list(set(targets))
