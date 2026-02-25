import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Swords,
  Network,
  Play,
  Square,
  Plus,
  Trash2,
  Terminal,
  Database,
  FileText,
  Search,
  Cpu,
  Lock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Upload,
  Download,
  Code,
  Layers,
  Radio,
  Eye,
  Zap,
  BarChart3,
  X,
} from 'lucide-react'

// ---- Types ----

type C2Status = 'connected' | 'disconnected' | 'pending'
type SessionStatus = 'active' | 'dead' | 'sleeping'
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'
type PlaybookStatus = 'draft' | 'running' | 'completed' | 'paused'
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type TabId = 'c2' | 'socks' | 'playbooks' | 'neo4j' | 'parsers' | 'search' | 'analysis'

interface C2Server {
  id: string
  name: string
  type: 'mythic' | 'cobalt_strike' | 'sliver' | 'havoc' | 'custom'
  url: string
  status: C2Status
  sessions: number
  listeners: number
  connectedAt?: string
}

interface Session {
  id: string
  hostname: string
  username: string
  os: string
  arch: string
  pid: number
  ip: string
  c2Id: string
  status: SessionStatus
  lastCheckin: string
  integrity: 'high' | 'medium' | 'low'
  tags: string[]
}

interface SocksTask {
  id: string
  name: string
  command: string
  sessionId: string
  proxy: string
  status: TaskStatus
  output: string
  startedAt?: string
  completedAt?: string
}

interface PlaybookStep {
  id: string
  name: string
  command: string
  template?: string
  onSuccess?: string
  onFailure?: string
  timeout?: number
}

interface Playbook {
  id: string
  name: string
  description: string
  steps: PlaybookStep[]
  status: PlaybookStatus
  currentStep?: number
  tags: string[]
}

interface Neo4jQuery {
  id: string
  name: string
  query: string
  description: string
  category: string
}

interface ParsedFile {
  id: string
  filename: string
  type: string
  status: TaskStatus
  findings: number
  size: string
  uploadedAt: string
}

interface Finding {
  id: string
  type: string
  severity: Severity
  title: string
  detail: string
  source: string
  timestamp: string
}
interface LogParser {
  id: string
  name: string
  type: string
  config: Record<string, string>
  enabled: boolean
}

// ---- Initial empty state ----

const EMPTY_C2_SERVERS: C2Server[] = []
const EMPTY_SESSIONS: Session[] = []
const EMPTY_TASKS: SocksTask[] = []
const EMPTY_PLAYBOOKS: Playbook[] = []
const EMPTY_FINDINGS: Finding[] = []
const EMPTY_PARSERS: LogParser[] = []

const BUILTIN_QUERIES: Neo4jQuery[] = [
  {
    id: 'q-1',
    name: 'All Domain Admins',
    query: 'MATCH p=(u:User)-[:MemberOf*1..]->(g:Group {name: "DOMAIN ADMINS@DOMAIN.LOCAL"}) RETURN p',
    description: 'Find all domain admin users including nested group membership',
    category: 'AD Recon',
  },
  {
    id: 'q-2',
    name: 'Kerberoastable Accounts',
    query: 'MATCH (u:User {hasspn: true}) WHERE u.enabled=true RETURN u.name, u.serviceprincipalnames',
    description: 'Find enabled users with SPNs (Kerberoastable)',
    category: 'Credential Attack',
  },
  {
    id: 'q-3',
    name: 'AS-REP Roastable',
    query: 'MATCH (u:User {dontreqpreauth: true, enabled: true}) RETURN u.name',
    description: 'Find accounts not requiring Kerberos pre-authentication',
    category: 'Credential Attack',
  },
  {
    id: 'q-4',
    name: 'Shortest Path to DA',
    query: 'MATCH (u:User {name: "{user}@DOMAIN.LOCAL"}), (g:Group {name: "DOMAIN ADMINS@DOMAIN.LOCAL"}), p=shortestPath((u)-[*1..]->(g)) RETURN p',
    description: 'Find shortest attack path from user to Domain Admin',
    category: 'Attack Paths',
  },
  {
    id: 'q-5',
    name: 'Computers with Unconstrained Delegation',
    query: 'MATCH (c:Computer {unconstraineddelegation: true}) WHERE c.enabled=true RETURN c.name',
    description: 'Find computers with unconstrained Kerberos delegation',
    category: 'Privilege Escalation',
  },
  {
    id: 'q-6',
    name: 'Local Admin Rights',
    query: 'MATCH p=(u:User)-[:AdminTo]->(c:Computer) RETURN u.name, c.name',
    description: 'Find users with local admin rights on computers',
    category: 'Lateral Movement',
  },
]

