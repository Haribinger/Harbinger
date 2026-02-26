---
name: pentagi
description: Autonomous pentesting logic and vulnerability assessment brain.
---

# PentAGI - Autonomous Pentesting Brain

PentAGI provides the high-level logic for vulnerability hunting. It uses the available tools (HexStrike) to achieve security objectives.

## Capabilities

- **Attack Surface Mapping**: Finding subdomains, IPs, and services.
- **Vulnerability Prioritization**: Deciding which targets to hit first.
- **Payload Generation**: Crafting specific payloads for detected vulnerabilities.
- **Exploitation Orchestration**: Running complex multi-step attacks.

## Usage

The agent uses PentAGI to make intelligent decisions during a scan.

```bash
# Example: Consulting the PentAGI brain for the next step in a scan
node scripts/pentagi-think.js "I've found an open port 80 on example.com, what should I do next?"
```
