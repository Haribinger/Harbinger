import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key,
  Check,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Copy,
  Download,
  Shield,
  Bot,
  Database,
  Cpu,
  Globe,
  Server,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react'
import { useSecretsStore, Provider, PROVIDER_MODELS } from '../store/secretsStore'
import toast from 'react-hot-toast'

const PROVIDER_INFO: Record<Provider, { name: string; icon: React.ElementType; description: string; color: string }> = {
  anthropic: {
    name: 'Anthropic',
    icon: Bot,
    description: 'Claude models - Most capable reasoning',
    color: 'text-orange-400',
  },
  openai: {
    name: 'OpenAI',
    icon: Sparkles,
    description: 'GPT-4, GPT-3.5 models',
    color: 'text-green-400',
  },
  google: {
    name: 'Google AI',
    icon: Database,
    description: 'Gemini models - Fast and efficient',
    color: 'text-blue-400',
  },
  gemini: {
    name: 'Gemini',
    icon: Database,
    description: 'Google Gemini models - Multimodal',
    color: 'text-blue-300',
  },
  groq: {
    name: 'Groq',
    icon: Cpu,
    description: 'Ultra-fast LLM inference via Groq',
    color: 'text-yellow-400',
  },
  mistral: {
    name: 'Mistral',
    icon: Server,
    description: 'Mistral AI - European frontier models',
    color: 'text-pink-400',
  },
  ollama: {
    name: 'Ollama',
    icon: Cpu,
    description: 'Local LLMs - Llama, Mistral, etc.',
    color: 'text-purple-400',
  },
  custom: {
    name: 'Custom',
    icon: Globe,
    description: 'Custom OpenAI-compatible API',
    color: 'text-cyan-400',
  },
}