const PLAYBOOK_TEMPLATES: Playbook[] = [
  {
    id: 'pb-1',
    name: 'Initial Access → Domain Admin',
    description: 'Full attack chain from initial foothold to domain admin',
    status: 'draft',
    tags: ['AD', 'privilege_escalation'],
    steps: [
      { id: 's1', name: 'Enumerate local users', command: 'net user', template: '' },
      { id: 's2', name: 'Check domain info', command: 'nltest /domain_trusts', template: '' },
      { id: 's3', name: 'Run BloodHound ingestor', command: 'SharpHound.exe -c All', template: '' },
      { id: 's4', name: 'Dump LSASS', command: 'mimikatz "sekurlsa::logonpasswords"', template: '' },
    ],
  },
  {
    id: 'pb-2',
    name: 'Kerberoasting Attack Chain',
    description: 'Enumerate SPNs, request tickets, crack offline',
    status: 'draft',
    tags: ['kerberoast', 'credential_access'],
    steps: [
      { id: 's1', name: 'Find Kerberoastable accounts', command: 'GetUserSPNs.py -request', template: '' },
      { id: 's2', name: 'Request service tickets', command: 'Rubeus.exe kerberoast /rc4opsec', template: '' },
      { id: 's3', name: 'Save tickets to file', command: 'echo {output} > tickets.txt', template: '' },
    ],
  },
  {
    id: 'pb-3',
    name: 'Lateral Movement via WMI',
    description: 'Execute commands on remote hosts via WMI',
    status: 'draft',
    tags: ['lateral_movement', 'wmi'],
    steps: [
      { id: 's1', name: 'WMI command execution', command: 'wmic /node:{target} process call create "{cmd}"', template: '{target}' },
      { id: 's2', name: 'Verify execution', command: 'wmic /node:{target} process list brief', template: '' },
    ],
  },
]

// ---- Helper components ----

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    connected: 'bg-green-500/20 text-green-400 border-green-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    dead: 'bg-red-500/20 text-red-400 border-red-500/30',
    disconnected: 'bg-red-500/20 text-red-400 border-red-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    sleeping: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    pending: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    running: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    paused: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
      {status}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = {
    critical: 'bg-red-600/20 text-red-300 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    info: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border uppercase ${colors[severity]}`}>
      {severity}
    </span>
  )
}

function C2TypeIcon({ type }: { type: C2Server['type'] }) {
  const labels: Record<C2Server['type'], string> = {
    mythic: 'MYT', cobalt_strike: 'CS', sliver: 'SLV', havoc: 'HVC', custom: 'CST',
  }
  return (
    <div className="w-8 h-8 rounded bg-red-600/20 border border-red-500/30 flex items-center justify-center">
      <span className="text-red-400 text-xs font-bold font-mono">{labels[type]}</span>
    </div>
  )
}

// ---- Tab components ----

