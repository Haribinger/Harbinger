import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Settings as SettingsIcon,
  Monitor,
  Bot,
  Container,
  Puzzle,
  Bell,
  Shield,
  Key,
  Database,
  Save,
  RotateCcw,
  ChevronRight,
  Moon,
  Sun,
  Laptop,
  Bug,
  Check,
  AlertCircle,
  Globe,
  RefreshCw,
  Copy,
  Download,
  Upload,
  Eye,
  EyeOff,
  Zap,
  Palette,
  Plus,
  Trash2,
  Edit3,
  Type,
  Lock,
  Router,
} from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'
import { useSecretsStore, PROVIDER_MODELS } from '../../store/secretsStore'
import type { Provider } from '../../store/secretsStore'
import { useThemeStore, applyTheme } from '../../store/themeStore'
import type { HarbingerTheme, ThemeTokens } from '../../types/theme'
import { BUILTIN_THEMES } from '../../types/theme'
import { useBugBountyStore } from '../../store/bugBountyStore'
import { useModelRouterStore } from '../../store/modelRouterStore'
import type { ModelRoute } from '../../store/modelRouterStore'
import toast from 'react-hot-toast'

const sections = [
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'models', label: 'AI Models', icon: Bot },
  { id: 'channels', label: 'Channels', icon: Globe },
  { id: 'docker', label: 'Docker', icon: Container },
  { id: 'mcp', label: 'MCP', icon: Puzzle },
  { id: 'bugbounty', label: 'Bug Bounty', icon: Bug },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'model-router', label: 'Model Router', icon: Router },
  { id: 'advanced', label: 'Advanced', icon: Database },
]

// Provider info for display — all 8 providers
const PROVIDER_INFO: Record<string, { name: string; icon: React.ElementType; color: string; description: string }> = {
  anthropic: { name: 'Anthropic', icon: Bot, color: 'text-orange-400', description: 'Claude models — Opus, Sonnet, Haiku' },
  openai: { name: 'OpenAI', icon: Bot, color: 'text-green-400', description: 'GPT-4o, GPT-4, o1 reasoning models' },
  groq: { name: 'Groq', icon: Zap, color: 'text-yellow-400', description: 'Ultra-fast inference — Llama, Mixtral, Gemma' },
  ollama: { name: 'Ollama (Local)', icon: Container, color: 'text-purple-400', description: 'Local models — no API key needed' },
  gemini: { name: 'Google Gemini', icon: Database, color: 'text-blue-400', description: 'Gemini 2.0 Flash, Pro, Flash' },
  mistral: { name: 'Mistral AI', icon: Shield, color: 'text-red-400', description: 'Mistral Large, Small, Codestral' },
  google: { name: 'Google AI Studio', icon: Globe, color: 'text-cyan-400', description: 'Gemini via AI Studio API' },
  lmstudio: { name: 'LM Studio (Local)', icon: Laptop, color: 'text-emerald-400', description: 'Local models via LM Studio — no API key needed' },
  gpt4all: { name: 'GPT4All (Local)', icon: Container, color: 'text-indigo-400', description: 'Local models via GPT4All — no API key needed' },
  custom: { name: 'Custom / Self-Hosted', icon: Globe, color: 'text-gray-400', description: 'Any OpenAI-compatible API' },
}

