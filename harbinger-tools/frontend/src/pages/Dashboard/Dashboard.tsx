import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Bot,
  Container,
  Globe,
  Workflow,
  Target,
  Cpu,
  RefreshCw,
  Crosshair,
  Terminal,
  Shield,
  FileText,
  Zap,
  Radio,
  Database,
  GitBranch,
  Wrench,
} from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { useDockerStore } from '../../store/dockerStore'
import { useBrowserStore } from '../../store/browserStore'
import { useWorkflowStore } from '../../store/workflowStore'
import { useChannelStore } from '../../store/channelStore'
import { dashboardApi, type ActivityItem, type ServiceHealth } from '../../api/dashboard'

// Design tokens — Obsidian Command / REDCLAW aesthetic
const C = {
  bg: '#0a0a0f',
  surface: '#0d0d15',
  panel: '#0f0f1a',
  border: '#1a1a2e',
  gold: '#f0c040',
  danger: '#ef4444',
  success: '#22c55e',
  muted: '#9ca3af',
  dim: '#4b5563',
  white: '#ffffff',
}

const FONT = 'JetBrains Mono, Fira Code, monospace'

// Default roster icons by type — used for agents from DB
const TYPE_ICON: Record<string, typeof Crosshair> = {
  recon: Crosshair, web: Zap, cloud: Radio, osint: Target,
  binary: Terminal, report: FileText, network: Globe, mobile: Shield,
  api: Database, custom: Bot, maintainer: Wrench, default: Bot,
}

// Fallback when no agents in DB yet
const SEED_ROSTER = [
  { codename: 'PATHFINDER', role: 'RECON', color: '#3b82f6' },
  { codename: 'BREACH',     role: 'WEB',   color: '#ef4444' },
  { codename: 'PHANTOM',    role: 'CLOUD', color: '#a855f7' },
  { codename: 'SPECTER',    role: 'OSINT', color: '#22c55e' },
  { codename: 'CIPHER',     role: 'BIN/RE', color: '#f59e0b' },
  { codename: 'SCRIBE',     role: 'REPORT', color: '#f0c040' },
]

// Quick operations grid
const OPS = [
  { label: 'RECON SCAN',  desc: 'Launch PATHFINDER',  color: '#3b82f6', icon: Crosshair, route: '/skills' },
  { label: 'SPAWN AGENT', desc: 'Configure new agent', color: '#f0c040', icon: Bot,       route: '/agents' },
  { label: 'WEB ATTACK',  desc: 'BREACH target',       color: '#ef4444', icon: Zap,       route: '/redteam' },
  { label: 'OSINT SWEEP', desc: 'SPECTER intel run',   color: '#22c55e', icon: Target,    route: '/bounty-hub' },
  { label: 'DOCKER ENV',  desc: 'Spawn container',     color: '#a855f7', icon: Container, route: '/docker' },
  { label: 'WRITE REPORT', desc: 'SCRIBE debrief',     color: '#f59e0b', icon: FileText,  route: '/chat' },
]

