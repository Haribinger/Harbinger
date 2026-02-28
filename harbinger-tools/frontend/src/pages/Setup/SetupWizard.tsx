import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Github,
  User,
  Settings,
  Shield,
  Sparkles,
  Loader2,
  Copy,
  CheckCircle2,
  Bot,
  Container,
  MessageSquare,
  Zap,
  Globe,
  Database,
  RefreshCw,
  ExternalLink,
  Hash,
  Send,
  MonitorCheck,
  Cpu,
  HardDrive,
  WifiOff,
  ChevronDown,
  KeyRound,
} from 'lucide-react'
import { useSetupStore } from '../../store/setupStore'
import { useNavigate } from 'react-router-dom'

const C = {
  bg: '#0a0a0f',
  surface: '#0d0d15',
  surfaceLight: '#141420',
  border: '#1a1a2e',
  accent: '#f0c040',
  danger: '#ef4444',
  success: '#22c55e',
  info: '#3b82f6',
  text: '#ffffff',
  textMuted: '#9ca3af',
}

const steps = [
  { id: 'welcome', title: 'Welcome', icon: Sparkles },
  { id: 'config', title: 'Configuration', icon: Settings },
  { id: 'ai', title: 'AI Provider', icon: Bot },
  { id: 'github', title: 'GitHub Auth', icon: Github },
  { id: 'channels', title: 'Channels', icon: MessageSquare },
  { id: 'admin', title: 'Admin Account', icon: User },
  { id: 'review', title: 'Launch', icon: Shield },
]

const PROVIDERS = [
  { id: 'ollama', name: 'Ollama (Local)', icon: Container, color: '#a855f7', desc: 'Run models locally — no API key, no cost, full privacy', recommended: true },
  { id: 'anthropic', name: 'Anthropic', icon: Bot, color: '#f97316', desc: 'Claude models — Opus, Sonnet, Haiku' },
  { id: 'openai', name: 'OpenAI', icon: Bot, color: '#22c55e', desc: 'GPT-4o, GPT-4, o1 reasoning' },
  { id: 'groq', name: 'Groq', icon: Zap, color: '#eab308', desc: 'Ultra-fast inference — Llama, Mixtral' },
  { id: 'gemini', name: 'Google Gemini', icon: Database, color: '#3b82f6', desc: 'Gemini 2.0 Flash, Pro' },
  { id: 'mistral', name: 'Mistral AI', icon: Shield, color: '#ef4444', desc: 'Mistral Large, Codestral' },
  { id: 'google', name: 'Google AI Studio', icon: Globe, color: '#06b6d4', desc: 'Gemini via AI Studio API' },
  { id: 'lmstudio', name: 'LM Studio', icon: MonitorCheck, color: '#8b5cf6', desc: 'Local model server — OpenAI-compatible' },
  { id: 'gpt4all', name: 'GPT4All', icon: Cpu, color: '#10b981', desc: 'Offline desktop AI — no internet needed' },
  { id: 'custom', name: 'Custom Endpoint', icon: Globe, color: '#6b7280', desc: 'Any OpenAI-compatible API' },
] as const

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash',
  mistral: 'mistral-large-latest',
  google: 'gemini-2.0-flash',
}