function Settings() {
  const {
    notifications,
    autoSave,
    modelDefaults,
    dockerDefaults,
    mcpDefaults,
    notificationSettings,
    securitySettings,
    advancedSettings,
    updateSettings,
    updateNotificationSettings,
    updateSecuritySettings,
    updateAdvancedSettings,
    resetSettings,
  } = useSettingsStore()

  const {
    providers,
    activeProvider,
    ollamaUrl,
    ollamaModels,
    isOllamaConnected,
    bugBountyKeys,
    setBugBountyKey,
    updateProvider,
    setActiveProvider,
    setOllamaUrl,
    fetchOllamaModels,
    exportToEnv,
  } = useSecretsStore()

  const {
    programs, lastUpdated, isLoading: isBugBountyLoading, error: bugBountyError,
    fetchAll: fetchBugBountyData, dataSources, addDataSource, removeDataSource, toggleDataSource,
  } = useBugBountyStore()
  const [newSourceUrl, setNewSourceUrl] = useState('')

  const [activeSection, setActiveSection] = useState('appearance')
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [isTestingOllama, setIsTestingOllama] = useState(false)
  const [healthStatus, setHealthStatus] = useState<Array<{ name: string; status: 'connected' | 'disconnected' | 'error'; port: string }>>([])
  const [isLoadingHealth, setIsLoadingHealth] = useState(false)

  const [localModelDefaults, setLocalModelDefaults] = useState(modelDefaults)
  const [localDockerDefaults, setLocalDockerDefaults] = useState(dockerDefaults)
  const [localMcpDefaults, setLocalMcpDefaults] = useState(mcpDefaults)

  // Load health status on mount + auto-fetch Ollama models
  useEffect(() => {
    fetchHealthStatus()
    // Auto-fetch Ollama models if Ollama is active or enabled
    if (activeProvider === 'ollama' || providers.ollama?.enabled) {
      fetchOllamaModels()
    }
  }, [])

  const fetchHealthStatus = async () => {
    setIsLoadingHealth(true)
    try {
      const token = localStorage.getItem('harbinger-token')
      const response = await fetch('/api/dashboard/health', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.ok) {
        const data = await response.json()
        setHealthStatus(Array.isArray(data) ? data : [])
      } else {
        setHealthStatus([])
      }
    } catch {
      setHealthStatus([])
    } finally {
      setIsLoadingHealth(false)
    }
  }

  const handleSave = () => {
    updateSettings({
      modelDefaults: localModelDefaults,
      dockerDefaults: localDockerDefaults,
      mcpDefaults: localMcpDefaults,
    })
    setSaved(true)
    toast.success('Settings saved!')
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    resetSettings()
    // Read fresh defaults from store after reset (not stale hook values)
    const fresh = useSettingsStore.getState()
    setLocalModelDefaults(fresh.modelDefaults)
    setLocalDockerDefaults(fresh.dockerDefaults)
    setLocalMcpDefaults(fresh.mcpDefaults)
    toast('Settings reset to defaults')
  }

  const toggleShowKey = (key: string) => {
    setShowKey((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleProviderChange = (provider: string) => {
    setActiveProvider(provider as any)
    updateProvider(provider as any, { enabled: true })
    toast.success(`Switched to ${PROVIDER_INFO[provider]?.name || provider}`)
  }

  const testOllamaConnection = async () => {
    setIsTestingOllama(true)
    try {
      await fetchOllamaModels()
      // Read fresh state after async operation completes
      const { isOllamaConnected: connected, ollamaModels: models } = useSecretsStore.getState()
      if (connected) {
        toast.success(`Connected! Found ${models.length} models`)
      } else {
        toast.error('Could not connect to Ollama — check if it\'s running on ' + ollamaUrl)
      }
    } catch {
      toast.error('Failed to connect to Ollama')
    } finally {
      setIsTestingOllama(false)
    }
  }

  const copyEnvFile = () => {
    const env = exportToEnv()
    navigator.clipboard.writeText(env)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard!')
  }

  const downloadEnvFile = () => {
    const env = exportToEnv()
    const blob = new Blob([env], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '.env'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Downloaded .env file!')
  }

  const getApiKeyPlaceholder = (provider: string): string => {
    const placeholders: Record<string, string> = {
      anthropic: 'sk-ant-api03-...',
      openai: 'sk-...',
      google: 'AIza...',
      gemini: 'AIza...',
      groq: 'gsk_...',
      mistral: 'Bearer ...',
      custom: 'Enter API key...',
    }
    return placeholders[provider] || 'Enter API key...'
  }

  const getApiKeyDescription = (provider: string): string => {
    const descriptions: Record<string, string> = {
      anthropic: 'Get your API key from console.anthropic.com',
      openai: 'Get your API key from platform.openai.com',
      google: 'Get your API key from makersuite.google.com',
      gemini: 'Get your API key from aistudio.google.com',
      groq: 'Get your free API key from console.groq.com',
      mistral: 'Get your API key from console.mistral.ai',
      custom: 'Enter your API key for the custom endpoint',
    }
    return descriptions[provider] || ''
  }

  const activeConfig = providers[activeProvider as keyof typeof providers]
  const ActiveIcon = PROVIDER_INFO[activeProvider]?.icon || Bot

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex overflow-hidden"
    >
      {/* Sidebar */}
      <div className="w-56 border-r border-border flex flex-col bg-surface">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Settings
          </h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeSection === section.id
                  ? 'bg-[#f0c040]/10 text-[#f0c040] border border-[#f0c040]/30'
                  : 'text-text-secondary hover:bg-surface-light hover:text-white'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
              {activeSection === section.id && <ChevronRight className="w-3 h-3 ml-auto" />}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {/* Appearance — Full Theme System */}
          {activeSection === 'appearance' && (
            <ThemeSection autoSave={autoSave} updateSettings={updateSettings} />
          )}

          {/* AI Models - Now with Providers */}
          {activeSection === 'models' && (
            <Section title="AI Models" description="Configure AI providers and default models">
              {/* Provider Selection Cards */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-text-secondary mb-3">Select Provider</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.entries(PROVIDER_INFO).map(([key, info]) => {
                    const Icon = info.icon
                    const isActive = activeProvider === key
                    const hasKey = providers[key as keyof typeof providers]?.apiKey || (key === 'ollama' && isOllamaConnected)

                    return (
                      <motion.button
                        key={key}
                        onClick={() => handleProviderChange(key)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`relative p-4 rounded-xl border text-left transition-all ${
                          isActive
                            ? 'border-[#f0c040] bg-[#f0c040]/10'
                            : 'border-surface-light hover:border-surface-light/80 bg-surface'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <Icon className={`w-5 h-5 ${info.color}`} />
                          <div className="flex items-center gap-1">
                            {hasKey && <div className="w-2 h-2 rounded-full bg-green-500" />}
                            {isActive && (
                              <div className="w-5 h-5 rounded-full bg-[#f0c040] flex items-center justify-center">
                                <Check className="w-3 h-3 text-[#0a0a0f]" />
                              </div>
                            )}
                          </div>
                        </div>
                        <h3 className="font-semibold mt-2 text-sm">{info.name}</h3>
                        <p className="text-xs text-text-secondary mt-1 line-clamp-1">{info.description}</p>
                        {key === 'ollama' && isOllamaConnected && (
                          <p className="text-xs text-green-400 mt-1">{ollamaModels.length} models</p>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* Active Provider Configuration */}
              <div className="bg-surface rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <ActiveIcon className={`w-6 h-6 ${PROVIDER_INFO[activeProvider]?.color}`} />
                  <div>
                    <h3 className="font-semibold text-lg">
                      {PROVIDER_INFO[activeProvider]?.name || 'Provider'} Configuration
                    </h3>
                    <p className="text-sm text-text-secondary">Configure your API credentials</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* API Key Input */}
                  {activeProvider !== 'ollama' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        API Key
                        <span className="text-red-400 ml-1">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showKey[activeProvider] ? 'text' : 'password'}
                          value={activeConfig?.apiKey || ''}
                          onChange={(e) => updateProvider(activeProvider as any, { apiKey: e.target.value })}
                          placeholder={getApiKeyPlaceholder(activeProvider)}
                          className="w-full bg-background border border-border rounded-lg px-4 py-3 pr-20 font-mono text-sm focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => toggleShowKey(activeProvider)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white"
                        >
                          {showKey[activeProvider] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">{getApiKeyDescription(activeProvider)}</p>
                    </div>
                  )}

                  {/* Base URL */}
                  {(activeProvider === 'ollama' || activeProvider === 'custom') && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Base URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={activeConfig?.baseUrl || ''}
                          onChange={(e) => {
                            updateProvider(activeProvider as any, { baseUrl: e.target.value })
                            if (activeProvider === 'ollama') setOllamaUrl(e.target.value)
                          }}
                          placeholder={activeProvider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
                          className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary"
                        />
                        {activeProvider === 'ollama' && (
                          <button
                            onClick={testOllamaConnection}
                            disabled={isTestingOllama}
                            className="px-4 py-2 bg-surface-light hover:bg-surface-light/80 border border-border rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-4 h-4 ${isTestingOllama ? 'animate-spin' : ''}`} />
                            Test
                          </button>
                        )}
                      </div>
                      {activeProvider === 'ollama' && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className={`w-2 h-2 rounded-full ${isOllamaConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                          <span className={`text-xs ${isOllamaConnected ? 'text-green-400' : 'text-text-secondary'}`}>
                            {isOllamaConnected ? `Connected - ${ollamaModels.length} models available` : 'Not connected'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Model Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Default Model</label>
                    <select
                      value={localModelDefaults.model}
                      onChange={(e) => setLocalModelDefaults({ ...localModelDefaults, model: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary"
                    >
                      {activeProvider === 'ollama' && ollamaModels.length > 0 ? (
                        ollamaModels.map((model: string) => (
                          <option key={model} value={model}>{model}</option>
                        ))
                      ) : activeProvider === 'ollama' ? (
                        <option value="">No models found</option>
                      ) : (
                        (providers[activeProvider as keyof typeof providers]?.models || PROVIDER_MODELS[activeProvider as Provider] || []).map((model: string) => (
                          <option key={model} value={model}>{model}</option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Temperature */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Temperature: {localModelDefaults.temperature}</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={localModelDefaults.temperature}
                      onChange={(e) => setLocalModelDefaults({ ...localModelDefaults, temperature: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>

                  {/* Max Tokens */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Tokens</label>
                    <input
                      type="number"
                      value={localModelDefaults.maxTokens}
                      onChange={(e) => setLocalModelDefaults({ ...localModelDefaults, maxTokens: parseInt(e.target.value) })}
                      className="w-36 bg-background border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary"
                      min={256}
                      max={200000}
                      step={256}
                    />
                  </div>
                </div>
              </div>

              {/* Export Section */}
              <div className="bg-surface rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-4">Export Configuration</h3>
                <div className="flex gap-3">
                  <button
                    onClick={copyEnvFile}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-light hover:bg-surface-light/80 border border-border rounded-lg text-sm transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy .env'}
                  </button>
                  <button
                    onClick={downloadEnvFile}
                    className="flex items-center gap-2 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg text-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download .env
                  </button>
                </div>
              </div>
            </Section>
          )}

          {/* Channels */}
          {activeSection === 'channels' && (
            <ChannelsSection />
          )}

          {/* Docker */}
          {activeSection === 'docker' && (
            <Section title="Docker" description="Default container configuration and resource limits">
              <Setting label="Default Image" description="Base image for new containers">
                <input
                  type="text"
                  value={localDockerDefaults.defaultImage}
                  onChange={(e) => setLocalDockerDefaults({ ...localDockerDefaults, defaultImage: e.target.value })}
                  className="bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary text-sm w-64"
                />
              </Setting>

              <Setting label="Pentest Image" description="Default image for security testing containers">
                <input
                  type="text"
                  value={localDockerDefaults.pentestImage}
                  onChange={(e) => setLocalDockerDefaults({ ...localDockerDefaults, pentestImage: e.target.value })}
                  className="bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary text-sm w-64"
                />
              </Setting>

              <Setting label="Auto Cleanup" description="Automatically remove stopped containers">
                <Toggle
                  value={localDockerDefaults.autoCleanup}
                  onChange={(v) => setLocalDockerDefaults({ ...localDockerDefaults, autoCleanup: v })}
                />
              </Setting>

              <div className="bg-surface rounded-xl border border-border p-5">
                <h3 className="font-medium mb-4">Resource Limits</h3>
                <div className="space-y-4">
                  <Setting label="CPU Cores" description="Max CPU cores per container">
                    <input
                      type="number"
                      value={localDockerDefaults.resourceLimits.cpu}
                      onChange={(e) => setLocalDockerDefaults({
                        ...localDockerDefaults,
                        resourceLimits: { ...localDockerDefaults.resourceLimits, cpu: parseFloat(e.target.value) },
                      })}
                      className="bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary text-sm w-24"
                      min={0.5}
                      max={32}
                      step={0.5}
                    />
                  </Setting>
                  <Setting label="Memory (GB)" description="Max RAM per container">
                    <input
                      type="number"
                      value={localDockerDefaults.resourceLimits.memory}
                      onChange={(e) => setLocalDockerDefaults({
                        ...localDockerDefaults,
                        resourceLimits: { ...localDockerDefaults.resourceLimits, memory: parseInt(e.target.value) },
                      })}
                      className="bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary text-sm w-24"
                      min={1}
                      max={64}
                    />
                  </Setting>
                </div>
              </div>
            </Section>
          )}

          {/* MCP */}
          {activeSection === 'mcp' && (
            <Section title="MCP" description="Model Context Protocol connection settings">
              <Setting label="Auto Connect" description="Automatically connect to MCP servers on startup">
                <Toggle
                  value={localMcpDefaults.autoConnect}
                  onChange={(v) => setLocalMcpDefaults({ ...localMcpDefaults, autoConnect: v })}
                />
              </Setting>

              <Setting label="Connection Timeout (ms)" description="Timeout for MCP server connections">
                <input
                  type="number"
                  value={localMcpDefaults.timeout}
                  onChange={(e) => setLocalMcpDefaults({ ...localMcpDefaults, timeout: parseInt(e.target.value) })}
                  className="bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary text-sm w-32"
                  min={1000}
                  step={1000}
                />
              </Setting>

              <Setting label="Retry Attempts" description="Number of reconnection attempts">
                <input
                  type="number"
                  value={localMcpDefaults.retryAttempts}
                  onChange={(e) => setLocalMcpDefaults({ ...localMcpDefaults, retryAttempts: parseInt(e.target.value) })}
                  className="bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary text-sm w-24"
                  min={0}
                  max={10}
                />
              </Setting>

              <div className="bg-surface rounded-xl border border-border p-5">
                <h3 className="font-medium mb-2">HexStrike MCP</h3>
                <p className="text-sm text-text-secondary mb-4">
                  150+ integrated security tools including Nikto, Nuclei, SQLMap, and more.
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                  <span className="text-sm text-text-secondary">Status: check /api/dashboard/health</span>
                </div>
              </div>
            </Section>
          )}

          {/* Bug Bounty */}
          {activeSection === 'bugbounty' && (
            <Section title="Bug Bounty Platforms" description="Connect to bug bounty platforms and sync program data">
              {/* Data Sources */}
              <div className="bg-surface rounded-xl border border-border p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#f0c040]" />
                  GitHub Data Sources
                </h3>
                <p className="text-xs text-text-secondary mb-4">
                  Hourly-updated scope data from bug bounty platforms. Add GitHub repos that provide domains.txt, wildcards.txt, and platform JSON files.
                </p>

                {dataSources.map((source) => (
                  <div key={source.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleDataSource(source.id)}
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${source.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                        title={source.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-mono truncate">{source.repoUrl}</div>
                        <div className="text-[10px] text-text-secondary">
                          {source.lastSynced ? `Synced ${new Date(source.lastSynced).toLocaleString()}` : 'Never synced'}
                          {' · '}{source.branch}/{source.dataPath}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                      <a
                        href={`https://github.com/${source.repoUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-white/[0.06] text-text-secondary hover:text-white transition-colors"
                        title="View on GitHub"
                      >
                        <Globe className="w-3.5 h-3.5" />
                      </a>
                      {source.id !== 'bounty-targets-data' && (
                        <button
                          onClick={() => removeDataSource(source.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                          title="Remove source"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add new source */}
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    placeholder="owner/repo (e.g. arkadiyt/bounty-targets-data)"
                    className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newSourceUrl.trim()) {
                        const repo = newSourceUrl.trim()
                        if (repo.includes('/') && !dataSources.some(s => s.repoUrl === repo)) {
                          addDataSource({
                            id: `custom-${Date.now()}`,
                            name: repo.split('/')[1],
                            repoUrl: repo,
                            branch: 'main',
                            dataPath: 'data',
                            enabled: true,
                            lastSynced: null,
                          })
                          setNewSourceUrl('')
                          toast.success(`Added ${repo}`)
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const repo = newSourceUrl.trim()
                      if (repo.includes('/') && !dataSources.some(s => s.repoUrl === repo)) {
                        addDataSource({
                          id: `custom-${Date.now()}`,
                          name: repo.split('/')[1],
                          repoUrl: repo,
                          branch: 'main',
                          dataPath: 'data',
                          enabled: true,
                          lastSynced: null,
                        })
                        setNewSourceUrl('')
                        toast.success(`Added ${repo}`)
                      }
                    }}
                    disabled={!newSourceUrl.trim() || !newSourceUrl.includes('/')}
                    className="flex items-center gap-1 px-3 py-2 bg-[#f0c040]/10 text-[#f0c040] border border-[#f0c040]/20 rounded-lg text-xs font-medium hover:bg-[#f0c040]/20 transition-colors disabled:opacity-30"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
              </div>

              {/* Sync status + button */}
              <div className="bg-surface rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">Program Data</h3>
                    <p className="text-xs text-text-secondary">
                      {programs.length > 0 ? `${programs.length} programs loaded` : 'No data loaded yet'}
                      {lastUpdated && ` · Updated ${new Date(lastUpdated).toLocaleString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      fetchBugBountyData().then(() => {
                        const { programs: p, error: e } = useBugBountyStore.getState()
                        if (e) {
                          toast.error(e)
                        } else {
                          toast.success(`Synced ${p.length} programs`)
                        }
                      })
                    }}
                    disabled={isBugBountyLoading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#f0c040]/10 text-[#f0c040] border border-[#f0c040]/20 hover:bg-[#f0c040]/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isBugBountyLoading ? 'animate-spin' : ''}`} />
                    {isBugBountyLoading ? 'Syncing...' : 'Sync All Sources'}
                  </button>
                </div>
                {bugBountyError && (
                  <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-3">
                    {bugBountyError}
                  </div>
                )}
                <div className="text-xs text-text-secondary">
                  Fetches domains.txt, wildcards.txt, and platform data (HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy) from enabled sources.
                </div>
              </div>

              {/* Platform API keys */}
              {[
                { name: 'HackerOne', key: 'hackerone' as const, url: 'https://api.hackerone.com', color: 'text-[#53c3a5]', link: 'https://www.hackerone.com/product/attack-surface-management' },
                { name: 'Bugcrowd', key: 'bugcrowd' as const, url: 'https://api.bugcrowd.com', color: 'text-[#f46a28]', link: 'https://www.bugcrowd.com/products/platform/' },
                { name: 'Intigriti', key: 'intigriti' as const, url: 'https://api.intigriti.com', color: 'text-[#6d3fcf]', link: 'https://www.intigriti.com/researcher' },
              ].map((platform) => (
                <div key={platform.key} className="bg-surface rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className={`font-semibold ${platform.color}`}>{platform.name}</h3>
                      <p className="text-xs text-text-secondary">{platform.url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={platform.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Connect ↗
                      </a>
                      <div className={`w-2 h-2 rounded-full ${bugBountyKeys[platform.key] ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">API Key</label>
                    <input
                      type="password"
                      value={bugBountyKeys[platform.key]}
                      onChange={(e) => setBugBountyKey(platform.key, e.target.value)}
                      placeholder="Enter your API key..."
                      className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <Section title="Notifications" description="Configure notification preferences">
              <Setting label="Enable Notifications" description="Receive alerts for agent and workflow events">
                <Toggle value={notifications} onChange={(v) => updateSettings({ notifications: v })} />
              </Setting>
              <Setting label="Agent Completion" description="Notify when an agent finishes a task">
                <Toggle value={notificationSettings.agentCompletion} onChange={(v) => updateNotificationSettings({ agentCompletion: v })} />
              </Setting>
              <Setting label="Workflow Status" description="Notify on workflow state changes">
                <Toggle value={notificationSettings.workflowStatus} onChange={(v) => updateNotificationSettings({ workflowStatus: v })} />
              </Setting>
              <Setting label="Container Events" description="Notify when containers start or stop">
                <Toggle value={notificationSettings.containerEvents} onChange={(v) => updateNotificationSettings({ containerEvents: v })} />
              </Setting>
              <Setting label="Security Findings" description="Notify when vulnerabilities are discovered">
                <Toggle value={notificationSettings.securityFindings} onChange={(v) => updateNotificationSettings({ securityFindings: v })} />
              </Setting>
            </Section>
          )}

          {/* API Keys - Now shows provider config */}
          {activeSection === 'api-keys' && (
            <Section title="API Keys" description="Configure AI provider credentials">
              <div className="bg-surface rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-400" />
                  Configured Providers
                </h3>
                <div className="space-y-2">
                  {Object.entries(providers).map(([key, config]) => {
                    const info = PROVIDER_INFO[key]
                    if (!info) return null
                    const Icon = info.icon
                    const isConfigured = config.apiKey || (key === 'ollama' && isOllamaConnected)
                    const isActive = activeProvider === key

                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isActive ? 'border-[#f0c040]/50 bg-[#f0c040]/5' : 'border-border bg-surface-light'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-5 h-5 ${info.color}`} />
                          <div>
                            <span className="font-medium text-sm">{info.name}</span>
                            {isActive && <span className="ml-2 text-xs text-[#f0c040]">(active)</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-text-secondary">
                            {isConfigured ? 'Configured' : 'Not configured'}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-gray-500'}`} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm text-yellow-400">Security Notice</h4>
                  <p className="text-xs text-text-secondary mt-1">
                    API keys are stored locally in your browser and persisted to localStorage. They are never sent to our servers.
                  </p>
                </div>
              </div>
            </Section>
          )}

          {/* Security */}
          {activeSection === 'security' && (
            <Section title="Security" description="Platform security configuration">
              <div className="space-y-4">
                <Setting label="Rate Limiting" description="Protect the API from abuse">
                  <Toggle value={securitySettings.rateLimiting} onChange={(v) => updateSecuritySettings({ rateLimiting: v })} />
                </Setting>
                <Setting label="CORS Protection" description="Restrict cross-origin requests">
                  <Toggle value={securitySettings.corsProtection} onChange={(v) => updateSecuritySettings({ corsProtection: v })} />
                </Setting>
                <Setting label="Audit Logging" description="Log all security-relevant events">
                  <Toggle value={securitySettings.auditLogging} onChange={(v) => updateSecuritySettings({ auditLogging: v })} />
                </Setting>
                <Setting label="SSL/TLS Enforcement" description="Require HTTPS connections">
                  <Toggle value={securitySettings.sslEnforcement} onChange={(v) => updateSecuritySettings({ sslEnforcement: v })} />
                </Setting>
                <Setting label="Intrusion Detection" description="Monitor for suspicious activity">
                  <Toggle value={securitySettings.intrusionDetection} onChange={(v) => updateSecuritySettings({ intrusionDetection: v })} />
                </Setting>
              </div>
            </Section>
          )}

          {/* Model Router */}
          {activeSection === 'model-router' && (
            <ModelRouterSection />
          )}

          {/* Advanced */}
          {activeSection === 'advanced' && (
            <Section title="Advanced" description="Advanced configuration options">
              <Setting label="Debug Mode" description="Enable verbose logging for troubleshooting">
                <Toggle value={advancedSettings.debugMode} onChange={(v) => updateAdvancedSettings({ debugMode: v })} />
              </Setting>

              <Setting label="Telemetry" description="Send anonymous usage statistics">
                <Toggle value={advancedSettings.telemetry} onChange={(v) => updateAdvancedSettings({ telemetry: v })} />
              </Setting>

              <div className="bg-surface rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Infrastructure</h3>
                  <button
                    onClick={fetchHealthStatus}
                    disabled={isLoadingHealth}
                    className="text-xs flex items-center gap-1 text-primary hover:text-primary/80"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingHealth ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
                <p className="text-sm text-text-secondary mb-4">Connected services and their status</p>
                <div className="space-y-3">
                  {healthStatus.length > 0 ? (
                    healthStatus.map((svc) => (
                      <div key={svc.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${svc.status === 'connected' ? 'bg-green-500' : 'bg-gray-500'}`} />
                          <span className="text-sm">{svc.name}</span>
                        </div>
                        <span className="text-xs text-text-secondary font-mono">:{svc.port}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-text-secondary">Loading services...</div>
                  )}
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
                <h3 className="font-semibold text-red-400 mb-2">Danger Zone</h3>
                <p className="text-sm text-text-secondary mb-4">These actions cannot be undone</p>
                <div className="space-y-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset All Settings
                  </button>
                </div>
              </div>
            </Section>
          )}
        </div>

        {/* Save Bar */}
        <div className="border-t border-border p-4 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 hover:bg-surface-light border border-border rounded-lg transition-colors text-sm text-text-secondary"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm transition-all ${
              saved ? 'bg-green-600 text-white' : 'bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10'
            }`}
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// Reusable components
function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-text-secondary">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Setting({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-text-secondary mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3 ml-8 flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[#f0c040]' : 'bg-surface-light border border-border'}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-6' : 'left-1'}`}
      />
    </button>
  )
}

// ─── Theme Section ────────────────────────────────────────────────────────

// Agent roster for per-agent themes
const AGENT_ROSTER = [
  { id: 'pathfinder', name: 'PATHFINDER', color: '#22c55e' },
  { id: 'breach', name: 'BREACH', color: '#ef4444' },
  { id: 'phantom', name: 'PHANTOM', color: '#06b6d4' },
  { id: 'specter', name: 'SPECTER', color: '#8b5cf6' },
  { id: 'cipher', name: 'CIPHER', color: '#f59e0b' },
  { id: 'scribe', name: 'SCRIBE', color: '#ec4899' },
  { id: 'sam', name: 'SAM', color: '#a78bfa' },
  { id: 'brief', name: 'BRIEF', color: '#fbbf24' },
  { id: 'sage', name: 'SAGE', color: '#10b981' },
  { id: 'lens', name: 'LENS', color: '#06b6d4' },
  { id: 'maintainer', name: 'MAINTAINER', color: '#10b981' },
]

function ThemeSection({ autoSave, updateSettings }: { autoSave: boolean; updateSettings: (s: any) => void }) {
  const {
    activeThemeId,
    setActiveTheme,
    addCustomTheme,
    deleteCustomTheme,
    duplicateTheme,
    importTheme,
    exportTheme,
    getAllThemes,
    getActiveTheme,
    agentThemes,
    setAgentTheme,
    schedule,
    setSchedule,
    syncToBackend,
  } = useThemeStore()

  const [editingTheme, setEditingTheme] = useState<HarbingerTheme | null>(null)
  const [previewTokens, setPreviewTokens] = useState<ThemeTokens | null>(null)
  const [themeTab, setThemeTab] = useState<'gallery' | 'schedule' | 'agents' | 'generate'>('gallery')
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const allThemes = getAllThemes()
  const activeTheme = getActiveTheme()

  // Color token fields for the editor
  const TOKEN_FIELDS: { key: keyof ThemeTokens; label: string; group: string }[] = [
    { key: 'background', label: 'Background', group: 'Surfaces' },
    { key: 'surface', label: 'Surface', group: 'Surfaces' },
    { key: 'surfaceLight', label: 'Surface Light', group: 'Surfaces' },
    { key: 'surfaceDark', label: 'Surface Dark', group: 'Surfaces' },
    { key: 'textPrimary', label: 'Text Primary', group: 'Text' },
    { key: 'textSecondary', label: 'Text Secondary', group: 'Text' },
    { key: 'border', label: 'Border', group: 'Text' },
    { key: 'accent', label: 'Accent', group: 'Colors' },
    { key: 'accentHover', label: 'Accent Hover', group: 'Colors' },
    { key: 'danger', label: 'Danger', group: 'Colors' },
    { key: 'success', label: 'Success', group: 'Colors' },
    { key: 'warning', label: 'Warning', group: 'Colors' },
    { key: 'info', label: 'Info', group: 'Colors' },
    { key: 'scrollbarTrack', label: 'Scrollbar Track', group: 'UI' },
    { key: 'scrollbarThumb', label: 'Scrollbar Thumb', group: 'UI' },
    { key: 'terminalBg', label: 'Terminal BG', group: 'UI' },
    { key: 'glassBg', label: 'Glass BG', group: 'UI' },
  ]

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const json = ev.target?.result as string
      const theme = importTheme(json)
      if (theme) {
        toast.success(`Imported "${theme.name}"`)
      } else {
        toast.error('Invalid theme file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExport = (id: string) => {
    const json = exportTheme(id)
    if (!json) return
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `harbinger-theme-${id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Theme exported')
  }

  const startNewTheme = () => {
    const base = getActiveTheme()
    const now = new Date().toISOString()
    setEditingTheme({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'My Custom Theme',
      description: '',
      author: 'User',
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      fontFamily: base.fontFamily,
      tags: ['custom'],
      builtin: false,
      tokens: { ...base.tokens },
    })
    setPreviewTokens({ ...base.tokens })
  }

  const startEditTheme = (theme: HarbingerTheme) => {
    setEditingTheme({ ...theme, tokens: { ...theme.tokens }, tags: [...theme.tags] })
    setPreviewTokens({ ...theme.tokens })
  }

  const saveEditingTheme = () => {
    if (!editingTheme || !previewTokens) return
    const final = { ...editingTheme, tokens: previewTokens }
    const existing = allThemes.find((t) => t.id === final.id && !t.builtin)
    if (existing) {
      useThemeStore.getState().updateCustomTheme(final.id, final)
    } else {
      addCustomTheme(final)
    }
    setActiveTheme(final.id)
    setEditingTheme(null)
    setPreviewTokens(null)
    toast.success(`Theme "${final.name}" saved and applied`)
  }

  const cancelEdit = () => {
    applyTheme(activeTheme.tokens, activeTheme.fontFamily)
    setEditingTheme(null)
    setPreviewTokens(null)
  }

  const updatePreviewToken = (key: keyof ThemeTokens, value: string) => {
    if (!previewTokens || !editingTheme) return
    const updated = { ...previewTokens, [key]: value }
    setPreviewTokens(updated)
    applyTheme(updated, editingTheme.fontFamily)
  }

  const handleGenerate = async () => {
    if (!generatePrompt.trim()) return
    setIsGenerating(true)
    try {
      const res = await fetch('/api/themes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('harbinger-token') || ''}` },
        body: JSON.stringify({ description: generatePrompt }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Theme prompt generated — use it with any AI agent to create the token JSON, then import it')
        // Copy the prompt to clipboard for use with agents
        navigator.clipboard.writeText(data.prompt).catch(() => {})
        toast('AI prompt copied to clipboard', { icon: '📋' })
      } else {
        toast.error(data.error || 'Generation failed')
      }
    } catch {
      toast.error('Could not reach backend')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSyncBackend = async () => {
    await syncToBackend()
    toast.success('Themes synced to backend')
  }

  // ─── Theme Editor Mode ─────────────────────────────────────────────
  if (editingTheme && previewTokens) {
    const groups = TOKEN_FIELDS.reduce<Record<string, typeof TOKEN_FIELDS>>((acc, f) => {
      ;(acc[f.group] ||= []).push(f)
      return acc
    }, {})

    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Theme Editor
            </h2>
            <p className="text-text-secondary text-sm">Changes preview live — save to keep them</p>
          </div>
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-light transition-colors">
              Cancel
            </button>
            <button onClick={saveEditingTheme} className="px-4 py-2 text-sm rounded-lg transition-colors" style={{ border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }}>
              <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Save Theme</span>
            </button>
          </div>
        </div>

        {/* Name and Meta */}
        <div className="bg-surface rounded-xl border border-border p-5 mb-4 space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Theme Name</label>
            <input
              type="text"
              value={editingTheme.name}
              onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Description</label>
            <input
              type="text"
              value={editingTheme.description}
              onChange={(e) => setEditingTheme({ ...editingTheme, description: e.target.value })}
              placeholder="Short description..."
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Font Family</label>
            <div className="grid grid-cols-3 gap-2">
              {(['mono', 'sans', 'system'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setEditingTheme({ ...editingTheme, fontFamily: f })
                    applyTheme(previewTokens, f)
                  }}
                  className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                    editingTheme.fontFamily === f ? '' : 'border-border hover:border-border/80'
                  }`}
                  style={editingTheme.fontFamily === f ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' } : {}}
                >
                  <Type className="w-3.5 h-3.5 inline mr-1.5" />
                  {f === 'mono' ? 'Monospace' : f === 'sans' ? 'Sans Serif' : 'System'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Color Token Groups */}
        {Object.entries(groups).map(([group, fields]) => (
          <div key={group} className="bg-surface rounded-xl border border-border p-5 mb-4">
            <h3 className="font-semibold text-sm mb-4">{group}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={previewTokens[field.key].startsWith('rgba') ? '#888888' : previewTokens[field.key]}
                    onChange={(e) => updatePreviewToken(field.key, e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <div className="flex-1">
                    <label className="block text-xs font-medium">{field.label}</label>
                    <input
                      type="text"
                      value={previewTokens[field.key]}
                      onChange={(e) => updatePreviewToken(field.key, e.target.value)}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none mt-0.5"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Live Preview Panel */}
        <div className="bg-surface rounded-xl border border-border p-5 mb-4">
          <h3 className="font-semibold text-sm mb-4">Live Preview</h3>
          <ThemePreview tokens={previewTokens} />
        </div>
      </div>
    )
  }

  // ─── Tab navigation ─────────────────────────────────────────────────
  const tabs = [
    { id: 'gallery' as const, label: 'Themes', icon: Palette },
    { id: 'generate' as const, label: 'Generate', icon: Zap },
    { id: 'agents' as const, label: 'Agent Themes', icon: Bot },
    { id: 'schedule' as const, label: 'Schedule', icon: Moon },
  ]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Appearance</h2>
        <p className="text-text-secondary">Themes, scheduling, and per-agent customization</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setThemeTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              themeTab === tab.id
                ? 'text-[var(--color-accent)] border-[var(--color-accent)]'
                : 'text-text-secondary border-transparent hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Gallery Tab ─── */}
      {themeTab === 'gallery' && (
        <div className="space-y-4">
          {/* Actions bar */}
          <div className="flex items-center gap-2">
            <button onClick={startNewTheme} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors" style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}>
              <Plus className="w-4 h-4" /> New Theme
            </button>
            <button onClick={handleImport} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border hover:bg-surface-light transition-colors">
              <Upload className="w-4 h-4" /> Import
            </button>
            <button onClick={handleSyncBackend} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border hover:bg-surface-light transition-colors">
              <RefreshCw className="w-4 h-4" /> Sync to Backend
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} className="hidden" />
          </div>

          {/* Theme Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allThemes.map((theme) => {
              const isActive = theme.id === activeThemeId
              return (
                <motion.div
                  key={theme.id}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-xl border overflow-hidden cursor-pointer transition-all"
                  style={{
                    borderColor: isActive ? theme.tokens.accent : theme.tokens.border,
                    boxShadow: isActive ? `0 0 0 2px ${theme.tokens.accent}40` : 'none',
                  }}
                  onClick={() => setActiveTheme(theme.id)}
                >
                  {/* Mini preview */}
                  <div className="h-24 relative" style={{ background: theme.tokens.background }}>
                    <div className="absolute inset-2 flex gap-1.5">
                      <div className="w-8 rounded-sm" style={{ background: theme.tokens.surface, border: `1px solid ${theme.tokens.border}` }}>
                        <div className="w-3 h-1.5 rounded-full mx-auto mt-2" style={{ background: theme.tokens.accent }} />
                        <div className="w-3 h-1 rounded-full mx-auto mt-1.5 opacity-40" style={{ background: theme.tokens.textSecondary }} />
                        <div className="w-3 h-1 rounded-full mx-auto mt-1 opacity-40" style={{ background: theme.tokens.textSecondary }} />
                      </div>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="flex gap-1.5 flex-1">
                          <div className="flex-1 rounded-sm p-1.5" style={{ background: theme.tokens.surface, border: `1px solid ${theme.tokens.border}` }}>
                            <div className="w-6 h-1 rounded-full" style={{ background: theme.tokens.textPrimary, opacity: 0.6 }} />
                            <div className="text-[8px] font-bold mt-0.5" style={{ color: theme.tokens.accent }}>42</div>
                          </div>
                          <div className="flex-1 rounded-sm p-1.5" style={{ background: theme.tokens.surface, border: `1px solid ${theme.tokens.border}` }}>
                            <div className="w-6 h-1 rounded-full" style={{ background: theme.tokens.textPrimary, opacity: 0.6 }} />
                            <div className="text-[8px] font-bold mt-0.5" style={{ color: theme.tokens.success }}>OK</div>
                          </div>
                          <div className="flex-1 rounded-sm p-1.5" style={{ background: theme.tokens.surface, border: `1px solid ${theme.tokens.border}` }}>
                            <div className="w-6 h-1 rounded-full" style={{ background: theme.tokens.textPrimary, opacity: 0.6 }} />
                            <div className="text-[8px] font-bold mt-0.5" style={{ color: theme.tokens.danger }}>3</div>
                          </div>
                        </div>
                        <div className="flex-1 rounded-sm p-1" style={{ background: theme.tokens.terminalBg, border: `1px solid ${theme.tokens.border}` }}>
                          <div className="w-16 h-0.5 rounded-full mt-0.5" style={{ background: theme.tokens.success, opacity: 0.6 }} />
                          <div className="w-12 h-0.5 rounded-full mt-1" style={{ background: theme.tokens.textSecondary, opacity: 0.4 }} />
                        </div>
                      </div>
                    </div>
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: theme.tokens.accent }}>
                        <Check className="w-3 h-3" style={{ color: theme.tokens.background }} />
                      </div>
                    )}
                  </div>
                  {/* Info bar */}
                  <div className="px-3 py-2.5 flex items-center justify-between" style={{ background: theme.tokens.surface, borderTop: `1px solid ${theme.tokens.border}` }}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: theme.tokens.textPrimary }}>{theme.name}</div>
                      <div className="text-[10px] truncate" style={{ color: theme.tokens.textSecondary }}>{theme.description}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: theme.tokens.accent }} />
                      {!theme.builtin && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); startEditTheme(theme) }} className="p-1 rounded hover:bg-black/20 transition-colors" title="Edit">
                            <Edit3 className="w-3 h-3" style={{ color: theme.tokens.textSecondary }} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteCustomTheme(theme.id) }} className="p-1 rounded hover:bg-black/20 transition-colors" title="Delete">
                            <Trash2 className="w-3 h-3" style={{ color: theme.tokens.danger }} />
                          </button>
                        </>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); duplicateTheme(theme.id) }} className="p-1 rounded hover:bg-black/20 transition-colors" title="Duplicate">
                        <Copy className="w-3 h-3" style={{ color: theme.tokens.textSecondary }} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleExport(theme.id) }} className="p-1 rounded hover:bg-black/20 transition-colors" title="Export">
                        <Download className="w-3 h-3" style={{ color: theme.tokens.textSecondary }} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Auto Save toggle */}
          <Setting label="Auto Save" description="Automatically save configuration changes">
            <Toggle value={autoSave} onChange={(v: boolean) => updateSettings({ autoSave: v })} />
          </Setting>
        </div>
      )}

      {/* ─── Generate Tab ─── */}
      {themeTab === 'generate' && (
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              Generate Theme from Description
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Describe your ideal UI in plain English. The system generates an AI prompt that any agent (SAM, SAGE, or external) can use to produce a complete theme JSON.
            </p>
            <textarea
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              placeholder="e.g., &quot;A deep ocean theme with bioluminescent accents — dark navy background, glowing teal highlights, soft coral warnings, and pearl-white text&quot;"
              rows={4}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm font-mono focus:outline-none resize-none"
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={handleGenerate}
                disabled={!generatePrompt.trim() || isGenerating}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
                style={{ border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }}
              >
                <Zap className="w-4 h-4" />
                {isGenerating ? 'Generating...' : 'Generate Prompt'}
              </button>
            </div>
          </div>

          {/* Quick-start examples */}
          <div className="bg-surface rounded-xl border border-border p-5">
            <h3 className="font-semibold text-sm mb-3">Inspiration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                'Deep ocean with bioluminescent teal highlights',
                'Minimalist grayscale with electric blue accents',
                'Warm ember tones — smoldering orange on charcoal',
                'Military tactical — olive drab, amber warnings, dark khaki',
                'Synthwave sunset — pink-to-purple gradient vibes',
                'Matrix-inspired — green phosphor on pitch black',
              ].map((desc) => (
                <button
                  key={desc}
                  onClick={() => setGeneratePrompt(desc)}
                  className="text-left px-3 py-2 text-xs rounded-lg border border-border hover:bg-surface-light transition-colors text-text-secondary hover:text-white"
                >
                  {desc}
                </button>
              ))}
            </div>
          </div>

          {/* Import generated JSON */}
          <div className="bg-surface rounded-xl border border-border p-5">
            <h3 className="font-semibold text-sm mb-2">Import Generated Theme</h3>
            <p className="text-xs text-text-secondary mb-3">
              Paste the JSON tokens your agent generated, or import a .json file.
            </p>
            <div className="flex gap-2">
              <button onClick={handleImport} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border hover:bg-surface-light transition-colors">
                <Upload className="w-4 h-4" /> Import .json
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Agent Themes Tab ─── */}
      {themeTab === 'agents' && (
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-1">Per-Agent Theme Override</h3>
            <p className="text-xs text-text-secondary mb-4">
              Assign a theme to each agent. When viewing an agent's chat or workspace, their theme takes priority.
            </p>
            <div className="space-y-3">
              {AGENT_ROSTER.map((agent) => {
                const assigned = agentThemes[agent.id]
                const assignedTheme = assigned ? allThemes.find((t) => t.id === assigned) : null
                return (
                  <div key={agent.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${agent.color}20`, color: agent.color }}>
                        {agent.name[0]}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{agent.name}</span>
                        {assignedTheme && (
                          <span className="ml-2 text-xs" style={{ color: assignedTheme.tokens.accent }}>
                            {assignedTheme.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <select
                      value={assigned || ''}
                      onChange={(e) => setAgentTheme(agent.id, e.target.value || null)}
                      className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none w-48"
                    >
                      <option value="">Default (global)</option>
                      {allThemes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Accent swatch preview */}
          <div className="bg-surface rounded-xl border border-border p-5">
            <h3 className="font-semibold text-sm mb-3">Agent Color Map</h3>
            <div className="flex flex-wrap gap-3">
              {AGENT_ROSTER.map((agent) => {
                const tid = agentThemes[agent.id]
                const theme = tid ? allThemes.find((t) => t.id === tid) : null
                const accent = theme ? theme.tokens.accent : agent.color
                return (
                  <div key={agent.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border">
                    <div className="w-3 h-3 rounded-full" style={{ background: accent }} />
                    <span className="text-xs font-mono">{agent.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Schedule Tab ─── */}
      {themeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Theme Scheduling</h3>
                <p className="text-xs text-text-secondary">Automatically switch themes based on time of day</p>
              </div>
              <Toggle value={schedule.enabled} onChange={(v: boolean) => setSchedule({ enabled: v })} />
            </div>

            <div className={`space-y-4 ${!schedule.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* Day theme */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-24">
                  <Sun className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm">Day</span>
                </div>
                <input
                  type="time"
                  value={schedule.dayStart}
                  onChange={(e) => setSchedule({ dayStart: e.target.value })}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none"
                />
                <select
                  value={schedule.dayThemeId}
                  onChange={(e) => setSchedule({ dayThemeId: e.target.value })}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                >
                  {allThemes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {schedule.dayThemeId && (() => {
                  const t = allThemes.find((th) => th.id === schedule.dayThemeId)
                  return t ? <div className="w-4 h-4 rounded-full" style={{ background: t.tokens.accent }} /> : null
                })()}
              </div>

              {/* Night theme */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-24">
                  <Moon className="w-4 h-4 text-blue-400" />
                  <span className="text-sm">Night</span>
                </div>
                <input
                  type="time"
                  value={schedule.nightStart}
                  onChange={(e) => setSchedule({ nightStart: e.target.value })}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none"
                />
                <select
                  value={schedule.nightThemeId}
                  onChange={(e) => setSchedule({ nightThemeId: e.target.value })}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                >
                  {allThemes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {schedule.nightThemeId && (() => {
                  const t = allThemes.find((th) => th.id === schedule.nightThemeId)
                  return t ? <div className="w-4 h-4 rounded-full" style={{ background: t.tokens.accent }} /> : null
                })()}
              </div>
            </div>
          </div>

          {/* Timeline visualization */}
          <div className="bg-surface rounded-xl border border-border p-5">
            <h3 className="font-semibold text-sm mb-3">24-Hour Timeline</h3>
            <div className="flex h-8 rounded-lg overflow-hidden border border-border">
              {Array.from({ length: 24 }, (_, h) => {
                const hh = String(h).padStart(2, '0') + ':00'
                const isDay = hh >= schedule.dayStart && hh < schedule.nightStart
                const dayTheme = allThemes.find((t) => t.id === schedule.dayThemeId)
                const nightTheme = allThemes.find((t) => t.id === schedule.nightThemeId)
                const theme = isDay ? dayTheme : nightTheme
                return (
                  <div
                    key={h}
                    className="flex-1 flex items-end justify-center"
                    style={{ background: theme?.tokens.background || '#0a0a0f' }}
                    title={`${hh} — ${isDay ? 'Day' : 'Night'} theme`}
                  >
                    {h % 6 === 0 && (
                      <span className="text-[8px] mb-0.5" style={{ color: theme?.tokens.textSecondary || '#888' }}>{h}</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-text-secondary">
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>12 AM</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Reusable theme preview component
function ThemePreview({ tokens }: { tokens: ThemeTokens }) {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: tokens.border, background: tokens.background }}>
      <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ background: tokens.surface, borderColor: tokens.border }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: tokens.danger }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: tokens.warning }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: tokens.success }} />
        <span className="text-xs font-mono ml-2" style={{ color: tokens.textSecondary }}>harbinger — command center</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg p-3 border" style={{ background: tokens.surface, borderColor: tokens.border }}>
          <div className="text-xs font-semibold mb-1" style={{ color: tokens.textPrimary }}>Agents Online</div>
          <div className="text-2xl font-bold" style={{ color: tokens.accent }}>6</div>
          <div className="text-[10px] mt-1" style={{ color: tokens.textSecondary }}>All operational</div>
        </div>
        <div className="rounded-lg p-3 border" style={{ background: tokens.surface, borderColor: tokens.border }}>
          <div className="text-xs font-semibold mb-1" style={{ color: tokens.textPrimary }}>Findings</div>
          <div className="text-2xl font-bold" style={{ color: tokens.danger }}>12</div>
          <div className="text-[10px] mt-1" style={{ color: tokens.textSecondary }}>3 critical</div>
        </div>
        <div className="rounded-lg p-3 border" style={{ background: tokens.surface, borderColor: tokens.border }}>
          <div className="text-xs font-semibold mb-1" style={{ color: tokens.textPrimary }}>Workflows</div>
          <div className="text-2xl font-bold" style={{ color: tokens.success }}>4</div>
          <div className="text-[10px] mt-1" style={{ color: tokens.textSecondary }}>2 running</div>
        </div>
        <div className="col-span-2 rounded-lg p-3 font-mono text-xs" style={{ background: tokens.terminalBg, border: `1px solid ${tokens.border}` }}>
          <div style={{ color: tokens.success }}>$ harbinger scan --target example.com</div>
          <div style={{ color: tokens.textSecondary }}>[PATHFINDER] Enumerating subdomains...</div>
          <div style={{ color: tokens.warning }}>[BREACH] Found 3 potential vectors</div>
          <div style={{ color: tokens.accent }}>Scan complete. 12 findings.</div>
        </div>
        <div className="rounded-lg p-3 border space-y-2" style={{ background: tokens.surface, borderColor: tokens.border }}>
          <button className="w-full px-3 py-1.5 rounded text-xs font-medium border" style={{ borderColor: tokens.accent, color: tokens.accent }}>Primary</button>
          <button className="w-full px-3 py-1.5 rounded text-xs font-medium" style={{ background: tokens.danger, color: '#fff' }}>Danger</button>
          <button className="w-full px-3 py-1.5 rounded text-xs font-medium border" style={{ background: tokens.surfaceLight, borderColor: tokens.border, color: tokens.textPrimary }}>Secondary</button>
        </div>
      </div>
    </div>
  )
}

// Channels configuration section (Discord, Telegram, Slack)
function ChannelsSection() {
  const [channels, setChannels] = useState<Record<string, any>>({})
  const [discordToken, setDiscordToken] = useState('')
  const [discordGuild, setDiscordGuild] = useState('')
  const [discordChannel, setDiscordChannel] = useState('')
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramChat, setTelegramChat] = useState('')
  const [testing, setTesting] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('harbinger-token')
    fetch('/api/channels', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : {})
      .then(setChannels)
      .catch(() => {})
  }, [])

  const saveChannel = async (channel: string) => {
    setSaving(channel)
    try {
      const body = channel === 'discord'
        ? { botToken: discordToken, guildId: discordGuild, channelId: discordChannel }
        : { botToken: telegramToken, chatId: telegramChat }
      const res = await fetch(`/api/channels/${channel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('harbinger-token') || ''}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`${channel} configured!`)
        setChannels(prev => ({ ...prev, [channel]: { ...prev[channel], enabled: data.enabled, status: data.status, hasToken: true } }))
      } else {
        toast.error(data.error || 'Failed to configure')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(null)
    }
  }

  const testChannel = async (channel: string) => {
    setTesting(channel)
    try {
      const res = await fetch(`/api/channels/${channel}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('harbinger-token') || ''}` },
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`${channel} connection OK`)
      } else {
        toast.error(data.error || `${channel} connection failed`)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setTesting(null)
    }
  }

  return (
    <Section title="Channels" description="Connect Discord, Telegram, and Slack for remote agent control and alerts">
      {/* Discord */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#5865F215' }}>
              <span className="text-sm font-bold" style={{ color: '#5865F2' }}>#</span>
            </div>
            <div>
              <h3 className="font-semibold text-sm">Discord</h3>
              <p className="text-xs text-text-secondary">Bot alerts and agent commands</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {channels.discord?.hasToken && (
              <div className={`w-2 h-2 rounded-full ${channels.discord?.status === 'connected' ? 'bg-green-500' : 'bg-gray-500'}`} />
            )}
            <span className="text-xs text-text-secondary">{channels.discord?.hasToken ? channels.discord.status : 'Not configured'}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Bot Token</label>
            <input
              type="password"
              value={discordToken}
              onChange={(e) => setDiscordToken(e.target.value)}
              placeholder="MTIz..."
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Guild/Server ID</label>
              <input
                type="text"
                value={discordGuild}
                onChange={(e) => setDiscordGuild(e.target.value)}
                placeholder="Server ID"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Channel ID</label>
              <input
                type="text"
                value={discordChannel}
                onChange={(e) => setDiscordChannel(e.target.value)}
                placeholder="Channel ID"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => saveChannel('discord')}
              disabled={!discordToken || saving === 'discord'}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
              style={{ border: '1px solid #5865F2', color: '#5865F2' }}
            >
              <Save className="w-3.5 h-3.5" />
              {saving === 'discord' ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => testChannel('discord')}
              disabled={!channels.discord?.hasToken || testing === 'discord'}
              className="flex items-center gap-2 px-4 py-2 bg-surface-light border border-border rounded-lg text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing === 'discord' ? 'animate-spin' : ''}`} />
              Test
            </button>
          </div>
        </div>
      </div>

      {/* Telegram */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#0088cc15' }}>
              <span className="text-sm" style={{ color: '#0088cc' }}>TG</span>
            </div>
            <div>
              <h3 className="font-semibold text-sm">Telegram</h3>
              <p className="text-xs text-text-secondary">Bot commands, voice messages, file sharing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {channels.telegram?.hasToken && (
              <div className={`w-2 h-2 rounded-full ${channels.telegram?.status === 'connected' ? 'bg-green-500' : 'bg-gray-500'}`} />
            )}
            <span className="text-xs text-text-secondary">{channels.telegram?.hasToken ? channels.telegram.status : 'Not configured'}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Bot Token</label>
            <input
              type="password"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              placeholder="123456:ABC-DEF..."
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Chat ID</label>
            <input
              type="text"
              value={telegramChat}
              onChange={(e) => setTelegramChat(e.target.value)}
              placeholder="-1001234567890"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => saveChannel('telegram')}
              disabled={!telegramToken || saving === 'telegram'}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
              style={{ border: '1px solid #0088cc', color: '#0088cc' }}
            >
              <Save className="w-3.5 h-3.5" />
              {saving === 'telegram' ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => testChannel('telegram')}
              disabled={!channels.telegram?.hasToken || testing === 'telegram'}
              className="flex items-center gap-2 px-4 py-2 bg-surface-light border border-border rounded-lg text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing === 'telegram' ? 'animate-spin' : ''}`} />
              Test
            </button>
          </div>
        </div>
      </div>

      {/* Setup links */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-sm text-yellow-400">Setup Guides</h4>
          <div className="text-xs text-text-secondary mt-1 space-y-1">
            <p>
              <strong>Discord:</strong> Create app at{' '}
              <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">discord.com/developers</a>
              {' '}— enable Bot, copy token, invite to server with Message + Slash Command permissions.
            </p>
            <p>
              <strong>Telegram:</strong> Message{' '}
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@BotFather</a>
              {' '}→ /newbot → copy token. Add bot to group, send a message, check{' '}
              <code className="px-1 py-0.5 bg-background rounded text-xs">getUpdates</code> for chat ID.
            </p>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── Model Router Section ─────────────────────────────────────────────────

const COMPLEXITY_TIERS = ['trivial', 'simple', 'moderate', 'complex', 'massive'] as const
const TIER_DESCRIPTIONS: Record<string, string> = {
  trivial: 'Greetings, simple lookups (500 tokens)',
  simple: 'Single-step tasks, short answers (2K tokens)',
  moderate: 'Multi-step analysis, code review (4K tokens)',
  complex: 'Deep reasoning, exploit dev (8K tokens)',
  massive: 'Full codebase analysis, report gen (32K tokens)',
}

const LOCAL_PROVIDERS = ['ollama', 'lmstudio', 'gpt4all']
const ALL_PROVIDERS = ['ollama', 'lmstudio', 'gpt4all', 'anthropic', 'openai', 'google', 'gemini', 'mistral', 'groq', 'custom']

function ModelRouterSection() {
  const {
    routes,
    config,
    isLoading,
    fetchRoutes,
    updateRoutes,
    updateRoute,
    toggleLocalMode,
  } = useModelRouterStore()

  useEffect(() => {
    fetchRoutes()
  }, [])

  const handleSaveRoutes = async () => {
    await updateRoutes(routes, config)
    toast.success('Model routes saved')
  }

  const availableProviders = config.local_mode ? LOCAL_PROVIDERS : ALL_PROVIDERS

  return (
    <Section title="Model Router" description="Local-first smart model routing — control where your data goes">
      {/* Local Mode Toggle — most prominent element */}
      <div
        className="rounded-xl p-5"
        style={{
          background: config.local_mode ? '#10b98110' : '#0d0d15',
          border: `2px solid ${config.local_mode ? '#10b981' : '#1a1a2e'}`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: config.local_mode ? '#10b98120' : '#1a1a2e' }}>
              <Lock size={20} style={{ color: config.local_mode ? '#10b981' : '#9ca3af' }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                Local Mode
                {config.local_mode && (
                  <span className="text-[9px] px-2 py-0.5 rounded tracking-wider" style={{ background: '#10b98120', color: '#10b981' }}>
                    ALL TRAFFIC STAYS LOCAL
                  </span>
                )}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {config.local_mode
                  ? 'Nothing leaves your system. All tasks routed to local models.'
                  : 'Cloud providers available for complex tasks. Toggle to lock down.'}
              </p>
            </div>
          </div>
          <Toggle value={config.local_mode} onChange={toggleLocalMode} />
        </div>
      </div>

      {/* Auto-Classify + Cost Optimization toggles */}
      <div className="grid grid-cols-2 gap-4">
        <Setting label="Auto-Classify Tasks" description="Detect task complexity automatically">
          <Toggle
            value={config.auto_classify}
            onChange={(v) => updateRoutes(routes, { ...config, auto_classify: v })}
          />
        </Setting>
        <Setting label="Cost Optimization" description="Always prefer cheapest sufficient model">
          <Toggle
            value={config.cost_optimization}
            onChange={(v) => updateRoutes(routes, { ...config, cost_optimization: v })}
          />
        </Setting>
      </div>

      {/* Route Table */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Router size={16} style={{ color: '#f0c040' }} />
            Route Table
          </h3>
          <button
            onClick={handleSaveRoutes}
            disabled={isLoading}
            className="text-xs flex items-center gap-1 px-3 py-1.5 rounded border transition-colors"
            style={{ borderColor: '#f0c040', color: '#f0c040' }}
          >
            <Save size={12} />
            Save Routes
          </button>
        </div>

        <div className="space-y-3">
          {/* Header */}
          <div className="grid grid-cols-5 gap-3 text-[10px] text-text-secondary tracking-wider px-1">
            <span>TIER</span>
            <span>PROVIDER</span>
            <span>MODEL</span>
            <span>FALLBACK</span>
            <span>TOKENS</span>
          </div>

          {/* Rows */}
          {routes.map((route, idx) => (
            <div
              key={route.task_type}
              className="grid grid-cols-5 gap-3 items-center p-3 rounded-lg"
              style={{ background: '#0a0a0f', border: '1px solid #1a1a2e' }}
            >
              <div>
                <span className="text-xs font-bold uppercase" style={{ color: '#f0c040' }}>
                  {route.task_type}
                </span>
                <p className="text-[9px] text-text-secondary mt-0.5">
                  {TIER_DESCRIPTIONS[route.task_type] || ''}
                </p>
              </div>

              <select
                value={route.default_provider}
                onChange={(e) => updateRoute(idx, { default_provider: e.target.value })}
                className="bg-surface-light border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary font-mono"
              >
                {availableProviders.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <input
                value={route.model}
                onChange={(e) => updateRoute(idx, { model: e.target.value })}
                className="bg-surface-light border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary font-mono"
              />

              <input
                value={route.fallback_model || ''}
                onChange={(e) => updateRoute(idx, { fallback_model: e.target.value, fallback_provider: e.target.value ? 'anthropic' : '' })}
                placeholder="none"
                className="bg-surface-light border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary font-mono"
              />

              <input
                type="number"
                value={route.max_tokens}
                onChange={(e) => updateRoute(idx, { max_tokens: parseInt(e.target.value) || 500 })}
                className="bg-surface-light border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary font-mono w-full"
              />
            </div>
          ))}

          {routes.length === 0 && (
            <div className="text-center py-6 text-xs text-text-secondary">
              No routes configured. Save to initialize defaults.
            </div>
          )}
        </div>
      </div>

      {/* Provider Priority */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Zap size={16} style={{ color: '#f0c040' }} />
          Provider Priority
        </h3>
        <p className="text-xs text-text-secondary mb-3">
          Order determines fallback preference. Local providers are tried first.
        </p>
        <div className="space-y-1.5">
          {['ollama', 'lmstudio', 'gpt4all', 'anthropic', 'openai', 'google'].map((provider, i) => {
            const isLocal = LOCAL_PROVIDERS.includes(provider)
            return (
              <div
                key={provider}
                className="flex items-center justify-between p-2.5 rounded"
                style={{ background: '#0a0a0f', border: '1px solid #1a1a2e' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] w-5 text-center" style={{ color: '#666' }}>{i + 1}</span>
                  <span className="text-xs font-mono">{provider}</span>
                  {isLocal && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#10b98115', color: '#10b981' }}>
                      local
                    </span>
                  )}
                </div>
                <div className="w-2 h-2 rounded-full" style={{ background: isLocal ? '#10b981' : '#3b82f6' }} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-Agent Overrides */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Bot size={16} style={{ color: '#f0c040' }} />
          Per-Agent Overrides
        </h3>
        <p className="text-xs text-text-secondary mb-3">
          Pin specific agents to models. Overrides the route table for that agent.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { agent: 'CIPHER', hint: 'opus (deep analysis)', color: '#f97316' },
            { agent: 'MAINTAINER', hint: 'local (cost-free)', color: '#10b981' },
            { agent: 'PATHFINDER', hint: 'sonnet (balanced)', color: '#3b82f6' },
            { agent: 'SCRIBE', hint: 'sonnet (writing)', color: '#22c55e' },
          ].map(({ agent, hint, color }) => (
            <div
              key={agent}
              className="flex items-center justify-between p-2.5 rounded"
              style={{ background: '#0a0a0f', border: '1px solid #1a1a2e' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs font-mono">{agent}</span>
              </div>
              <span className="text-[10px]" style={{ color: '#666' }}>{hint}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

export default Settings
