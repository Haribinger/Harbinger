import { useState } from 'react'
import { useAgentStore } from '../../store/agentStore'
import { useMCPStore } from '../../store/mcpStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useSecretsStore } from '../../store/secretsStore'
import type { Agent, AgentPersonality } from '../../types'

interface CreateAgentModalProps {
  onClose: () => void
  onCreate?: (agent: Partial<Agent>) => void
  personalities?: AgentPersonality[]
}

export default function CreateAgentModal({ onClose, onCreate, personalities: propPersonalities }: CreateAgentModalProps) {
  const { addAgent } = useAgentStore()
  const { builtinTools } = useMCPStore()
  const { modelDefaults } = useSettingsStore()
  const { providers, activeProvider } = useSecretsStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [selectedPersonality, setSelectedPersonality] = useState<string>('')
  const [model, setModel] = useState(modelDefaults.model)
  const [temperature, setTemperature] = useState(modelDefaults.temperature)

  const availableModels = providers[activeProvider as keyof typeof providers]?.models || []

  const personalities = propPersonalities || []

  const colors = [
    '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#14b8a6',
  ]

  const handleSubmit = () => {
    const newAgent: Agent = {
      id: Date.now().toString(),
      name: name || 'New Agent',
      description,
      color,
      personality: personalities.find(p => p.id === selectedPersonality),
      status: 'offline',
      codename: name || `agent-${Date.now()}`,
      currentTask: '',
      toolsCount: builtinTools.filter(t => t.enabled).length,
      findingsCount: 0,
      capabilities: [],
      tools: builtinTools.filter(t => t.enabled),
      mcps: [],
      config: {
        model,
        temperature,
        maxTokens: modelDefaults.maxTokens,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    if (onCreate) {
      onCreate(newAgent)
    } else {
      addAgent(newAgent)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold">Create New Agent</h2>
          <p className="text-text-secondary">Configure a new AI agent</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Security Expert"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this agent does..."
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Personality</label>
            <select
              value={selectedPersonality}
              onChange={(e) => setSelectedPersonality(e.target.value)}
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            >
              <option value="">Custom</option>
              {personalities.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            >
              {availableModels.length > 0 ? (
                availableModels.map((m: string) => (
                  <option key={m} value={m}>{m}</option>
                ))
              ) : (
                <option value={model}>{model}</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Temperature: {temperature}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 hover:bg-surface-light rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            Create Agent
          </button>
        </div>
      </div>
    </div>
  )
}
