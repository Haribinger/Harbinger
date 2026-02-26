import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Agent, AgentConfig, AgentPersonality, Message, ChatSession } from '../types'
import { agentsApi } from '../api/agents'
import { agentOrchestrator } from '../core/orchestrator'

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

  fetchAgents: () => Promise<void>
  spawnAgent: (agentType: string, personality: string, codename: string) => Promise<void>
  spawnAgentById: (agentId: string) => Promise<void>
  stopAgent: (agentId: string) => Promise<void>
  getAgentHeartbeat: (agentId: string) => Promise<boolean>
  handoffTask: (fromAgentId: string, toAgentId: string, task: string) => Promise<void>
  createAgentInDB: (name: string, type: string, description: string, capabilities: string[], config?: AgentConfig) => Promise<Agent | null>
  deleteAgentFromDB: (id: string) => Promise<void>
  cloneAgent: (sourceId: string, newName: string) => Promise<Agent | null>
}

// Map DB status strings to frontend status union
function mapDBStatus(s: string): Agent['status'] {
  const map: Record<string, Agent['status']> = {
    idle: 'idle',
    running: 'running',
    stopped: 'stopped',
    busy: 'busy',
    error: 'error',
    spawned: 'spawned',
    working: 'working',
    heartbeat: 'heartbeat',
  }
  return map[s] || 'idle'
}

