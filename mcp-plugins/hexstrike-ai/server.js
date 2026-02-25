const http = require("http");

const PORT = parseInt(process.env.HEXSTRIKE_PORT || "3001", 10);
const SERVICE_NAME = "hexstrike-ai";
const startedAt = new Date().toISOString();

// Tool inventory — mirrors the frontend mcpStore builtinTools that belong to HexStrike categories.
// Each entry uses the same schema shape the Harbinger frontend expects from /api/mcp/:id/tools.
const TOOLS = [
  // Network Scanning
  { id: "nmap_scan", name: "Nmap", category: "Network Scanning", description: "Port scan and service/OS fingerprinting" },
  { id: "masscan_scan", name: "Masscan", category: "Network Scanning", description: "High-speed internet-scale port scanner" },
  { id: "rustscan_scan", name: "RustScan", category: "Network Scanning", description: "Ultra-fast port scanner (Rust-based)" },
  { id: "nuclei_scan", name: "Nuclei", category: "Network Scanning", description: "Template-based vulnerability scanner" },
  { id: "httpx_probe", name: "Httpx", category: "Network Scanning", description: "HTTP probing — status, title, tech detection" },
  { id: "naabu_portscan", name: "Naabu", category: "Network Scanning", description: "Fast port scanner with Nmap integration" },
  { id: "nikto_scan", name: "Nikto", category: "Network Scanning", description: "Web server vulnerability scanner" },

  // Web Application
  { id: "gobuster_scan", name: "Gobuster", category: "Web Application", description: "Directory/file/DNS/vhost brute-forcer" },
  { id: "feroxbuster_scan", name: "Feroxbuster", category: "Web Application", description: "Recursive web content discovery" },
  { id: "ffuf_fuzz", name: "FFuf", category: "Web Application", description: "Fast web fuzzer for endpoints, headers, params" },
  { id: "sqlmap_scan", name: "SQLMap", category: "Web Application", description: "Automated SQL injection detection and exploitation" },
  { id: "dalfox_xss", name: "DalFox", category: "Web Application", description: "XSS scanner and parameter analyzer" },
  { id: "wpscan_scan", name: "WPScan", category: "Web Application", description: "WordPress vulnerability scanner" },
  { id: "zap_scan", name: "OWASP ZAP", category: "Web Application", description: "Active and passive web application scanning" },
  { id: "arjun_params", name: "Arjun", category: "Web Application", description: "HTTP parameter discovery tool" },
  { id: "xsser_scan", name: "XSSer", category: "Web Application", description: "XSS vulnerability framework" },
  { id: "jwt_analyzer", name: "JWT Analyzer", category: "Web Application", description: "Decode, verify, and attack JWT tokens" },

  // Subdomain & OSINT
  { id: "subfinder_enum", name: "Subfinder", category: "Subdomain & OSINT", description: "Passive subdomain enumeration" },
  { id: "amass_enum", name: "Amass", category: "Subdomain & OSINT", description: "In-depth DNS enumeration and network mapping" },
  { id: "dnsx_resolve", name: "Dnsx", category: "Subdomain & OSINT", description: "DNS resolution and brute-forcing" },
  { id: "waybackurls", name: "Waybackurls", category: "Subdomain & OSINT", description: "Fetch URLs from Wayback Machine" },
  { id: "gau_discover", name: "GAU", category: "Subdomain & OSINT", description: "Get all URLs from AlienVault, Wayback, URLScan" },
  { id: "hakrawler_crawl", name: "Hakrawler", category: "Subdomain & OSINT", description: "Web crawler for links, endpoints, and forms" },
  { id: "katana_crawl", name: "Katana", category: "Subdomain & OSINT", description: "Next-gen web crawling framework" },
  { id: "theHarvester", name: "theHarvester", category: "Subdomain & OSINT", description: "E-mail, subdomains and names harvest from public sources" },
  { id: "shodan_search", name: "Shodan", category: "Subdomain & OSINT", description: "Search internet-connected devices and services" },

  // Enumeration
  { id: "enum4linux_scan", name: "Enum4linux", category: "Enumeration", description: "SMB/LDAP enumeration (Windows/Samba)" },
  { id: "netexec_scan", name: "NetExec", category: "Enumeration", description: "Network service exploitation (CME successor)" },
  { id: "smbmap_scan", name: "SMBMap", category: "Enumeration", description: "SMB share enumeration and file access" },
  { id: "ldapdomaindump", name: "LDAP Domain Dump", category: "Enumeration", description: "Dump Active Directory info via LDAP" },
  { id: "bloodhound_collect", name: "BloodHound Collector", category: "Enumeration", description: "Collect AD data for BloodHound analysis" },

  // Cloud Security
  { id: "prowler_aws", name: "Prowler", category: "Cloud Security", description: "AWS security assessment and compliance checks" },
  { id: "trivy_scan", name: "Trivy", category: "Cloud Security", description: "Container and IaC vulnerability scanner" },
  { id: "checkov_iac", name: "Checkov", category: "Cloud Security", description: "IaC security scanner (Terraform, K8s, ARM, etc)" },
  { id: "docker_bench", name: "Docker Bench", category: "Cloud Security", description: "CIS Docker security benchmark checks" },
  { id: "kube_hunter", name: "Kube-Hunter", category: "Cloud Security", description: "Kubernetes cluster penetration testing" },
  { id: "scout_suite", name: "ScoutSuite", category: "Cloud Security", description: "Multi-cloud security auditing (AWS/GCP/Azure)" },

  // Credential Testing
  { id: "hydra_brute", name: "Hydra", category: "Credential Testing", description: "Parallelised login brute-forcer" },
  { id: "hashcat_crack", name: "Hashcat", category: "Credential Testing", description: "GPU-accelerated hash cracking" },
  { id: "john_crack", name: "John the Ripper", category: "Credential Testing", description: "Password cracker supporting many hash formats" },
  { id: "kerbrute_scan", name: "Kerbrute", category: "Credential Testing", description: "Kerberos pre-auth brute-forcing" },

  // Exploitation
  { id: "metasploit_run", name: "Metasploit", category: "Exploitation", description: "Run Metasploit Framework modules" },
  { id: "msfvenom_payload", name: "MSFVenom", category: "Exploitation", description: "Generate payloads for various platforms" },
  { id: "impacket_suite", name: "Impacket", category: "Exploitation", description: "Windows protocol attack suite (psexec, secretsdump, etc)" },

  // Binary Analysis
  { id: "binwalk_analyze", name: "Binwalk", category: "Binary Analysis", description: "Firmware analysis and extraction" },
  { id: "strings_extract", name: "Strings", category: "Binary Analysis", description: "Extract printable strings from binaries" },
  { id: "checksec_binary", name: "Checksec", category: "Binary Analysis", description: "Check binary security properties" },
  { id: "radare2_analyze", name: "Radare2", category: "Binary Analysis", description: "Reverse engineering framework" },
  { id: "ghidra_decompile", name: "Ghidra", category: "Binary Analysis", description: "NSA reverse engineering and decompilation" },
  { id: "gdb_debug", name: "GDB", category: "Binary Analysis", description: "GNU debugger with PEDA/Pwndbg" },

  // Forensics & CTF
  { id: "volatility_mem", name: "Volatility3", category: "Forensics & CTF", description: "Memory forensics analysis" },
  { id: "foremost_carve", name: "Foremost", category: "Forensics & CTF", description: "File carving from raw images/dumps" },
  { id: "steghide_steg", name: "Steghide", category: "Forensics & CTF", description: "Steganography detection and extraction" },
  { id: "exiftool_meta", name: "Exiftool", category: "Forensics & CTF", description: "Read and write file metadata" },
  { id: "wireshark_pcap", name: "Tshark", category: "Forensics & CTF", description: "CLI packet capture analysis" },
];

