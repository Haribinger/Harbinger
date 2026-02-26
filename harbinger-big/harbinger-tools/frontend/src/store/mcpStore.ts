import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MCP, Tool } from '../types'

interface MCPState {
  mcps: MCP[]
  builtinTools: Tool[]
  selectedMCP: MCP | null
  isLoading: boolean
  error: string | null

  // Actions
  setMCPs: (mcps: MCP[]) => void
  addMCP: (mcp: Omit<MCP, 'id' | 'status' | 'tools' | 'resources' | 'prompts'>) => void
  updateMCP: (id: string, updates: Partial<MCP>) => void
  removeMCP: (id: string) => void
  setSelectedMCP: (mcp: MCP | null) => void
  connectMCP: (id: string) => void
  disconnectMCP: (id: string) => void

  setBuiltinTools: (tools: Tool[]) => void
  addBuiltinTool: (tool: Tool) => void
  removeBuiltinTool: (id: string) => void
  toggleTool: (id: string) => void

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

const t = (
  id: string,
  name: string,
  description: string,
  category: string,
  props: Record<string, { type: string; description: string; enum?: string[] }>,
  required: string[] = []
): Tool => ({
  id,
  name,
  description,
  type: 'builtin',
  category,
  schema: { type: 'object', properties: props, required },
  enabled: true,
})

export const useMCPStore = create<MCPState>()(
  persist(
    (set) => ({
      mcps: [
        // Pre-configured Harbinger MCP servers (URLs use nginx/Vite proxy paths)
        {
          id: 'hexstrike',
          name: 'HexStrike AI',
          description: '150+ offensive security tools — scanning, exploitation, fuzzing, binary analysis',
          url: '/mcp/hexstrike',
          status: 'disconnected' as const,
          tools: [],
          resources: [],
          prompts: [],
          config: { dockerService: 'harbinger-hexstrike' },
        },
        {
          id: 'redteam',
          name: 'Red Team Ops',
          description: 'C2 management, SOCKS proxy chains, playbooks, Neo4j AD analysis, LSASS/NTDS parsers',
          url: '/api/redteam',
          status: 'disconnected' as const,
          tools: [],
          resources: [],
          prompts: [],
          config: { dockerService: 'harbinger-redteam' },
        },
        {
          id: 'pentagi',
          name: 'PentAGI Agent',
          description: 'Autonomous penetration testing agent with multi-step planning and execution',
          url: '/mcp/pentagi',
          status: 'disconnected' as const,
          tools: [],
          resources: [],
          prompts: [],
          config: { dockerService: 'harbinger-pentagi' },
        },
        {
          id: 'mcp-ui',
          name: 'MCP Visualizer',
          description: 'Real-time visualization of active tools, scan results, and agent workflows',
          url: '/mcp/ui',
          status: 'disconnected' as const,
          tools: [],
          resources: [],
          prompts: [],
          config: { dockerService: 'harbinger-mcp-ui' },
        },
      ],

      builtinTools: [
        // ── File System ──────────────────────────────────────────────────────
        t('read', 'Read', 'Read files from the workspace', 'File System',
          { path: { type: 'string', description: 'File path to read' } }, ['path']),
        t('write', 'Write', 'Create or overwrite files', 'File System',
          {
            path: { type: 'string', description: 'File path to write' },
            content: { type: 'string', description: 'Content to write' },
          }, ['path', 'content']),
        t('edit', 'Edit', 'Make precise edits to files', 'File System',
          {
            path: { type: 'string', description: 'File path to edit' },
            old_string: { type: 'string', description: 'Text to replace' },
            new_string: { type: 'string', description: 'Replacement text' },
          }, ['path', 'old_string', 'new_string']),

        // ── Shell ────────────────────────────────────────────────────────────
        t('bash', 'Bash', 'Execute shell commands', 'Shell',
          {
            command: { type: 'string', description: 'Command to execute' },
            working_dir: { type: 'string', description: 'Working directory' },
          }, ['command']),

        // ── Search ───────────────────────────────────────────────────────────
        t('glob', 'Glob', 'Find files by glob pattern', 'Search',
          {
            pattern: { type: 'string', description: 'Glob pattern' },
            path: { type: 'string', description: 'Base directory' },
          }, ['pattern']),
        t('grep', 'Grep', 'Search file contents with regex', 'Search',
          {
            pattern: { type: 'string', description: 'Search pattern' },
            path: { type: 'string', description: 'Directory to search' },
          }, ['pattern', 'path']),

        // ── Web ──────────────────────────────────────────────────────────────
        t('web_search', 'Web Search', 'Search the web for information', 'Web',
          { query: { type: 'string', description: 'Search query' } }, ['query']),
        t('web_fetch', 'Web Fetch', 'Fetch and analyze web pages', 'Web',
          { url: { type: 'string', description: 'URL to fetch' } }, ['url']),

        // ── Agents ───────────────────────────────────────────────────────────
        t('task', 'Task', 'Spawn sub-agents for parallel tasks', 'Agents',
          {
            description: { type: 'string', description: 'Task description' },
            tools: { type: 'array', description: 'Allowed tools' } as never,
          }, ['description']),

        // ── Infrastructure ───────────────────────────────────────────────────
        t('docker', 'Docker', 'Manage Docker containers and images', 'Infrastructure',
          {
            action: { type: 'string', description: 'Action to perform', enum: ['run', 'stop', 'exec', 'logs', 'pull', 'build'] },
            image: { type: 'string', description: 'Docker image' },
            command: { type: 'string', description: 'Command to run' },
          }, ['action']),
        t('browser', 'Browser', 'Control Playwright browser instances', 'Infrastructure',
          {
            action: { type: 'string', description: 'Action', enum: ['navigate', 'click', 'type', 'screenshot', 'scroll', 'evaluate'] },
            url: { type: 'string', description: 'URL to navigate to' },
            selector: { type: 'string', description: 'Element selector' },
            text: { type: 'string', description: 'Text to type' },
          }, ['action']),

        // ── Network Scanning ─────────────────────────────────────────────────
        t('nmap_scan', 'Nmap', 'Port scan and service/OS fingerprinting', 'Network Scanning',
          {
            target: { type: 'string', description: 'Target IP / hostname / CIDR' },
            flags: { type: 'string', description: 'Nmap flags (e.g. -sV -sC -p-)' },
            output_format: { type: 'string', description: 'Output format', enum: ['normal', 'xml', 'grepable'] },
          }, ['target']),
        t('masscan_scan', 'Masscan', 'High-speed internet-scale port scanner', 'Network Scanning',
          {
            target: { type: 'string', description: 'Target IP range or CIDR' },
            ports: { type: 'string', description: 'Port range (e.g. 1-65535 or 80,443)' },
            rate: { type: 'string', description: 'Packets per second (e.g. 10000)' },
          }, ['target', 'ports']),
        t('rustscan_scan', 'RustScan', 'Ultra-fast port scanner (Rust-based)', 'Network Scanning',
          {
            target: { type: 'string', description: 'Target IP or hostname' },
            ports: { type: 'string', description: 'Port range or list' },
            timeout: { type: 'string', description: 'Timeout in ms' },
          }, ['target']),
        t('nuclei_scan', 'Nuclei', 'Template-based vulnerability scanner', 'Network Scanning',
          {
            target: { type: 'string', description: 'Target URL or IP' },
            templates: { type: 'string', description: 'Template path or tag (e.g. cves, exposures)' },
            severity: { type: 'string', description: 'Filter severity', enum: ['info', 'low', 'medium', 'high', 'critical'] },
          }, ['target']),
        t('httpx_probe', 'Httpx', 'HTTP probing — status, title, tech detection', 'Network Scanning',
          {
            targets: { type: 'string', description: 'List of hosts/URLs (newline separated)' },
            flags: { type: 'string', description: 'Httpx flags (e.g. -title -tech-detect -status-code)' },
          }, ['targets']),
        t('naabu_portscan', 'Naabu', 'Fast port scanner with Nmap integration', 'Network Scanning',
          {
            target: { type: 'string', description: 'Target host or CIDR' },
            ports: { type: 'string', description: 'Ports to scan' },
            rate: { type: 'string', description: 'Rate limit' },
          }, ['target']),
        t('nikto_scan', 'Nikto', 'Web server vulnerability scanner', 'Network Scanning',
          {
            target: { type: 'string', description: 'Target URL' },
            flags: { type: 'string', description: 'Nikto options' },
          }, ['target']),

        // ── Web Application ──────────────────────────────────────────────────
        t('gobuster_scan', 'Gobuster', 'Directory/file/DNS/vhost brute-forcer', 'Web Application',
          {
            target: { type: 'string', description: 'Target URL' },
            mode: { type: 'string', description: 'Mode', enum: ['dir', 'dns', 'vhost', 's3'] },
            wordlist: { type: 'string', description: 'Path to wordlist' },
            extensions: { type: 'string', description: 'File extensions (e.g. php,html,js)' },
          }, ['target', 'mode']),
        t('feroxbuster_scan', 'Feroxbuster', 'Recursive web content discovery', 'Web Application',
          {
            target: { type: 'string', description: 'Target URL' },
            wordlist: { type: 'string', description: 'Wordlist path' },
            depth: { type: 'string', description: 'Recursion depth' },
            extensions: { type: 'string', description: 'Extensions to try' },
          }, ['target']),
        t('ffuf_fuzz', 'FFuf', 'Fast web fuzzer for endpoints, headers, params', 'Web Application',
          {
            url: { type: 'string', description: 'URL with FUZZ placeholder' },
            wordlist: { type: 'string', description: 'Wordlist path' },
            filter_status: { type: 'string', description: 'Filter HTTP codes (e.g. 404,403)' },
            method: { type: 'string', description: 'HTTP method', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
          }, ['url', 'wordlist']),
        t('sqlmap_scan', 'SQLMap', 'Automated SQL injection detection and exploitation', 'Web Application',
          {
            url: { type: 'string', description: 'Target URL' },
            data: { type: 'string', description: 'POST data' },
            level: { type: 'string', description: 'Test level (1-5)', enum: ['1', '2', '3', '4', '5'] },
            risk: { type: 'string', description: 'Risk level (1-3)', enum: ['1', '2', '3'] },
          }, ['url']),
        t('dalfox_xss', 'DalFox', 'XSS scanner and parameter analyzer', 'Web Application',
          {
            url: { type: 'string', description: 'Target URL' },
            params: { type: 'string', description: 'Parameters to test' },
            blind_xss_callback: { type: 'string', description: 'Blind XSS callback URL' },
          }, ['url']),
        t('wpscan_scan', 'WPScan', 'WordPress vulnerability scanner', 'Web Application',
          {
            url: { type: 'string', description: 'WordPress site URL' },
            enumerate: { type: 'string', description: 'Enumeration flags (e.g. u,p,vp,vt)' },
            api_token: { type: 'string', description: 'WPScan API token' },
          }, ['url']),
        t('zap_scan', 'OWASP ZAP', 'Active and passive web application scanning', 'Web Application',
          {
            target: { type: 'string', description: 'Target URL' },
            scan_type: { type: 'string', description: 'Scan type', enum: ['passive', 'active', 'spider', 'ajax_spider'] },
            api_key: { type: 'string', description: 'ZAP API key' },
          }, ['target']),
        t('arjun_params', 'Arjun', 'HTTP parameter discovery tool', 'Web Application',
          {
            url: { type: 'string', description: 'Target URL' },
            method: { type: 'string', description: 'HTTP method', enum: ['GET', 'POST', 'JSON', 'XML'] },
            wordlist: { type: 'string', description: 'Custom wordlist' },
          }, ['url']),
        t('xsser_scan', 'XSSer', 'XSS vulnerability framework', 'Web Application',
          {
            url: { type: 'string', description: 'Target URL' },
            payload: { type: 'string', description: 'Custom payload' },
            auto: { type: 'string', description: 'Auto-detect and inject', enum: ['true', 'false'] },
          }, ['url']),
        t('jwt_analyzer', 'JWT Analyzer', 'Decode, verify, and attack JWT tokens', 'Web Application',
          {
            token: { type: 'string', description: 'JWT token to analyze' },
            attack: { type: 'string', description: 'Attack type', enum: ['none_alg', 'brute_secret', 'decode', 'verify'] },
            secret: { type: 'string', description: 'Secret for verification' },
          }, ['token']),

        // ── Subdomain & OSINT ────────────────────────────────────────────────
        t('subfinder_enum', 'Subfinder', 'Passive subdomain enumeration', 'Subdomain & OSINT',
          {
            domain: { type: 'string', description: 'Target domain' },
            sources: { type: 'string', description: 'Sources to use (e.g. shodan,virustotal)' },
            output: { type: 'string', description: 'Output file path' },
          }, ['domain']),
        t('amass_enum', 'Amass', 'In-depth DNS enumeration and network mapping', 'Subdomain & OSINT',
          {
            domain: { type: 'string', description: 'Target domain' },
            mode: { type: 'string', description: 'Mode', enum: ['enum', 'intel', 'viz', 'track', 'db'] },
            passive: { type: 'string', description: 'Passive only', enum: ['true', 'false'] },
          }, ['domain']),
        t('dnsx_resolve', 'Dnsx', 'DNS resolution and brute-forcing', 'Subdomain & OSINT',
          {
            targets: { type: 'string', description: 'Hosts/domains to resolve' },
            wordlist: { type: 'string', description: 'Wordlist for brute-force' },
            record_types: { type: 'string', description: 'Record types (e.g. A,AAAA,MX,TXT)' },
          }, ['targets']),
        t('waybackurls', 'Waybackurls', 'Fetch URLs from Wayback Machine for a domain', 'Subdomain & OSINT',
          {
            domain: { type: 'string', description: 'Target domain' },
          }, ['domain']),
        t('gau_discover', 'GAU', 'Get all URLs from AlienVault, Wayback, URLScan', 'Subdomain & OSINT',
          {
            domain: { type: 'string', description: 'Target domain' },
            providers: { type: 'string', description: 'Providers to query', enum: ['wayback', 'otx', 'urlscan', 'all'] },
          }, ['domain']),
        t('hakrawler_crawl', 'Hakrawler', 'Web crawler for links, endpoints, and forms', 'Subdomain & OSINT',
          {
            url: { type: 'string', description: 'Target URL to crawl' },
            depth: { type: 'string', description: 'Crawl depth' },
            subs: { type: 'string', description: 'Include subdomains', enum: ['true', 'false'] },
          }, ['url']),
        t('katana_crawl', 'Katana', 'Next-gen web crawling framework', 'Subdomain & OSINT',
          {
            url: { type: 'string', description: 'Target URL' },
            depth: { type: 'string', description: 'Crawl depth' },
            js_crawl: { type: 'string', description: 'JavaScript crawling', enum: ['true', 'false'] },
          }, ['url']),
        t('theHarvester', 'theHarvester', 'E-mail, subdomains and names harvest from public sources', 'Subdomain & OSINT',
          {
            domain: { type: 'string', description: 'Target domain' },
            sources: { type: 'string', description: 'Data sources (e.g. google,bing,shodan)' },
            limit: { type: 'string', description: 'Result limit' },
          }, ['domain']),
        t('shodan_search', 'Shodan', 'Search internet-connected devices and services', 'Subdomain & OSINT',
          {
            query: { type: 'string', description: 'Shodan search query' },
            api_key: { type: 'string', description: 'Shodan API key' },
            limit: { type: 'string', description: 'Max results' },
          }, ['query']),

        // ── Enumeration ───────────────────────────────────────────────────────
        t('enum4linux_scan', 'Enum4linux', 'SMB/LDAP enumeration (Windows/Samba)', 'Enumeration',
          {
            target: { type: 'string', description: 'Target IP' },
            flags: { type: 'string', description: 'Options (e.g. -a for all)' },
          }, ['target']),
        t('netexec_scan', 'NetExec', 'Network service exploitation (CME successor)', 'Enumeration',
          {
            target: { type: 'string', description: 'Target host/CIDR' },
            protocol: { type: 'string', description: 'Protocol', enum: ['smb', 'ldap', 'winrm', 'ssh', 'ftp', 'rdp', 'mssql'] },
            username: { type: 'string', description: 'Username or file' },
            password: { type: 'string', description: 'Password or file' },
            module: { type: 'string', description: 'Module to run' },
          }, ['target', 'protocol']),
        t('smbmap_scan', 'SMBMap', 'SMB share enumeration and file access', 'Enumeration',
          {
            target: { type: 'string', description: 'Target IP' },
            username: { type: 'string', description: 'Username' },
            password: { type: 'string', description: 'Password' },
            domain: { type: 'string', description: 'Domain' },
          }, ['target']),
        t('ldapdomaindump', 'LDAP Domain Dump', 'Dump Active Directory info via LDAP', 'Enumeration',
          {
            target: { type: 'string', description: 'Domain controller IP' },
            username: { type: 'string', description: 'AD username' },
            password: { type: 'string', description: 'AD password' },
          }, ['target', 'username', 'password']),
        t('bloodhound_collect', 'BloodHound Collector', 'Collect AD data for BloodHound analysis', 'Enumeration',
          {
            domain: { type: 'string', description: 'Target domain' },
            dc: { type: 'string', description: 'Domain controller' },
            collection_method: { type: 'string', description: 'Method', enum: ['All', 'DCOnly', 'Session', 'LoggedOn'] },
          }, ['domain']),

        // ── Cloud Security ────────────────────────────────────────────────────
        t('prowler_aws', 'Prowler', 'AWS security assessment and compliance checks', 'Cloud Security',
          {
            profile: { type: 'string', description: 'AWS CLI profile' },
            checks: { type: 'string', description: 'Specific checks or group (e.g. cis_level1)' },
            region: { type: 'string', description: 'AWS region' },
          }, []),
        t('trivy_scan', 'Trivy', 'Container and IaC vulnerability scanner', 'Cloud Security',
          {
            target: { type: 'string', description: 'Image name, directory, or repo URL' },
            scan_type: { type: 'string', description: 'Scan type', enum: ['image', 'fs', 'repo', 'sbom', 'k8s'] },
            severity: { type: 'string', description: 'Min severity', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          }, ['target']),
        t('checkov_iac', 'Checkov', 'IaC security scanner (Terraform, K8s, ARM, etc)', 'Cloud Security',
          {
            path: { type: 'string', description: 'Directory or file to scan' },
            framework: { type: 'string', description: 'Framework', enum: ['terraform', 'cloudformation', 'kubernetes', 'arm', 'dockerfile'] },
            check: { type: 'string', description: 'Specific check IDs to run' },
          }, ['path']),
        t('docker_bench', 'Docker Bench', 'CIS Docker security benchmark checks', 'Cloud Security',
          {
            containers: { type: 'string', description: 'Specific containers to check' },
          }, []),
        t('kube_hunter', 'Kube-Hunter', 'Kubernetes cluster penetration testing', 'Cloud Security',
          {
            target: { type: 'string', description: 'Cluster API server address' },
            pod: { type: 'string', description: 'Run from within a pod', enum: ['true', 'false'] },
          }, []),
        t('scout_suite', 'ScoutSuite', 'Multi-cloud security auditing (AWS/GCP/Azure)', 'Cloud Security',
          {
            provider: { type: 'string', description: 'Cloud provider', enum: ['aws', 'gcp', 'azure', 'aliyun'] },
            profile: { type: 'string', description: 'Cloud CLI profile' },
            report_dir: { type: 'string', description: 'Output report directory' },
          }, ['provider']),

        // ── Credential Testing ────────────────────────────────────────────────
        t('hydra_brute', 'Hydra', 'Parallelised login brute-forcer', 'Credential Testing',
          {
            target: { type: 'string', description: 'Target IP/host' },
            service: { type: 'string', description: 'Service', enum: ['ssh', 'ftp', 'http', 'https', 'smb', 'rdp', 'mysql', 'mssql', 'ldap'] },
            username: { type: 'string', description: 'Username or file' },
            password_list: { type: 'string', description: 'Password wordlist path' },
            threads: { type: 'string', description: 'Number of threads' },
          }, ['target', 'service']),
        t('hashcat_crack', 'Hashcat', 'GPU-accelerated hash cracking', 'Credential Testing',
          {
            hash: { type: 'string', description: 'Hash or hash file' },
            hash_type: { type: 'string', description: 'Hash type (e.g. 0=MD5, 1000=NTLM, 13100=Kerberoast)' },
            wordlist: { type: 'string', description: 'Wordlist path' },
            rules: { type: 'string', description: 'Rule file path' },
            attack_mode: { type: 'string', description: 'Attack mode', enum: ['0', '1', '3', '6', '7'] },
          }, ['hash', 'hash_type']),
        t('john_crack', 'John the Ripper', 'Password cracker supporting many hash formats', 'Credential Testing',
          {
            hash_file: { type: 'string', description: 'Hash file path' },
            wordlist: { type: 'string', description: 'Wordlist path' },
            format: { type: 'string', description: 'Hash format (e.g. nt, md5, sha256)' },
            rules: { type: 'string', description: 'Crack rules to apply' },
          }, ['hash_file']),
        t('kerbrute_scan', 'Kerbrute', 'Kerberos pre-auth brute-forcing and user enumeration', 'Credential Testing',
          {
            mode: { type: 'string', description: 'Mode', enum: ['userenum', 'bruteuser', 'bruteforce', 'passwordspray'] },
            domain: { type: 'string', description: 'Target domain' },
            dc: { type: 'string', description: 'Domain controller' },
            wordlist: { type: 'string', description: 'User or password wordlist' },
          }, ['mode', 'domain']),

        // ── Exploitation ──────────────────────────────────────────────────────
        t('metasploit_run', 'Metasploit', 'Run Metasploit Framework modules', 'Exploitation',
          {
            module: { type: 'string', description: 'Module path (e.g. exploit/multi/handler)' },
            options: { type: 'string', description: 'Module options as key=value pairs' },
            payload: { type: 'string', description: 'Payload to use' },
          }, ['module']),
        t('msfvenom_payload', 'MSFVenom', 'Generate payloads for various platforms', 'Exploitation',
          {
            platform: { type: 'string', description: 'Target platform', enum: ['windows', 'linux', 'osx', 'android', 'java', 'php', 'python'] },
            arch: { type: 'string', description: 'Architecture', enum: ['x86', 'x64', 'arm', 'aarch64'] },
            payload: { type: 'string', description: 'Payload (e.g. windows/x64/meterpreter/reverse_tcp)' },
            lhost: { type: 'string', description: 'Listener host' },
            lport: { type: 'string', description: 'Listener port' },
            format: { type: 'string', description: 'Output format', enum: ['exe', 'elf', 'raw', 'py', 'ps1', 'hta', 'asp'] },
          }, ['payload', 'lhost', 'lport']),
        t('impacket_suite', 'Impacket', 'Windows protocol attack suite (psexec, secretsdump, etc)', 'Exploitation',
          {
            tool: { type: 'string', description: 'Tool', enum: ['psexec', 'wmiexec', 'smbexec', 'secretsdump', 'GetTGT', 'GetST', 'GetNPUsers', 'GetUserSPNs'] },
            target: { type: 'string', description: 'Target host' },
            username: { type: 'string', description: 'Username' },
            password: { type: 'string', description: 'Password or hash' },
            domain: { type: 'string', description: 'Domain' },
          }, ['tool', 'target']),

        // ── Binary Analysis ───────────────────────────────────────────────────
        t('binwalk_analyze', 'Binwalk', 'Firmware analysis and extraction', 'Binary Analysis',
          {
            file: { type: 'string', description: 'Binary file path' },
            extract: { type: 'string', description: 'Extract embedded files', enum: ['true', 'false'] },
          }, ['file']),
        t('strings_extract', 'Strings', 'Extract printable strings from binaries', 'Binary Analysis',
          {
            file: { type: 'string', description: 'Binary file path' },
            min_length: { type: 'string', description: 'Minimum string length' },
            encoding: { type: 'string', description: 'Encoding', enum: ['ascii', 'unicode', 'both'] },
          }, ['file']),
        t('checksec_binary', 'Checksec', 'Check binary security properties (PIE, NX, RELRO, etc)', 'Binary Analysis',
          {
            file: { type: 'string', description: 'Binary file path' },
            output: { type: 'string', description: 'Output format', enum: ['text', 'json', 'csv'] },
          }, ['file']),
        t('radare2_analyze', 'Radare2', 'Reverse engineering framework', 'Binary Analysis',
          {
            file: { type: 'string', description: 'Binary file path' },
            commands: { type: 'string', description: 'R2 commands to run (e.g. aaa;afl)' },
          }, ['file']),
        t('ghidra_decompile', 'Ghidra', 'NSA reverse engineering and decompilation', 'Binary Analysis',
          {
            file: { type: 'string', description: 'Binary file path' },
            function: { type: 'string', description: 'Function to decompile (name or address)' },
          }, ['file']),
        t('gdb_debug', 'GDB', 'GNU debugger with PEDA/Pwndbg', 'Binary Analysis',
          {
            file: { type: 'string', description: 'Binary to debug' },
            commands: { type: 'string', description: 'GDB commands to run' },
            args: { type: 'string', description: 'Program arguments' },
          }, ['file']),

        // ── Forensics & CTF ───────────────────────────────────────────────────
        t('volatility_mem', 'Volatility3', 'Memory forensics analysis', 'Forensics & CTF',
          {
            memory_dump: { type: 'string', description: 'Path to memory dump file' },
            plugin: { type: 'string', description: 'Plugin to run (e.g. windows.pslist, linux.bash)' },
            os: { type: 'string', description: 'Target OS', enum: ['windows', 'linux', 'mac'] },
          }, ['memory_dump', 'plugin']),
        t('foremost_carve', 'Foremost', 'File carving from raw images/dumps', 'Forensics & CTF',
          {
            input: { type: 'string', description: 'Input file or device' },
            output_dir: { type: 'string', description: 'Output directory' },
            types: { type: 'string', description: 'File types to carve (e.g. jpg,png,pdf)' },
          }, ['input']),
        t('steghide_steg', 'Steghide', 'Steganography detection and extraction', 'Forensics & CTF',
          {
            file: { type: 'string', description: 'Cover file' },
            action: { type: 'string', description: 'Action', enum: ['embed', 'extract', 'info'] },
            passphrase: { type: 'string', description: 'Passphrase' },
          }, ['file', 'action']),
        t('exiftool_meta', 'Exiftool', 'Read and write file metadata', 'Forensics & CTF',
          {
            file: { type: 'string', description: 'File path' },
            output: { type: 'string', description: 'Output format', enum: ['text', 'json', 'csv'] },
          }, ['file']),
        t('wireshark_pcap', 'Tshark', 'CLI packet capture analysis (Wireshark engine)', 'Forensics & CTF',
          {
            file: { type: 'string', description: 'PCAP file path' },
            filter: { type: 'string', description: 'Display filter (e.g. http, dns, tcp.port==443)' },
            decode_as: { type: 'string', description: 'Decode protocol override' },
          }, ['file']),

        // ── AI Analysis ───────────────────────────────────────────────────────
        t('ai_payload_gen', 'AI Payload Generator', 'Generate context-aware attack payloads with AI', 'AI Analysis',
          {
            vulnerability_type: { type: 'string', description: 'Type', enum: ['xss', 'sqli', 'ssrf', 'xxe', 'ssti', 'rce', 'path_traversal', 'idor'] },
            context: { type: 'string', description: 'Application context and WAF info' },
            encoding: { type: 'string', description: 'Encoding strategy', enum: ['none', 'url', 'html', 'base64', 'unicode'] },
          }, ['vulnerability_type']),
        t('ai_attack_chain', 'AI Attack Chain', 'Build multi-stage attack chains from recon data', 'AI Analysis',
          {
            target_info: { type: 'string', description: 'Target information (OS, services, version)' },
            objective: { type: 'string', description: 'Attack objective (e.g. RCE, privilege escalation, data exfil)' },
          }, ['target_info']),
        t('ai_recon_workflow', 'AI Recon Planner', 'Plan optimal reconnaissance workflow for a target', 'AI Analysis',
          {
            target: { type: 'string', description: 'Target domain or IP' },
            scope: { type: 'string', description: 'Scope definition (in-scope and out-of-scope)' },
          }, ['target']),
        t('detect_tech_stack', 'Tech Stack Detector', 'AI-powered technology stack fingerprinting', 'AI Analysis',
          {
            url: { type: 'string', description: 'Target URL' },
            headers: { type: 'string', description: 'HTTP response headers' },
            source_snippets: { type: 'string', description: 'Page source snippets' },
          }, ['url']),
        t('cve_intelligence', 'CVE Intelligence', 'Fetch CVE details, PoC exploits, and patch info', 'AI Analysis',
          {
            cve_id: { type: 'string', description: 'CVE identifier (e.g. CVE-2024-1234)' },
            include_poc: { type: 'string', description: 'Search for PoC exploits', enum: ['true', 'false'] },
          }, ['cve_id']),

        // ── Bug Bounty ────────────────────────────────────────────────────────
        t('bb_recon_workflow', 'BB Recon', 'Full bug bounty reconnaissance workflow', 'Bug Bounty',
          {
            domain: { type: 'string', description: 'Target domain' },
            platform: { type: 'string', description: 'Bug bounty platform', enum: ['hackerone', 'bugcrowd', 'intigriti', 'yeswehack', 'synack'] },
            scope: { type: 'string', description: 'Program scope definition' },
          }, ['domain']),
        t('bb_vuln_hunt', 'BB Vuln Hunter', 'Automated vulnerability hunting for bug bounty', 'Bug Bounty',
          {
            target: { type: 'string', description: 'Target URL or domain' },
            focus: { type: 'string', description: 'Vulnerability class to focus on', enum: ['xss', 'sqli', 'ssrf', 'idor', 'auth_bypass', 'rce', 'all'] },
          }, ['target']),
        t('bb_osint', 'BB OSINT', 'Bug bounty OSINT gathering (LinkedIn, GitHub, pastebin)', 'Bug Bounty',
          {
            company: { type: 'string', description: 'Company/organization name' },
            domain: { type: 'string', description: 'Primary domain' },
            sources: { type: 'string', description: 'OSINT sources to use', enum: ['github', 'linkedin', 'pastebin', 'shodan', 'all'] },
          }, ['company']),
        t('bb_report_gen', 'BB Report Generator', 'Generate professional bug bounty report', 'Bug Bounty',
          {
            vulnerability: { type: 'string', description: 'Vulnerability description' },
            severity: { type: 'string', description: 'Severity', enum: ['critical', 'high', 'medium', 'low', 'info'] },
            steps: { type: 'string', description: 'Steps to reproduce' },
            impact: { type: 'string', description: 'Business impact' },
          }, ['vulnerability', 'severity', 'steps']),

        // ── Reporting ─────────────────────────────────────────────────────────
        t('create_vuln_report', 'Vuln Report', 'Generate structured vulnerability report (markdown/HTML/PDF)', 'Reporting',
          {
            findings: { type: 'string', description: 'JSON findings data' },
            format: { type: 'string', description: 'Output format', enum: ['markdown', 'html', 'pdf', 'json'] },
            template: { type: 'string', description: 'Report template', enum: ['pentest', 'bugbounty', 'compliance', 'executive'] },
          }, ['findings']),
        t('export_findings_csv', 'Export Findings', 'Export vulnerability findings to CSV/Excel', 'Reporting',
          {
            findings: { type: 'string', description: 'JSON findings data' },
            format: { type: 'string', description: 'Export format', enum: ['csv', 'xlsx', 'json'] },
          }, ['findings']),
        t('scan_summary', 'Scan Summary', 'Summarize scan results into an executive overview', 'Reporting',
          {
            scan_data: { type: 'string', description: 'Raw scan output data' },
            target: { type: 'string', description: 'Target description' },
          }, ['scan_data']),
      ],

      selectedMCP: null,
      isLoading: false,
      error: null,

      setMCPs: (mcps) => set({ mcps }),
      addMCP: (mcp) => set((state) => ({
        mcps: [...state.mcps, {
          ...mcp,
          id: Date.now().toString(),
          status: 'disconnected' as const,
          tools: [],
          resources: [],
          prompts: [],
        }],
      })),
      updateMCP: (id, updates) =>
        set((state) => ({
          mcps: state.mcps.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),
      removeMCP: (id) =>
        set((state) => ({
          mcps: state.mcps.filter((m) => m.id !== id),
        })),
      setSelectedMCP: (mcp) => set({ selectedMCP: mcp }),
      connectMCP: (id) =>
        set((state) => ({
          mcps: state.mcps.map((m) =>
            m.id === id ? { ...m, status: 'connected' as const } : m
          ),
        })),
      disconnectMCP: (id) =>
        set((state) => ({
          mcps: state.mcps.map((m) =>
            m.id === id ? { ...m, status: 'disconnected' as const } : m
          ),
        })),

      setBuiltinTools: (tools) => set({ builtinTools: tools }),
      addBuiltinTool: (tool) =>
        set((state) => ({
          builtinTools: [...state.builtinTools, tool],
        })),
      removeBuiltinTool: (id) =>
        set((state) => ({
          builtinTools: state.builtinTools.filter((t) => t.id !== id),
        })),
      toggleTool: (id) =>
        set((state) => ({
          builtinTools: state.builtinTools.map((t) =>
            t.id === id ? { ...t, enabled: !t.enabled } : t
          ),
        })),

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'harbinger-mcp',
      partialize: (state) => ({
        mcps: state.mcps,
        builtinTools: state.builtinTools,
      }),
    }
  )
)