// Map agent type to Obsidian Command color — supports unlimited types
function typeToColor(type: string): string {
  const colors: Record<string, string> = {
    recon: '#3b82f6',
    web: '#ef4444',
    cloud: '#a855f7',
    osint: '#06b6d4',
    binary: '#f97316',
    report: '#22c55e',
    'binary-re': '#f97316',
    reporting: '#22c55e',
    network: '#14b8a6',
    mobile: '#ec4899',
    api: '#84cc16',
    fuzzing: '#f59e0b',
    crypto: '#8b5cf6',
    'social-engineering': '#06b6d4',
    custom: '#6366f1',
  }
  return colors[type] || '#6366f1'
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      // Dynamic — populated from DB via fetchAgents(). No hardcoded agents.
      // The 6 canonical agents (PATHFINDER, BREACH, etc.) are seeded into PostgreSQL
      // by seedDefaultAgents() in database.go when the DB is first created.
      agents: [],
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

      fetchAgents: async () => {
        try {
          set({ isLoading: true })
          const dbAgents = await agentsApi.getAll()
          if (dbAgents.length > 0) {
            // Merge DB agents into local state — use DB as source of truth for known agents
            const { agents: localAgents } = useAgentStore.getState()
            const dbAgentIds = new Set(dbAgents.map(a => a.id))

            // Map DB agents to the frontend Agent type
            const mappedDBAgents: Agent[] = dbAgents.map(a => {
              const existing = localAgents.find(l => l.name === a.name || l.id === a.id)
              return {
                id: a.id,
                name: a.name || (existing?.name ?? ''),
                description: a.description || (existing?.description ?? ''),
                color: existing?.color || typeToColor(a.type || 'recon'),
                type: a.type || existing?.type || 'recon',
                personality: existing?.personality || a.name?.toLowerCase(),
                status: mapDBStatus(a.status),
                codename: a.name,
                currentTask: existing?.currentTask || '',
                toolsCount: a.capabilities?.length || (existing?.toolsCount ?? 0),
                findingsCount: existing?.findingsCount || 0,
                capabilities: a.capabilities || (existing?.capabilities ?? []),
                containerId: a.container_id || a.containerId,
                tools: existing?.tools || [],
                mcps: existing?.mcps || [],
                config: existing?.config || { model: 'claude-opus-4-6', temperature: 0.5, maxTokens: 4096 },
                createdAt: a.created_at || a.createdAt || (existing?.createdAt ?? new Date().toISOString()),
                updatedAt: a.updated_at || a.updatedAt || (existing?.updatedAt ?? new Date().toISOString()),
              }
            })

            // Keep local-only agents (those not in DB — like pre-seeded ones before DB existed)
            const localOnly = localAgents.filter(l => !dbAgentIds.has(l.id) && !dbAgents.some(d => d.name === l.name))

            set({ agents: [...mappedDBAgents, ...localOnly] })
          }
        } catch (err) {
          console.warn('[AgentStore] Failed to fetch from API, using local state:', err)
        } finally {
          set({ isLoading: false })
        }
      },

      spawnAgent: async (agentType, personality, codename) => {
        // First try to create in DB, then spawn Docker container
        try {
          const agent = await agentsApi.create({
            name: codename,
            type: agentType,
            description: `${codename} — ${agentType} agent`,
            capabilities: [],
          })
          // Now spawn the Docker container
          const result = await agentsApi.spawn(agent.id)
          const now = new Date().toISOString()
          const newAgent: Agent = {
            id: agent.id,
            name: codename,
            description: agent.description || '',
            color: typeToColor(agentType),
            type: agentType,
            personality,
            status: result.ok ? 'running' : 'idle',
            codename,
            currentTask: result.ok ? 'Container started' : '',
            toolsCount: 0,
            findingsCount: 0,
            capabilities: agent.capabilities || [],
            containerId: result.container_id,
            tools: [],
            mcps: [],
            config: { model: 'claude-opus-4-6', temperature: 0.7, maxTokens: 4096 },
            createdAt: now,
            updatedAt: now,
          }
          set((state) => ({ agents: [...state.agents, newAgent] }))
        } catch (err) {
          console.error('[AgentStore] Spawn failed, creating local-only:', err)
          const now = new Date().toISOString()
          const newAgent: Agent = {
            id: `agent-${Date.now()}`,
            name: codename,
            description: '',
            color: typeToColor(agentType),
            type: agentType,
            personality,
            status: 'idle',
            codename,
            currentTask: '',
            toolsCount: 0,
            findingsCount: 0,
            capabilities: [],
            tools: [],
            mcps: [],
            config: { model: 'claude-opus-4-6', temperature: 0.7, maxTokens: 4096 },
            createdAt: now,
            updatedAt: now,
          }
          set((state) => ({ agents: [...state.agents, newAgent] }))
        }
      },

      spawnAgentById: async (agentId) => {
        try {
          const result = await agentsApi.spawn(agentId)
          if (result.ok) {
            set((state) => ({
              agents: state.agents.map((a) =>
                a.id === agentId ? { ...a, status: 'running' as const, containerId: result.container_id, currentTask: 'Container started' } : a
              ),
            }))
          }
        } catch (err) {
          console.error('[AgentStore] Spawn by ID failed:', err)
        }
      },

      stopAgent: async (agentId) => {
        try {
          await agentsApi.stop(agentId)
        } catch (err) {
          console.warn('[AgentStore] API stop failed, updating local:', err)
        }
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, status: 'stopped' as const, containerId: undefined, currentTask: '' } : a
          ),
        }))
      },

      getAgentHeartbeat: async (agentId) => {
        try {
          await agentsApi.heartbeat(agentId)
          set((state) => ({
            agents: state.agents.map((a) =>
              a.id === agentId ? { ...a, status: 'running' as const } : a
            ),
          }))
          return true
        } catch {
          return false
        }
      },

      handoffTask: async (fromAgentId, toAgentId, task) => {
        agentOrchestrator.handoffTask(fromAgentId, toAgentId, task)
        set((state) => ({
          agents: state.agents.map((a) => {
            if (a.id === fromAgentId) {
              return { ...a, status: 'handoff' as const, currentTask: `Handoff to ${toAgentId}` }
            } else if (a.id === toAgentId) {
              return { ...a, status: 'working' as const, currentTask: task }
            }
            return a
          }),
        }))
      },

      createAgentInDB: async (name, type, description, capabilities, config) => {
        try {
          const dbAgent = await agentsApi.create({ name, type, description, capabilities, config })
          const now = new Date().toISOString()
          const newAgent: Agent = {
            id: dbAgent.id,
            name: dbAgent.name,
            description: dbAgent.description || description,
            color: typeToColor(type),
            type,
            status: 'idle',
            codename: name,
            currentTask: '',
            toolsCount: capabilities.length,
            findingsCount: 0,
            capabilities: dbAgent.capabilities || capabilities,
            tools: [],
            mcps: [],
            config: config || { model: 'claude-opus-4-6', temperature: 0.5, maxTokens: 4096 },
            createdAt: now,
            updatedAt: now,
          }
          set((state) => ({ agents: [...state.agents, newAgent] }))
          return newAgent
        } catch (err) {
          console.error('[AgentStore] DB create failed:', err)
          return null
        }
      },

      cloneAgent: async (sourceId, newName) => {
        try {
          const cloned = await agentsApi.clone(sourceId, newName)
          const now = new Date().toISOString()
          // Find source agent's config to inherit
          const source = useAgentStore.getState().agents.find(a => a.id === sourceId)
          const newAgent: Agent = {
            id: cloned.id,
            name: cloned.name,
            description: cloned.description || '',
            color: typeToColor(cloned.type || 'custom'),
            type: cloned.type || 'custom',
            status: 'idle',
            codename: newName,
            currentTask: '',
            toolsCount: cloned.capabilities?.length || 0,
            findingsCount: 0,
            capabilities: cloned.capabilities || [],
            tools: [],
            mcps: [],
            config: source?.config || { model: 'claude-opus-4-6', temperature: 0.5, maxTokens: 4096 },
            createdAt: now,
            updatedAt: now,
          }
          set((state) => ({ agents: [...state.agents, newAgent] }))
          return newAgent
        } catch (err) {
          console.error('[AgentStore] Clone failed:', err)
          return null
        }
      },

      deleteAgentFromDB: async (id) => {
        try {
          await agentsApi.delete(id)
        } catch (err) {
          console.warn('[AgentStore] API delete failed:', err)
        }
        set((state) => ({ agents: state.agents.filter((a) => a.id !== id) }))
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
