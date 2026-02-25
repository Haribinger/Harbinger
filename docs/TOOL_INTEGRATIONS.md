# Tool Integrations

Harbinger leverages a vast array of offensive security tools, seamlessly integrated through its Model Context Protocol (MCP)-first architecture. This document outlines key tool integrations, including recent updates from Parrot OS 7.1 and the introduction of MCPwn.

## Parrot OS 7.1 Integration

Parrot OS 7.1, released on February 11, 2026, brings a significant refresh to its toolkit, enhancing Harbinger's capabilities with the latest in penetration testing and security auditing. Key updates and integrated tools include:

- **Kernel Update**: Linux kernel 6.17.13, providing improved hardware support and performance for security operations.
- **Updated Pentesting Tools**: Numerous existing tools have been updated to their latest versions, ensuring Harbinger agents utilize the most current exploits and methodologies.
- **Enlightenment Spin**: A new, lightweight Enlightenment desktop environment option, potentially offering performance benefits for resource-intensive tasks.
- **Rocket Launcher for Docker**: Updates to Parrot's Docker-based security tool launcher, featuring a new UI and additional tools, which directly benefits Harbinger's containerized agent deployment.

Harbinger agents can directly access and utilize the comprehensive suite of tools available within the Parrot OS 7.1 environment, ensuring a robust and up-to-date offensive security toolkit.

## MCPwn: AI-Driven Cybersecurity Exploitation

Parrot OS 7.1 introduces **MCPwn**, a groundbreaking security testing tool specifically designed for AI-powered Model Context Protocol (MCP) servers. MCPwn integrates directly into Harbinger's MCP-first architecture, enabling agents to:

- **Detect Remote Code Execution (RCE)**: Identify and exploit RCE vulnerabilities within MCP servers.
- **Prompt Injection**: Test for and leverage prompt injection flaws in AI models interacting via MCP.
- **AI-Driven Exploitation**: MCPwn allows Harbinger agents to perform advanced, AI-aware attacks against other MCP-enabled systems, pushing the boundaries of autonomous offensive security.

This integration significantly enhances Harbinger's ability to assess and exploit vulnerabilities in modern, AI-driven systems.

## Integrated Tool Sources

Harbinger consolidates tools from various leading sources, providing a comprehensive and diverse arsenal for its agents:

### HexStrike (150+ Tools)

HexStrike is Harbinger's primary MCP tool server, offering a vast collection of pre-integrated security tools. These tools cover a wide spectrum of offensive security domains, including:

| Tool Category | Description | Example Tools | Agent Usage |
|:--------------|:------------|:--------------|:------------|
| **Reconnaissance** | Information gathering and discovery. | Nmap, Masscan, Amass, Sublist3r | PATHFINDER, SPECTER |
| **Vulnerability Scanning** | Automated identification of weaknesses. | Nessus, OpenVAS, Acunetix | BREACH, PHANTOM |
| **Web Exploitation** | Attacks targeting web applications. | SQLMap, DirBuster, Nikto, Burp Suite | BREACH |
| **Cloud Security** | Auditing and exploiting cloud environments. | Prowler, ScoutSuite, Pacu | PHANTOM |
| **Binary Analysis** | Reverse engineering and malware analysis. | IDA Pro, Ghidra, Radare2 | CIPHER |
| **OSINT** | Open-source intelligence gathering. | Maltego, theHarvester, Shodan | SPECTER |

### ProjectDiscovery Tools

Harbinger integrates popular tools from ProjectDiscovery, known for their efficiency and effectiveness in reconnaissance and vulnerability scanning:

| Tool Name | Description | Agent Usage | Installation |
|:----------|:------------|:------------|:-------------|
| **subfinder** | Fast passive subdomain enumeration. | PATHFINDER | `go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest` |
| **httpx** | Fast and multi-purpose HTTP toolkit. | PATHFINDER, BREACH | `go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest` |
| **naabu** | Fast port scanner. | PATHFINDER | `go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu@latest` |
| **nuclei** | Fast and customizable vulnerability scanner. | PATHFINDER, BREACH | `go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest` |
| **dnsx** | Fast and multi-purpose DNS toolkit. | PATHFINDER | `go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest` |
| **katana** | Next-generation crawling and spidering. | PATHFINDER, BREACH | `go install -v github.com/projectdiscovery/katana/cmd/katana@latest` |

### Parrot OS & Kali Tools

Beyond HexStrike and ProjectDiscovery, Harbinger benefits from the extensive toolsets provided by Parrot OS and Kali Linux. These include a wide range of utilities for every phase of penetration testing, from information gathering to post-exploitation.

| Tool Category | Description | Example Tools | Agent Usage |
|:--------------|:------------|:--------------|:------------|
| **Information Gathering** | Network mapping, service enumeration. | Nmap, Sparta, Recon-ng | PATHFINDER, SPECTER |
| **Vulnerability Analysis** | Web application scanners, exploit databases. | Nikto, WPScan, Searchsploit | BREACH |
| **Password Attacks** | Brute-forcing, dictionary attacks. | Hashcat, John the Ripper | BREACH, PHANTOM |
| **Wireless Attacks** | Wi-Fi network auditing. | Aircrack-ng, Kismet | (Specialized agents) |
| **Forensics** | Digital evidence collection and analysis. | Autopsy, Volatility | (Specialized agents) |

### Custom Scripts

Harbinger also incorporates custom-developed scripts for specialized tasks and automation, tailored to optimize agent workflows and integrate unique methodologies. These scripts are often used for:

- **Automated Reconnaissance Pipelines**: Chaining multiple tools for efficient target mapping.
- **Web Vulnerability Scanning**: Custom logic for specific web application testing scenarios.
- **Cloud Misconfiguration Audits**: Bespoke checks for unique cloud environments.
- **OSINT Data Correlation**: Advanced processing of open-source intelligence.
- **Report Generation**: Tailoring output to specific reporting standards or platforms.

## How to Install Integrated Tools

Most tools are either pre-installed within the Harbinger Docker containers or can be installed via standard package managers (`apt`, `go install`, `pip`) within the agent environments. For ProjectDiscovery tools, `go install` commands are provided above. For other tools, refer to their official documentation or the respective Parrot OS/Kali Linux package management guides.
