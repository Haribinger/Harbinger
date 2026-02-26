import { create } from 'zustand'

export interface SkillRef {
  name: string
  path: string
}

export type SkillCategory =
  | 'recon' | 'web' | 'cloud' | 'osint' | 'reporting'
  | 'binary-re' | 'network' | 'mobile' | 'fuzzing'
  | 'crypto' | 'social-engineering' | 'bugbounty' | 'unknown'

export interface Skill {
  id: string
  name: string
  description: string
  agent: string
  agentDir: string
  scripts: string[]
  references: SkillRef[]
  enabled: boolean
  lastRun?: string
  category: SkillCategory
}

interface SkillsState {
  skills: Skill[]
  selectedSkill: Skill | null
  activeCategory: string
  searchQuery: string
  isLoading: boolean
  error: string | null

  setSkills: (skills: Skill[]) => void
  setSelectedSkill: (skill: Skill | null) => void
  setActiveCategory: (cat: string) => void
  setSearchQuery: (q: string) => void
  toggleSkill: (id: string) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  fetchSkills: () => Promise<void>
  filteredSkills: () => Skill[]
}

const AGENT_SKILL_MAP: Record<string, { agent: string; agentDir: string }> = {
  recon:               { agent: 'PATHFINDER', agentDir: 'recon-scout' },
  web:                 { agent: 'BREACH',     agentDir: 'web-hacker' },
  cloud:               { agent: 'PHANTOM',    agentDir: 'cloud-infiltrator' },
  osint:               { agent: 'SPECTER',    agentDir: 'osint-detective' },
  reporting:           { agent: 'SCRIBE',     agentDir: 'report-writer' },
  'binary-re':         { agent: 'CIPHER',     agentDir: 'binary-reverser' },
  network:             { agent: 'PHANTOM',    agentDir: 'cloud-infiltrator' },
  mobile:              { agent: 'BREACH',     agentDir: 'web-hacker' },
  fuzzing:             { agent: 'CIPHER',     agentDir: 'binary-reverser' },
  crypto:              { agent: 'CIPHER',     agentDir: 'binary-reverser' },
  'social-engineering':{ agent: 'SPECTER',    agentDir: 'osint-detective' },
  bugbounty:           { agent: 'BREACH',     agentDir: 'web-hacker' },
}