export function SecretsManager() {
  const {
    providers,
    activeProvider,
    ollamaUrl,
    ollamaModels,
    isOllamaConnected,
    updateProvider,
    setActiveProvider,
    setOllamaUrl,
    fetchOllamaModels,
    exportToEnv,
  } = useSecretsStore()

  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [isTestingOllama, setIsTestingOllama] = useState(false)
  const [copied, setCopied] = useState(false)

  const activeConfig = providers[activeProvider]
  const ActiveIcon = PROVIDER_INFO[activeProvider].icon

  const toggleShowKey = (key: string) => {
    setShowKey((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleProviderChange = (provider: Provider) => {
    setActiveProvider(provider)
    updateProvider(provider, { enabled: true })
    toast.success(`Switched to ${PROVIDER_INFO[provider].name}`)
  }

  const handleApiKeyChange = (provider: Provider, value: string) => {
    updateProvider(provider, { apiKey: value })
  }

  const handleModelChange = (provider: Provider, model: string) => {
    updateProvider(provider, { defaultModel: model })
  }

  const handleBaseUrlChange = (provider: Provider, value: string) => {
    updateProvider(provider, { baseUrl: value })
    if (provider === 'ollama') {
      setOllamaUrl(value)
    }
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

  // Auto-fetch Ollama models on mount
  useEffect(() => {
    if (activeProvider === 'ollama' && ollamaUrl) {
      fetchOllamaModels()
    }
  }, [activeProvider, ollamaUrl])

  return (
    <div className="space-y-6">
      {/* Provider Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {(Object.keys(PROVIDER_INFO) as Provider[]).map((provider) => {
          const info = PROVIDER_INFO[provider]
          const Icon = info.icon
          const isActive = activeProvider === provider
          const hasKey = providers[provider].apiKey || (provider === 'ollama' && isOllamaConnected)

          return (
            <motion.button
              key={provider}
              onClick={() => handleProviderChange(provider)}
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
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-white" />
                  </motion.div>
                )}
                {hasKey && !isActive && (
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </div>
              <h3 className="font-semibold mt-3">{info.name}</h3>
              <p className="text-xs text-text-secondary mt-1">{info.description}</p>
            </motion.button>
          )
        })}
      </div>

      {/* Active Provider Configuration */}
      <motion.div
        key={activeProvider}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface rounded-xl border border-border p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <ActiveIcon className={`w-6 h-6 ${PROVIDER_INFO[activeProvider].color}`} />
          <div>
            <h3 className="font-semibold text-lg">
              {PROVIDER_INFO[activeProvider].name} Configuration
            </h3>
            <p className="text-sm text-text-secondary">
              Configure your {PROVIDER_INFO[activeProvider].name} API credentials
            </p>
          </div>
          <div className="ml-auto">
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-400">
              Active Provider
            </span>
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
                  value={activeConfig.apiKey}
                  onChange={(e) => handleApiKeyChange(activeProvider, e.target.value)}
                  placeholder={getApiKeyPlaceholder(activeProvider)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 pr-20 font-mono text-sm focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => toggleShowKey(activeProvider)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white"
                >
                  {showKey[activeProvider] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {activeConfig.apiKey && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                )}
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {getApiKeyDescription(activeProvider)}
              </p>
            </div>
          )}

          {/* Base URL (for Ollama and Custom) */}
          {(activeProvider === 'ollama' || activeProvider === 'custom') && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Base URL
                <span className="text-red-400 ml-1">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={activeConfig.baseUrl || ''}
                  onChange={(e) => handleBaseUrlChange(activeProvider, e.target.value)}
                  placeholder={
                    activeProvider === 'ollama'
                      ? 'http://localhost:11434'
                      : 'https://api.example.com/v1'
                  }
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
                    {isOllamaConnected
                      ? `Connected - ${ollamaModels.length} models available`
                      : 'Not connected'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Default Model</label>
            <select
              value={activeConfig.defaultModel}
              onChange={(e) => handleModelChange(activeProvider, e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary"
              disabled={activeProvider === 'ollama' && !isOllamaConnected}
            >
              {activeProvider === 'ollama' ? (
                ollamaModels.length > 0 ? (
                  ollamaModels.map((model: string) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                ) : (
                  <option value="">No models found</option>
                )
              ) : (
                PROVIDER_MODELS[activeProvider].map((model: string) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))
              )}
            </select>
            <p className="text-xs text-text-secondary mt-1">
              {activeProvider === 'ollama' && !isOllamaConnected
                ? 'Connect to Ollama to see available models'
                : 'Select the default model for new agents'}
            </p>
          </div>

          {/* Provider-specific info */}
          {activeProvider === 'ollama' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Server className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm text-blue-400">Ollama Setup</h4>
                  <p className="text-xs text-text-secondary mt-1">
                    Make sure Ollama is running locally or enter the URL of your Ollama server.
                    Pull models with:{' '}
                    <code className="bg-background px-1 rounded">ollama pull llama3</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeProvider === 'custom' && (
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm text-cyan-400">Custom Provider</h4>
                  <p className="text-xs text-text-secondary mt-1">
                    Enter the base URL of any OpenAI-compatible API (e.g., OpenRouter, Together AI, etc.)
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* All Configured Providers Summary */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-400" />
          Configured Providers
        </h3>
        <div className="space-y-2">
          {(Object.entries(providers) as [Provider, typeof providers['anthropic']][]).map(
            ([key, config]) => {
              const info = PROVIDER_INFO[key]
              const Icon = info.icon
              const isConfigured = config.apiKey || (key === 'ollama' && isOllamaConnected)
              const isActive = activeProvider === key

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isActive
                      ? 'border-indigo-500/50 bg-indigo-500/5'
                      : 'border-border bg-surface-light'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${info.color}`} />
                    <div>
                      <span className="font-medium text-sm">{info.name}</span>
                      {isActive && (
                        <span className="ml-2 text-xs text-indigo-400">(active)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary">
                      {key === 'ollama'
                        ? isOllamaConnected
                          ? `${ollamaModels.length} models`
                          : 'Not connected'
                        : isConfigured
                        ? 'Configured'
                        : 'Not configured'}
                    </span>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isConfigured ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                    />
                  </div>
                </div>
              )
            }
          )}
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-4">Export Configuration</h3>
        <p className="text-sm text-text-secondary mb-4">
          Export your secrets as environment variables for your <code className="bg-background px-1 rounded">.env</code> file
        </p>
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

      {/* Security Notice */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-sm text-yellow-400">Security Notice</h4>
          <p className="text-xs text-text-secondary mt-1">
            API keys are stored locally in your browser and persisted to localStorage. They are never sent to our servers.
            Download the .env file and set your environment variables for production deployments.
          </p>
        </div>
      </div>
    </div>
  )
}

function getApiKeyPlaceholder(provider: Provider): string {
  switch (provider) {
    case 'anthropic':
      return 'sk-ant-api03-...'
    case 'openai':
      return 'sk-...'
    case 'google':
      return 'AIza...'
    default:
      return 'Enter API key...'
  }
}

function getApiKeyDescription(provider: Provider): string {
  switch (provider) {
    case 'anthropic':
      return 'Get your API key from console.anthropic.com'
    case 'openai':
      return 'Get your API key from platform.openai.com'
    case 'google':
      return 'Get your API key from makersuite.google.com'
    default:
      return ''
  }
}

export default SecretsManager
