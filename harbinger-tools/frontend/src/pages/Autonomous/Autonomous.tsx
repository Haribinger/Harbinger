import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Brain,
  RefreshCw,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  Bot,
  Cpu,
  Lightbulb,
  TrendingUp,
  Eye,
  Wrench,
  Code,
  Workflow,
  FileCode,
  Trash2,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAutonomousStore } from '../../store/autonomousStore'
import type { AgentThought } from '../../api/autonomous'

const FONT = 'JetBrains Mono, Fira Code, monospace'

// Color map for thought types
const TYPE_COLORS: Record<string, string> = {
  observation: '#3b82f6',
  enhancement: '#f0c040',
  proposal: '#22c55e',
  alert: '#ef4444',
}

const CATEGORY_COLORS: Record<string, string> = {
  performance: '#8b5cf6',
  accuracy: '#3b82f6',
  cost: '#f59e0b',
  automation: '#22c55e',
  collaboration: '#06b6d4',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
  implemented: '#3b82f6',
}

const AUTOMATION_ICONS: Record<string, React.ReactNode> = {
  script: <FileCode size={12} />,
  skill: <Wrench size={12} />,
  workflow: <Workflow size={12} />,
  code_change: <Code size={12} />,
}

function Autonomous() {
  const {
    thoughts, swarm, stats, isLoading, error,
    selectedAgent, selectedType, selectedStatus,
    setFilter, refresh, approveThought, rejectThought, implementThought, deleteThought,
  } = useAutonomousStore()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh() }, [])

  // Group thoughts by time for chart
  const thoughtsOverTime = thoughts.reduce<Record<string, number>>((acc, t) => {
    const date = new Date(t.created_at * 1000).toISOString().slice(0, 10)
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {})
  const timeData = Object.entries(thoughtsOverTime)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  // Efficiency by agent for chart
  const effByAgent = Object.entries(stats?.thoughts_by_agent || {}).map(([name, count]) => ({
    name: name.length > 12 ? name.slice(0, 12) : name,
    count,
  }))

  // Separate thoughts into categories
  const _pendingThoughts = thoughts.filter(t => t.status === 'pending')
  const proposals = thoughts.filter(t => t.type === 'proposal')

  // Unique agent names for filter
  const agentNames = [...new Set(thoughts.map(t => t.agent_name).filter(Boolean))]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6 min-h-full"
      style={{ fontFamily: FONT }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: '#f0c040' }}>
            <Brain size={20} />
            AUTONOMOUS INTELLIGENCE
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Agent thinking loops, swarm awareness, efficiency tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filters */}
          <FilterSelect
            value={selectedAgent}
            onChange={(v) => setFilter('selectedAgent', v)}
            options={[{ value: '', label: 'All Agents' }, ...agentNames.map(n => ({ value: n, label: n }))]}
          />
          <FilterSelect
            value={selectedType}
            onChange={(v) => setFilter('selectedType', v)}
            options={[
              { value: '', label: 'All Types' },
              { value: 'observation', label: 'Observation' },
              { value: 'enhancement', label: 'Enhancement' },
              { value: 'proposal', label: 'Proposal' },
              { value: 'alert', label: 'Alert' },
            ]}
          />
          <FilterSelect
            value={selectedStatus}
            onChange={(v) => setFilter('selectedStatus', v)}
            options={[
              { value: '', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'implemented', label: 'Implemented' },
            ]}
          />
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded transition-colors"
            style={{ background: '#0d0d15', border: '1px solid #1a1a2e', color: '#9ca3af' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs p-2 rounded" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
          {error}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="ACTIVE THOUGHTS"
          value={stats?.active_thoughts ?? 0}
          icon={<Eye size={16} />}
          color="#3b82f6"
        />
        <MetricCard
          label="PENDING PROPOSALS"
          value={stats?.pending_proposals ?? 0}
          icon={<Lightbulb size={16} />}
          color="#f59e0b"
        />
        <MetricCard
          label="AVG EFFICIENCY"
          value={stats?.avg_efficiency ? `${stats.avg_efficiency.toFixed(1)}x` : '0x'}
          icon={<TrendingUp size={16} />}
          color="#22c55e"
        />
        <MetricCard
          label="IMPLEMENTED"
          value={stats?.implemented_count ?? 0}
          icon={<CheckCircle size={16} />}
          color="#f0c040"
        />
      </div>

      {/* 3-column grid: Swarm Overview / Thought Log / Enhancement Proposals */}
      <div className="grid grid-cols-3 gap-4">
        {/* Swarm Overview */}
        <div className="rounded-lg p-4" style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}>
          <h3 className="text-xs font-bold tracking-wider mb-3 flex items-center gap-2" style={{ color: '#9ca3af' }}>
            <Cpu size={12} /> SWARM OVERVIEW
          </h3>
          {swarm ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs mb-3">
                <span style={{ color: '#9ca3af' }}>System Health</span>
                <span
                  className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider"
                  style={{
                    background: swarm.system_health === 'healthy' ? '#22c55e20' : swarm.system_health === 'degraded' ? '#f59e0b20' : '#ef444420',
                    color: swarm.system_health === 'healthy' ? '#22c55e' : swarm.system_health === 'degraded' ? '#f59e0b' : '#ef4444',
                  }}
                >
                  {swarm.system_health}
                </span>
              </div>
              {swarm.agents.length > 0 ? swarm.agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-2 rounded"
                  style={{ background: '#0a0a0f', border: '1px solid #1a1a2e' }}
                >
                  <div className="flex items-center gap-2">
                    <Bot size={12} style={{ color: '#f0c040' }} />
                    <span className="text-xs" style={{ color: '#e5e7eb' }}>{agent.name || agent.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px]" style={{ color: '#666' }}>{agent.thought_count}t</span>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: agent.status === 'running' || agent.status === 'working' ? '#22c55e' : '#374151' }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-xs text-center py-4" style={{ color: '#666' }}>No agents in swarm</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-center py-4" style={{ color: '#666' }}>Loading swarm state...</p>
          )}
        </div>

        {/* Thought Log */}
        <div className="rounded-lg p-4" style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}>
          <h3 className="text-xs font-bold tracking-wider mb-3 flex items-center gap-2" style={{ color: '#9ca3af' }}>
            <Brain size={12} /> THOUGHT LOG
          </h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a2e #0d0d15' }}>
            {thoughts.length > 0 ? thoughts.slice(0, 20).map((t) => (
              <ThoughtCard key={t.id} thought={t} onApprove={approveThought} onReject={rejectThought} onDelete={deleteThought} />
            )) : (
              <EmptyState icon={<Brain size={32} />} message="No thoughts recorded yet" sub="Agents will generate thoughts when their autonomous engine is running." />
            )}
          </div>
        </div>

        {/* Enhancement Proposals */}
        <div className="rounded-lg p-4" style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}>
          <h3 className="text-xs font-bold tracking-wider mb-3 flex items-center gap-2" style={{ color: '#9ca3af' }}>
            <Lightbulb size={12} /> ENHANCEMENT PROPOSALS
          </h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a2e #0d0d15' }}>
            {proposals.length > 0 ? proposals.slice(0, 15).map((p) => (
              <ProposalCard key={p.id} thought={p} onApprove={approveThought} onReject={rejectThought} onImplement={implementThought} />
            )) : (
              <EmptyState icon={<Lightbulb size={32} />} message="No proposals yet" sub="Agents propose automations when they detect patterns with cost_benefit > 1.0." />
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Thoughts Over Time */}
        <div className="rounded-lg p-4" style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}>
          <h3 className="text-xs font-bold tracking-wider mb-4" style={{ color: '#9ca3af' }}>
            THOUGHTS OVER TIME
          </h3>
          {timeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }} />
                <Tooltip contentStyle={{ background: '#0d0d15', border: '1px solid #1a1a2e', borderRadius: '4px', fontFamily: FONT, fontSize: '11px' }} />
                <Line type="monotone" dataKey="count" stroke="#f0c040" strokeWidth={2} dot={{ fill: '#f0c040', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={<Clock size={32} />} message="No time-series data yet" />
          )}
        </div>

        {/* Thoughts by Agent */}
        <div className="rounded-lg p-4" style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}>
          <h3 className="text-xs font-bold tracking-wider mb-4" style={{ color: '#9ca3af' }}>
            THOUGHTS BY AGENT
          </h3>
          {effByAgent.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={effByAgent}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }} />
                <YAxis tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }} />
                <Tooltip contentStyle={{ background: '#0d0d15', border: '1px solid #1a1a2e', borderRadius: '4px', fontFamily: FONT, fontSize: '11px' }} />
                <Bar dataKey="count" fill="#f0c040" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={<Bot size={32} />} message="No agent data yet" />
          )}
        </div>
      </div>

      {/* Automation Suggestions */}
      <div className="rounded-lg p-4" style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}>
        <h3 className="text-xs font-bold tracking-wider mb-4 flex items-center gap-2" style={{ color: '#9ca3af' }}>
          <Zap size={12} /> AUTOMATION SUGGESTIONS
        </h3>
        {stats && Object.keys(stats.automations_by_type).length > 0 ? (
          <div className="grid grid-cols-4 gap-3">
            {['script', 'skill', 'workflow', 'code_change'].map((type) => (
              <div
                key={type}
                className="p-3 rounded"
                style={{ background: '#0a0a0f', border: '1px solid #1a1a2e' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ color: '#f0c040' }}>{AUTOMATION_ICONS[type]}</span>
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>
                    {type.replace('_', ' ')}s
                  </span>
                </div>
                <span className="text-lg font-bold" style={{ color: '#e5e7eb', fontFamily: FONT }}>
                  {stats.automations_by_type[type] || 0}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Zap size={32} />} message="No automation suggestions yet" sub="The autonomous engine classifies enhancements as scripts, skills, workflows, or code changes." />
        )}
      </div>

      {/* Category breakdown */}
      {stats && Object.keys(stats.thoughts_by_category).length > 0 && (
        <div className="rounded-lg p-4" style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}>
          <h3 className="text-xs font-bold tracking-wider mb-3" style={{ color: '#9ca3af' }}>
            THOUGHTS BY CATEGORY
          </h3>
          <div className="flex gap-3">
            {Object.entries(stats.thoughts_by_category).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: CATEGORY_COLORS[cat] || '#666' }} />
                <span className="text-xs" style={{ color: '#9ca3af' }}>{cat}: <span style={{ color: '#e5e7eb' }}>{count}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode; color: string
}) {
  return (
    <div className="rounded-lg p-4" style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] tracking-wider" style={{ color: '#9ca3af' }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <span className="text-2xl font-bold" style={{ color, fontFamily: FONT }}>{value}</span>
    </div>
  )
}

function FilterSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs px-2 py-1.5 rounded"
      style={{ background: '#0d0d15', border: '1px solid #1a1a2e', color: '#9ca3af', fontFamily: FONT, outline: 'none' }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function ThoughtCard({ thought, onApprove, onReject, onDelete }: {
  thought: AgentThought
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onDelete: (id: string) => void
}) {
  const typeColor = TYPE_COLORS[thought.type] || '#666'
  const statusColor = STATUS_COLORS[thought.status] || '#666'

  return (
    <div className="p-2.5 rounded" style={{ background: '#0a0a0f', border: '1px solid #1a1a2e' }}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: typeColor }} />
          <span className="text-[10px] font-bold" style={{ color: '#e5e7eb' }}>{thought.title}</span>
        </div>
        <span className="text-[8px] px-1.5 py-0.5 rounded uppercase" style={{ background: statusColor + '20', color: statusColor }}>
          {thought.status}
        </span>
      </div>
      <p className="text-[10px] mb-1.5" style={{ color: '#666' }}>{thought.content?.slice(0, 120)}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[9px]" style={{ color: '#f0c040' }}>{thought.agent_name}</span>
          {thought.efficiency && (
            <span className="text-[9px]" style={{ color: '#22c55e' }}>
              {thought.efficiency.cost_benefit.toFixed(1)}x ROI
            </span>
          )}
        </div>
        {thought.status === 'pending' && (
          <div className="flex items-center gap-1">
            <button onClick={() => onApprove(thought.id)} className="p-0.5 rounded hover:opacity-80" style={{ color: '#22c55e' }}>
              <CheckCircle size={12} />
            </button>
            <button onClick={() => onReject(thought.id)} className="p-0.5 rounded hover:opacity-80" style={{ color: '#ef4444' }}>
              <XCircle size={12} />
            </button>
            <button onClick={() => onDelete(thought.id)} className="p-0.5 rounded hover:opacity-80" style={{ color: '#666' }}>
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProposalCard({ thought, onApprove, onReject, onImplement }: {
  thought: AgentThought
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onImplement: (id: string) => void
}) {
  const statusColor = STATUS_COLORS[thought.status] || '#666'
  const autoType = thought.efficiency?.automation_type || 'script'

  return (
    <div className="p-3 rounded" style={{ background: '#0a0a0f', border: '1px solid #1a1a2e' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ color: '#f0c040' }}>{AUTOMATION_ICONS[autoType]}</span>
          <span className="text-[10px] font-bold" style={{ color: '#e5e7eb' }}>{thought.title}</span>
        </div>
        <span className="text-[8px] px-1.5 py-0.5 rounded uppercase" style={{ background: statusColor + '20', color: statusColor }}>
          {thought.status}
        </span>
      </div>
      <p className="text-[10px] mb-2" style={{ color: '#9ca3af' }}>{thought.content}</p>
      {thought.efficiency && (
        <div className="grid grid-cols-3 gap-1 mb-2">
          <MiniStat label="TIME SAVED" value={`${thought.efficiency.time_saved}h`} />
          <MiniStat label="FREQUENCY" value={`${thought.efficiency.frequency}/wk`} />
          <MiniStat label="ROI" value={`${thought.efficiency.cost_benefit.toFixed(1)}x`} color="#22c55e" />
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[9px]" style={{ color: '#f0c040' }}>{thought.agent_name}</span>
        <div className="flex items-center gap-1">
          {thought.status === 'pending' && (
            <>
              <button onClick={() => onApprove(thought.id)} className="text-[9px] px-2 py-0.5 rounded" style={{ background: '#22c55e20', color: '#22c55e' }}>Approve</button>
              <button onClick={() => onReject(thought.id)} className="text-[9px] px-2 py-0.5 rounded" style={{ background: '#ef444420', color: '#ef4444' }}>Reject</button>
            </>
          )}
          {thought.status === 'approved' && (
            <button onClick={() => onImplement(thought.id)} className="text-[9px] px-2 py-0.5 rounded" style={{ background: '#3b82f620', color: '#3b82f6' }}>
              Mark Implemented
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[8px] tracking-wider" style={{ color: '#666' }}>{label}</div>
      <div className="text-[11px] font-bold" style={{ color: color || '#e5e7eb', fontFamily: FONT }}>{value}</div>
    </div>
  )
}

function EmptyState({ icon, message, sub }: { icon: React.ReactNode; message: string; sub?: string }) {
  return (
    <div className="text-center py-6">
      <div className="mx-auto mb-2" style={{ color: '#374151' }}>{icon}</div>
      <p className="text-xs" style={{ color: '#666' }}>{message}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: '#4b5563' }}>{sub}</p>}
    </div>
  )
}

export default Autonomous
