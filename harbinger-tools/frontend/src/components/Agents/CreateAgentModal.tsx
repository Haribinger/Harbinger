import { useState, useEffect } from 'react'
import { useAgentStore } from '../../store/agentStore'
import { useMCPStore } from '../../store/mcpStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useSecretsStore, PROVIDER_MODELS } from '../../store/secretsStore'
import type { Provider } from '../../store/secretsStore'
import type { Agent, AgentPersonality } from '../../types'
import { apiClient } from '../../api/client'
import {
  X, ChevronRight, Zap, Plus,
} from 'lucide-react'

interface CreateAgentModalProps {
  onClose: () => void
  onCreate?: (agent: Partial<Agent>) => void
  personalities?: AgentPersonality[]
}

interface AgentTemplate {
  id: string
  name: string
  type: string
  description: string
  capabilities: string[]
  config?: {
    docker_image?: string
    memory_mb?: number
    cpu_count?: number
    [key: string]: unknown
  }
  color: string
}

// Obsidian Command tokens
const C = {
  bg: '#0a0a0f',
  surface: '#0d0d15',
  surfaceLight: '#111119',
  border: '#1a1a2e',
  gold: '#f0c040',
  green: '#22c55e',
  red: '#ef4444',
  muted: '#9ca3af',
  dim: '#374151',
  white: '#ffffff',
  font: 'JetBrains Mono, Fira Code, monospace',
}

const AGENT_TYPES = [
  'recon', 'web', 'cloud', 'osint', 'binary', 'report',
  'network', 'mobile', 'api', 'fuzzing', 'crypto', 'social-engineering', 'custom',
]

const COLORS = [
  '#3b82f6', '#ef4444', '#a855f7', '#06b6d4', '#f97316', '#22c55e',
  '#6366f1', '#ec4899', '#14b8a6', '#84cc16', '#f59e0b', '#8b5cf6',
]

