# Harbinger Offensive Security Framework: Open-Source Tool Inventory

This document provides a comprehensive inventory of high-quality free and open-source security tools for integration into the **Harbinger** framework. The inventory is categorized by functional area, with detailed information on each tool's capabilities, licensing, and integration priority.

---

## 1. ProjectDiscovery Full Suite
ProjectDiscovery provides production-grade, modular tools that are essential for modern reconnaissance and vulnerability detection.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Nuclei** | [projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei) | 27.1k | Template-based vulnerability scanner | MIT | Critical | Web/Cloud | Free |
| **Katana** | [projectdiscovery/katana](https://github.com/projectdiscovery/katana) | 15.6k | Next-generation crawling and spidering framework | MIT | Critical | Web | Free |
| **Subfinder** | [projectdiscovery/subfinder](https://github.com/projectdiscovery/subfinder) | 13.1k | Passive subdomain enumeration tool | MIT | Critical | Recon | Free |
| **httpx** | [projectdiscovery/httpx](https://github.com/projectdiscovery/httpx) | 9.6k | Multi-purpose HTTP toolkit for probing | MIT | Critical | Recon | Free |
| **Naabu** | [projectdiscovery/naabu](https://github.com/projectdiscovery/naabu) | 4.5k | Fast port scanner written in Go | MIT | High | Recon | Free |
| **dnsx** | [projectdiscovery/dnsx](https://github.com/projectdiscovery/dnsx) | 3.2k | Multi-purpose DNS toolkit | MIT | High | Recon | Free |
| **Interactsh** | [projectdiscovery/interactsh](https://github.com/projectdiscovery/interactsh) | 3.1k | OOB interaction gathering server/client | MIT | High | Web | Free |
| **Notify** | [projectdiscovery/notify](https://github.com/projectdiscovery/notify) | 2.1k | Stream tool output to various platforms | MIT | Medium | Report | Free |
| **Uncover** | [projectdiscovery/uncover](https://github.com/projectdiscovery/uncover) | 1.8k | Search exposed hosts via multiple search engine APIs | MIT | High | Recon | Free |
| **TLSX** | [projectdiscovery/tlsx](https://github.com/projectdiscovery/tlsx) | 1.2k | Fast and configurable TLS grabber | MIT | Medium | Recon | Free |
| **AlterX** | [projectdiscovery/alterx](https://github.com/projectdiscovery/alterx) | 1.1k | Fast and customizable subdomain wordlist generator | MIT | Medium | Recon | Free |
| **Cloudlist** | [projectdiscovery/cloudlist](https://github.com/projectdiscovery/cloudlist) | 1.1k | Enumerate assets from multiple cloud providers | MIT | High | Cloud | Free |
| **ASNmap** | [projectdiscovery/asnmap](https://github.com/projectdiscovery/asnmap) | 800+ | Map organization network ranges using ASN | MIT | Medium | Recon | Free |
| **MapCIDR** | [projectdiscovery/mapcidr](https://github.com/projectdiscovery/mapcidr) | 600+ | Utility for performing operations on subnets/CIDR | MIT | Medium | Recon | Free |
| **PDTM** | [projectdiscovery/pdtm](https://github.com/projectdiscovery/pdtm) | 500+ | ProjectDiscovery Tool Manager | MIT | Low | System | Free |
| **Proxify** | [projectdiscovery/proxify](https://github.com/projectdiscovery/proxify) | 1.5k | Swiss Army Knife Proxy for HTTP/HTTPS traffic | MIT | Medium | Web | Free |
| **SimpleHTTPServer** | [projectdiscovery/simplehttpserver](https://github.com/projectdiscovery/simplehttpserver) | 300+ | Go-based enhanced simple HTTP server | MIT | Low | System | Free |
| **Chaos** | [projectdiscovery/chaos-client](https://github.com/projectdiscovery/chaos-client) | 600+ | Client for Chaos dataset (internet-wide asset data) | MIT | Medium | Recon | Free |

---

## 2. Shodan & External Intelligence Tools
Tools for leveraging Shodan, Censys, and other internet-wide scanners for asset discovery and vulnerability research.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ShodanX** | [RevoltSecurities/ShodanX](https://github.com/RevoltSecurities/ShodanX) | 488 | Gather information using Shodan dorks and facets | MIT | High | Recon | Free API* |
| **Shef** | [1hehaq/shef](https://github.com/1hehaq/shef) | 100+ | Extract/scrape IPs from Shodan without API key | MIT | High | Recon | Free |
| **Shodan-Facets** | [rcbonz/ShodanWizard](https://github.com/rcbonz/ShodanWizard) | 50+ | Tool to explore Shodan facets for fine-tuning searches | MIT | Medium | Recon | Free API* |
| **Censys-CLI** | [censys/censys-python](https://github.com/censys/censys-python) | 500+ | Official CLI for Censys Search API | Apache-2.0 | High | Recon | Free API* |
| **ZoomEye-Python** | [zoomeye/zoomeye-python](https://github.com/zoomeye/zoomeye-python) | 400+ | Official SDK and CLI for ZoomEye API | MIT | High | Recon | Free API* |
| **FOFA-CLI** | [fofapro/fofa-py](https://github.com/fofapro/fofa-py) | 300+ | Official Python SDK and CLI for FOFA | MIT | High | Recon | Free API* |
| **Uncover-MCP** | [Co5mos/uncover-mcp](https://github.com/Co5mos/uncover-mcp) | 50+ | MCP server for FOFA/Shodan/Quake/Hunter | MIT | Critical | Recon | Free API* |

*\*Requires free-tier API keys for full functionality.*

---

## 3. HexStrike AI Integrated Tools
HexStrike AI integrates over 150+ tools via MCP. Below are the core tools identified from their repository that are essential for Harbinger's pipeline.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AutoRecon** | [Tib3rius/AutoRecon](https://github.com/Tib3rius/AutoRecon) | 5.8k | Multi-threaded network reconnaissance tool | GPL-3.0 | High | Recon | Free |
| **NetExec** | [PennyWise-Team/NetExec](https://github.com/PennyWise-Team/NetExec) | 2.1k | Network service exploitation framework (formerly CrackMapExec) | BSD-2-Clause | Critical | Web/Network | Free |
| **Responder** | [lgandx/Responder](https://github.com/lgandx/Responder) | 11.2k | LLMNR, NBT-NS and MDNS poisoner | GPL-3.0 | High | Network | Free |
| **Enum4linux-ng** | [cddmp/enum4linux-ng](https://github.com/cddmp/enum4linux-ng) | 1.1k | Next-generation SMB enumeration tool | MIT | High | Network | Free |
| **Wafw00f** | [EnableSecurity/wafw00f](https://github.com/EnableSecurity/wafw00f) | 5.5k | Web Application Firewall fingerprinting tool | BSD-3-Clause | Medium | Web | Free |
| **Nikto** | [sullo/nikto](https://github.com/sullo/nikto) | 6.5k | Web server vulnerability scanner | GPL-2.0 | Medium | Web | Free |
| **WhatWeb** | [urbanadventurer/WhatWeb](https://github.com/urbanadventurer/WhatWeb) | 4.8k | Next-generation web scanner for technology identification | GPL-2.0 | Medium | Web | Free |
| **TestSSL.sh** | [drwetter/testssl.sh](https://github.com/drwetter/testssl.sh) | 11.5k | Command line tool to check SSL/TLS configurations | GPL-2.0 | High | Recon | Free |

---

## 4. Reconnaissance Tools (Free/Open-Source)
Comprehensive reconnaissance tools for asset discovery, endpoint mining, and information gathering.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Amass** | [owasp-amass/amass](https://github.com/owasp-amass/amass) | 11.2k | In-depth attack surface mapping and asset discovery | Apache-2.0 | Critical | Recon | Free |
| **theHarvester** | [laramies/theHarvester](https://github.com/laramies/theHarvester) | 9.8k | E-mails, subdomains and names harvester | MIT | High | Recon | Free |
| **Recon-ng** | [lanmaster53/recon-ng](https://github.com/lanmaster53/recon-ng) | 9.1k | Full-featured Web Reconnaissance Framework | GPL-3.0 | High | Recon | Free |
| **SpiderFoot** | [smicallef/spiderfoot](https://github.com/smicallef/spiderfoot) | 10.5k | OSINT automation tool for footprinting | MIT | High | OSINT | Free |
| **Photon** | [s0md3v/Photon](https://github.com/s0md3v/Photon) | 10.2k | Incredibly fast crawler designed for OSINT | GPL-3.0 | Medium | OSINT | Free |
| **Arjun** | [s0md3v/Arjun](https://github.com/s0md3v/Arjun) | 4.5k | HTTP parameter discovery suite | GPL-3.0 | High | Web | Free |
| **ParamSpider** | [devanshbatham/ParamSpider](https://github.com/devanshbatham/ParamSpider) | 3.2k | Mining parameters from web archives | MIT | High | Web | Free |
| **Waybackurls** | [tomnomnom/waybackurls](https://github.com/tomnomnom/waybackurls) | 4.5k | Fetch all URLs that the Wayback Machine knows about | MIT | High | Recon | Free |
| **gau** | [lc/gau](https://github.com/lc/gau) | 4.8k | Get all URLs from various sources (Wayback, AlienVault, etc.) | MIT | High | Recon | Free |
| **Hakrawler** | [hakluke/hakrawler](https://github.com/hakluke/hakrawler) | 3.5k | Simple, fast web crawler for endpoint discovery | MIT | High | Recon | Free |
| **GoSpider** | [jaeles-project/gospider](https://github.com/jaeles-project/gospider) | 3.2k | Fast web spider written in Go | MIT | High | Recon | Free |
| **Feroxbuster** | [epi052/feroxbuster](https://github.com/epi052/feroxbuster) | 4.5k | Simple, fast, recursive content discovery tool | MIT | High | Web | Free |
| **ffuf** | [ffuf/ffuf](https://github.com/ffuf/ffuf) | 11.5k | Fast web fuzzer written in Go | MIT | Critical | Web | Free |
| **Dirsearch** | [maurosoria/dirsearch](https://github.com/maurosoria/dirsearch) | 12.5k | Web path scanner | GPL-2.0 | High | Web | Free |
| **Gobuster** | [OJ/gobuster](https://github.com/OJ/gobuster) | 9.5k | Tool used to discover URIs and DNS subdomains | Apache-2.0 | High | Web | Free |

---

## 5. Web Vulnerability Tools
Specialized tools for identifying and exploiting common web vulnerabilities like SQLi, XSS, and SSRF.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SQLMap** | [sqlmapproject/sqlmap](https://github.com/sqlmapproject/sqlmap) | 31.2k | Automatic SQL injection and database takeover tool | GPL-2.0 | Critical | Web | Free |
| **XSStrike** | [s0md3v/XSStrike](https://github.com/s0md3v/XSStrike) | 12.5k | Advanced XSS detection and exploitation suite | GPL-3.0 | High | Web | Free |
| **Dalfox** | [hahwul/dalfox](https://github.com/hahwul/dalfox) | 4.5k | Parameter analysis and XSS scanning tool | MIT | High | Web | Free |
| **NoSQLMap** | [codingo/NoSQLMap](https://github.com/codingo/NoSQLMap) | 3.8k | Automated NoSQL database auditing and exploitation | MIT | Medium | Web | Free |
| **SSRFmap** | [swisskyrepo/SSRFmap](https://github.com/swisskyrepo/SSRFmap) | 2.5k | Automatic SSRF detection and exploitation tool | MIT | Medium | Web | Free |
| **CORStest** | [chenjj/CORStest](https://github.com/chenjj/CORStest) | 1.2k | Python tool to test for CORS misconfigurations | MIT | Medium | Web | Free |
| **jwt_tool** | [ticarpi/jwt_tool](https://github.com/ticarpi/jwt_tool) | 2.8k | Toolkit for testing, tweaking and cracking JSON Web Tokens | GPL-3.0 | Medium | Web | Free |
| **Commix** | [commixproject/commix](https://github.com/commixproject/commix) | 4.2k | Automated OS command injection and exploitation tool | GPL-2.0 | High | Web | Free |
| **tplmap** | [epinna/tplmap](https://github.com/epinna/tplmap) | 3.5k | Server-Side Template Injection and Code Injection tool | MIT | High | Web | Free |

---

## 6. Cloud & Infrastructure Tools
Tools for auditing and exploiting cloud environments (AWS, Azure, GCP) and container infrastructure.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ScoutSuite** | [nccgroup/ScoutSuite](https://github.com/nccgroup/ScoutSuite) | 5.8k | Multi-cloud security auditing tool | GPL-3.0 | High | Cloud | Free |
| **Prowler** | [prowler-cloud/prowler](https://github.com/prowler-cloud/prowler) | 11.5k | Cloud security platform for AWS, Azure, and GCP | Apache-2.0 | Critical | Cloud | Free |
| **CloudSploit** | [aquasecurity/cloudsploit](https://github.com/aquasecurity/cloudsploit) | 3.2k | Cloud security posture management (CSPM) tool | MIT | High | Cloud | Free |
| **Pacu** | [RhinoSecurityLabs/pacu](https://github.com/RhinoSecurityLabs/pacu) | 4.5k | AWS exploitation framework | BSD-3-Clause | High | Cloud | Free |
| **Enumerate-IAM** | [andresriancho/enumerate-iam](https://github.com/andresriancho/enumerate-iam) | 1.2k | Enumerate permissions associated with AWS IAM credentials | GPL-3.0 | Medium | Cloud | Free |
| **S3Scanner** | [sa7mon/S3Scanner](https://github.com/sa7mon/S3Scanner) | 2.8k | Scan for open S3 buckets and dump their contents | MIT | High | Cloud | Free |
| **CloudBrute** | [0xsha/CloudBrute](https://github.com/0xsha/CloudBrute) | 1.5k | Find a company's infrastructure, files, and apps on top cloud providers | MIT | Medium | Cloud | Free |
| **cf-check** | [dwisiswant0/cf-check](https://github.com/dwisiswant0/cf-check) | 500+ | Check if an IP address belongs to Cloudflare | MIT | Medium | Recon | Free |

---

## 7. OSINT Tools
Tools for gathering intelligence from public sources, social media, and data leaks.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Sherlock** | [sherlock-project/sherlock](https://github.com/sherlock-project/sherlock) | 65.2k | Hunt down social media accounts by username | MIT | Critical | OSINT | Free |
| **Maigret** | [soxoj/maigret](https://github.com/soxoj/maigret) | 12.5k | Collect a dossier on a person by username only | MIT | High | OSINT | Free |
| **holehe** | [megadose/holehe](https://github.com/megadose/holehe) | 6.2k | Check if an email is used on 120+ websites | MIT | High | OSINT | Free |
| **GHunt** | [mxrch/GHunt](https://github.com/mxrch/GHunt) | 18.5k | OSINT tool to extract info from any Google Account | OSINT | High | OSINT | Free |
| **Social-Analyzer** | [qeeqbox/social-analyzer](https://github.com/qeeqbox/social-analyzer) | 11.2k | API, CLI & Web App for analyzing profiles across 1000+ websites | GPL-3.0 | Medium | OSINT | Free |
| **Email-Finder** | [m8sec/email-finder](https://github.com/m8sec/email-finder) | 1.2k | Search for email addresses from various sources | MIT | Medium | OSINT | Free |

---

## 8. Binary & Reverse Engineering Tools
Tools for analyzing compiled binaries, debugging, and exploit development.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ghidra** | [NationalSecurityAgency/ghidra](https://github.com/NationalSecurityAgency/ghidra) | 52.5k | NSA's software reverse engineering (SRE) framework | Apache-2.0 | Critical | Binary | Free |
| **radare2** | [radareorg/radare2](https://github.com/radareorg/radare2) | 21.2k | UNIX-like reverse engineering framework and command-line tool | LGPL-3.0 | High | Binary | Free |
| **Cutter** | [rizinorg/cutter](https://github.com/rizinorg/cutter) | 10.5k | Free and Open Source RE Platform powered by rizin | GPL-3.0 | High | Binary | Free |
| **Binary Ninja (Community)** | [Vector35/binaryninja-api](https://github.com/Vector35/binaryninja-api) | 2.5k | API for Binary Ninja (Community version is free) | Proprietary | Medium | Binary | Free |
| **pwntools** | [Gallopsled/pwntools](https://github.com/Gallopsled/pwntools) | 12.5k | CTF framework and exploit development library | MIT | Critical | Binary | Free |
| **ROPgadget** | [JonathanSalwan/ROPgadget](https://github.com/JonathanSalwan/ROPgadget) | 4.5k | Search for gadgets on a binary to facilitate ROP exploitation | MIT | High | Binary | Free |

---

## 9. Network Tools
Core networking tools for scanning, traffic analysis, and protocol exploitation.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Nmap** | [nmap/nmap](https://github.com/nmap/nmap) | 15.2k | Network mapper and security scanner | GPL-2.0 | Critical | Recon | Free |
| **Masscan** | [robertdavidgraham/masscan](https://github.com/robertdavidgraham/masscan) | 25.5k | TCP port scanner, spews packets at 10 million per second | AGPL-3.0 | High | Recon | Free |
| **Zmap** | [zmap/zmap](https://github.com/zmap/zmap) | 8.5k | Fast single-packet network scanner | Apache-2.0 | Medium | Recon | Free |
| **Rustscan** | [RustScan/RustScan](https://github.com/RustScan/RustScan) | 12.5k | Modern port scanner that is ultra-fast | MIT | High | Recon | Free |
| **Netcat (ncat)** | [nmap/nmap](https://github.com/nmap/nmap) | N/A | Networking utility which reads and writes data across network connections | GPL-2.0 | High | Network | Free |
| **Wireshark (tshark)** | [wireshark/wireshark](https://github.com/wireshark/wireshark) | 10.2k | Network protocol analyzer (CLI version) | GPL-2.0 | High | Network | Free |

---

## 10. Reporting & Documentation Tools
Tools for generating professional security reports and managing findings.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ghostwriter** | [Ghostwriter/Ghostwriter](https://github.com/Ghostwriter/Ghostwriter) | 2.5k | Collaborative reporting and project management platform | MIT | High | Report | Free |
| **Pwndoc** | [pwndoc/pwndoc](https://github.com/pwndoc/pwndoc) | 3.2k | Pentest reporting tool with custom templates | MIT | High | Report | Free |
| **SysReptor** | [SysReptor/SysReptor](https://github.com/SysReptor/SysReptor) | 1.8k | Fully customizable offensive security reporting | AGPL-3.0 | High | Report | Free |
| **Dradis CE** | [dradis/dradis-ce](https://github.com/dradis/dradis-ce) | 1.5k | Framework for information sharing and reporting | GPL-2.0 | Medium | Report | Free |

---

## 11. MCP-Specific Security Tools
Tools specifically designed to work with the Model Context Protocol (MCP) for AI-driven security operations.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **MCP-SecurityTools** | [Ta0ing/MCP-SecurityTools](https://github.com/Ta0ing/MCP-SecurityTools) | 387 | Collection of MCP servers for security tools | MIT | Critical | System | Free |
| **Uncover-MCP** | [Co5mos/uncover-mcp](https://github.com/Co5mos/uncover-mcp) | 50+ | MCP server for FOFA/Shodan/Quake/Hunter | MIT | Critical | Recon | Free |
| **ENScan_GO-MCP** | [wgpsec/ENScan_GO](https://github.com/wgpsec/ENScan_GO) | 1.2k | MCP-enabled enterprise information collection tool | MIT | High | Recon | Free |
| **VirusTotal-MCP** | [BurtTheCoder/mcp-virustotal](https://github.com/BurtTheCoder/mcp-virustotal) | 50+ | MCP server for VirusTotal security analysis | MIT | High | OSINT | Free |
| **CloudSword-MCP** | [wgpsec/cloudsword](https://github.com/wgpsec/cloudsword) | 300+ | MCP-enabled cloud security auditing tool | MIT | High | Cloud | Free |
| **ZoomEye-MCP** | [zoomeye-ai/mcp_zoomeye](https://github.com/zoomeye-ai/mcp_zoomeye) | 50+ | Official ZoomEye MCP server for asset querying | MIT | High | Recon | Free |
| **AWVS-MCP** | [Ta0ing/awvs-mcp](https://github.com/Ta0ing/MCP-SecurityTools/tree/main/awvs-mcp) | N/A | MCP server for Acunetix Web Vulnerability Scanner | MIT | Medium | Web | Free |

---

## 12. Bug Bounty Automation Frameworks
Comprehensive frameworks that orchestrate multiple tools for automated reconnaissance and scanning.

| Tool Name | GitHub URL | Stars | Description | License | Priority | Agent | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ReconFTW** | [six2dez/reconftw](https://github.com/six2dez/reconftw) | 18.5k | Automated reconnaissance framework for bug bounty | MIT | Critical | Recon | Free |
| **AutoRecon** | [Tib3rius/AutoRecon](https://github.com/Tib3rius/AutoRecon) | 5.8k | Multi-threaded network reconnaissance tool | GPL-3.0 | High | Recon | Free |
| **Osmedeus** | [j3ssie/osmedeus](https://github.com/j3ssie/osmedeus) | 5.2k | Fully automated offensive security framework | MIT | High | Recon | Free |
| **LazyRecon** | [nahamsec/lazyrecon](https://github.com/nahamsec/lazyrecon) | 2.5k | Bash script for automated reconnaissance | MIT | Medium | Recon | Free |
| **BugBountyScanner** | [channyein1337/bugbounty-scanner](https://github.com/channyein1337/bugbounty-scanner) | 1.2k | Automated vulnerability scanner for bug bounty | MIT | Medium | Web | Free |

---

## Top 50 Must-Have Tools for Harbinger
Ranked by integration priority and overall impact on the offensive security pipeline.

| Rank | Tool Name | Category | Priority | Harbinger Agent |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Nuclei** | Vulnerability Scanning | Critical | Web/Cloud |
| 2 | **Subfinder** | Reconnaissance | Critical | Recon |
| 3 | **httpx** | Reconnaissance | Critical | Recon |
| 4 | **Katana** | Web Crawling | Critical | Web |
| 5 | **Amass** | Reconnaissance | Critical | Recon |
| 6 | **SQLMap** | Web Vulnerability | Critical | Web |
| 7 | **ffuf** | Web Fuzzing | Critical | Web |
| 8 | **Sherlock** | OSINT | Critical | OSINT |
| 9 | **Ghidra** | Binary Analysis | Critical | Binary |
| 10 | **Nmap** | Network Scanning | Critical | Recon |
| 11 | **ReconFTW** | Automation | Critical | Recon |
| 12 | **NetExec** | Network Exploitation | Critical | Web/Network |
| 13 | **Uncover-MCP** | MCP / Intelligence | Critical | Recon |
| 14 | **Prowler** | Cloud Security | Critical | Cloud |
| 15 | **pwntools** | Binary Analysis | Critical | Binary |
| 16 | **Masscan** | Network Scanning | High | Recon |
| 17 | **Naabu** | Network Scanning | High | Recon |
| 18 | **dnsx** | Reconnaissance | High | Recon |
| 19 | **Interactsh** | Web Vulnerability | High | Web |
| 20 | **theHarvester** | Reconnaissance | High | Recon |
| 21 | **Recon-ng** | Reconnaissance | High | Recon |
| 22 | **SpiderFoot** | OSINT | High | OSINT |
| 23 | **XSStrike** | Web Vulnerability | High | Web |
| 24 | **Dalfox** | Web Vulnerability | High | Web |
| 25 | **ScoutSuite** | Cloud Security | High | Cloud |
| 26 | **Pacu** | Cloud Security | High | Cloud |
| 27 | **Maigret** | OSINT | High | OSINT |
| 28 | **holehe** | OSINT | High | OSINT |
| 29 | **GHunt** | OSINT | High | OSINT |
| 30 | **radare2** | Binary Analysis | High | Binary |
| 31 | **Cutter** | Binary Analysis | High | Binary |
| 32 | **Rustscan** | Network Scanning | High | Recon |
| 33 | **Ghostwriter** | Reporting | High | Report |
| 34 | **Pwndoc** | Reporting | High | Report |
| 35 | **SysReptor** | Reporting | High | Report |
| 36 | **AutoRecon** | Automation | High | Recon |
| 37 | **Osmedeus** | Automation | High | Recon |
| 38 | **Arjun** | Web Vulnerability | High | Web |
| 39 | **ParamSpider** | Web Vulnerability | High | Web |
| 40 | **Waybackurls** | Reconnaissance | High | Recon |
| 41 | **gau** | Reconnaissance | High | Recon |
| 42 | **Hakrawler** | Reconnaissance | High | Recon |
| 43 | **GoSpider** | Reconnaissance | High | Recon |
| 44 | **Feroxbuster** | Web Vulnerability | High | Web |
| 45 | **Dirsearch** | Web Vulnerability | High | Web |
| 46 | **Gobuster** | Web Vulnerability | High | Web |
| 47 | **Cloudlist** | Cloud Security | High | Cloud |
| 48 | **S3Scanner** | Cloud Security | High | Cloud |
| 49 | **Responder** | Network Exploitation | High | Network |
| 50 | **tplmap** | Web Vulnerability | High | Web |

---
**Note**: This inventory is a living document and should be updated as new tools emerge and existing ones evolve. All tools listed are free or open-source, providing a powerful foundation for the Harbinger framework.
