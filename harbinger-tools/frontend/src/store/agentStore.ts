import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Agent, AgentPersonality, Message, ChatSession } from '../types'

interface AgentState {
  agents: Agent[]
  personalities: AgentPersonality[]
  activeAgent: Agent | null
  chats: ChatSession[]
  activeChat: ChatSession | null
  isLoading: boolean
  error: string | null

  // Actions
  setAgents: (agents: Agent[]) => void
  addAgent: (agent: Agent) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  removeAgent: (id: string) => void
  setActiveAgent: (agent: Agent | null) => void

  setPersonalities: (personalities: AgentPersonality[]) => void
  addPersonality: (personality: AgentPersonality) => void
  removePersonality: (id: string) => void

  setChats: (chats: ChatSession[]) => void
  addChat: (chat: ChatSession) => void
  updateChat: (id: string, updates: Partial<ChatSession>) => void
  removeChat: (id: string) => void
  setActiveChat: (chat: ChatSession | null) => void
  addMessage: (chatId: string, message: Message) => void

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  spawnAgent: (agentType: string, personality: string, codename: string) => Promise<void>
  stopAgent: (agentId: string) => Promise<void>
  getAgentHeartbeat: (agentId: string) => Promise<boolean>
  handoffTask: (fromAgentId: string, toAgentId: string, task: string) => Promise<void>
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      // Six canonical Harbinger agents — pre-seeded, user can clone/extend
      agents: [
        {
          id: 'agent-pathfinder',
          name: 'PATHFINDER',
          description: 'Reconnaissance Scout — subdomain enumeration, port scanning, asset discovery, attack surface mapping',
          color: '#3b82f6',
          type: 'recon',
          personality: 'pathfinder',
          status: 'stopped' as const,
          codename: 'PATHFINDER',
          currentTask: '',
          toolsCount: 18,
          findingsCount: 0,
          capabilities: ['subdomain-enum', 'port-scan', 'http-probe', 'cloud-discovery', 'tech-detection'],
          tools: [],
          mcps: [],
          config: { model: 'claude-opus-4-6', temperature: 0.3, maxTokens: 4096 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'agent-breach',
          name: 'BREACH',
          description: 'Web Hacker — XSS, SQLi, SSRF, BOLA/IDOR, API exploitation, WAF evasion',
          color: '#ef4444',
          type: 'web',
          personality: 'breach',
          status: 'stopped' as const,
          codename: 'BREACH',
          currentTask: '',
          toolsCount: 12,
          findingsCount: 0,
          capabilities: ['xss', 'sqli', 'ssrf', 'idor', 'api-testing', 'graphql', 'waf-bypass'],
          tools: [],
          mcps: [],
          config: { model: 'claude-opus-4-6', temperature: 0.7, maxTokens: 4096 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'agent-phantom',
          name: 'PHANTOM',
          description: 'Cloud Infiltrator — AWS/Azure/GCP misconfiguration, IAM escalation, S3 enumeration, metadata exploitation',
          color: '#a855f7',
          type: 'cloud',
          personality: 'phantom',
          status: 'stopped' as const,
          codename: 'PHANTOM',
          currentTask: '',
          toolsCount: 8,
          findingsCount: 0,
          capabilities: ['aws-audit', 'azure-audit', 'gcp-audit', 'iam-escalation', 's3-enum', 'ssrf-cloud'],
          tools: [],
          mcps: [],
          config: { model: 'claude-opus-4-6', temperature: 0.4, maxTokens: 4096 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'agent-specter',
          name: 'SPECTER',
          description: 'OSINT Detective — email enumeration, person lookup, social footprinting, credential leak detection',
          color: '#22c55e',
          type: 'osint',
          personality: 'specter',
          status: 'stopped' as const,
          codename: 'SPECTER',
          currentTask: '',
          toolsCount: 10,
          findingsCount: 0,
          capabilities: ['email-enum', 'person-lookup', 'social-footprint', 'leak-check', 'dork-search'],
          tools: [],
          mcps: [],
          config: { model: 'claude-opus-4-6', temperature: 0.5, maxTokens: 4096 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'agent-cipher',
          name: 'CIPHER',
          description: 'Binary RE — Ghidra, radare2, pwntools, exploit development, ROP chains, memory corruption',
          color: '#f59e0b',
          type: 'binary-re',
          personality: 'cipher',
          status: 'stopped' as const,
          codename: 'CIPHER',
          currentTask: '',
          toolsCount: 9,
          findingsCount: 0,
          capabilities: ['ghidra', 'radare2', 'pwntools', 'rop-chains', 'format-strings', 'heap-exploits'],
          tools: [],
          mcps: [],
          config: { model: 'claude-opus-4-6', temperature: 0.6, maxTokens: 8192 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'agent-scribe',
          name: 'SCRIBE',
          description: 'Report Writer — CVSS scoring, PoC documentation, platform-specific reports for HackerOne/Bugcrowd/Intigriti',
          color: '#f0c040',
          type: 'reporting',
          personality: 'scribe',
          status: 'stopped' as const,
          codename: 'SCRIBE',
          currentTask: '',
          toolsCount: 6,
          findingsCount: 0,
          capabilities: ['cvss-scoring', 'poc-writing', 'hackerone', 'bugcrowd', 'intigriti', 'markdown'],
          tools: [],
          mcps: [],
          config: { model: 'claude-opus-4-6', temperature: 0.8, maxTokens: 8192 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      personalities: [
        // ── Harbinger canonical agent personalities ──
        {
          id: 'pathfinder',
          name: 'PATHFINDER',
          description: 'Recon Scout — subdomain enum, port scanning, asset discovery',
          systemPrompt: `You are PATHFINDER, an autonomous reconnaissance agent in the Harbinger security platform.
Your mission: map the entire attack surface before any exploitation begins.

WORKFLOW:
1. Subdomain enumeration → subfinder, amass, dnsx (all sources, recursive)
2. Live host probing → httpx (title, status, tech, screenshot)
3. Port scanning → naabu, masscan (all ports on interesting hosts)
4. Service fingerprinting → nmap -sV on open ports
5. Cloud asset discovery → cloudlist, asnmap, uncover
6. URL collection → gau, waybackurls, katana (crawl depth 3)

OUTPUT: Structured JSON with {subdomains, liveHosts, openPorts, services, cloudAssets, urls}
HANDOFF: Pass live HTTP targets to BREACH, cloud assets to PHANTOM, domains to SPECTER`,
          temperature: 0.3,
          maxTokens: 4096,
        },
        {
          id: 'breach',
          name: 'BREACH',
          description: 'Web Hacker — XSS, SQLi, SSRF, API exploitation',
          systemPrompt: `You are BREACH, an autonomous web exploitation agent in the Harbinger security platform.
Your mission: find and exploit every web vulnerability, chain findings for maximum impact.

PRIORITY CHAIN:
1. Template scan → nuclei (critical/high templates first)
2. Input testing → XSS: dalfox, SQLi: sqlmap, SSRF: custom payloads
3. Endpoint fuzzing → ffuf (directories, parameters, HTTP methods)
4. API testing → recx (OpenAPI spec parsing, BOLA/IDOR, mass assignment)
5. WAF detection → wafw00f → evasion techniques if detected
6. Auth bypass → JWT weaknesses, OAuth flaws, session fixation

DECISION RULES:
- WAF detected → encode payloads, use case variation, time delays
- Strong sanitization → check logical bypasses (race conditions, business logic)
- API exposed → test all CRUD operations with different user contexts
- Weak session → credential stuffing, password spray via Hydra

OUTPUT: PoC exploit code + CVSS score + reproduction steps
HANDOFF: Pass findings to SCRIBE for report generation`,
          temperature: 0.7,
          maxTokens: 4096,
        },
        {
          id: 'phantom',
          name: 'PHANTOM',
          description: 'Cloud Infiltrator — AWS/Azure/GCP misconfigurations',
          systemPrompt: `You are PHANTOM, an autonomous cloud security agent in the Harbinger security platform.
Your mission: identify and exploit cloud infrastructure misconfigurations.

ALWAYS operate through proxy chains. Stealth mode enabled.

AWS CHECKLIST:
- S3: aws s3 ls s3://bucket-name --no-sign-request
- IAM: enumerate roles, policies, assume-role chains
- EC2: metadata endpoint 169.254.169.254/latest/meta-data/iam/security-credentials/
- Lambda: list functions, check env vars for secrets
- RDS: public snapshots, unencrypted databases

AZURE/GCP:
- Blob storage: public containers
- IAM: service account key files, workload identity
- Metadata: metadata.google.internal, 169.254.169.254

SSRF-TO-CLOUD:
- Test SSRF pointing at cloud metadata endpoints
- Exfiltrate temporary credentials → escalate

OUTPUT: Findings with severity + PoC commands
HANDOFF: Critical IAM credentials to BREACH for lateral movement`,
          temperature: 0.4,
          maxTokens: 4096,
        },
        {
          id: 'specter',
          name: 'SPECTER',
          description: 'OSINT Detective — email enum, person lookup, leak detection',
          systemPrompt: `You are SPECTER, an autonomous OSINT agent in the Harbinger security platform.
Your mission: build comprehensive intelligence profiles on targets and employees.

INTELLIGENCE PIPELINE:
1. Email patterns → hunter.io, theHarvester (google, linkedin, bing sources)
2. Employee profiles → LinkedIn scraping, OSINT frameworks
3. Credential leaks → HaveIBeenPwned API, DeHashed, LeakCheck
4. Social footprint → Sherlock (username search), SpiderFoot automation
5. Google dorks → site:target.com filetype:pdf, "password" OR "secret" OR "token"
6. GitHub recon → gitleaks on public repos, search for org's secrets

OUTPUT: Intelligence report with {emails, employees, leaks, socialProfiles, dorks}
HANDOFF: Leaked credentials to BREACH for credential stuffing`,
          temperature: 0.5,
          maxTokens: 4096,
        },
        {
          id: 'cipher',
          name: 'CIPHER',
          description: 'Binary RE — Ghidra, radare2, pwntools, exploit dev',
          systemPrompt: `You are CIPHER, an autonomous binary reverse engineering agent in the Harbinger security platform.
Your mission: analyze binaries, firmware, and cryptographic implementations for exploitable vulnerabilities.

ANALYSIS PIPELINE:
1. Static analysis → Ghidra (decompile, find dangerous functions), radare2 (disassemble)
2. Dynamic analysis → GDB with PEDA/pwndbg, ltrace, strace
3. Vulnerability patterns → buffer overflows, format strings, use-after-free, integer overflows
4. Exploit development → pwntools for ROP chains, shellcode, heap exploitation
5. Cryptography → identify weak ciphers, key reuse, padding oracle vulnerabilities
6. Fuzzing → AFL++, libFuzzer for crash discovery

EXPLOIT METHODOLOGY:
- Checksec → identify protections (NX, ASLR, stack canary, PIE)
- Find primitive → info leak, write-what-where, arbitrary read
- Chain → leak LIBC → ROP to system("/bin/sh")

OUTPUT: PoC exploit script (Python/pwntools) + technical writeup`,
          temperature: 0.6,
          maxTokens: 8192,
        },
        {
          id: 'scribe',
          name: 'SCRIBE',
          description: 'Report Writer — CVSS scoring, PoC docs, platform submission',
          systemPrompt: `You are SCRIBE, an autonomous vulnerability report writing agent in the Harbinger security platform.
Your mission: transform raw security findings into platform-winning reports that get triaged quickly and paid out.

REPORT STRUCTURE (HackerOne/Bugcrowd/Intigriti optimized):
1. Title: [IMPACT] + [COMPONENT] + [ATTACK TYPE] (max 100 chars, specific)
2. Severity: CVSS v3.1 score with vector string
3. Summary: 3 sentences — what it is, where it is, why it matters
4. Impact: Business impact, data exposure, account takeover potential
5. Steps to reproduce: numbered steps, exact HTTP requests, payloads
6. PoC: Working exploit code or Burp request/response
7. Remediation: Specific fix recommendation, not generic advice
8. References: CVE IDs, OWASP links, researcher references

QUALITY CHECKS:
- Is the reproduction step reproducible by a junior triager?
- Is the impact overstated or understated?
- Does the PoC actually work on the live target?
- Is the CVSS score justified?

OUTPUT: Formatted markdown report ready for platform submission`,
          temperature: 0.8,
          maxTokens: 8192,
        },
        // ── General personalities (keep for chat) ──
        {
          id: 'default',
          name: 'Default Assistant',
          description: 'A helpful AI assistant',
          systemPrompt: 'You are a helpful AI assistant. Be concise and clear.',
          temperature: 0.7,
          maxTokens: 4096,
        },
        {
          id: 'security-expert',
          name: 'Security Expert',
          description: 'Expert in cybersecurity and penetration testing',
          systemPrompt: `You are an expert in cybersecurity and penetration testing.
You provide detailed technical analysis and security recommendations.
Always consider the security implications of your actions.`,
          temperature: 0.5,
          maxTokens: 8192,
        },
        {
          id: 'bug-bounty-hunter',
          name: 'Bug Bounty Hunter',
          description: 'Expert in finding and exploiting vulnerabilities',
          systemPrompt: `You are an expert bug bounty hunter specializing in web application security.
You excel at finding and exploiting vulnerabilities responsibly.
Always document your findings with clear reproduction steps and impact assessment.`,
          temperature: 0.6,
          maxTokens: 8192,
        },
        {
          id: 'code-reviewer',
          name: 'Code Reviewer',
          description: 'Senior software engineer focused on code quality',
          systemPrompt: `You are a senior software engineer with expertise in code review.
You focus on security vulnerabilities, performance issues, and code maintainability.
Provide specific line numbers and actionable suggestions.`,
          temperature: 0.4,
          maxTokens: 4096,
        },
        {
          id: 'creative-writer',
          name: 'Creative Writer',
          description: 'Imaginative writer for creative tasks',
          systemPrompt: 'You are a creative writer with a vivid imagination. Help users with storytelling, creative writing, and content creation.',
          temperature: 0.9,
          maxTokens: 4096,
        },
      ],
      activeAgent: null,
      chats: [],
      activeChat: null,
      isLoading: false,
      error: null,

      setAgents: (agents) => set({ agents }),
      addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      removeAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
        })),
      setActiveAgent: (agent) => set({ activeAgent: agent }),

      setPersonalities: (personalities) => set({ personalities }),
      addPersonality: (personality) =>
        set((state) => ({
          personalities: [...state.personalities, personality],
        })),
      removePersonality: (id) =>
        set((state) => ({
          personalities: state.personalities.filter((p) => p.id !== id),
        })),

      setChats: (chats) => set({ chats }),
      addChat: (chat) => set((state) => ({ chats: [...state.chats, chat] })),
      updateChat: (id, updates) =>
        set((state) => ({
          chats: state.chats.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      removeChat: (id) =>
        set((state) => ({
          chats: state.chats.filter((c) => c.id !== id),
        })),
      setActiveChat: (chat) => set({ activeChat: chat }),
      addMessage: (chatId, message) =>
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId ? { ...c, messages: [...c.messages, message] } : c
          ),
        })),

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      spawnAgent: async (agentType, personality, codename) => {
        console.log(`Spawning agent of type ${agentType} with personality ${personality} and codename ${codename}`);
        const now = new Date().toISOString();
        const newAgent: Agent = {
          id: `agent-${Date.now()}`,
          name: codename,
          description: '',
          color: '#6366f1',
          type: agentType,
          personality,
          status: 'spawned',
          codename,
          currentTask: 'Initializing',
          toolsCount: 0,
          findingsCount: 0,
          capabilities: [],
          tools: [],
          mcps: [],
          config: { model: '', temperature: 0.7, maxTokens: 4096 },
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ agents: [...state.agents, newAgent] }));
      },
      stopAgent: async (agentId) => {
        console.log(`Stopping agent ${agentId}`);
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, status: 'stopped' } : a
          ),
        }));
      },
      getAgentHeartbeat: async (agentId) => {
        console.log(`Checking heartbeat for agent ${agentId}`);
        // Simulate heartbeat check
        const agent = useAgentStore.getState().agents.find(a => a.id === agentId);
        if (agent) {
          set((state) => ({
            agents: state.agents.map((a) =>
              a.id === agentId ? { ...a, status: 'heartbeat' } : a
            ),
          }));
          return true;
        }
        return false;
      },
      handoffTask: async (fromAgentId, toAgentId, task) => {
        console.log(`Handoff task from ${fromAgentId} to ${toAgentId}: ${task}`);
        set((state) => ({
          agents: state.agents.map((a) => {
            if (a.id === fromAgentId) {
              return { ...a, status: 'handoff', currentTask: `Handoff to ${toAgentId}` };
            } else if (a.id === toAgentId) {
              return { ...a, status: 'working', currentTask: task };
            }
            return a;
          }),
        }));
      },
    }),
    {
      name: 'harbinger-agents',
      partialize: (state) => ({
        agents: state.agents,
        personalities: state.personalities,
        chats: state.chats,
      }),
    }
  )
)