export default function CreateAgentModal({ onClose, onCreate, personalities: propPersonalities }: CreateAgentModalProps) {
  const { addAgent } = useAgentStore()
  const { builtinTools } = useMCPStore()
  const { modelDefaults } = useSettingsStore()
  const { providers, activeProvider } = useSecretsStore()

  const [step, setStep] = useState<'template' | 'configure'>('template')
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [agentType, setAgentType] = useState('recon')
  const [color, setColor] = useState('#6366f1')
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [capInput, setCapInput] = useState('')
  const [dockerImage, setDockerImage] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [selectedPersonality, setSelectedPersonality] = useState<string>('')
  const [model, setModel] = useState(modelDefaults.model)
  const [temperature, setTemperature] = useState(modelDefaults.temperature)
  const [memoryMb, setMemoryMb] = useState(512)
  const [cpuCount, setCpuCount] = useState(1)

  const availableModels = providers[activeProvider as keyof typeof providers]?.models || PROVIDER_MODELS[activeProvider as Provider] || []
  const personalities = propPersonalities || []

  // Fetch templates on mount
  useEffect(() => {
    apiClient.get<AgentTemplate[] | { templates: AgentTemplate[] }>('/api/agents/templates')
      .then((res) => {
        const nextTemplates = Array.isArray(res)
          ? res
          : ('templates' in res && Array.isArray(res.templates) ? res.templates : [])
        setTemplates(nextTemplates)
      })
      .catch(() => {
        // Fallback templates
        setTemplates([
          { id: 'template-recon', name: 'PATHFINDER', type: 'recon', description: 'Recon Scout', capabilities: ['subfinder', 'httpx', 'naabu'], config: {}, color: '#3b82f6' },
          { id: 'template-web', name: 'BREACH', type: 'web', description: 'Web Hacker', capabilities: ['nuclei', 'sqlmap', 'dalfox'], config: {}, color: '#ef4444' },
          { id: 'template-cloud', name: 'PHANTOM', type: 'cloud', description: 'Cloud Infiltrator', capabilities: ['ScoutSuite', 'Prowler'], config: {}, color: '#a855f7' },
          { id: 'template-osint', name: 'SPECTER', type: 'osint', description: 'OSINT Detective', capabilities: ['theHarvester', 'Sherlock'], config: {}, color: '#06b6d4' },
          { id: 'template-binary', name: 'CIPHER', type: 'binary', description: 'Binary RE', capabilities: ['Ghidra', 'radare2'], config: {}, color: '#f97316' },
          { id: 'template-report', name: 'SCRIBE', type: 'report', description: 'Report Writer', capabilities: ['markdown', 'pdf'], config: {}, color: '#22c55e' },
          { id: 'template-custom', name: 'Custom Agent', type: 'custom', description: 'Start from scratch', capabilities: [], config: {}, color: '#6366f1' },
        ])
      })
  }, [])

  const selectTemplate = (t: AgentTemplate) => {
    setSelectedTemplate(t)
    if (t.type !== 'custom') {
      setName(t.name + '-' + Math.random().toString(36).slice(2, 6).toUpperCase())
      setDescription(t.description)
      setAgentType(t.type)
      setColor(t.color)
      setCapabilities([...t.capabilities])
      setDockerImage(t.config?.docker_image || '')
      setMemoryMb(t.config?.memory_mb ?? 512)
      setCpuCount(t.config?.cpu_count ?? 1)
    } else {
      setName('')
      setDescription('')
      setAgentType('custom')
      setCapabilities([])
      setDockerImage('')
    }
    setStep('configure')
  }

  const addCapability = () => {
    const cap = capInput.trim()
    if (cap && !capabilities.includes(cap)) {
      setCapabilities([...capabilities, cap])
    }
    setCapInput('')
  }

  const removeCapability = (cap: string) => {
    setCapabilities(capabilities.filter((c) => c !== cap))
  }

  const handleSubmit = () => {
    const config = {
      model,
      temperature,
      maxTokens: modelDefaults.maxTokens,
      docker_image: dockerImage || undefined,
      system_prompt: systemPrompt || undefined,
      memory_mb: memoryMb !== 512 ? memoryMb : undefined,
      cpu_count: cpuCount !== 1 ? cpuCount : undefined,
    }

    const newAgent: Partial<Agent> = {
      name: name || 'New Agent',
      description,
      color,
      type: agentType,
      personality: personalities.find((p) => p.id === selectedPersonality),
      status: 'idle',
      codename: name || `agent-${Date.now()}`,
      currentTask: '',
      toolsCount: capabilities.length,
      findingsCount: 0,
      capabilities,
      tools: builtinTools.filter((t) => t.enabled),
      mcps: [],
      config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    if (onCreate) {
      onCreate(newAgent)
    } else {
      addAgent(newAgent as Agent)
      onClose()
    }
  }

  return (
    <div
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4,
          fontFamily: C.font, width: '100%', maxWidth: step === 'template' ? 800 : 560,
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', margin: 0, color: C.white }}>
              {step === 'template' ? 'SELECT AGENT TEMPLATE' : 'CONFIGURE AGENT'}
            </h2>
            <p style={{ fontSize: 10, color: C.muted, margin: '2px 0 0' }}>
              {step === 'template'
                ? 'Pick a template or start from scratch — customize everything'
                : `Based on: ${selectedTemplate?.name || 'Custom'}`
              }
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {step === 'template' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  style={{
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2,
                    padding: 14, textAlign: 'left', cursor: 'pointer', fontFamily: C.font,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.color)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 4, background: `${t.color}20`,
                      border: `1px solid ${t.color}40`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 12, fontWeight: 700, color: t.color,
                    }}>
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.white }}>{t.name}</div>
                      <div style={{ fontSize: 9, color: t.color, textTransform: 'uppercase' }}>{t.type}</div>
                    </div>
                    <ChevronRight size={12} style={{ color: C.dim, marginLeft: 'auto' }} />
                  </div>
                  <p style={{ fontSize: 10, color: C.muted, margin: 0, lineHeight: 1.4 }}>
                    {t.description.length > 80 ? t.description.slice(0, 80) + '...' : t.description}
                  </p>
                  {t.capabilities.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
                      {t.capabilities.slice(0, 3).map((c) => (
                        <span key={c} style={{
                          fontSize: 8, padding: '1px 5px', borderRadius: 2,
                          background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}30`,
                        }}>
                          {c}
                        </span>
                      ))}
                      {t.capabilities.length > 3 && (
                        <span style={{ fontSize: 8, color: C.dim }}>
                          +{t.capabilities.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <Field label="AGENT NAME">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., NIGHTWATCH, MY-SCANNER, RECON-V2"
                  style={inputStyle}
                />
              </Field>

              {/* Type */}
              <Field label="TYPE">
                <select
                  value={agentType}
                  onChange={(e) => setAgentType(e.target.value)}
                  style={inputStyle}
                >
                  {AGENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.toUpperCase()}</option>
                  ))}
                </select>
              </Field>

              {/* Description */}
              <Field label="DESCRIPTION">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this agent do?"
                  rows={2}
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </Field>

              {/* Color */}
              <Field label="COLOR">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      style={{
                        width: 24, height: 24, borderRadius: 2, background: c, cursor: 'pointer',
                        border: color === c ? '2px solid white' : `2px solid transparent`,
                        transition: 'border-color 0.15s',
                      }}
                    />
                  ))}
                </div>
              </Field>

              {/* Capabilities (tag input) */}
              <Field label="CAPABILITIES / TOOLS">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {capabilities.map((cap) => (
                    <span
                      key={cap}
                      style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 2,
                        background: `${C.gold}15`, color: C.gold, border: `1px solid ${C.gold}30`,
                        display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                      }}
                      onClick={() => removeCapability(cap)}
                      title="Click to remove"
                    >
                      {cap} <X size={8} />
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={capInput}
                    onChange={(e) => setCapInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addCapability() }
                      if (e.key === ',' || e.key === 'Tab') { e.preventDefault(); addCapability() }
                    }}
                    placeholder="Type tool name, press Enter"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={addCapability}
                    disabled={!capInput.trim()}
                    style={{
                      background: `${C.gold}20`, border: `1px solid ${C.gold}40`, borderRadius: 2,
                      color: C.gold, padding: '0 12px', cursor: 'pointer', fontFamily: C.font,
                      fontSize: 10, opacity: capInput.trim() ? 1 : 0.4,
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </Field>

              {/* Docker Image */}
              <Field label="DOCKER IMAGE">
                <input
                  type="text"
                  value={dockerImage}
                  onChange={(e) => setDockerImage(e.target.value)}
                  placeholder="harbinger/custom-agent:latest (leave blank for default)"
                  style={inputStyle}
                />
              </Field>

              {/* Resource Limits */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="MEMORY (MB)">
                  <select value={memoryMb} onChange={(e) => setMemoryMb(Number(e.target.value))} style={inputStyle}>
                    {[256, 512, 1024, 2048, 4096].map((m) => (
                      <option key={m} value={m}>{m} MB</option>
                    ))}
                  </select>
                </Field>
                <Field label="CPU CORES">
                  <select value={cpuCount} onChange={(e) => setCpuCount(Number(e.target.value))} style={inputStyle}>
                    {[1, 2, 4, 8].map((c) => (
                      <option key={c} value={c}>{c} core{c > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Model */}
              <Field label="AI MODEL">
                <select value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle}>
                  {availableModels.length > 0 ? (
                    availableModels.map((m: string) => (
                      <option key={m} value={m}>{m}</option>
                    ))
                  ) : (
                    <option value={model}>{model}</option>
                  )}
                </select>
              </Field>

              {/* Temperature */}
              <Field label={`TEMPERATURE: ${temperature}`}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: C.gold }}
                />
              </Field>

              {/* Personality */}
              {personalities.length > 0 && (
                <Field label="PERSONALITY">
                  <select
                    value={selectedPersonality}
                    onChange={(e) => setSelectedPersonality(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">None (custom)</option>
                    {personalities.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </Field>
              )}

              {/* System Prompt */}
              <Field label="SYSTEM PROMPT (OPTIONAL)">
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Custom instructions for this agent..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: step === 'configure' ? 'space-between' : 'flex-end',
          padding: '12px 20px', borderTop: `1px solid ${C.border}`,
        }}>
          {step === 'configure' && (
            <button
              onClick={() => setStep('template')}
              style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: 2,
                color: C.muted, padding: '8px 16px', cursor: 'pointer', fontFamily: C.font,
                fontSize: 11,
              }}
            >
              BACK
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: 2,
                color: C.muted, padding: '8px 16px', cursor: 'pointer', fontFamily: C.font,
                fontSize: 11,
              }}
            >
              CANCEL
            </button>
            {step === 'configure' && (
              <button
                onClick={handleSubmit}
                disabled={!name}
                style={{
                  background: name ? `${C.gold}20` : 'transparent',
                  border: `1px solid ${name ? C.gold : C.dim}`,
                  borderRadius: 2, color: name ? C.gold : C.dim,
                  padding: '8px 20px', cursor: name ? 'pointer' : 'default',
                  fontFamily: C.font, fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Zap size={12} /> CREATE AGENT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Sub-components
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em',
        color: C.muted, marginBottom: 6, fontFamily: C.font,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 2,
  color: C.white,
  padding: '8px 12px',
  fontFamily: C.font,
  fontSize: 11,
  outline: 'none',
  boxSizing: 'border-box',
}
