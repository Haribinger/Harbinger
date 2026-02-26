import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Play,
  Square,
  Trash2,
  Terminal,
  Palette,
  RefreshCw,
  FileText,
  Activity,
  Zap,
  Copy,
} from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { agentOrchestrator } from '../../core/orchestrator'
import { useMCPStore } from '../../store/mcpStore'
import { agentsApi } from '../../api/agents'
import CreateAgentModal from '../../components/Agents/CreateAgentModal'
import type { Agent } from '../../types'

function Agents() {
  const {
    agents, personalities, addAgent, removeAgent, updateAgent,
    setActiveAgent, spawnAgentById, stopAgent, fetchAgents, deleteAgentFromDB, cloneAgent,
  } = useAgentStore()
  const { builtinTools } = useMCPStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showLogs, setShowLogs] = useState<string | null>(null)
  const [logContent, setLogContent] = useState('')
  const [loadingAgents, setLoadingAgents] = useState<Set<string>>(new Set())

  // Fetch agents from DB on mount
  useEffect(() => {
    fetchAgents()
    const interval = setInterval(fetchAgents, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const handleCreateAgent = async (agentData: Partial<Agent>) => {
    const codename = agentData.codename || agentData.name || `Agent-${Date.now().toString().slice(-4)}`
    const type = agentData.type || 'custom'
    const config = agentData.config || { model: 'claude-opus-4-6', temperature: 0.7, maxTokens: 4096 }

    // Create in DB + local store
    const { createAgentInDB } = useAgentStore.getState()
    const created = await createAgentInDB(
      codename, type,
      agentData.description || '',
      agentData.capabilities || [],
      config,
    )
    if (!created) {
      // Fallback: add to local store only
      addAgent({
        id: `agent-${Date.now()}`,
        name: agentData.name || codename,
        description: agentData.description || '',
        color: agentData.color || '#6366f1',
        type,
        personality: typeof agentData.personality === 'object' ? agentData.personality?.id : agentData.personality || 'default',
        status: 'idle',
        codename,
        currentTask: '',
        toolsCount: 0,
        findingsCount: 0,
        capabilities: agentData.capabilities || [],
        tools: agentData.tools || builtinTools.filter(t => t.enabled),
        mcps: [],
        config,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    setShowCreateModal(false)
  }

  const handleClone = async (agent: Agent) => {
    const cloneName = agent.name + '-CLONE-' + Math.random().toString(36).slice(2, 6).toUpperCase()
    await cloneAgent(agent.id, cloneName)
    fetchAgents()
  }

  const handleSpawn = async (agentId: string) => {
    setLoadingAgents(prev => new Set(prev).add(agentId))
    try {
      await spawnAgentById(agentId)
    } finally {
      setLoadingAgents(prev => {
        const next = new Set(prev)
        next.delete(agentId)
        return next
      })
    }
  }

  const handleStop = async (agentId: string) => {
    setLoadingAgents(prev => new Set(prev).add(agentId))
    try {
      await stopAgent(agentId)
    } finally {
      setLoadingAgents(prev => {
        const next = new Set(prev)
        next.delete(agentId)
        return next
      })
    }
  }

  const handleViewLogs = async (agentId: string) => {
    setShowLogs(agentId)
    try {
      const logs = await agentsApi.getLogs(agentId)
      setLogContent(logs)
    } catch {
      setLogContent('[No logs available — agent may not be running]')
    }
  }

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Delete agent ${agent.name}? This will also stop its container.`)) return
    await deleteAgentFromDB(agent.id)
  }

  const isRunning = (status: string) =>
    status === 'running' || status === 'working' || status === 'heartbeat' || status === 'spawned'

  useEffect(() => {
    const handleStatusChange = (agent: any) => {
      useAgentStore.getState().updateAgent(agent.id, { status: agent.status, currentTask: agent.currentTask })
    }
    agentOrchestrator.on('agentStatusChange', handleStatusChange)
    return () => {
      agentOrchestrator.off('agentStatusChange', handleStatusChange)
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'monospace' }}>AGENT ROSTER</h1>
          <p className="text-sm" style={{ color: '#9ca3af' }}>
            {agents.length} agents registered — {agents.filter(a => isRunning(a.status)).length} running
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => fetchAgents()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
            style={{ border: '1px solid #1a1a2e', color: '#9ca3af' }}
            title="Refresh from backend"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ border: '1px solid #f0c040', color: '#f0c040', background: 'transparent' }}
          >
            <Plus className="w-4 h-4" />
            <span>Spawn Agent</span>
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent, index) => {
          const running = isRunning(agent.status)
          const loading = loadingAgents.has(agent.id)

          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-xl p-5 transition-all group"
              style={{
                background: '#0d0d15',
                border: running ? '1px solid #f0c040' : '1px solid #1a1a2e',
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: agent.color, fontFamily: 'monospace' }}
                  >
                    {(agent.codename || agent.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold" style={{ fontFamily: 'monospace' }}>
                      {agent.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: running ? '#22c55e' : agent.status === 'error' ? '#ef4444' : '#6b7280',
                          animation: running ? 'pulse 2s infinite' : undefined,
                        }}
                      />
                      <span className="text-xs capitalize" style={{ color: '#9ca3af' }}>
                        {agent.status}
                      </span>
                    </div>
                    {agent.currentTask && (
                      <span className="text-xs" style={{ color: '#6b7280' }}>{agent.currentTask}</span>
                    )}
                    {agent.containerId && (
                      <span className="text-xs block" style={{ color: '#f0c040' }}>
                        {agent.containerId.slice(0, 12)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm mb-4 line-clamp-2" style={{ color: '#9ca3af' }}>
                {agent.description}
              </p>

              <div className="flex flex-wrap gap-1 mb-4">
                {(agent.capabilities || []).slice(0, 4).map((cap) => (
                  <span
                    key={cap}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: '#1a1a2e', color: '#9ca3af' }}
                  >
                    {cap}
                  </span>
                ))}
                {(agent.capabilities || []).length > 4 && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1a1a2e', color: '#6b7280' }}>
                    +{agent.capabilities.length - 4}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid #1a1a2e' }}>
                {!running ? (
                  <button
                    onClick={() => handleSpawn(agent.id)}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors"
                    style={{ border: '1px solid #22c55e', color: '#22c55e' }}
                    title="Spawn Docker container"
                  >
                    {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Spawn
                  </button>
                ) : (
                  <button
                    onClick={() => handleStop(agent.id)}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors"
                    style={{ border: '1px solid #ef4444', color: '#ef4444' }}
                    title="Stop agent container"
                  >
                    {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
                    Stop
                  </button>
                )}
                <button
                  onClick={() => handleViewLogs(agent.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors"
                  style={{ border: '1px solid #1a1a2e', color: '#9ca3af' }}
                  title="View container logs"
                >
                  <FileText className="w-3 h-3" />
                  Logs
                </button>
                <button
                  onClick={() => setActiveAgent(agent)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors"
                  style={{ border: '1px solid #1a1a2e', color: '#f0c040' }}
                  title="Open agent chat"
                >
                  <Zap className="w-3 h-3" />
                  Chat
                </button>
                <button
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors"
                  style={{ border: '1px solid #1a1a2e', color: '#9ca3af' }}
                  title="View status"
                >
                  <Activity className="w-3 h-3" />
                  Status
                </button>
                <button
                  onClick={() => handleClone(agent)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors"
                  style={{ border: '1px solid #1a1a2e', color: '#06b6d4' }}
                  title="Clone agent"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(agent)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors"
                  style={{ border: '1px solid #1a1a2e', color: '#ef4444' }}
                  title="Delete agent"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 text-xs" style={{ color: '#6b7280' }}>
                  <Terminal className="w-3 h-3" />
                  <span>{agent.toolsCount || agent.capabilities?.length || 0} tools</span>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: '#6b7280' }}>
                  <Palette className="w-3 h-3" />
                  <span>{agent.findingsCount || 0} findings</span>
                </div>
                <span className="text-xs" style={{ color: '#6b7280', fontFamily: 'monospace' }}>
                  {agent.type}
                </span>
              </div>
            </motion.div>
          )
        })}

        {/* Create New Card */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowCreateModal(true)}
          className="flex flex-col items-center justify-center gap-3 p-5 rounded-xl transition-all min-h-[200px]"
          style={{ border: '2px dashed #1a1a2e' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: '#1a1a2e' }}
          >
            <Plus className="w-6 h-6" style={{ color: '#9ca3af' }} />
          </div>
          <span className="font-medium" style={{ color: '#9ca3af', fontFamily: 'monospace' }}>
            CREATE NEW AGENT
          </span>
          <span className="text-xs" style={{ color: '#6b7280' }}>
            No limit — spawn as many as your system can handle
          </span>
        </motion.button>
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setShowLogs(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[80vh] rounded-xl overflow-hidden"
            style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1a1a2e' }}>
              <h3 className="font-bold" style={{ fontFamily: 'monospace', color: '#f0c040' }}>
                AGENT LOGS — {showLogs.slice(0, 12)}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewLogs(showLogs)}
                  className="px-3 py-1 rounded text-xs"
                  style={{ border: '1px solid #1a1a2e', color: '#9ca3af' }}
                >
                  <RefreshCw className="w-3 h-3 inline mr-1" />
                  Refresh
                </button>
                <button
                  onClick={() => setShowLogs(null)}
                  className="px-3 py-1 rounded text-xs"
                  style={{ border: '1px solid #1a1a2e', color: '#9ca3af' }}
                >
                  Close
                </button>
              </div>
            </div>
            <pre
              className="p-4 overflow-auto text-xs"
              style={{
                maxHeight: 'calc(80vh - 60px)',
                color: '#9ca3af',
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {logContent || 'Loading...'}
            </pre>
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreateModal && (
        <CreateAgentModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateAgent}
          personalities={personalities}
        />
      )}
    </motion.div>
  )
}

export default Agents
