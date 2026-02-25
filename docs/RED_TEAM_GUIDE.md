# Red Team Guide

This guide provides an overview of setting up a Red Team operation with Harbinger, covering VPS setup, Command and Control (C2) frameworks, and operational security (OPSEC) considerations.

## VPS Setup

Setting up a Virtual Private Server (VPS) is crucial for hosting your C2 infrastructure and other Red Team tools. Key considerations include:

-   **Provider Selection:** Choose a reputable VPS provider with good uptime, reliable network, and data center locations relevant to your operations.
-   **Operating System:** Typically, a Linux distribution (e.g., Ubuntu Server, Debian) is preferred for its flexibility and wide range of available tools.
-   **Security Hardening:** Implement basic security measures such as SSH key authentication, firewall rules, and regular updates.

## Sliver C2

Sliver is a cross-platform adversary emulation framework, ideal for Red Teams. It provides a sophisticated C2 server and implants for various operating systems.

-   **Installation:** Follow the official Sliver documentation for installation on your VPS.
-   **Listeners:** Configure listeners (e.g., HTTP, HTTPS, DNS) to establish communication with implants.
-   **Implants:** Generate custom implants with specific configurations for your target environment.

## Mythic

Mythic is another powerful C2 framework that offers a web-based interface for managing agents, tasks, and data. It supports a wide array of C2 profiles and extensible agent development.

-   **Deployment:** Mythic can be deployed via Docker, simplifying the setup process.
-   **Agents:** Utilize Mythic's diverse agent ecosystem (e.g., Apfell, Poseidon) or develop custom agents.
-   **Operations:** Manage multiple concurrent operations, track tasking, and collect intelligence.

## OPSEC (Operational Security)

Maintaining strong OPSEC is paramount for Red Team engagements to avoid detection and compromise. Key OPSEC principles include:

-   **Infrastructure Obfuscation:** Using domain fronting, CDN services, and legitimate-looking domains to hide C2 infrastructure.
-   **Traffic Encryption:** Ensuring all C2 communications are encrypted to prevent eavesdropping.
-   **Tooling Customization:** Modifying default tool signatures and payloads to evade EDR/AV detection.
-   **Attribution Avoidance:** Minimizing identifiable traces and using non-attributable infrastructure.
-   **Burner Infrastructure:** Rapidly deploying and tearing down infrastructure to limit exposure and forensic analysis.