// Default skill catalog — serves as fallback when backend is unreachable
const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'recon', name: 'recon', category: 'recon',
    description: 'Subdomain enum, DNS resolution, HTTP probing, port scanning. Full attack surface mapping for PATHFINDER.',
    scripts: ['recon-full.sh'], references: [{ name: 'subdomain-enumeration.md', path: 'references/subdomain-enumeration.md' }, { name: 'port-scanning.md', path: 'references/port-scanning.md' }],
    enabled: true, ...AGENT_SKILL_MAP['recon'],
  },
  {
    id: 'web', name: 'web', category: 'web',
    description: 'XSS, SQLi, SSRF, API testing, nuclei, dalfox. Full web app exploitation for BREACH.',
    scripts: ['web-scan.sh'], references: [{ name: 'xss.md', path: 'references/xss.md' }, { name: 'sql-injection.md', path: 'references/sql-injection.md' }, { name: 'ssrf.md', path: 'references/ssrf.md' }, { name: 'api-testing.md', path: 'references/api-testing.md' }],
    enabled: true, ...AGENT_SKILL_MAP['web'],
  },
  {
    id: 'cloud', name: 'cloud', category: 'cloud',
    description: 'AWS/Azure/GCP auditing, IAM escalation, S3 enum, EC2 metadata. Cloud infiltration for PHANTOM.',
    scripts: ['cloud-audit.sh'], references: [{ name: 'aws-misconfig.md', path: 'references/aws-misconfig.md' }],
    enabled: true, ...AGENT_SKILL_MAP['cloud'],
  },
  {
    id: 'osint', name: 'osint', category: 'osint',
    description: 'Email enumeration, person lookup, breach checking, social footprinting for SPECTER.',
    scripts: ['osint-person.sh'], references: [{ name: 'email-enumeration.md', path: 'references/email-enumeration.md' }, { name: 'leak-check.md', path: 'references/leak-check.md' }],
    enabled: true, ...AGENT_SKILL_MAP['osint'],
  },
  {
    id: 'reporting', name: 'reporting', category: 'reporting',
    description: 'Vulnerability report structure, CVSS scoring, impact statements, HackerOne/Bugcrowd templates for SCRIBE.',
    scripts: ['generate-report.sh'], references: [{ name: 'writing-winning-reports.md', path: 'references/writing-winning-reports.md' }],
    enabled: true, ...AGENT_SKILL_MAP['reporting'],
  },
  {
    id: 'binary-re', name: 'binary-re', category: 'binary-re',
    description: 'Ghidra/radare2 static analysis, pwntools exploit dev, ROP chains, heap exploitation for CIPHER.',
    scripts: ['analyze-binary.sh'], references: [{ name: 'ghidra.md', path: 'references/ghidra.md' }, { name: 'exploit-patterns.md', path: 'references/exploit-patterns.md' }],
    enabled: true, ...AGENT_SKILL_MAP['binary-re'],
  },
  {
    id: 'network', name: 'network', category: 'network',
    description: 'Network pivoting, SOCKS tunneling, lateral movement, credential relay for PHANTOM.',
    scripts: ['network-pivot.sh'], references: [{ name: 'pivoting.md', path: 'references/pivoting.md' }, { name: 'lateral-movement.md', path: 'references/lateral-movement.md' }],
    enabled: false, ...AGENT_SKILL_MAP['network'],
  },
  {
    id: 'mobile', name: 'mobile', category: 'mobile',
    description: 'Android APK analysis, Frida instrumentation, SSL pinning bypass, iOS pentest for BREACH.',
    scripts: ['apk-recon.sh'], references: [{ name: 'android-vulns.md', path: 'references/android-vulns.md' }, { name: 'frida-scripts.md', path: 'references/frida-scripts.md' }],
    enabled: false, ...AGENT_SKILL_MAP['mobile'],
  },
  {
    id: 'fuzzing', name: 'fuzzing', category: 'fuzzing',
    description: 'AFL++ coverage-guided fuzzing, libFuzzer, ffuf web fuzzing, protocol fuzzing for CIPHER.',
    scripts: ['web-fuzz.sh'], references: [{ name: 'afl-guide.md', path: 'references/afl-guide.md' }, { name: 'web-fuzzing.md', path: 'references/web-fuzzing.md' }],
    enabled: false, ...AGENT_SKILL_MAP['fuzzing'],
  },
  {
    id: 'crypto', name: 'crypto', category: 'crypto',
    description: 'JWT attacks, TLS analysis, hash cracking, padding oracle, weak cipher detection for CIPHER.',
    scripts: ['tls-audit.sh'], references: [{ name: 'jwt-attacks.md', path: 'references/jwt-attacks.md' }, { name: 'tls-analysis.md', path: 'references/tls-analysis.md' }],
    enabled: false, ...AGENT_SKILL_MAP['crypto'],
  },
  {
    id: 'social-engineering', name: 'social-engineering', category: 'social-engineering',
    description: 'Phishing infra (GoPhish/evilginx2), DMARC analysis, pretexting for authorized red team ops. SPECTER.',
    scripts: ['email-auth-check.sh'], references: [{ name: 'phishing-infra.md', path: 'references/phishing-infra.md' }, { name: 'email-recon.md', path: 'references/email-recon.md' }],
    enabled: false, ...AGENT_SKILL_MAP['social-engineering'],
  },
  {
    id: 'bugbounty', name: 'bugbounty', category: 'bugbounty',
    description: 'End-to-end bug bounty ops — program discovery, scope analysis, dork generation, HackerOne submission for BREACH/SCRIBE.',
    scripts: [], references: [{ name: 'hackerone-guide.md', path: 'references/hackerone-guide.md' }, { name: 'google-dorks.md', path: 'references/google-dorks.md' }, { name: 'program-finder.md', path: 'references/program-finder.md' }],
    enabled: true, ...AGENT_SKILL_MAP['bugbounty'],
  },
]

export const useSkillsStore = create<SkillsState>()((set, get) => ({
  skills: DEFAULT_SKILLS,
  selectedSkill: null,
  activeCategory: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,

  setSkills: (skills) => set({ skills }),
  setSelectedSkill: (skill) => set({ selectedSkill: skill }),
  setActiveCategory: (cat) => set({ activeCategory: cat }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  toggleSkill: (id) =>
    set((state) => ({
      skills: state.skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    })),
  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),

  fetchSkills: async () => {
    const token = localStorage.getItem('harbinger-token')
    // No token → use local catalog silently (no point hitting API without auth)
    if (!token) {
      set({ error: null })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('/api/skills', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        // Auth issue — use local catalog without alarming the user
        set({ isLoading: false })
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const raw: Skill[] = Array.isArray(data) ? data : (Array.isArray(data?.skills) ? data.skills : [])
      if (raw.length > 0) {
        // Merge API data with enabled state from existing local data
        const existing = get().skills
        const merged = raw.map((s) => ({
          ...s,
          enabled: existing.find((e) => e.id === s.id)?.enabled ?? true,
        }))
        set({ skills: merged })
      }
      // If empty response, keep default skill catalog
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      set({ error: `skills API unavailable (${msg}) — showing local catalog` })
      // Keep default catalog on error
    } finally {
      set({ isLoading: false })
    }
  },

  filteredSkills: () => {
    const { skills, activeCategory, searchQuery } = get()
    return skills.filter((s) => {
      const matchCat = activeCategory === 'all' || s.category === activeCategory
      const q = searchQuery.toLowerCase()
      const matchSearch = !q || s.name.includes(q) || s.description.toLowerCase().includes(q) || s.agent.toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  },
}))
