import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Play,
  Trash2,
  Edit3,
  Terminal,
  Palette,
} from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { agentOrchestrator } from '../../core/orchestrator'
import { useMCPStore } from '../../store/mcpStore'
import CreateAgentModal from '../../components/Agents/CreateAgentModal'
import type { Agent } from '../../types'

function Agents() {
  const { agents, personalities, addAgent, removeAgent, setActiveAgent, spawnAgent, stopAgent, handoffTask } = useAgentStore()
  const { builtinTools } = useMCPStore()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const handleCreateAgent = async (agentData: Partial<Agent>) => {
    const newAgent = agentOrchestrator.spawnAgent(
      agentData.type || 'default',
      (typeof agentData.personality === 'object' ? agentData.personality.id : agentData.personality) || 'default',
      agentData.codename || `Agent-${Date.now().toString().slice(-4)}`
    );
    addAgent({
      ...newAgent,
      name: agentData.name || 'New Agent',
      description: agentData.description || '',
      color: agentData.color || '#6366f1',
      capabilities: agentData.capabilities || [],
      tools: agentData.tools || builtinTools.filter(t => t.enabled),
      mcps: [],
      config: agentData.config || {
        model: 'claude-opus-4-6',
        temperature: 0.7,
        maxTokens: 4096,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setShowCreateModal(false);
  };

  useEffect(() => {
    const handleStatusChange = (agent: Agent) => {
      useAgentStore.getState().updateAgent(agent.id, agent);
    };

    agentOrchestrator.on('agentStatusChange', handleStatusChange);

    return () => {
      agentOrchestrator.off('agentStatusChange', handleStatusChange);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-text-secondary">Manage your AI agents and personalities</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Spawn Agent</span>
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent, index) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-surface rounded-xl border border-border p-5 hover:border-primary/50 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                  style={{ backgroundColor: agent.color }}
                >
                  {agent.codename.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold">{agent.name} ({agent.codename})</h3>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      agent.status === 'heartbeat' ? 'bg-green-500 animate-pulse' :
                      agent.status === 'working' ? 'bg-yellow-500' :
                      agent.status === 'stopped' ? 'bg-red-500' :
                      'bg-gray-500'
                    }`}></span>
                    <span className="text-xs text-text-secondary capitalize">{agent.status}</span>
                  </div>
                  <span className="text-xs text-text-secondary">{agent.currentTask}</span>
                </div>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setActiveAgent(agent)}
                  className="p-2 hover:bg-[#f0c040]/10 text-[#f0c040] rounded-lg"
                  title="Activate"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-surface-light rounded-lg text-text-secondary">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeAgent(agent.id)}
                  className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-sm text-text-secondary mb-4 line-clamp-2">{agent.description}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              {agent.capabilities.slice(0, 4).map((cap) => (
                <span key={cap} className="text-xs px-2 py-1 bg-surface-light rounded-full">
                  {cap}
                </span>
              ))}
              {agent.capabilities.length > 4 && (
                <span className="text-xs px-2 py-1 bg-surface-light rounded-full">+{agent.capabilities.length - 4}</span>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Terminal className="w-4 h-4" />
                <span>{agent.toolsCount} tools</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Palette className="w-4 h-4" />
                <span>{agent.findingsCount} findings</span>
              </div>
              <span className="text-xs text-text-secondary">
                {agent.config.model}
              </span>
            </div>
          </motion.div>
        ))}

        {/* Create New Card */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowCreateModal(true)}
          className="flex flex-col items-center justify-center gap-3 p-5 border-2 border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-surface-light/50 transition-all min-h-[200px]"
        >
          <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center">
            <Plus className="w-6 h-6 text-text-secondary" />
          </div>
          <span className="font-medium text-text-secondary">Create New Agent</span>
        </motion.button>
      </div>

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
