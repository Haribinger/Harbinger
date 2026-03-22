"""Autonomy levels — control how much approval agents need."""
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Tools requiring approval at different autonomy levels
HIGH_RISK_TOOLS = {"terminal", "browser"}  # Can interact with external systems
EXPLOIT_PATTERNS = {"sqlmap", "dalfox", "exploit", "reverse_shell", "msfconsole", "meterpreter"}


@dataclass
class AutonomyDecision:
    allowed: bool
    needs_approval: bool = False
    reason: str = ""


def check_autonomy(tool_name: str, tool_args: dict,
                    autonomy_level: str = "supervised") -> AutonomyDecision:
    """Check if a tool call is allowed under the current autonomy level."""

    if autonomy_level == "full_auto":
        return AutonomyDecision(allowed=True)

    if autonomy_level == "autonomous":
        # Only need approval for exploit-like commands
        if tool_name == "terminal":
            cmd = tool_args.get("command", "").lower()
            if any(p in cmd for p in EXPLOIT_PATTERNS):
                return AutonomyDecision(
                    allowed=True, needs_approval=True,
                    reason=f"Exploit command detected in autonomous mode"
                )
        return AutonomyDecision(allowed=True)

    if autonomy_level == "supervised":
        # Approve recon tools automatically, require approval for active tools
        if tool_name == "terminal":
            cmd = tool_args.get("command", "").lower()
            # Passive recon tools are auto-approved
            passive = ["subfinder", "httpx", "katana", "naabu", "whois", "dig",
                       "curl", "cat", "ls", "echo", "grep", "wc", "head", "tail"]
            if any(cmd.startswith(p) for p in passive):
                return AutonomyDecision(allowed=True)
            # Active scanning auto-approved
            if any(cmd.startswith(p) for p in ["nuclei", "ffuf", "gobuster"]):
                return AutonomyDecision(allowed=True)
            # Everything else needs approval
            return AutonomyDecision(
                allowed=True, needs_approval=True,
                reason=f"Supervised mode: approval needed for '{cmd[:50]}'"
            )
        if tool_name in ("file", "done", "ask"):
            return AutonomyDecision(allowed=True)
        return AutonomyDecision(allowed=True)

    if autonomy_level == "manual":
        # Everything needs approval except done/ask
        if tool_name in ("done", "ask"):
            return AutonomyDecision(allowed=True)
        return AutonomyDecision(
            allowed=True, needs_approval=True,
            reason="Manual mode: all actions require approval"
        )

    return AutonomyDecision(allowed=True)
