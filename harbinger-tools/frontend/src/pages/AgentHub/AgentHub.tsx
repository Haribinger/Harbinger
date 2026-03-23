import { useEffect, useState, useCallback } from 'react'
import { useHubStore } from '../../store/hubStore'
import { hubApi, type ActiveAgent, type CatalogEntry, type TrustTier } from '../../api/hub'

// ── Design tokens ───────────────────────────────────────────────────────────

const TRUST_COLORS: Record<TrustTier, { bg: string; text: string; border: string; label: string }> = {
  builtin:    { bg: 'rgba(240,192,64,0.15)', text: '#f0c040', border: '#f0c040', label: 'BUILTIN' },
  verified:   { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: '#22c55e', label: 'VERIFIED' },
  community:  { bg: 'rgba(0,212,255,0.15)', text: '#00d4ff', border: '#00d4ff', label: 'COMMUNITY' },
  unknown:    { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', border: '#555', label: 'UNKNOWN' },
  restricted: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: '#ef4444', label: 'RESTRICTED' },
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#9ca3af', executing: '#22c55e', waiting: '#f0c040', error: '#ef4444', offline: '#555',
}

const INTEGRATION_BADGE: Record<string, { color: string; label: string }> = {
  builtin: { color: '#f0c040', label: 'BUILT-IN' },
  roar: { color: '#00d4ff', label: 'ROAR' },
  mcp: { color: '#a855f7', label: 'MCP' },
  docker: { color: '#22c55e', label: 'DOCKER' },
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function TrustBadge({ tier }: { tier: TrustTier }) {
  const t = TRUST_COLORS[tier] || TRUST_COLORS.unknown
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: t.bg, color: t.text }}>
      {t.label}
    </span>
  )
}

// ── Catalog Tab ─────────────────────────────────────────────────────────────

function CatalogTab({ catalog, onInstall, isLoading }: {
  catalog: CatalogEntry[]
  onInstall: (id: string) => void
  isLoading: boolean
}) {
  const [search, setSearch] = useState('')
  const [capFilter, setCapFilter] = useState('')

  const allCaps = [...new Set(catalog.flatMap(c => c.capabilities))].sort()
  const filtered = catalog.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.description.toLowerCase().includes(search.toLowerCase())) return false
    if (capFilter && !c.capabilities.includes(capFilter)) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search agents..." autoComplete="off" spellCheck={false}
          className="flex-1 bg-[#0a0a0f] border border-[#1a1a2e] text-white font-mono text-sm rounded px-3 py-1.5 placeholder:text-gray-700 focus:outline-none focus:border-[#f0c040]" />
        <select value={capFilter} onChange={e => setCapFilter(e.target.value)}
          className="bg-[#0a0a0f] border border-[#1a1a2e] text-gray-300 text-xs font-mono rounded px-2 py-1.5 w-40">
          <option value="">All capabilities</option>
          {allCaps.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Add Custom Agent */}
      <button
        onClick={() => {
          const name = prompt('Agent name:')
          const image = prompt('Docker image (e.g. ghcr.io/org/agent:latest):')
          if (name && image) {
            const caps = (prompt('Capabilities (comma-separated):') || '').split(',').map(s => s.trim()).filter(Boolean)
            const type = (prompt('Integration type (roar/mcp):') || 'roar') as 'roar' | 'mcp'
            hubApi.installCustom({ docker_image: image, name, capabilities: caps, integration_type: type })
          }
        }}
        className="w-full py-2 border border-dashed border-[#1a1a2e] rounded-lg text-xs font-mono text-gray-500 hover:text-[#f0c040] hover:border-[#f0c040]/30 transition-colors"
      >
        + Add Custom Agent
      </button>

      <div className="grid grid-cols-2 gap-3">
        {filtered.map(entry => {
          const ib = INTEGRATION_BADGE[entry.integration_type] || INTEGRATION_BADGE.docker
          return (
            <div key={entry.id} className="bg-[#0d0d15] border border-[#1a1a2e] rounded-xl p-4 hover:border-[#f0c040]/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white">{entry.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: ib.color, backgroundColor: `${ib.color}15` }}>{ib.label}</span>
                  <TrustBadge tier={entry.trust_tier} />
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2">{entry.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {entry.capabilities.slice(0, 3).map(cap => (
                    <span key={cap} className="text-[10px] font-mono text-gray-600 bg-[#1a1a2e] px-1.5 py-0.5 rounded">{cap}</span>
                  ))}
                </div>
                {entry.installed ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30">INSTALLED</span>
                ) : (
                  <button onClick={() => onInstall(entry.id)} disabled={isLoading}
                    className="text-[10px] font-mono px-3 py-1 rounded bg-[#f0c040]/10 text-[#f0c040] border border-[#f0c040]/30 hover:bg-[#f0c040]/20 transition-colors disabled:opacity-50">
                    INSTALL
                  </button>
                )}
              </div>
              <div className="text-[10px] text-gray-700 mt-2 font-mono">{entry.author} • {entry.repo ? 'GitHub' : 'Local'}</div>
            </div>
          )
        })}
        {filtered.length === 0 && <div className="col-span-2 text-center text-gray-600 font-mono text-sm py-8">No agents match your search</div>}
      </div>
    </div>
  )
}