function SetupWizard() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isTestingOllama, setIsTestingOllama] = useState(false)
  const [isTestingKey, setIsTestingKey] = useState(false)
  const [keyTestResult, setKeyTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const contentRef = useRef<HTMLDivElement>(null)

  const {
    currentStep, totalSteps, isComplete,
    nextStep, prevStep, submitSetup, isStepValid, getStepError, testOllama, testApiKey,
    detectServices, serviceStatus, detecting,
    // App config
    appName, appUrl, setAppName, setAppUrl,
    // AI
    llmProvider, llmApiKey, llmModel, ollamaUrl, ollamaStatus, ollamaModels,
    setLlmProvider, setLlmApiKey, setLlmModel, setOllamaUrl,
    // GitHub
    githubClientId, githubClientSecret, githubPat, githubOwner, githubRepo,
    setGitHubClientId, setGitHubClientSecret, setGitHubPat, setGitHubOwner, setGitHubRepo,
    // Channels
    discordBotToken, discordGuildId, discordChannelId,
    telegramBotToken, telegramChatId,
    setDiscordBotToken, setDiscordGuildId, setDiscordChannelId,
    setTelegramBotToken, setTelegramChatId,
    // Admin
    adminEmail, adminPassword, adminPasswordConfirm,
    setAdminEmail, setAdminPassword, setAdminPasswordConfirm,
    isEmailValid,
  } = useSetupStore()

  // Auto-detect services on welcome step mount
  useEffect(() => {
    if (currentStep === 0) {
      detectServices()
    }
  }, [currentStep, detectServices])

  // Auto-fill app URL from current location
  useEffect(() => {
    if (!appUrl && typeof window !== 'undefined') {
      const origin = window.location.origin
      if (origin && origin !== 'http://localhost:3000') {
        setAppUrl(origin)
      }
    }
  }, [appUrl, setAppUrl])

  // Auto-redirect after setup completion
  useEffect(() => {
    if (!isComplete) return
    if (countdown <= 0) { navigate('/login'); return }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [isComplete, countdown, navigate])

  // Keyboard: Enter to advance, Escape to go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't hijack Enter when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleNext()
        }
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (currentStep === totalSteps - 1) {
          handleSubmit()
        } else {
          handleNext()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const handleNext = useCallback(() => {
    if (!isStepValid()) {
      setSubmitError(getStepError())
      return
    }
    setSubmitError(null)
    setKeyTestResult(null)
    nextStep()
  }, [isStepValid, getStepError, nextStep])

  const handleSubmit = async () => {
    setSubmitError(null)
    setIsSubmitting(true)
    const result = await submitSetup()
    setIsSubmitting(false)
    if (!result.success) {
      setSubmitError(result.error || 'Setup failed')
    }
  }

  const handleTestOllama = async () => {
    setIsTestingOllama(true)
    await testOllama()
    setIsTestingOllama(false)
  }

  const handleTestApiKey = async () => {
    setIsTestingKey(true)
    const result = await testApiKey(llmProvider, llmApiKey)
    setKeyTestResult(result)
    setIsTestingKey(false)
  }

  const copyRedirectUrl = () => {
    const url = appUrl || window.location.origin
    navigator.clipboard.writeText(`${url}/api/auth/github/callback`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Service status indicator component
  const ServiceDot = ({ status }: { status: 'unknown' | 'online' | 'offline' }) => (
    <div className="flex items-center gap-1.5">
      <div
        className="w-2 h-2 rounded-full"
        style={{
          background: status === 'online' ? C.success : status === 'offline' ? C.danger : C.textMuted,
          boxShadow: status === 'online' ? `0 0 6px ${C.success}40` : undefined,
        }}
      />
      <span className="text-[10px] font-mono uppercase" style={{ color: status === 'online' ? C.success : status === 'offline' ? '#ef444490' : C.textMuted }}>
        {status}
      </span>
    </div>
  )

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: '#22c55e20' }}>
            <CheckCircle2 className="w-10 h-10" style={{ color: C.success }} />
          </div>
          <h1 className="text-3xl font-bold mb-4" style={{ color: C.text, fontFamily: 'monospace' }}>HARBINGER ONLINE</h1>
          <p style={{ color: C.textMuted }} className="mb-2">Your command center is configured and ready.</p>
          <p style={{ color: C.textMuted }} className="mb-4 text-sm">
            {llmProvider === 'ollama' ? 'Local AI agents powered by Ollama' : `AI powered by ${PROVIDERS.find(p => p.id === llmProvider)?.name}`}
            {discordBotToken && ' · Discord connected'}
            {telegramBotToken && ' · Telegram connected'}
          </p>
          <p className="text-xs mb-6 font-mono" style={{ color: C.textMuted }}>
            Redirecting to login in {countdown}s...
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3 rounded-xl font-medium transition-colors font-mono"
            style={{ border: `1px solid ${C.accent}`, color: C.accent, background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = `${C.accent}15`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            ENTER COMMAND CENTER
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
      <div className="w-full max-w-3xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => index < currentStep && useSetupStore.getState().setStep(index)}
                  disabled={index > currentStep}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-mono flex-shrink-0 transition-all"
                  style={{
                    background: index < currentStep ? C.success : index === currentStep ? C.accent : C.surfaceLight,
                    color: index <= currentStep ? C.bg : C.textMuted,
                    border: index === currentStep ? `2px solid ${C.accent}` : '1px solid transparent',
                    cursor: index < currentStep ? 'pointer' : index === currentStep ? 'default' : 'not-allowed',
                    opacity: index > currentStep ? 0.5 : 1,
                  }}
                >
                  {index < currentStep ? <Check className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                </button>
                {index < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1.5" style={{ background: index < currentStep ? C.success : C.border }} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold font-mono" style={{ color: C.text }}>{steps[currentStep].title}</h2>
            <p className="text-xs font-mono" style={{ color: C.textMuted }}>Step {currentStep + 1} of {totalSteps}</p>
          </div>
        </div>

        {/* Content */}
        <motion.div
          ref={contentRef}
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl p-8"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
        >
          {submitError && (
            <div className="mb-6 p-4 rounded-xl flex items-center gap-3 text-sm" style={{ background: '#ef444420', border: '1px solid #ef444430', color: C.danger }}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {submitError}
            </div>
          )}

          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="text-center">
              <pre className="text-xs mb-6 leading-tight" style={{ color: C.accent, fontFamily: 'monospace' }}>
{`    ██╗  ██╗ █████╗ ██████╗ ██████╗ ██╗███╗   ██╗ ██████╗ ███████╗██████╗
    ██║  ██║██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║██╔════╝ ██╔════╝██╔══██╗
    ███████║███████║██████╔╝██████╔╝██║██╔██╗ ██║██║  ███╗█████╗  ██████╔╝
    ██╔══██║██╔══██║██╔══██╗██╔══██╗██║██║╚██╗██║██║   ██║██╔══╝  ██╔══██╗
    ██║  ██║██║  ██║██║  ██║██████╔╝██║██║ ╚████║╚██████╔╝███████╗██║  ██║
    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝`}
              </pre>
              <h1 className="text-2xl font-bold mb-4 font-mono" style={{ color: C.text }}>Autonomous Security Command Center</h1>
              <p className="mb-6 max-w-lg mx-auto text-sm" style={{ color: C.textMuted }}>
                Deploy your own AI-powered security team. Runs locally, connects anywhere.
              </p>

              {/* System status panel */}
              <div className="mb-6 p-4 rounded-xl text-left" style={{ background: C.surfaceLight, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-medium" style={{ color: C.text }}>SYSTEM STATUS</span>
                  <button
                    onClick={() => detectServices()}
                    disabled={detecting}
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded"
                    style={{ color: C.textMuted, background: C.bg }}
                  >
                    <RefreshCw className={`w-3 h-3 ${detecting ? 'animate-spin' : ''}`} />
                    {detecting ? 'Scanning...' : 'Refresh'}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: 'Backend API', status: serviceStatus.backend, icon: HardDrive },
                    { label: 'Docker', status: serviceStatus.docker, icon: Container },
                    { label: 'Ollama', status: serviceStatus.ollama, icon: Cpu },
                    { label: 'PostgreSQL', status: serviceStatus.postgres, icon: Database },
                    { label: 'Redis', status: serviceStatus.redis, icon: Zap },
                  ].map((svc) => (
                    <div key={svc.label} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: C.bg }}>
                      <svc.icon className="w-3.5 h-3.5" style={{ color: svc.status === 'online' ? C.success : C.textMuted }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono truncate" style={{ color: C.textMuted }}>{svc.label}</p>
                      </div>
                      <ServiceDot status={svc.status} />
                    </div>
                  ))}
                </div>
                {serviceStatus.backend === 'offline' && (
                  <p className="text-[10px] mt-2 font-mono" style={{ color: C.textMuted }}>
                    Backend offline — setup will submit when it comes online. Start with: <code className="px-1 rounded" style={{ background: C.bg, color: C.accent }}>docker compose up -d</code>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left text-sm">
                {[
                  { icon: Bot, label: 'Any AI — Ollama, Claude, GPT, Groq, Gemini, Mistral' },
                  { icon: Github, label: 'GitHub OAuth, Device Flow, or PAT' },
                  { icon: MessageSquare, label: 'Discord + Telegram integration' },
                  { icon: Container, label: 'Docker agents with per-agent containers' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: C.surfaceLight }}>
                    <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: C.accent }} />
                    <span className="text-xs" style={{ color: C.textMuted }}>{item.label}</span>
                  </div>
                ))}
              </div>

              <p className="text-[10px] mt-4 font-mono" style={{ color: `${C.textMuted}80` }}>
                Press Enter or click Continue to begin setup. Your progress is auto-saved.
              </p>
            </div>
          )}

          {/* Step 1: App Configuration */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <InputField label="Instance Name" value={appName} onChange={setAppName} placeholder="Harbinger" description="Displayed in the UI header and browser tab" />
              <InputField
                label="App URL"
                value={appUrl}
                onChange={setAppUrl}
                placeholder={typeof window !== 'undefined' ? window.location.origin : 'http://localhost'}
                description="Used for OAuth callbacks and external links. Leave blank for local-only access."
                optional
              />
            </div>
          )}

          {/* Step 2: AI Provider */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <p className="text-sm mb-2" style={{ color: C.textMuted }}>
                Choose which AI powers your agents. Ollama runs locally — no API key needed.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setLlmProvider(p.id as string)
                      setKeyTestResult(null)
                      // Auto-fill default model
                      if (DEFAULT_MODELS[p.id] && !llmModel) {
                        setLlmModel(DEFAULT_MODELS[p.id])
                      }
                    }}
                    className="relative p-3 rounded-xl text-left transition-all"
                    style={{
                      background: llmProvider === p.id ? `${p.color}15` : C.surfaceLight,
                      border: `1px solid ${llmProvider === p.id ? p.color : C.border}`,
                    }}
                  >
                    {'recommended' in p && p.recommended && (
                      <span className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0.5 rounded-full font-mono" style={{ background: C.accent, color: C.bg }}>LOCAL</span>
                    )}
                    <p.icon className="w-4 h-4 mb-1" style={{ color: p.color }} />
                    <p className="text-[11px] font-medium leading-tight" style={{ color: C.text }}>{p.name}</p>
                  </button>
                ))}
              </div>

              {/* Provider description */}
              <div className="p-3 rounded-lg flex items-start gap-2" style={{ background: C.surfaceLight, border: `1px solid ${C.border}` }}>
                {(() => {
                  const p = PROVIDERS.find(p => p.id === llmProvider)
                  if (!p) return null
                  return (
                    <>
                      <p.icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: p.color }} />
                      <div>
                        <p className="text-xs font-medium" style={{ color: C.text }}>{p.name}</p>
                        <p className="text-xs" style={{ color: C.textMuted }}>{p.desc}</p>
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Ollama config */}
              {llmProvider === 'ollama' && (
                <div className="space-y-4 p-4 rounded-xl" style={{ background: C.surfaceLight, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Container className="w-5 h-5" style={{ color: '#a855f7' }} />
                    <span className="font-medium text-sm" style={{ color: C.text }}>Ollama Configuration</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="flex-1 rounded-lg px-4 py-2.5 text-sm focus:outline-none font-mono"
                      style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                    />
                    <button
                      onClick={handleTestOllama}
                      disabled={isTestingOllama}
                      className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
                      style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                    >
                      <RefreshCw className={`w-4 h-4 ${isTestingOllama ? 'animate-spin' : ''}`} />
                      Test
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: ollamaStatus === 'connected' ? C.success : ollamaStatus === 'error' ? C.danger : C.textMuted }} />
                    <span className="text-xs" style={{ color: ollamaStatus === 'connected' ? C.success : ollamaStatus === 'error' ? C.danger : C.textMuted }}>
                      {ollamaStatus === 'connected' ? `Connected — ${ollamaModels.length} model${ollamaModels.length !== 1 ? 's' : ''} available` : ollamaStatus === 'error' ? 'Cannot reach Ollama — is it running?' : 'Click Test to verify connection'}
                    </span>
                  </div>

                  {/* Model dropdown when connected */}
                  {ollamaStatus === 'connected' && ollamaModels.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: C.text }}>Model</label>
                      <div className="relative">
                        <select
                          value={llmModel}
                          onChange={(e) => setLlmModel(e.target.value)}
                          className="w-full rounded-lg px-4 py-2.5 text-sm font-mono appearance-none focus:outline-none"
                          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                        >
                          {ollamaModels.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: C.textMuted }} />
                      </div>
                    </div>
                  )}

                  <p className="text-xs" style={{ color: C.textMuted }}>
                    Install Ollama: <code className="px-1 py-0.5 rounded" style={{ background: C.bg }}>curl -fsSL https://ollama.com/install.sh | sh</code>
                    <br />Then pull a model: <code className="px-1 py-0.5 rounded" style={{ background: C.bg }}>ollama pull llama3.2</code>
                  </p>
                </div>
              )}

              {/* LM Studio / GPT4All config */}
              {(llmProvider === 'lmstudio' || llmProvider === 'gpt4all') && (
                <div className="space-y-4 p-4 rounded-xl" style={{ background: C.surfaceLight, border: `1px solid ${C.border}` }}>
                  <InputField
                    label="Server URL"
                    value={ollamaUrl}
                    onChange={setOllamaUrl}
                    placeholder={llmProvider === 'lmstudio' ? 'http://localhost:1234/v1' : 'http://localhost:4891/v1'}
                    description={`${llmProvider === 'lmstudio' ? 'LM Studio' : 'GPT4All'} exposes an OpenAI-compatible API. Start the local server first.`}
                  />
                  <InputField
                    label="Model"
                    value={llmModel}
                    onChange={setLlmModel}
                    placeholder="Enter model name"
                    optional
                  />
                </div>
              )}

              {/* API key for cloud providers */}
              {!['ollama', 'lmstudio', 'gpt4all'].includes(llmProvider) && (
                <div className="space-y-4">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <InputField
                        label="API Key"
                        value={llmApiKey}
                        onChange={(v) => { setLlmApiKey(v); setKeyTestResult(null) }}
                        placeholder={
                          llmProvider === 'anthropic' ? 'sk-ant-api03-...' :
                          llmProvider === 'openai' ? 'sk-...' :
                          llmProvider === 'groq' ? 'gsk_...' :
                          'Enter API key...'
                        }
                        type="password"
                        optional
                      />
                    </div>
                    {['anthropic', 'openai', 'groq'].includes(llmProvider) && llmApiKey && (
                      <button
                        onClick={handleTestApiKey}
                        disabled={isTestingKey}
                        className="px-4 py-2.5 rounded-lg text-xs flex items-center gap-2 disabled:opacity-50 font-mono mb-0.5 transition-colors"
                        style={{
                          background: C.bg,
                          border: `1px solid ${keyTestResult?.ok ? C.success : C.border}`,
                          color: keyTestResult?.ok ? C.success : C.text,
                        }}
                      >
                        {isTestingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                        {isTestingKey ? 'Testing...' : keyTestResult?.ok ? 'Valid' : 'Test Key'}
                      </button>
                    )}
                  </div>
                  {keyTestResult && !keyTestResult.ok && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: C.danger }}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      {keyTestResult.error}
                    </div>
                  )}
                  <InputField
                    label="Model"
                    value={llmModel}
                    onChange={setLlmModel}
                    placeholder={DEFAULT_MODELS[llmProvider] || 'Leave blank for default'}
                    description={DEFAULT_MODELS[llmProvider] ? `Default: ${DEFAULT_MODELS[llmProvider]}` : undefined}
                    optional
                  />
                </div>
              )}

              {llmProvider === 'custom' && (
                <InputField label="Base URL" value={ollamaUrl} onChange={setOllamaUrl} placeholder="https://api.example.com/v1" />
              )}
            </div>
          )}

          {/* Step 3: GitHub Auth */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl" style={{ background: '#f0c04010', border: `1px solid ${C.accent}30` }}>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.accent }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: C.accent }}>Authentication Options</p>
                    <p className="text-xs mt-1" style={{ color: C.textMuted }}>
                      All fields are optional. The login page supports 3 methods:<br/>
                      <strong>OAuth</strong> (redirect flow) · <strong>Device Flow</strong> (no callback needed) · <strong>Token</strong> (PAT or server GH_TOKEN)
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surfaceLight, border: `1px solid ${C.border}` }}>
                <h3 className="font-medium text-sm flex items-center gap-2" style={{ color: C.text }}>
                  <Github className="w-4 h-4" /> OAuth App (Optional)
                </h3>
                <div>
                  <label className="block text-xs mb-1" style={{ color: C.textMuted }}>Callback URL</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={appUrl ? `${appUrl}/api/auth/github/callback` : `${window.location.origin}/api/auth/github/callback`}
                      className="flex-1 rounded-lg px-3 py-2 text-xs font-mono cursor-not-allowed"
                      style={{ background: C.bg, border: `1px solid ${C.border}`, color: `${C.text}80` }}
                    />
                    <button onClick={copyRedirectUrl} className="px-3 py-2 rounded-lg transition-colors" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                      {copied ? <Check className="w-4 h-4" style={{ color: C.success }} /> : <Copy className="w-4 h-4" style={{ color: C.textMuted }} />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Client ID" value={githubClientId} onChange={setGitHubClientId} placeholder="Iv23lixxx..." compact />
                  <InputField label="Client Secret" value={githubClientSecret} onChange={setGitHubClientSecret} placeholder="••••••••" type="password" compact />
                </div>
              </div>

              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surfaceLight, border: `1px solid ${C.border}` }}>
                <h3 className="font-medium text-sm flex items-center gap-2" style={{ color: C.text }}>
                  <Github className="w-4 h-4" /> Personal Access Token / Automation
                </h3>
                <InputField label="GitHub PAT" value={githubPat} onChange={setGitHubPat} placeholder="ghp_xxxxxxxxxxxx" type="password" description="Needs repo + workflow scopes" compact />
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Owner" value={githubOwner} onChange={setGitHubOwner} placeholder="username" compact />
                  <InputField label="Repository" value={githubRepo} onChange={setGitHubRepo} placeholder="harbinger" compact />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Channels */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <p className="text-sm" style={{ color: C.textMuted }}>
                Connect messaging channels to receive alerts and control agents remotely. All optional.
              </p>

              {/* Discord */}
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surfaceLight, border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2">
                  <Hash className="w-5 h-5" style={{ color: '#5865F2' }} />
                  <span className="font-medium text-sm" style={{ color: C.text }}>Discord</span>
                  {discordBotToken && <div className="w-2 h-2 rounded-full ml-auto" style={{ background: C.success }} />}
                </div>
                <InputField label="Bot Token" value={discordBotToken} onChange={setDiscordBotToken} placeholder="MTIz..." type="password" compact />
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Guild ID" value={discordGuildId} onChange={setDiscordGuildId} placeholder="Server ID" compact />
                  <InputField label="Channel ID" value={discordChannelId} onChange={setDiscordChannelId} placeholder="Channel ID" compact />
                </div>
                <a
                  href="https://discord.com/developers/applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1"
                  style={{ color: '#5865F2' }}
                >
                  Create Discord Bot <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Telegram */}
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surfaceLight, border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5" style={{ color: '#0088cc' }} />
                  <span className="font-medium text-sm" style={{ color: C.text }}>Telegram</span>
                  {telegramBotToken && <div className="w-2 h-2 rounded-full ml-auto" style={{ background: C.success }} />}
                </div>
                <InputField label="Bot Token" value={telegramBotToken} onChange={setTelegramBotToken} placeholder="123456:ABC-DEF..." type="password" compact />
                <InputField label="Chat ID" value={telegramChatId} onChange={setTelegramChatId} placeholder="-1001234567890" compact />
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1"
                  style={{ color: '#0088cc' }}
                >
                  Create bot with @BotFather <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Step 5: Admin Account */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <InputField label="Admin Email" value={adminEmail} onChange={setAdminEmail} placeholder="admin@example.com" type="email" />
                {adminEmail && !isEmailValid(adminEmail) && (
                  <p className="text-[10px] mt-1 font-mono" style={{ color: C.danger }}>Enter a valid email address</p>
                )}
              </div>
              <InputField label="Password" value={adminPassword} onChange={setAdminPassword} placeholder="••••••••" type="password" description="Minimum 8 characters" />
              {adminPassword && adminPassword.length < 8 && (
                <div className="flex items-center gap-1.5" style={{ marginTop: '-12px' }}>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: C.border }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (adminPassword.length / 8) * 100)}%`, background: adminPassword.length < 4 ? C.danger : C.accent }} />
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: adminPassword.length < 4 ? C.danger : C.accent }}>
                    {8 - adminPassword.length} more
                  </span>
                </div>
              )}
              <InputField label="Confirm Password" value={adminPasswordConfirm} onChange={setAdminPasswordConfirm} placeholder="••••••••" type="password" />
              {adminPasswordConfirm && adminPassword !== adminPasswordConfirm && (
                <p className="text-[10px] font-mono" style={{ color: C.danger, marginTop: '-12px' }}>Passwords do not match</p>
              )}
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <h3 className="font-medium font-mono mb-4" style={{ color: C.text }}>MISSION BRIEFING</h3>
              {!githubClientId && !githubPat && (
                <div className="p-3 rounded-xl flex items-start gap-2 text-xs" style={{ background: '#f0c04015', border: `1px solid ${C.accent}30`, color: C.accent }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>No GitHub auth configured in this wizard.</strong> You can still deploy if you have <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: C.bg }}>GH_TOKEN</code> set in your server environment. Otherwise, go back to step 4 to add OAuth or a PAT.
                  </div>
                </div>
              )}
              <div className="space-y-2 text-sm">
                <ReviewRow label="Instance" value={appName} />
                <ReviewRow label="URL" value={appUrl || window.location.origin} />
                <ReviewRow label="AI Provider" value={PROVIDERS.find(p => p.id === llmProvider)?.name || llmProvider} status="configured" />
                {llmModel && <ReviewRow label="Model" value={llmModel} />}
                {llmProvider === 'ollama' && <ReviewRow label="Ollama" value={ollamaUrl} status={ollamaStatus === 'connected' ? 'configured' : 'pending'} />}
                {(llmProvider === 'lmstudio' || llmProvider === 'gpt4all') && <ReviewRow label="Server" value={ollamaUrl} />}
                <ReviewRow label="GitHub OAuth" value={githubClientId ? 'Configured' : 'Skipped'} status={githubClientId ? 'configured' : 'skipped'} />
                <ReviewRow label="GitHub PAT" value={githubPat ? 'Set' : 'Not set'} status={githubPat ? 'configured' : 'skipped'} />
                <ReviewRow label="Discord" value={discordBotToken ? 'Connected' : 'Not configured'} status={discordBotToken ? 'configured' : 'skipped'} />
                <ReviewRow label="Telegram" value={telegramBotToken ? 'Connected' : 'Not configured'} status={telegramBotToken ? 'configured' : 'skipped'} />
                <ReviewRow label="Admin" value={adminEmail} status="configured" />
              </div>

              {serviceStatus.backend === 'offline' && (
                <div className="p-3 rounded-xl flex items-start gap-2 text-xs" style={{ background: '#ef444415', border: `1px solid ${C.danger}30`, color: C.danger }}>
                  <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Backend is offline.</strong> Setup will be saved but cannot be applied until the backend is running. Start it with <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: C.bg }}>docker compose up -d</code>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-5 py-2.5 text-sm transition-colors disabled:opacity-30 font-mono"
              style={{ color: C.textMuted }}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono hidden sm:inline" style={{ color: `${C.textMuted}60` }}>
                Press Enter
              </span>
              {currentStep === totalSteps - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-medium text-sm transition-all font-mono disabled:opacity-50"
                  style={{ border: `1px solid ${C.accent}`, color: C.bg, background: C.accent }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#d4a830'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.accent; }}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {isSubmitting ? 'DEPLOYING...' : 'DEPLOY HARBINGER'}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-medium text-sm transition-all font-mono"
                  style={{ border: `1px solid ${C.accent}`, color: C.accent, background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${C.accent}15`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// Reusable input
function InputField({ label, value, onChange, placeholder, description, type = 'text', optional, compact }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  description?: string
  type?: string
  optional?: boolean
  compact?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: C.text }}>
        {label} {optional && <span style={{ color: C.textMuted }}>(optional)</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg px-4 focus:outline-none text-sm font-mono transition-colors ${compact ? 'py-2' : 'py-2.5'}`}
        style={{
          background: C.surfaceLight,
          border: `1px solid ${C.border}`,
          color: C.text,
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
        onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
      />
      {description && <p className="text-xs mt-1" style={{ color: C.textMuted }}>{description}</p>}
    </div>
  )
}

// Review summary row
function ReviewRow({ label, value, status }: { label: string; value: string; status?: 'configured' | 'pending' | 'skipped' }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: C.surfaceLight }}>
      <span className="text-xs font-mono" style={{ color: C.textMuted }}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono" style={{ color: C.text }}>{value}</span>
        {status && (
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: status === 'configured' ? C.success : status === 'pending' ? C.accent : C.textMuted }}
          />
        )}
      </div>
    </div>
  )
}

export default SetupWizard