function C2Tab({ servers, sessions, setServers, setSessions }: { servers: C2Server[]; sessions: Session[]; setServers: (s: C2Server[]) => void; setSessions: (s: Session[]) => void }) {
  const [showAddC2, setShowAddC2] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [newC2, setNewC2] = useState({ name: '', type: 'mythic' as C2Server['type'], url: '', apiKey: '' })

  const handleAddC2 = () => {
    const server: C2Server = {
      id: `c2-${Date.now()}`,
      name: newC2.name,
      type: newC2.type,
      url: newC2.url,
      status: 'pending',
      sessions: 0,
      listeners: 0,
    }
    setServers([...servers, server])
    setShowAddC2(false)
    setNewC2({ name: '', type: 'mythic', url: '', apiKey: '' })
  }

  const handleRemoveSession = (id: string) => {
    setSessions(sessions.filter(s => s.id !== id))
    if (selectedSession?.id === id) setSelectedSession(null)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* C2 Servers */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-400" />
            C2 Servers
          </h3>
          <button
            onClick={() => setShowAddC2(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add C2
          </button>
        </div>

        <div className="space-y-3">
          {servers.map(s => (
            <div key={s.id} className="bg-surface-light rounded-lg p-3 border border-border">
              <div className="flex items-center gap-3">
                <C2TypeIcon type={s.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{s.name}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <span className="text-text-secondary text-xs font-mono truncate block">{s.url}</span>
                </div>
                <div className="text-right text-xs text-text-secondary">
                  <div>{s.sessions} sessions</div>
                  <div>{s.listeners} listeners</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add C2 Modal */}
        <AnimatePresence>
          {showAddC2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
              onClick={() => setShowAddC2(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-border rounded-xl p-6 w-full max-w-md"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="font-semibold text-lg mb-4">Add C2 Server</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-text-secondary block mb-1">Name</label>
                    <input
                      value={newC2.name}
                      onChange={(e) => setNewC2({ ...newC2, name: e.target.value })}
                      className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm"
                      placeholder="My Mythic Server"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary block mb-1">Type</label>
                    <select
                      value={newC2.type}
                      onChange={(e) => setNewC2({ ...newC2, type: e.target.value as C2Server['type'] })}
                      className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="mythic">Mythic</option>
                      <option value="cobalt_strike">Cobalt Strike</option>
                      <option value="sliver">Sliver</option>
                      <option value="havoc">Havoc</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary block mb-1">URL</label>
                    <input
                      value={newC2.url}
                      onChange={(e) => setNewC2({ ...newC2, url: e.target.value })}
                      className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm font-mono"
                      placeholder="https://c2.internal:7443"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary block mb-1">API Key / Token</label>
                    <input
                      type="password"
                      value={newC2.apiKey}
                      onChange={(e) => setNewC2({ ...newC2, apiKey: e.target.value })}
                      className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowAddC2(false)} className="flex-1 py-2 bg-surface-light border border-border rounded-lg text-sm hover:bg-surface transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleAddC2}
                    disabled={!newC2.name || !newC2.url}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                  >
                    Connect
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active Sessions */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Terminal className="w-4 h-4 text-green-400" />
            Active Sessions
          </h3>
          <span className="text-xs text-text-secondary">{sessions.length} total</span>
        </div>

        <div className="space-y-2">
          {sessions.map(sess => (
            <motion.div
              key={sess.id}
              whileHover={{ scale: 1.005 }}
              className={`bg-surface-light rounded-lg p-3 border cursor-pointer transition-colors ${
                selectedSession?.id === sess.id ? 'border-red-500/50' : 'border-border hover:border-border-hover'
              }`}
              onClick={() => setSelectedSession(selectedSession?.id === sess.id ? null : sess)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  sess.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{sess.hostname}</span>
                    <span className="text-text-secondary text-xs">({sess.username})</span>
                    {sess.integrity === 'high' && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">SYSTEM</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                    <span>{sess.os}</span>
                    <span>•</span>
                    <span className="font-mono">{sess.ip}</span>
                    <span>•</span>
                    <span>PID {sess.pid}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={sess.status} />
                  <span className="text-xs text-text-secondary">
                    {Math.round((Date.now() - new Date(sess.lastCheckin).getTime()) / 1000)}s ago
                  </span>
                </div>
              </div>

              {/* Expanded session actions */}
              <AnimatePresence>
                {selectedSession?.id === sess.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-border flex gap-2 flex-wrap">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs hover:bg-indigo-600/30 transition-colors">
                        <Terminal className="w-3 h-3" />
                        Shell
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs hover:bg-surface-light transition-colors">
                        <Upload className="w-3 h-3" />
                        Upload
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs hover:bg-surface-light transition-colors">
                        <Download className="w-3 h-3" />
                        Download
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs hover:bg-surface-light transition-colors">
                        <Cpu className="w-3 h-3" />
                        Inject
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs hover:bg-surface-light transition-colors">
                        <Eye className="w-3 h-3" />
                        SOCKS
                      </button>
                      <button
                        onClick={() => handleRemoveSession(sess.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-xs hover:bg-red-600/30 transition-colors"
                      >
                        <Square className="w-3 h-3" />
                        Kill
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SocksTasksTab({ sessions, tasks, setTasks }: { sessions: Session[]; tasks: SocksTask[]; setTasks: (t: SocksTask[]) => void }) {
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', command: '', sessionId: sessions[0]?.id ?? '', proxy: '127.0.0.1:1080' })

  const addTask = () => {
    const t: SocksTask = {
      id: `task-${Date.now()}`,
      ...form,
      status: 'pending',
      output: '',
    }
    setTasks([...tasks, t])
    setShowNew(false)

    // Simulate running
    setTimeout(() => {
      const runningTasks = tasks.map(x => x.id === t.id ? { ...x, status: 'running' as const, startedAt: new Date().toISOString() } : x)
      setTasks(runningTasks)
      setTimeout(() => {
        const completedTasks = runningTasks.map(x => x.id === t.id ? {
          ...x,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
          output: `[*] Running ${t.name} via SOCKS proxy ${t.proxy}\n[+] Command executed successfully\n[+] Results captured`,
        } : x)
        setTasks(completedTasks)
      }, 3000)
    }, 500)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">SOCKS Task Execution</h3>
          <p className="text-sm text-text-secondary mt-0.5">Run security tools through SOCKS proxies via active sessions</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* Quick commands */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h4 className="text-sm font-medium mb-3 text-text-secondary">Quick Commands</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { name: 'Nmap via SOCKS', cmd: 'proxychains nmap -sT -Pn {target}' },
            { name: 'SMB Enum', cmd: 'proxychains enum4linux -a {target}' },
            { name: 'Kerberoast', cmd: 'proxychains GetUserSPNs.py {domain}/{user}:{pass}@{dc}' },
            { name: 'BloodHound', cmd: 'proxychains bloodhound-python -d {domain} -u {user} -p {pass}' },
            { name: 'Secretsdump', cmd: 'proxychains secretsdump.py {domain}/{user}:{pass}@{target}' },
            { name: 'WinRM Shell', cmd: 'proxychains evil-winrm -i {target} -u {user} -p {pass}' },
            { name: 'LDAP Dump', cmd: 'proxychains ldapdomaindump {dc} -u {domain}\\{user} -p {pass}' },
            { name: 'Pass-the-Hash', cmd: 'proxychains wmiexec.py -hashes :{hash} {domain}/{user}@{target}' },
          ].map(q => (
            <button
              key={q.name}
              onClick={() => {
                setForm(f => ({ ...f, name: q.name, command: q.cmd }))
                setShowNew(true)
              }}
              className="text-left p-2 bg-surface-light hover:bg-surface-lighter border border-border rounded-lg text-xs transition-colors"
            >
              <div className="font-medium text-text-primary">{q.name}</div>
              <div className="text-text-secondary font-mono mt-0.5 truncate">{q.cmd.substring(0, 35)}…</div>
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      {tasks.length === 0 && !showNew && (
        <div className="text-center py-12 text-text-secondary">
          <Network className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No SOCKS tasks yet. Create one to run tools via proxy.</p>
        </div>
      )}

      <div className="space-y-3">
        {tasks.map(t => (
          <div key={t.id} className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="font-medium">{t.name}</span>
                <StatusBadge status={t.status} />
              </div>
              <button
                onClick={() => setTasks(tasks.filter((x: SocksTask) => x.id !== t.id))}
                className="p-1.5 text-text-secondary hover:text-red-400 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="font-mono text-xs text-text-secondary bg-surface-light rounded-lg p-2 mb-2">{t.command}</div>
            <div className="flex gap-4 text-xs text-text-secondary">
              <span>Session: {sessions.find(s => s.id === t.sessionId)?.hostname ?? t.sessionId}</span>
              <span>Proxy: {t.proxy}</span>
            </div>
            {t.output && (
              <pre className="mt-3 text-xs font-mono text-green-400 bg-black/40 rounded-lg p-3 whitespace-pre-wrap">{t.output}</pre>
            )}
          </div>
        ))}
      </div>

      {/* New task modal */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setShowNew(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-border rounded-xl p-6 w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-semibold text-lg mb-4">New SOCKS Task</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-text-secondary block mb-1">Task Name</label>
                  <input
                    className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm"
                    placeholder="Nmap scan via proxy"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-text-secondary block mb-1">Session (SOCKS source)</label>
                  <select
                    className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm"
                    value={form.sessionId}
                    onChange={e => setForm(f => ({ ...f, sessionId: e.target.value }))}
                  >
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{s.hostname} ({s.ip})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-text-secondary block mb-1">SOCKS Proxy</label>
                  <input
                    className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm font-mono"
                    value={form.proxy}
                    onChange={e => setForm(f => ({ ...f, proxy: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-text-secondary block mb-1">Command</label>
                  <textarea
                    rows={3}
                    className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm font-mono resize-none"
                    placeholder="proxychains nmap -sT -Pn -p 80,443,445 192.168.1.0/24"
                    value={form.command}
                    onChange={e => setForm(f => ({ ...f, command: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowNew(false)} className="flex-1 py-2 bg-surface-light border border-border rounded-lg text-sm hover:bg-surface transition-colors">
                  Cancel
                </button>
                <button onClick={addTask} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" />
                  Run Task
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PlaybooksTab({ playbooks, setPlaybooks }: { playbooks: Playbook[]; setPlaybooks: (p: Playbook[]) => void }) {
  const [selected, setSelected] = useState<Playbook | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  const runPlaybook = (id: string) => {
    const runningPlaybooks = playbooks.map(p => p.id === id ? { ...p, status: 'running' as const, currentStep: 0 } : p)
    setPlaybooks(runningPlaybooks)
    // Simulate step execution
    let step = 0
    const interval = setInterval(() => {
      step++
      const updatedPlaybooks = runningPlaybooks.map(p => {
        if (p.id !== id) return p
        if (step >= p.steps.length) {
          clearInterval(interval)
          return { ...p, status: 'completed' as const, currentStep: p.steps.length }
        }
        return { ...p, currentStep: step }
      })
      setPlaybooks(updatedPlaybooks)
      if (step >= (playbooks.find(p => p.id === id)?.steps.length ?? 0)) clearInterval(interval)
    }, 2000)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Playbook list */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Playbooks
          </h3>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-lg text-sm transition-colors">
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        <div className="space-y-3">
          {playbooks.map(pb => (
            <div
              key={pb.id}
              className={`bg-surface-light rounded-lg p-3 border cursor-pointer transition-colors ${
                selected?.id === pb.id ? 'border-indigo-500/50' : 'border-border hover:border-border-hover'
              }`}
              onClick={() => setSelected(selected?.id === pb.id ? null : pb)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{pb.name}</span>
                    <StatusBadge status={pb.status} />
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">{pb.description}</p>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {pb.tags.map(t => (
                      <span key={t} className="text-xs bg-surface border border-border px-2 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-text-secondary">{pb.steps.length} steps</div>
              </div>

              {/* Progress bar if running */}
              {pb.status === 'running' && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-text-secondary mb-1">
                    <span>Step {(pb.currentStep ?? 0) + 1} / {pb.steps.length}</span>
                    <span>{Math.round(((pb.currentStep ?? 0) / pb.steps.length) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${((pb.currentStep ?? 0) / pb.steps.length) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                {pb.status === 'draft' && (
                  <button
                    onClick={e => { e.stopPropagation(); runPlaybook(pb.id) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 text-green-400 border border-green-500/30 rounded text-xs hover:bg-green-600/30 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    Run
                  </button>
                )}
                {pb.status === 'running' && (
                  <button
                    onClick={e => { e.stopPropagation(); setPlaybooks(playbooks.map((p: Playbook) => p.id === pb.id ? { ...p, status: 'paused' } : p)) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 rounded text-xs hover:bg-yellow-600/30 transition-colors"
                  >
                    <Square className="w-3 h-3" />
                    Pause
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step detail */}
      <div className="bg-surface rounded-xl border border-border p-4">
        {selected ? (
          <>
            <h3 className="font-semibold mb-4">{selected.name} — Steps</h3>
            <div className="space-y-2">
              {selected.steps.map((step, idx) => {
                const pb = playbooks.find(p => p.id === selected.id)
                const isActive = pb?.status === 'running' && pb.currentStep === idx
                const isDone = (pb?.currentStep ?? -1) > idx || pb?.status === 'completed'
                return (
                  <div
                    key={step.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      isActive ? 'border-indigo-500/50 bg-indigo-600/5' :
                      isDone ? 'border-green-500/30 bg-green-600/5' :
                      'border-border bg-surface-light'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isDone ? 'bg-green-500/20 text-green-400' :
                        isActive ? 'bg-indigo-500/20 text-indigo-400' :
                        'bg-surface text-text-secondary'
                      }`}>
                        {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : isActive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{step.name}</div>
                        <div className="font-mono text-xs text-text-secondary truncate mt-0.5">{step.command}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-text-secondary">
            <div className="text-center">
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a playbook to view steps</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Neo4jTab() {
  const [queries] = useState<Neo4jQuery[]>(BUILTIN_QUERIES)
  const [selected, setSelected] = useState<Neo4jQuery | null>(null)
  const [customQuery, setCustomQuery] = useState('')
  const [results, setResults] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')

  const categories = ['All', ...Array.from(new Set(queries.map(q => q.category)))]

  const filtered = activeCategory === 'All' ? queries : queries.filter(q => q.category === activeCategory)

  const runQuery = useCallback((q: string) => {
    setRunning(true)
    setResults('')
    setTimeout(() => {
      setResults(`// Query results for: ${q.substring(0, 60)}...\n\n{\n  "nodes": [],\n  "relationships": [],\n  "stats": {\n    "nodes_created": 0,\n    "relationships_created": 0,\n    "properties_set": 0\n  },\n  "message": "Connected to Neo4j — run query to see results"\n}`)
      setRunning(false)
    }, 1500)
  }, [])

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Query library */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-400" />
            Neo4j Query Library
          </h3>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                activeCategory === c
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                  : 'bg-surface-light text-text-secondary border border-border hover:text-text-primary'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map(q => (
            <div
              key={q.id}
              className={`bg-surface-light rounded-lg p-3 border cursor-pointer transition-colors ${
                selected?.id === q.id ? 'border-purple-500/50' : 'border-border hover:border-border-hover'
              }`}
              onClick={() => { setSelected(q); setCustomQuery(q.query) }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium text-sm">{q.name}</span>
                  <p className="text-xs text-text-secondary mt-0.5">{q.description}</p>
                </div>
                <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded flex-shrink-0">{q.category}</span>
              </div>
              <div className="font-mono text-xs text-text-secondary bg-black/20 rounded p-2 mt-2 truncate">
                {q.query.substring(0, 80)}…
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Query editor & results */}
      <div className="bg-surface rounded-xl border border-border p-4 flex flex-col gap-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Code className="w-4 h-4 text-purple-400" />
          Query Editor
        </h3>

        <textarea
          rows={6}
          className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm font-mono resize-none text-purple-300"
          placeholder="MATCH (n) RETURN n LIMIT 25"
          value={customQuery}
          onChange={e => setCustomQuery(e.target.value)}
        />

        <button
          onClick={() => runQuery(customQuery)}
          disabled={!customQuery || running}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
        >
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Running...' : 'Run Query'}
        </button>

        {results && (
          <div className="flex-1">
            <h4 className="text-sm font-medium mb-2 text-text-secondary">Results</h4>
            <pre className="text-xs font-mono text-green-400 bg-black/40 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">{results}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

function ParsersTab({ parsers, setParsers }: { parsers: LogParser[]; setParsers: (p: LogParser[]) => void }) {
  const [files, setFiles] = useState<ParsedFile[]>([])
  const [dragOver, setDragOver] = useState(false)

  const FILE_TYPES = [
    { ext: '.lsass.dmp', name: 'LSASS Dump', icon: '🔑', desc: 'Extract credentials from LSASS memory dumps' },
    { ext: '.dit', name: 'NTDS.dit', icon: '🗃️', desc: 'Active Directory database with all password hashes' },
    { ext: '.xml', name: 'BloodHound XML', icon: '🩸', desc: 'BloodHound domain data for graph analysis' },
    { ext: '.zip', name: 'BloodHound ZIP', icon: '🩸', desc: 'BloodHound JSON/ZIP export files' },
    { ext: '.pcap', name: 'PCAP/Network', icon: '📡', desc: 'Network capture for credential extraction' },
    { ext: '.evtx', name: 'Windows Events', icon: '📋', desc: 'Windows event log analysis for IOCs' },
    { ext: '.json', name: 'AD Snapshot', icon: '📸', desc: 'AD snapshot in JSON format' },
    { ext: '.txt', name: 'Hash File', icon: '🔐', desc: 'NTLM/NTHash password hash lists' },
  ]

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    droppedFiles.forEach(f => {
      const pf: ParsedFile = {
        id: `file-${Date.now()}-${Math.random()}`,
        filename: f.name,
        type: FILE_TYPES.find(t => f.name.toLowerCase().endsWith(t.ext))?.name ?? 'Unknown',
        status: 'running',
        findings: 0,
        size: (f.size / 1024).toFixed(1) + ' KB',
        uploadedAt: new Date().toISOString(),
      }
      setFiles(prev => [...prev, pf])
      setTimeout(() => {
        setFiles(prev => prev.map(x => x.id === pf.id ? {
          ...x,
          status: 'completed',
          findings: Math.floor(Math.random() * 50) + 1,
        } : x))
      }, 3000 + Math.random() * 2000)
    })
  }

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
          dragOver ? 'border-red-500/70 bg-red-500/5' : 'border-border hover:border-border-hover'
        }`}
      >
        <Upload className="w-10 h-10 mx-auto mb-3 text-text-secondary" />
        <p className="font-medium">Drop files here to parse</p>
        <p className="text-sm text-text-secondary mt-1">LSASS dumps, NTDS.dit, BloodHound data, PCAP, EVTX, hash lists</p>
        <button className="mt-4 px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-600/30 transition-colors">
          Browse Files
        </button>
      </div>

      {/* Supported formats */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="font-semibold mb-3">Supported File Formats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FILE_TYPES.map(t => (
            <div key={t.ext} className="bg-surface-light rounded-lg p-3 border border-border">
              <div className="text-2xl mb-1">{t.icon}</div>
              <div className="font-medium text-sm">{t.name}</div>
              <div className="text-xs text-text-secondary mt-0.5">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Parsed files */}
      {files.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold mb-3">Parsed Files</h3>
          <div className="space-y-2">
            {files.map(f => (
              <div key={f.id} className="flex items-center gap-4 bg-surface-light rounded-lg p-3 border border-border">
                <FileText className="w-5 h-5 text-text-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{f.filename}</span>
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="flex gap-3 text-xs text-text-secondary mt-0.5">
                    <span>{f.type}</span>
                    <span>{f.size}</span>
                  </div>
                </div>
                {f.status === 'completed' && (
                  <div className="text-sm font-medium text-green-400">{f.findings} findings</div>
                )}
                {f.status === 'running' && (
                  <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                )}
                <button
                  onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))}
                  className="p-1.5 text-text-secondary hover:text-red-400 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SearchTab() {
  const [query, setQuery] = useState('')
  const [results] = useState<Finding[]>([
    {
      id: 'f1', type: 'credential', severity: 'critical',
      title: 'Plaintext Domain Admin Password Found',
      detail: 'Domain admin credentials extracted from LSASS dump on WORKSTATION-01',
      source: 'LSASS Parser', timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'f2', type: 'vulnerability', severity: 'high',
      title: 'Kerberoastable Service Account: svc_sql',
      detail: 'SPN: MSSQLSvc/db01.domain.local:1433 — Account has never had password changed',
      source: 'Neo4j Query', timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'f3', type: 'recon', severity: 'medium',
      title: 'DC-PRIMARY: Unconstrained Delegation Enabled',
      detail: 'Domain controller has unconstrained Kerberos delegation — TGTs can be captured',
      source: 'BloodHound', timestamp: new Date(Date.now() - 10800000).toISOString(),
    },
  ])

  const filtered = query
    ? results.filter(r => r.title.toLowerCase().includes(query.toLowerCase()) || r.detail.toLowerCase().includes(query.toLowerCase()))
    : results

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
        <input
          className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-sm"
          placeholder="Search across all C2 data, findings, credentials, and intelligence..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {['credentials', 'vulnerabilities', 'domain_admins', 'kerberoastable', 'unconstrained_delegation', 'lsass'].map(tag => (
          <button
            key={tag}
            onClick={() => setQuery(tag.replace(/_/g, ' '))}
            className="px-3 py-1 bg-surface-light border border-border rounded-lg text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(f => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-xl border border-border p-4"
          >
            <div className="flex items-start gap-3">
              <SeverityBadge severity={f.severity} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{f.title}</div>
                <p className="text-sm text-text-secondary mt-1">{f.detail}</p>
                <div className="flex gap-3 mt-2 text-xs text-text-secondary">
                  <span>Source: {f.source}</span>
                  <span>•</span>
                  <span>{new Date(f.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-secondary">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No results for "{query}"</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AnalysisTab({ findings, setFindings }: { findings: Finding[]; setFindings: (f: Finding[]) => void }) {
  const [prompt, setPrompt] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)

  const analyze = () => {
    if (!prompt) return
    setAnalyzing(true)
    setAnalysis(null)
    setTimeout(() => {
      setAnalysis(`## AI Red Team Analysis

**Target:** ${prompt}

### Attack Surface Summary

Based on the gathered intelligence, here are the key attack paths:

**1. Kerberoasting → Lateral Movement**
- svc_sql has an SPN and weak password policy
- Crack ticket offline → reuse credentials for lateral movement
- Estimated success probability: **HIGH**

**2. Unconstrained Delegation → DCSync**
- DC-PRIMARY has unconstrained delegation
- If we compromise DC-PRIMARY, we can force other DCs to authenticate → capture TGTs
- Use captured TGT to perform DCSync attack
- Estimated success probability: **VERY HIGH**

**3. Domain Admin Reuse**
- Plaintext DA credentials in LSASS suggest password reuse
- Check for matching hashes across all domain computers
- Estimated success probability: **HIGH**

### Recommended Next Steps

1. \`Rubeus.exe kerberoast /rc4opsec /outfile:hashes.txt\`
2. \`hashcat -a 0 -m 13100 hashes.txt /usr/share/wordlists/rockyou.txt\`
3. If cracked: \`secretsdump.py domain/svc_sql:{pass}@dc01\`
4. DCSync: \`mimikatz "lsadump::dcsync /domain:domain.local /all"\`

### OPSEC Considerations

- Use RC4 OPSEC flag for Kerberoast to avoid AES downgrade detection
- Perform DCSync from non-DC machine to blend in
- Clean event logs after lateral movement: \`wevtutil cl Security\`
`)
      setAnalyzing(false)
    }, 3000)
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-yellow-400" />
          AI-Powered Attack Analysis
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          Describe your current engagement context and gathered intelligence. The AI will analyze attack paths,
          prioritize techniques, and suggest next steps.
        </p>
        <textarea
          rows={5}
          className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm resize-none"
          placeholder="e.g., 'Initial foothold on WORKSTATION-01 as domain user jdoe. Have LSASS dump, BloodHound data shows 3 Kerberoastable accounts. Target is domain admin on DC-PRIMARY...'"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={analyze}
            disabled={!prompt || analyzing}
            className="flex items-center gap-2 px-6 py-2.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-lg text-sm transition-colors"
          >
            {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {analyzing ? 'Analyzing...' : 'Analyze Attack Surface'}
          </button>
          <button
            onClick={() => setPrompt('Domain user on WORKSTATION-01. Have lsass dump with da creds. Bloodhound shows path to DA via kerberoasting svc_sql')}
            className="px-4 py-2.5 bg-surface-light border border-border rounded-lg text-sm hover:bg-surface transition-colors"
          >
            Use Example
          </button>
        </div>
      </div>

      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-xl border border-yellow-500/20 p-6"
          >
            <div className="flex items-center gap-2 mb-4 text-yellow-400">
              <Zap className="w-4 h-4" />
              <span className="font-medium">Analysis Complete</span>
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-text-primary font-sans">{analysis}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Main component ----

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: 'c2', label: 'C2 Sessions', icon: Radio },
  { id: 'socks', label: 'SOCKS Tasks', icon: Network },
  { id: 'playbooks', label: 'Playbooks', icon: Layers },
  { id: 'neo4j', label: 'Neo4j / Graph', icon: Database },
  { id: 'parsers', label: 'File Parsers', icon: FileText },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'analysis', label: 'AI Analysis', icon: Zap },
]

export default function RedTeam() {
  const [activeTab, setActiveTab] = useState<TabId>('c2')
  const [c2Servers, setC2Servers] = useState<C2Server[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [tasks, setTasks] = useState<SocksTask[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>(PLAYBOOK_TEMPLATES)
  const [findings, setFindings] = useState<Finding[]>([])
  const [parsers, setParsers] = useState<LogParser[]>([])

  // Actions
  const addC2Server = (server: C2Server) => setC2Servers([...c2Servers, server])
  const removeC2Server = (id: string) => setC2Servers(c2Servers.filter(s => s.id !== id))
  const updateC2Server = (id: string, updates: Partial<C2Server>) => {
    setC2Servers(c2Servers.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const addSession = (session: Session) => setSessions([...sessions, session])
  const removeSession = (id: string) => setSessions(sessions.filter(s => s.id !== id))

  const addTask = (task: SocksTask) => setTasks([...tasks, task])
  const updateTask = (id: string, updates: Partial<SocksTask>) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const addPlaybook = (playbook: Playbook) => setPlaybooks([...playbooks, playbook])
  const removePlaybook = (id: string) => setPlaybooks(playbooks.filter(p => p.id !== id))

  const addFinding = (finding: Finding) => setFindings([...findings, finding])
  const addParser = (parser: LogParser) => setParsers([...parsers, parser])

  const stats = [
    { label: 'Active Sessions', value: sessions.filter(s => s.status === 'active').length, icon: Terminal, color: 'text-green-400' },
    { label: 'C2 Servers', value: c2Servers.length, icon: Radio, color: 'text-red-400' },
    { label: 'Playbooks', value: playbooks.length, icon: Lock, color: 'text-yellow-400' },
    { label: 'Findings', value: findings.length, icon: AlertTriangle, color: 'text-red-400' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center">
            <Swords className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Red Team Operations</h1>
            <p className="text-text-secondary text-sm">C2 management, SOCKS tasks, playbooks & AI analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Engagement Active
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-light hover:bg-surface border border-border rounded-lg text-sm transition-colors">
            <BarChart3 className="w-4 h-4" />
            Report
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-surface rounded-xl border border-border p-4">
            <div className={`flex items-center gap-2 mb-1 ${s.color}`}>
              <s.icon className="w-4 h-4" />
              <span className="text-xs text-text-secondary">{s.label}</span>
            </div>
            <div className="text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-light border border-border rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'c2' && <C2Tab servers={c2Servers} sessions={sessions} setServers={setC2Servers} setSessions={setSessions} />}
          {activeTab === 'socks' && <SocksTasksTab sessions={sessions} tasks={tasks} setTasks={setTasks} />}
          {activeTab === 'playbooks' && <PlaybooksTab playbooks={playbooks} setPlaybooks={setPlaybooks} />}
          {activeTab === 'neo4j' && <Neo4jTab />}
          {activeTab === 'parsers' && <ParsersTab parsers={parsers} setParsers={setParsers} />}
          {activeTab === 'search' && <SearchTab />}
          {activeTab === 'analysis' && <AnalysisTab findings={findings} setFindings={setFindings} />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