// ── Active Agents Tab ───────────────────────────────────────────────────────

function ActiveTab({ agents, onKill, onSelect }: {
  agents: ActiveAgent[]
  onKill: (codename: string) => void
  onSelect: (codename: string) => void
}) {
  return (
    <div className="space-y-2">
      {agents.map(agent => {
        const trustBorder = TRUST_COLORS[agent.trust_tier]?.border || '#1a1a2e'
        return (
        <div key={agent.codename}
          className="bg-[#0d0d15] rounded-lg p-3 hover:brightness-110 transition-all cursor-pointer"
          style={{ borderWidth: 1, borderStyle: 'solid', borderColor: `${trustBorder}40`, borderLeftWidth: 3, borderLeftColor: trustBorder }}
          onClick={() => onSelect(agent.codename)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[agent.status] || '#555' }} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white">{agent.codename}</span>
                  <TrustBadge tier={agent.trust_tier} />
                  {agent.integration_type !== 'builtin' && (
                    <span className="text-[10px] font-mono px-1 rounded" style={{ color: INTEGRATION_BADGE[agent.integration_type]?.color || '#9ca3af' }}>
                      {agent.integration_type.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 font-mono">{agent.display_name}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-right">
                <div className="text-gray-400">{agent.status}</div>
                {agent.current_task && <div className="text-gray-600 truncate max-w-[200px]">{agent.current_task}</div>}
              </div>
              <div className="text-right text-gray-600">
                <div className="text-[#22c55e]">{agent.tasks_completed} done</div>
                {agent.tasks_failed > 0 && <div className="text-[#ef4444]">{agent.tasks_failed} failed</div>}
              </div>
              <div className="text-gray-600">score: <span className="text-[#f0c040]">{agent.trust_score}</span></div>
              {agent.integration_type !== 'builtin' && (
                <button onClick={(e) => { e.stopPropagation(); onKill(agent.codename) }}
                  className="text-[10px] px-2 py-0.5 rounded bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 hover:bg-[#ef4444]/20">
                  KILL
                </button>
              )}
            </div>
          </div>
        </div>
        )
      })}
      {agents.length === 0 && <div className="text-center text-gray-600 font-mono text-sm py-8">No agents active</div>}
    </div>
  )
}

// ── Feed Tab ────────────────────────────────────────────────────────────────

function FeedTab({ events }: { events: Array<{ id: string; type: string; from_agent: string; to_agent: string; intent: string; payload: Record<string, unknown>; timestamp: number }> }) {
  const [agentFilter, setAgentFilter] = useState('')

  const allAgents = [...new Set(events.flatMap(e => [e.from_agent, e.to_agent]))].filter(Boolean).sort()
  const filtered = agentFilter ? events.filter(e => e.from_agent === agentFilter || e.to_agent === agentFilter) : events

  const intentColors: Record<string, string> = {
    execute: '#f0c040', delegate: '#00d4ff', update: '#22c55e', ask: '#a855f7', respond: '#e0e0e0', notify: '#9ca3af',
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
          className="bg-[#0a0a0f] border border-[#1a1a2e] text-gray-300 text-xs font-mono rounded px-2 py-1 w-40">
          <option value="">All agents</option>
          {allAgents.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-xs text-gray-600 font-mono">{filtered.length} events</span>
      </div>

      <div className="space-y-1 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#1a1a2e]">
        {[...filtered].reverse().slice(0, 100).map(event => (
          <div key={event.id} className="text-xs font-mono py-1 px-2 hover:bg-[#1a1a2e]/30 rounded">
            <span className="text-gray-600 mr-2">{new Date(event.timestamp * 1000).toLocaleTimeString('en-US', { hour12: false })}</span>
            <span className="text-[#f0c040] mr-1">{event.from_agent}</span>
            <span className="mr-1" style={{ color: intentColors[event.intent] || '#9ca3af' }}>→ {event.intent} →</span>
            <span className="text-[#00d4ff]">{event.to_agent}</span>
            {event.payload?.task != null && <span className="text-gray-500 ml-2">{String(event.payload.task).slice(0, 60)}</span>}
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center text-gray-600 py-8">No inter-agent messages yet</div>}
      </div>
    </div>
  )
}

// ── Settings Tab ────────────────────────────────────────────────────────────

function SettingsTab({ agents }: { agents: ActiveAgent[] }) {
  return (
    <div className="space-y-3">
      <div className="bg-[#0d0d15] border border-[#1a1a2e] rounded-xl p-4">
        <h3 className="font-mono font-bold text-sm mb-3">Trust Configuration</h3>
        <div className="space-y-2">
          {agents.map(agent => (
            <div key={agent.codename} className="flex items-center justify-between py-2 px-3 border border-[#1a1a2e] rounded-lg">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white">{agent.codename}</span>
                <TrustBadge tier={agent.trust_tier} />
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-gray-500">score: {agent.trust_score}</span>
                <select defaultValue={agent.trust_tier}
                  className="bg-[#0a0a0f] border border-[#1a1a2e] text-gray-300 text-[10px] font-mono rounded px-1.5 py-0.5">
                  <option value="builtin">BUILTIN</option>
                  <option value="verified">VERIFIED</option>
                  <option value="community">COMMUNITY</option>
                  <option value="unknown">UNKNOWN</option>
                  <option value="restricted">RESTRICTED</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#0d0d15] border border-[#1a1a2e] rounded-xl p-4">
        <h3 className="font-mono font-bold text-sm mb-3">Auto-Approve Rules</h3>
        <p className="text-xs text-gray-500 mb-3">Configure which trust tiers can receive task delegations without operator approval.</p>
        <div className="space-y-2">
          {(['builtin', 'verified', 'community', 'unknown'] as TrustTier[]).map(tier => {
            const t = TRUST_COLORS[tier]
            return (
              <div key={tier} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: t.text }}>{t.label}</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[10px] text-gray-600 font-mono">auto-approve</span>
                  <input type="checkbox" defaultChecked={tier === 'builtin' || tier === 'verified'}
                    className="w-3.5 h-3.5 rounded bg-[#0a0a0f] border-[#1a1a2e] text-[#f0c040] focus:ring-[#f0c040] focus:ring-offset-0" />
                </label>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AgentHub() {
  const {
    overview, catalog, agents, feedEvents, activeTab, isLoading, error, commandResponse,
    fetchOverview, fetchCatalog, fetchAgents, installAgent, killAgent, sendCommand,
    setActiveTab, selectAgent, refresh,
  } = useHubStore()

  const [cmdInput, setCmdInput] = useState('')

  useEffect(() => { refresh() }, [refresh])

  const handleInstall = useCallback((id: string) => { installAgent(id) }, [installAgent])
  const handleKill = useCallback((codename: string) => { killAgent(codename) }, [killAgent])
  const handleSelect = useCallback((codename: string) => { selectAgent(codename) }, [selectAgent])

  const handleCommand = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (cmdInput.trim()) {
      sendCommand(cmdInput.trim())
      setCmdInput('')
    }
  }, [cmdInput, sendCommand])

  const tabs = [
    { id: 'catalog' as const, label: 'Catalog', count: catalog.length },
    { id: 'active' as const, label: 'Active', count: agents.length },
    { id: 'feed' as const, label: 'Feed', count: feedEvents.length },
    { id: 'settings' as const, label: 'Settings' },
  ]

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a2e]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-mono font-bold text-[#f0c040]">AGENT HUB</h1>
          <span className="text-xs text-gray-500 font-mono">Unified Agent Ecosystem</span>
        </div>
        {overview && (
          <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
            <span>{overview.total_agents} agents</span>
            <span className="text-[#22c55e]">{overview.online} online</span>
            <span className="text-[#f0c040]">{overview.executing} executing</span>
            <span className="text-[#a855f7]">{overview.mcp_tools} MCP</span>
            <button onClick={() => hubApi.syncRegistries().then(() => refresh())}
              className="text-gray-600 hover:text-[#f0c040] transition-colors" title="Sync ROAR ↔ Registry">
              ↻ sync
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#1a1a2e] bg-[#0d0d15]">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
              activeTab === tab.id
                ? 'bg-[#1a1a2e] text-[#f0c040] border border-[#f0c040]/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}>
            {tab.label}
            {tab.count != null && <span className="ml-1 text-gray-600">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-thumb-[#1a1a2e]">
        {activeTab === 'catalog' && <CatalogTab catalog={catalog} onInstall={handleInstall} isLoading={isLoading} />}
        {activeTab === 'active' && <ActiveTab agents={agents} onKill={handleKill} onSelect={handleSelect} />}
        {activeTab === 'feed' && <FeedTab events={feedEvents} />}
        {activeTab === 'settings' && <SettingsTab agents={agents} />}
      </div>

      {/* Command Bar */}
      <div className="border-t border-[#1a1a2e] bg-[#0d0d15]">
        {commandResponse != null && (
          <div className="px-4 py-1.5 text-xs font-mono text-gray-400 border-b border-[#1a1a2e]/50">
            {JSON.stringify(commandResponse).slice(0, 200)}
          </div>
        )}
        <form onSubmit={handleCommand} className="flex items-center px-4 py-2.5">
          <span className="text-[#f0c040] font-mono text-sm mr-2 select-none">harbinger&gt;</span>
          <input type="text" value={cmdInput} onChange={e => setCmdInput(e.target.value)}
            placeholder="Type a command... (e.g. scan example.com, status, agents list)"
            autoComplete="off" spellCheck={false}
            className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm placeholder:text-gray-700" />
          <button type="submit" className="px-3 py-1 text-xs font-mono bg-[#f0c040] text-black font-bold rounded hover:bg-[#f0c040]/90">
            SEND
          </button>
        </form>
      </div>

      {error && (
        <div className="absolute bottom-16 right-4 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-xs font-mono px-3 py-2 rounded max-w-sm">
          {error}
        </div>
      )}
    </div>
  )
}
