import { useEffect, useState, useCallback } from 'react'
import {
  Radio,
  Wifi,
  WifiOff,
  Mic,
  Volume2,
  Zap,
  Shield,
  Globe,
  Terminal,
  Activity,
  ChevronRight,
  RefreshCw,
  Send,
  Power,
  Eye,
  Cpu,
  Bot,
  FileText,
} from 'lucide-react'
import { apiClient } from '../../api/client'

// Obsidian Command tokens
const C = {
  bg: '#0a0a0f',
  surface: '#0d0d15',
  surfaceAlt: '#111119',
  border: '#1a1a2e',
  borderHover: '#2a2a4e',
  gold: '#f0c040',
  goldDim: '#f0c04060',
  green: '#22c55e',
  red: '#ef4444',
  cyan: '#06b6d4',
  purple: '#a855f7',
  muted: '#9ca3af',
  dim: '#374151',
  white: '#ffffff',
  font: 'JetBrains Mono, Fira Code, monospace',
}

interface OpenClawStatus {
  ok: boolean
  connected: boolean
  gateway: string
  last_ping: string
  agents_total: number
  agents_running: number
  skills_count: number
  events_received: number
  features: Record<string, boolean>
  endpoints: Record<string, string>
}

interface OpenClawSkill {
  id: string
  name: string
  description: string
  agent: string
  file: string
}

interface OpenClawEvent {
  id: string
  type: string
  source: string
  data: Record<string, unknown>
  timestamp: string
}

// Voice command examples for the reference panel
const VOICE_COMMANDS = [
  { cmd: 'Show me my swarm', desc: 'List all agents + status', agent: 'SYSTEM' },
  { cmd: 'PATHFINDER, scan hackerone.com', desc: 'Launch recon agent', agent: 'PATHFINDER' },
  { cmd: 'What did you find?', desc: 'Get latest findings', agent: 'SYSTEM' },
  { cmd: 'Test everything for SQLi', desc: 'Deploy BREACH on targets', agent: 'BREACH' },
  { cmd: 'PHANTOM, check AWS', desc: 'Cloud audit', agent: 'PHANTOM' },
  { cmd: 'Write up critical findings', desc: 'Generate report', agent: 'SCRIBE' },
  { cmd: 'Deploy full operation on target.com', desc: 'Multi-agent pipeline', agent: 'ALL' },
  { cmd: 'Clean up and standby', desc: 'Stop all agents', agent: 'SYSTEM' },
]

// Default channels — overridden by real status from backend
const DEFAULT_CHANNELS = [
  { name: 'Voice', icon: Mic, status: 'available', color: C.gold },
  { name: 'WebChat', icon: Terminal, status: 'connected', color: C.green },
  { name: 'Telegram', icon: Send, status: 'configurable', color: C.cyan },
  { name: 'Slack', icon: Globe, status: 'configurable', color: C.purple },
]

function agentColor(agent: string): string {
  const map: Record<string, string> = {
    PATHFINDER: '#3b82f6',
    BREACH: '#ef4444',
    PHANTOM: '#a855f7',
    SPECTER: '#06b6d4',
    CIPHER: '#f97316',
    SCRIBE: '#22c55e',
    COMMANDER: C.gold,
    SYSTEM: C.muted,
    ALL: C.gold,
  }
  return map[agent] || C.muted
}

interface ChannelStatus {
  name: string
  icon: React.ElementType
  status: string
  color: string
}