// All monitored services
const SERVICE_LIST = [
  'Backend', 'PostgreSQL', 'Redis', 'Neo4j', 'HexStrike', 'PentAGI', 'MCP-UI', 'RedTeam',
]

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function Dashboard() {
  const navigate = useNavigate()
  const { agents } = useAgentStore()
  const { containers } = useDockerStore()
  const { sessions } = useBrowserStore()
  const { workflows } = useWorkflowStore()
  const { channels, fetchChannels } = useChannelStore()

  const [clock, setClock] = useState(formatTime())
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [health, setHealth] = useState<ServiceHealth[]>([])
  const [activityErr, setActivityErr] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(formatTime())

  // Build roster from DB agents, fallback to seed roster
  const agentRoster = agents.length > 0
    ? agents.slice(0, 12).map(a => ({
        codename: a.codename || a.name,
        role: (a.type || 'custom').toUpperCase(),
        color: a.color || '#f0c040',
        icon: TYPE_ICON[a.type || 'default'] || Bot,
        status: a.status,
        currentTask: a.currentTask,
      }))
    : SEED_ROSTER.map(s => ({
        ...s,
        icon: TYPE_ICON[s.role.toLowerCase()] || Bot,
        status: 'idle' as const,
        currentTask: '',
      }))

  // Active channels
  const activeChannels = Object.entries(channels).filter(([, c]) => c.enabled).map(([k]) => k)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(formatTime()), 1000)
    return () => clearInterval(t)
  }, [])

  const refresh = useCallback(async () => {
    await Promise.allSettled([
      dashboardApi.getActivity(12)
        .then(setActivity)
        .catch(() => setActivityErr(true)),
      dashboardApi.getServiceHealth()
        .then(setHealth)
        .catch(() => { /* service health check is non-critical — dashboard degrades gracefully */ }),
      fetchChannels(),
    ])
    setLastRefresh(formatTime())
  }, [fetchChannels])

  // Fetch on mount, then every 30s
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30_000)
    return () => clearInterval(t)
  }, [refresh])

  // Derived stats
  const activeAgents   = agents.filter((a) => a.status === 'online' || a.status === 'heartbeat' || a.status === 'working').length
  const runningScans   = containers.filter((c) => c.status === 'running').length
  const activeSessions = sessions.filter((s) => s.status === 'active').length
  const liveWorkflows  = workflows.filter((w) => w.status === 'running').length

  // Map activity type → color
  const actColor = (type: string) =>
    type === 'docker'  ? C.success :
    type === 'agent'   ? '#3b82f6'  :
    type === 'scan'    ? C.gold     :
    type === 'finding' ? C.danger   : C.muted

  // Map service status → color
  const svcColor = (svc: ServiceHealth | undefined) =>
    !svc                        ? C.dim     :
    svc.status === 'connected'  ? C.success :
    svc.status === 'error'      ? C.danger  : '#f59e0b'

  const svcLabel = (svc: ServiceHealth | undefined) =>
    !svc                        ? 'UNKNOWN' :
    svc.status === 'connected'  ? (svc.latency != null ? `${svc.latency}ms` : 'OK') :
    svc.status === 'error'      ? 'ERROR'   : svc.status.toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ background: C.bg, fontFamily: FONT, minHeight: '100%' }}
      className="p-4 space-y-3"
    >
      {/* ── TOP STATUS BAR ── */}
      <div
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
        className="flex items-center justify-between px-4 py-2"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Cpu size={14} style={{ color: C.gold }} />
            <span style={{ color: C.gold, fontSize: '11px', letterSpacing: '0.2em', fontWeight: 700 }}>
              HARBINGER COMMAND CENTER
            </span>
            <span style={{ color: C.dim, fontSize: '10px' }}>// v1.0.0</span>
          </div>
          <div style={{ width: '1px', height: '14px', background: C.border }} />
          <div className="flex items-center gap-1">
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.success, display: 'inline-block' }}
              className="animate-pulse" />
            <span style={{ color: C.success, fontSize: '10px', letterSpacing: '0.1em' }}>ONLINE</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {[
            { label: 'AGENTS', val: `${agents.length || agentRoster.length}` },
            { label: 'ACTIVE SCANS', val: `${runningScans}` },
            { label: 'CHANNELS', val: `${activeChannels.length}` },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span style={{ color: C.dim, fontSize: '10px', letterSpacing: '0.1em' }}>{s.label}</span>
              <span style={{ color: C.gold, fontSize: '12px', fontWeight: 700 }}>{s.val}</span>
            </div>
          ))}
          <div style={{ color: C.muted, fontSize: '11px', fontFamily: FONT }}>{clock}</div>
        </div>
      </div>

      {/* ── AGENT ROSTER — Dynamic ── */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
          <div style={{ color: C.dim, fontSize: '9px', letterSpacing: '0.2em' }}>
            AGENT ROSTER — {agentRoster.length} AGENTS
          </div>
          <div className="flex items-center gap-3">
            {activeChannels.map(ch => (
              <div key={ch} className="flex items-center gap-1">
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.success, display: 'inline-block' }} className="animate-pulse" />
                <span style={{ color: C.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{ch}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${Math.min(agentRoster.length, 6)}, 1fr)` }}>
          {agentRoster.map((a) => {
            const online = a.status === 'online' || a.status === 'heartbeat' || a.status === 'working' || a.status === 'running'
            const Icon = a.icon
            return (
              <motion.button
                key={a.codename}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/agents')}
                style={{
                  background: C.panel,
                  border: `1px solid ${online ? a.color + '60' : C.border}`,
                  borderTop: `2px solid ${a.color}`,
                  padding: '10px 8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <Icon size={12} style={{ color: a.color }} />
                  <span
                    style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: online ? C.success : C.dim,
                      display: 'inline-block',
                    }}
                    className={online ? 'animate-pulse' : ''}
                  />
                </div>
                <div style={{ color: a.color, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em' }}>
                  {a.codename}
                </div>
                <div style={{ color: C.dim, fontSize: '9px', marginTop: '2px' }}>{a.role}</div>
                <div style={{ color: online ? C.success : C.dim, fontSize: '9px', marginTop: '4px' }}>
                  {online ? (a.currentTask || 'ACTIVE') : 'IDLE'}
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'ACTIVE AGENTS',    val: activeAgents,   icon: Bot,       color: '#3b82f6', route: '/agents' },
          { label: 'RUNNING SCANS',    val: runningScans,   icon: Container, color: '#22c55e', route: '/docker' },
          { label: 'BROWSER SESSIONS', val: activeSessions, icon: Globe,     color: '#a855f7', route: '/browsers' },
          { label: 'LIVE WORKFLOWS',   val: liveWorkflows,  icon: Workflow,  color: '#f59e0b', route: '/workflows' },
        ].map((s) => (
          <motion.button
            key={s.label}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => navigate(s.route)}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              padding: '14px 16px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: C.dim, fontSize: '9px', letterSpacing: '0.15em' }}>{s.label}</span>
              <s.icon size={12} style={{ color: s.color }} />
            </div>
            <div style={{ color: s.color, fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>
              {s.val.toString().padStart(2, '0')}
            </div>
            <div style={{ color: C.dim, fontSize: '9px', marginTop: '6px' }}>CLICK TO VIEW →</div>
          </motion.button>
        ))}
      </div>

      {/* ── 3-COLUMN GRID ── */}
      <div className="grid grid-cols-3 gap-3" style={{ minHeight: '280px' }}>

        {/* Left: Activity Feed */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div
            style={{ borderBottom: `1px solid ${C.border}`, padding: '8px 12px' }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Activity size={11} style={{ color: C.gold }} />
              <span style={{ color: C.gold, fontSize: '10px', letterSpacing: '0.15em', fontWeight: 700 }}>
                ACTIVITY FEED
              </span>
            </div>
            <button
              onClick={refresh}
              style={{ color: C.dim, background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
              title="Refresh"
            >
              <RefreshCw size={10} />
            </button>
          </div>
          <div style={{ padding: '8px 12px', fontFamily: FONT, fontSize: '10px', overflowY: 'auto', maxHeight: '240px' }}>
            {activityErr || activity.length === 0 ? (
              <div style={{ color: C.dim }}>
                <div style={{ color: C.gold }}>{'>'} NO ACTIVITY YET</div>
                <div style={{ marginTop: '6px' }}>{'>'} START STACK:</div>
                <div style={{ color: C.success, marginTop: '2px', paddingLeft: '10px' }}>
                  docker compose up -d
                </div>
                <div style={{ color: C.dim, marginTop: '12px', fontSize: '9px' }}>
                  LAST CHECK: {lastRefresh}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-start gap-2">
                    <span style={{ color: C.dim, flexShrink: 0 }}>[{a.timestamp}]</span>
                    <span
                      style={{
                        color: actColor(a.type),
                        flexShrink: 0,
                        textTransform: 'uppercase',
                        fontWeight: 700,
                      }}
                    >
                      [{a.type}]
                    </span>
                    <span style={{ color: C.muted }}>{a.action}: {a.target}</span>
                  </div>
                ))}
                <div style={{ color: C.dim, fontSize: '9px', marginTop: '8px', borderTop: `1px solid ${C.border}`, paddingTop: '6px' }}>
                  LAST REFRESH: {lastRefresh}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Quick Operations */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: '8px 12px' }}>
            <div className="flex items-center gap-2">
              <Zap size={11} style={{ color: C.gold }} />
              <span style={{ color: C.gold, fontSize: '10px', letterSpacing: '0.15em', fontWeight: 700 }}>
                QUICK OPS
              </span>
            </div>
          </div>
          <div style={{ padding: '10px' }} className="grid grid-cols-2 gap-2">
            {OPS.map((op) => (
              <motion.button
                key={op.label}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(op.route)}
                style={{
                  background: C.panel,
                  border: `1px solid ${op.color}40`,
                  padding: '10px 8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <op.icon size={12} style={{ color: op.color, marginBottom: '6px' }} />
                <div style={{ color: op.color, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em' }}>
                  {op.label}
                </div>
                <div style={{ color: C.dim, fontSize: '9px', marginTop: '2px' }}>{op.desc}</div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Right: Service Health */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: '8px 12px' }}>
            <div className="flex items-center gap-2">
              <Database size={11} style={{ color: C.gold }} />
              <span style={{ color: C.gold, fontSize: '10px', letterSpacing: '0.15em', fontWeight: 700 }}>
                SERVICE HEALTH
              </span>
            </div>
          </div>
          <div style={{ padding: '8px 12px', fontSize: '10px' }} className="space-y-2">
            {SERVICE_LIST.map((name) => {
              const svc = health.find((h) => h.name === name)
              const col = svcColor(svc)
              const lbl = svcLabel(svc)
              return (
                <div key={name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: col, display: 'inline-block', flexShrink: 0,
                      }}
                      className={svc?.status === 'connected' ? 'animate-pulse' : ''}
                    />
                    <span style={{ color: C.muted, fontFamily: FONT }}>{name}</span>
                  </div>
                  <span style={{ color: col, fontFamily: FONT }}>{lbl}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── BOTTOM: Bounty Hub Strip ── */}
      <div
        style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '12px 16px' }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Shield size={12} style={{ color: C.gold }} />
            <span style={{ color: C.gold, fontSize: '10px', letterSpacing: '0.2em', fontWeight: 700 }}>
              BOUNTY HUB
            </span>
          </div>
          {[
            { platform: 'HackerOne',  color: '#ef4444' },
            { platform: 'Bugcrowd',   color: '#f59e0b' },
            { platform: 'Intigriti',  color: '#3b82f6' },
            { platform: 'YesWeHack', color: '#22c55e' },
          ].map((p) => (
            <div key={p.platform} className="flex items-center gap-1.5">
              <span style={{ color: p.color, fontSize: '9px' }}>●</span>
              <span style={{ color: C.muted, fontSize: '9px' }}>{p.platform}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <GitBranch size={11} style={{ color: C.dim }} />
            <span style={{ color: C.dim, fontSize: '9px' }}>arkadiyt/bounty-targets-data</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/bounty-hub')}
            style={{
              background: 'transparent',
              border: `1px solid ${C.gold}`,
              color: C.gold,
              padding: '5px 14px',
              fontSize: '10px',
              letterSpacing: '0.15em',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            SYNC PROGRAMS
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

export default Dashboard