function json(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  // Health check
  if (url === "/health" || url === "/healthz") {
    return json(res, 200, {
      status: "ok",
      service: SERVICE_NAME,
      version: "1.0.0",
      uptime: process.uptime(),
      started_at: startedAt,
      tools_count: TOOLS.length,
    });
  }

  // Server info
  if (url === "/api/v1/info") {
    return json(res, 200, {
      name: "HexStrike AI",
      description: "MCP server providing 50+ integrated offensive security tools for the Harbinger agent swarm.",
      version: "1.0.0",
      tools_count: TOOLS.length,
      categories: [...new Set(TOOLS.map((t) => t.category))],
      status: "ready",
    });
  }

  // Tool inventory — returns the full list the frontend MCPManager needs
  if (url === "/api/v1/tools") {
    return json(res, 200, { tools: TOOLS });
  }

  // Single tool lookup
  if (url.startsWith("/api/v1/tools/")) {
    const toolId = url.replace("/api/v1/tools/", "");
    const tool = TOOLS.find((t) => t.id === toolId);
    if (tool) return json(res, 200, tool);
    return json(res, 404, { error: `tool '${toolId}' not found` });
  }

  // Category listing
  if (url === "/api/v1/categories") {
    const categories = {};
    TOOLS.forEach((t) => {
      if (!categories[t.category]) categories[t.category] = [];
      categories[t.category].push(t.id);
    });
    return json(res, 200, { categories });
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[${SERVICE_NAME}] MCP server listening on port ${PORT} — ${TOOLS.length} tools registered`);
});