export default function OpenClaw() {
  const [status, setStatus] = useState<OpenClawStatus | null>(null)
  const [skills, setSkills] = useState<OpenClawSkill[]>([])
  const [events, setEvents] = useState<OpenClawEvent[]>([])
  const [channels, setChannels] = useState<ChannelStatus[]>(DEFAULT_CHANNELS)
  const [loading, setLoading] = useState(true)
  const [commandInput, setCommandInput] = useState('')
  const [commandResponse, setCommandResponse] = useState<unknown>(null)
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'events' | 'commands'>('overview')

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, skillsRes, eventsRes, channelsRes] = await Promise.allSettled([
        apiClient.get<unknown>('/api/openclaw/status'),
        apiClient.get<unknown>('/api/openclaw/skills'),
        apiClient.get<unknown>('/api/openclaw/events'),
        apiClient.get<unknown>('/api/channels'),
      ])

      if (statusRes.status === 'fulfilled') setStatus(statusRes.value)
      if (skillsRes.status === 'fulfilled') {
        const s = skillsRes.value
        setSkills(Array.isArray(s) ? s : Array.isArray(s?.skills) ? s.skills : [])
      }
      if (eventsRes.status === 'fulfilled') {
        const e = eventsRes.value
        setEvents(Array.isArray(e) ? e : Array.isArray(e?.events) ? e.events : [])
      }

      // Sync channel status from backend
      if (channelsRes.status === 'fulfilled') {
        const ch = channelsRes.value
        const realChannels: ChannelStatus[] = [
          { name: 'Voice', icon: Mic, status: 'available', color: C.gold },
          { name: 'WebChat', icon: Terminal, status: 'connected', color: C.green },
        ]
        if (ch?.discord) {
          realChannels.push({
            name: 'Discord',
            icon: Globe,
            status: ch.discord.enabled && ch.discord.hasToken ? 'connected' : ch.discord.enabled ? 'configured' : 'offline',
            color: '#5865F2',
          })
        }
        if (ch?.telegram) {
          realChannels.push({
            name: 'Telegram',
            icon: Send,
            status: ch.telegram.enabled && ch.telegram.hasToken ? 'connected' : ch.telegram.enabled ? 'configured' : 'offline',
            color: C.cyan,
          })
        }
        if (ch?.slack) {
          realChannels.push({
            name: 'Slack',
            icon: Globe,
            status: ch.slack.enabled && ch.slack.hasToken ? 'connected' : ch.slack.enabled ? 'configured' : 'offline',
            color: C.purple,
          })
        }
        setChannels(realChannels)
      }
    } catch {
      // Backend not reachable
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const timer = setInterval(fetchAll, 15000)
    return () => clearInterval(timer)
  }, [fetchAll])

  const sendCommand = async () => {
    if (!commandInput.trim() || sending) return
    setSending(true)
    setCommandResponse(null)
    try {
      const res = await apiClient.post<unknown>('/api/openclaw/command', {
        command: commandInput,
        channel: 'web',
      })
      setCommandResponse(res)
    } catch (err: unknown) {
      setCommandResponse({ error: err instanceof Error ? err.message : 'Command failed' })
    } finally {
      setSending(false)
    }
  }

  const connectGateway = async () => {
    try {
      const gatewayUrl = typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3007`
        : 'http://localhost:3007'
      await apiClient.post('/api/openclaw/connect', {
        gateway: gatewayUrl,
        version: '1.0.0',
      })
      fetchAll()
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.gold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: C.font, color: C.white, padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, background: `${C.gold}15`, border: `1px solid ${C.gold}40`,
            borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Radio size={20} style={{ color: C.gold }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', margin: 0 }}>
              OPENCLAW <span style={{ color: C.gold }}>MISSION CONTROL</span>
            </h1>
            <p style={{ fontSize: 10, color: C.muted, margin: 0, letterSpacing: '0.05em' }}>
              VOICE-COMMANDED AGENT ORCHESTRATION
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={fetchAll}
            style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2,
              color: C.muted, padding: '6px 12px', cursor: 'pointer', fontFamily: C.font,
              fontSize: 10, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={12} /> REFRESH
          </button>
          {!status?.connected && (
            <button
              onClick={connectGateway}
              style={{
                background: `${C.gold}20`, border: `1px solid ${C.gold}60`, borderRadius: 2,
                color: C.gold, padding: '6px 12px', cursor: 'pointer', fontFamily: C.font,
                fontSize: 10, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Power size={12} /> CONNECT GATEWAY
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20,
      }}>
        <StatusCard
          label="GATEWAY"
          value={status?.connected ? 'CONNECTED' : 'OFFLINE'}
          icon={status?.connected ? Wifi : WifiOff}
          color={status?.connected ? C.green : C.red}
        />
        <StatusCard label="AGENTS" value={`${status?.agents_running || 0}/${status?.agents_total || 0}`} icon={Bot} color={C.cyan} />
        <StatusCard label="SKILLS" value={String(status?.skills_count || skills.length || 0)} icon={Zap} color={C.gold} />
        <StatusCard label="EVENTS" value={String(status?.events_received || 0)} icon={Activity} color={C.purple} />
        <StatusCard label="CHANNELS" value={String(channels.length)} icon={Globe} color={C.green} />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        {(['overview', 'skills', 'events', 'commands'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'transparent', border: 'none', borderBottom: activeTab === tab ? `2px solid ${C.gold}` : '2px solid transparent',
              color: activeTab === tab ? C.gold : C.muted, padding: '10px 20px', cursor: 'pointer',
              fontFamily: C.font, fontSize: 11, fontWeight: activeTab === tab ? 700 : 400,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {/* Command Input */}
          <div style={{ ...panelStyle, gridColumn: '1 / 3' }}>
            <PanelHeader icon={Terminal} label="COMMAND TERMINAL" />
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
                  placeholder="Speak or type a command... (e.g. 'PATHFINDER, scan example.com')"
                  style={{
                    flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2,
                    color: C.white, padding: '10px 14px', fontFamily: C.font, fontSize: 12,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={sendCommand}
                  disabled={sending || !commandInput.trim()}
                  style={{
                    background: C.gold, border: 'none', borderRadius: 2,
                    color: C.bg, padding: '10px 16px', cursor: sending ? 'wait' : 'pointer',
                    fontFamily: C.font, fontSize: 11, fontWeight: 700, display: 'flex',
                    alignItems: 'center', gap: 6, opacity: sending ? 0.5 : 1,
                  }}
                >
                  <Send size={12} /> SEND
                </button>
              </div>
              {commandResponse && (
                <div style={{
                  marginTop: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2,
                  padding: 12, fontSize: 11, lineHeight: 1.6,
                }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: C.green, fontFamily: C.font }}>
                    {JSON.stringify(commandResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Channels */}
          <div style={panelStyle}>
            <PanelHeader icon={Globe} label="CHANNELS" />
            <div style={{ padding: 12 }}>
              {channels.map((ch) => {
                const statusColor = ch.status === 'connected' ? C.green : ch.status === 'available' ? C.green : ch.status === 'configured' ? C.gold : C.red
                return (
                  <div
                    key={ch.name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    <ch.icon size={14} style={{ color: ch.color }} />
                    <span style={{ fontSize: 11, flex: 1 }}>{ch.name}</span>
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 2,
                      background: `${statusColor}20`,
                      color: statusColor,
                      border: `1px solid ${statusColor}40`,
                    }}>
                      {ch.status.toUpperCase()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Architecture Diagram */}
          <div style={{ ...panelStyle, gridColumn: '1 / 3' }}>
            <PanelHeader icon={Cpu} label="ARCHITECTURE" />
            <div style={{ padding: 16 }}>
              <ArchitectureDiagram status={status} />
            </div>
          </div>

          {/* Voice Commands Reference */}
          <div style={panelStyle}>
            <PanelHeader icon={Mic} label="VOICE COMMANDS" />
            <div style={{ padding: 8, maxHeight: 320, overflowY: 'auto' }}>
              {VOICE_COMMANDS.map((vc, i) => (
                <button
                  key={i}
                  onClick={() => setCommandInput(vc.cmd)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
                    border: 'none', borderBottom: `1px solid ${C.border}`, padding: '8px 10px',
                    cursor: 'pointer', fontFamily: C.font,
                  }}
                >
                  <div style={{ fontSize: 11, color: C.white, marginBottom: 2 }}>
                    &quot;{vc.cmd}&quot;
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: C.muted }}>{vc.desc}</span>
                    <span style={{ fontSize: 8, color: agentColor(vc.agent), fontWeight: 700 }}>{vc.agent}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div style={{ ...panelStyle, gridColumn: '1 / -1' }}>
            <PanelHeader icon={Shield} label="CAPABILITIES" />
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {[
                { name: 'Voice Control', enabled: status?.features?.voice, icon: Volume2 },
                { name: 'Multi-Agent', enabled: status?.features?.multi_agent, icon: Bot },
                { name: 'Webhooks', enabled: status?.features?.webhooks, icon: Zap },
                { name: 'Skills Engine', enabled: status?.features?.skills, icon: FileText },
                { name: 'Orchestration', enabled: status?.features?.orchestration, icon: Activity },
              ].map((feat) => (
                <div
                  key={feat.name}
                  style={{
                    background: C.bg, border: `1px solid ${feat.enabled ? C.green : C.border}40`,
                    borderRadius: 2, padding: 12, textAlign: 'center',
                  }}
                >
                  <feat.icon size={20} style={{ color: feat.enabled ? C.green : C.dim, marginBottom: 6 }} />
                  <div style={{ fontSize: 10, color: feat.enabled ? C.white : C.muted }}>{feat.name}</div>
                  <div style={{
                    fontSize: 9, marginTop: 4, color: feat.enabled ? C.green : C.dim,
                    fontWeight: 700,
                  }}>
                    {feat.enabled ? 'ACTIVE' : 'AVAILABLE'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {skills.map((skill) => (
            <div key={skill.id} style={{ ...panelStyle, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Zap size={14} style={{ color: agentColor(skill.agent) }} />
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>
                  {skill.name.toUpperCase().replace(/-/g, ' ')}
                </span>
              </div>
              <p style={{ fontSize: 11, color: C.muted, margin: '0 0 10px', lineHeight: 1.5 }}>
                {skill.description}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 9, padding: '2px 8px', borderRadius: 2,
                  background: `${agentColor(skill.agent)}20`,
                  color: agentColor(skill.agent),
                  border: `1px solid ${agentColor(skill.agent)}40`,
                }}>
                  {skill.agent}
                </span>
                <span style={{ fontSize: 9, color: C.dim }}>{skill.file}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'events' && (
        <div style={panelStyle}>
          <PanelHeader icon={Activity} label="EVENT LOG" />
          <div style={{ padding: 12, maxHeight: 500, overflowY: 'auto' }}>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.dim }}>
                <Eye size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                <div style={{ fontSize: 11 }}>No events yet. Connect OpenClaw gateway to start receiving events.</div>
              </div>
            ) : (
              events.map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: evt.type.includes('critical') ? C.red : evt.type.includes('completed') ? C.green : C.gold,
                  }} />
                  <span style={{ fontSize: 11, flex: 1 }}>{evt.type}</span>
                  <span style={{ fontSize: 9, color: C.muted }}>{evt.source}</span>
                  <span style={{ fontSize: 9, color: C.dim }}>
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'commands' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* API Endpoints */}
          <div style={panelStyle}>
            <PanelHeader icon={Terminal} label="API ENDPOINTS" />
            <div style={{ padding: 12 }}>
              {status?.endpoints && Object.entries(status.endpoints).map(([key, path]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <ChevronRight size={10} style={{ color: C.gold }} />
                  <span style={{ fontSize: 11, color: C.gold, fontWeight: 700, width: 70 }}>
                    {key.toUpperCase()}
                  </span>
                  <code style={{ fontSize: 10, color: C.muted }}>{path}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Install Instructions */}
          <div style={panelStyle}>
            <PanelHeader icon={FileText} label="SETUP GUIDE" />
            <div style={{ padding: 16, fontSize: 11, lineHeight: 1.8 }}>
              <Step n={1} text="Install OpenClaw" code="curl -fsSL https://get.openclaw.ai | sh" />
              <Step n={2} text="Run the integration installer" code="bash openclaw/scripts/install.sh" />
              <Step n={3} text="Start Harbinger stack" code="docker-compose up -d" />
              <Step n={4} text="Start OpenClaw gateway" code="openclaw gateway start" />
              <Step n={5} text="Open mission control" code={typeof window !== 'undefined' ? `${window.location.origin}/openclaw` : '/openclaw'} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}

// ---- Sub-components ----

const panelStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 2,
}

function PanelHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
      borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.15em', color: C.muted,
    }}>
      <Icon size={12} style={{ color: C.gold }} />
      {label}
    </div>
  )
}

function StatusCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2,
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, background: `${color}15`, border: `1px solid ${color}30`,
        borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{value}</div>
      </div>
    </div>
  )
}

function Step({ n, text, code }: { n: number; text: string; code: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: C.white }}>
        <span style={{ color: C.gold, fontWeight: 700, marginRight: 8 }}>{n}.</span>
        {text}
      </div>
      <code style={{
        display: 'block', marginTop: 4, padding: '6px 10px', background: C.bg,
        border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 10, color: C.cyan,
      }}>
        {code}
      </code>
    </div>
  )
}

function ArchitectureDiagram({ status }: { status: OpenClawStatus | null }) {
  const connected = status?.connected
  const running = status?.agents_running || 0

  return (
    <div style={{ fontFamily: C.font, fontSize: 10, lineHeight: 2, color: C.muted }}>
      <pre style={{ margin: 0, whiteSpace: 'pre' }}>
{`    ┌─────────────────────────────────────────────────────┐
    │  YOU  (Voice / Text / Telegram / Slack / Discord)   │
    └────────────────────────┬────────────────────────────┘
                             │
    ┌────────────────────────▼────────────────────────────┐
    │  `}<span style={{ color: connected ? C.green : C.red, fontWeight: 700 }}>OPENCLAW GATEWAY</span>{`  ← ${connected ? 'CONNECTED' : 'OFFLINE'}                    │
    │  Node.js runtime + LLM router + voice pipeline     │
    └────────────────────────┬────────────────────────────┘
                             │
    ┌────────────────────────▼────────────────────────────┐
    │  `}<span style={{ color: C.gold, fontWeight: 700 }}>HARBINGER API</span>{`  ← :8080                              │
    │  Go backend + PostgreSQL + Redis + Neo4j           │
    └──┬─────┬─────┬─────┬─────┬─────┬───────────────────┘
       │     │     │     │     │     │
    `}<span style={{ color: '#3b82f6' }}>PATH</span>{`  `}<span style={{ color: '#ef4444' }}>BRCH</span>{`  `}<span style={{ color: '#a855f7' }}>PHTM</span>{`  `}<span style={{ color: '#06b6d4' }}>SPEC</span>{`  `}<span style={{ color: '#f97316' }}>CIPH</span>{`  `}<span style={{ color: '#22c55e' }}>SCRI</span>{`   ← `}<span style={{ color: running > 0 ? C.green : C.dim }}>{running} running</span>{`
    `}<span style={{ color: '#3b82f6' }}>Recon</span>{` `}<span style={{ color: '#ef4444' }}>Web </span>{`  `}<span style={{ color: '#a855f7' }}>Cloud</span>{` `}<span style={{ color: '#06b6d4' }}>OSINT</span>{` `}<span style={{ color: '#f97316' }}>BinRE</span>{` `}<span style={{ color: '#22c55e' }}>Rept</span>{`
       │     │     │     │     │     │
    ┌──▼─────▼─────▼─────▼─────▼─────▼───────────────────┐
    │  `}<span style={{ color: C.gold }}>Docker Containers</span>{`  — each agent = isolated runtime  │
    └─────────────────────────────────────────────────────┘`}
      </pre>
    </div>
  )
}
