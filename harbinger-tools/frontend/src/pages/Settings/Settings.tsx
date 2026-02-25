import { useState, useEffect } from 'react'
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
  Eye,
  EyeOff,
} from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'
import { useSecretsStore } from '../../store/secretsStore'
import { useBugBountyStore } from '../../store/bugBountyStore'
import { providersApi } from '../../api/providers'
import toast from 'react-hot-toast'

const sections = [
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'models', label: 'AI Models', icon: Bot },
  { id: 'docker', label: 'Docker', icon: Container },
  { id: 'mcp', label: 'MCP', icon: Puzzle },
  { id: 'bugbounty', label: 'Bug Bounty', icon: Bug },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'advanced', label: 'Advanced', icon: Database },
]

// Provider info for display
const PROVIDER_INFO: Record<string, { name: string; icon: React.ElementType; color: string }> = {
  anthropic: { name: 'Anthropic', icon: Bot, color: 'text-orange-400' },
  openai: { name: 'OpenAI', icon: Bot, color: 'text-green-400' },
  google: { name: 'Google AI', icon: Database, color: 'text-blue-400' },
  ollama: { name: 'Ollama', icon: Container, color: 'text-purple-400' },
  custom: { name: 'Custom', icon: Globe, color: 'text-cyan-400' },
}

function Settings() {
  const {
    theme,
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
    setTheme,
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

  const { programs, lastUpdated, isLoading: isBugBountyLoading, fetchAll: fetchBugBountyData } = useBugBountyStore()

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

  // Load health status on mount
  useEffect(() => {
    fetchHealthStatus()
  }, [])

  const fetchHealthStatus = async () => {
    setIsLoadingHealth(true)
    try {
      const response = await fetch('/api/dashboard/health')
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
    setLocalModelDefaults(modelDefaults)
    setLocalDockerDefaults(dockerDefaults)
    setLocalMcpDefaults(mcpDefaults)
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
      if (isOllamaConnected) {
        toast.success(`Connected! Found ${ollamaModels.length} models`)
      } else {
        toast.error('Could not connect to Ollama')
      }
    } catch (error) {
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
    switch (provider) {
      case 'anthropic': return 'sk-ant-api03-...'
      case 'openai': return 'sk-...'
      case 'google': return 'AIza...'
      default: return 'Enter API key...'
    }
  }

  const getApiKeyDescription = (provider: string): string => {
    switch (provider) {
      case 'anthropic': return 'Get your API key from console.anthropic.com'
      case 'openai': return 'Get your API key from platform.openai.com'
      case 'google': return 'Get your API key from makersuite.google.com'
      default: return ''
    }
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
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
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
          {/* Appearance */}
          {activeSection === 'appearance' && (
            <Section title="Appearance" description="Customize the look and feel of Harbinger">
              <Setting label="Theme" description="Choose your preferred color theme">
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: 'dark', label: 'Dark', icon: Moon },
                    { value: 'light', label: 'Light', icon: Sun },
                    { value: 'system', label: 'System', icon: Laptop },
                  ] as const).map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                        theme === t.value
                          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-400'
                          : 'border-border hover:border-primary/50 text-text-secondary hover:text-white'
                      }`}
                    >
                      <t.icon className="w-6 h-6" />
                      <span className="text-sm font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
              </Setting>

              <Setting label="Auto Save" description="Automatically save configuration changes">
                <Toggle value={autoSave} onChange={(v) => updateSettings({ autoSave: v })} />
              </Setting>
            </Section>
          )}

          {/* AI Models - Now with Providers */}
          {activeSection === 'models' && (
            <Section title="AI Models" description="Configure AI providers and default models">
              {/* Provider Selection Cards */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-text-secondary mb-3">Select Provider</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-surface-light hover:border-surface-light/80 bg-surface'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <Icon className={`w-6 h-6 ${info.color}`} />
                          {isActive && (
                            <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {hasKey && !isActive && <div className="w-2 h-2 rounded-full bg-green-500" />}
                        </div>
                        <h3 className="font-semibold mt-3">{info.name}</h3>
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
                        providers[activeProvider as keyof typeof providers]?.models?.map((model: string) => (
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
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download .env
                  </button>
                </div>
              </div>
            </Section>
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
              {/* Data sync status */}
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
                    onClick={fetchBugBountyData}
                    disabled={isBugBountyLoading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-light hover:bg-surface-light/80 border border-border rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isBugBountyLoading ? 'animate-spin' : ''}`} />
                    {isBugBountyLoading ? 'Syncing...' : 'Sync from GitHub'}
                  </button>
                </div>
                <a
                  href="https://github.com/arkadiyt/bounty-targets-data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  View data source (arkadiyt/bounty-targets-data) ↗
                </a>
              </div>

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
                          isActive ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-border bg-surface-light'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-5 h-5 ${info.color}`} />
                          <div>
                            <span className="font-medium text-sm">{info.name}</span>
                            {isActive && <span className="ml-2 text-xs text-indigo-400">(active)</span>}
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
              saved ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
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
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-surface-light border border-border'}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-6' : 'left-1'}`}
      />
    </button>
  )
}

export default Settings
