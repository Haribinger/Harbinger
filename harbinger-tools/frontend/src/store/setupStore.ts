import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { API_BASE } from '../config'

type LLMProvider = 'anthropic' | 'openai' | 'groq' | 'ollama' | 'gemini' | 'mistral' | 'google' | 'custom' | 'lmstudio' | 'gpt4all'

interface ServiceStatus {
  backend: 'unknown' | 'online' | 'offline'
  docker: 'unknown' | 'online' | 'offline'
  ollama: 'unknown' | 'online' | 'offline'
  postgres: 'unknown' | 'online' | 'offline'
  redis: 'unknown' | 'online' | 'offline'
}

interface SetupState {
  // Steps
  currentStep: number
  totalSteps: number
  isComplete: boolean

  // Step 1: App config
  appName: string
  appUrl: string

  // Step 2: AI Provider
  llmProvider: LLMProvider
  llmApiKey: string
  llmModel: string
  ollamaUrl: string
  ollamaStatus: 'untested' | 'connected' | 'error'
  ollamaModels: string[]

  // Step 3: GitHub Auth
  githubClientId: string
  githubClientSecret: string
  githubPat: string
  githubOwner: string
  githubRepo: string

  // Step 4: Channels (Discord, Telegram)
  discordBotToken: string
  discordGuildId: string
  discordChannelId: string
  telegramBotToken: string
  telegramChatId: string

  // Step 5: Admin account
  adminEmail: string
  adminPassword: string
  adminPasswordConfirm: string

  // Auto-detection
  serviceStatus: ServiceStatus
  detecting: boolean

  // Actions
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  setComplete: (complete: boolean) => void

  // Setters
  setAppName: (name: string) => void
  setAppUrl: (url: string) => void
  setLlmProvider: (provider: LLMProvider) => void
  setLlmApiKey: (key: string) => void
  setLlmModel: (model: string) => void
  setOllamaUrl: (url: string) => void
  setOllamaStatus: (status: 'untested' | 'connected' | 'error') => void
  setGitHubClientId: (id: string) => void
  setGitHubClientSecret: (secret: string) => void
  setGitHubPat: (pat: string) => void
  setGitHubOwner: (owner: string) => void
  setGitHubRepo: (repo: string) => void
  setDiscordBotToken: (token: string) => void
  setDiscordGuildId: (id: string) => void
  setDiscordChannelId: (id: string) => void
  setTelegramBotToken: (token: string) => void
  setTelegramChatId: (id: string) => void
  setAdminEmail: (email: string) => void
  setAdminPassword: (password: string) => void
  setAdminPasswordConfirm: (password: string) => void

  // Validation
  isStepValid: () => boolean
  getStepError: () => string | null
  isEmailValid: (email: string) => boolean

  // API
  submitSetup: () => Promise<{ success: boolean; error?: string }>
  checkNeedsSetup: () => Promise<boolean>
  testOllama: () => Promise<boolean>
  detectServices: () => Promise<void>
  testApiKey: (provider: LLMProvider, key: string) => Promise<{ ok: boolean; error?: string }>
  resetWizard: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const useSetupStore = create<SetupState>()(
  persist(
    (set, get) => ({
      currentStep: 0,
      totalSteps: 7,
      isComplete: false,

      // App config
      appName: 'Harbinger',
      appUrl: '',

      // AI Provider
      llmProvider: 'ollama',
      llmApiKey: '',
      llmModel: '',
      ollamaUrl: (typeof window !== 'undefined' ? window.location.protocol + '//' + window.location.hostname : 'http://localhost') + ':11434',
      ollamaStatus: 'untested',
      ollamaModels: [],

      // GitHub Auth
      githubClientId: '',
      githubClientSecret: '',
      githubPat: '',
      githubOwner: '',
      githubRepo: '',

      // Channels
      discordBotToken: '',
      discordGuildId: '',
      discordChannelId: '',
      telegramBotToken: '',
      telegramChatId: '',

      // Admin
      adminEmail: '',
      adminPassword: '',
      adminPasswordConfirm: '',

      // Auto-detection
      serviceStatus: {
        backend: 'unknown',
        docker: 'unknown',
        ollama: 'unknown',
        postgres: 'unknown',
        redis: 'unknown',
      },
      detecting: false,

      setStep: (step) => set({ currentStep: step }),
      nextStep: () => {
        const { currentStep, totalSteps } = get()
        if (currentStep < totalSteps - 1) set({ currentStep: currentStep + 1 })
      },
      prevStep: () => {
        const { currentStep } = get()
        if (currentStep > 0) set({ currentStep: currentStep - 1 })
      },
      setComplete: (complete) => set({ isComplete: complete }),

      // Setters
      setAppName: (name) => set({ appName: name }),
      setAppUrl: (url) => set({ appUrl: url }),
      setLlmProvider: (provider) => set({ llmProvider: provider }),
      setLlmApiKey: (key) => set({ llmApiKey: key }),
      setLlmModel: (model) => set({ llmModel: model }),
      setOllamaUrl: (url) => set({ ollamaUrl: url }),
      setOllamaStatus: (status) => set({ ollamaStatus: status }),
      setGitHubClientId: (id) => set({ githubClientId: id }),
      setGitHubClientSecret: (secret) => set({ githubClientSecret: secret }),
      setGitHubPat: (pat) => set({ githubPat: pat }),
      setGitHubOwner: (owner) => set({ githubOwner: owner }),
      setGitHubRepo: (repo) => set({ githubRepo: repo }),
      setDiscordBotToken: (token) => set({ discordBotToken: token }),
      setDiscordGuildId: (id) => set({ discordGuildId: id }),
      setDiscordChannelId: (id) => set({ discordChannelId: id }),
      setTelegramBotToken: (token) => set({ telegramBotToken: token }),
      setTelegramChatId: (id) => set({ telegramChatId: id }),
      setAdminEmail: (email) => set({ adminEmail: email }),
      setAdminPassword: (password) => set({ adminPassword: password }),
      setAdminPasswordConfirm: (password) => set({ adminPasswordConfirm: password }),

      isEmailValid: (email: string) => EMAIL_RE.test(email),

      isStepValid: () => {
        const s = get()
        switch (s.currentStep) {
          case 0: return true // Welcome
          case 1: return s.appName.length > 0
          case 2: return true // AI provider — all optional, Ollama needs no key
          case 3: return true // GitHub — optional
          case 4: return true // Channels — optional
          case 5: // Admin account
            return (
              EMAIL_RE.test(s.adminEmail) &&
              s.adminPassword.length >= 8 &&
              s.adminPassword === s.adminPasswordConfirm
            )
          case 6: return true // Review
          default: return false
        }
      },

      getStepError: () => {
        const s = get()
        switch (s.currentStep) {
          case 1:
            if (!s.appName) return 'Instance name is required'
            return null
          case 5:
            if (!s.adminEmail) return 'Admin email is required'
            if (!EMAIL_RE.test(s.adminEmail)) return 'Enter a valid email address'
            if (s.adminPassword.length < 8) return 'Password must be at least 8 characters'
            if (s.adminPassword !== s.adminPasswordConfirm) return 'Passwords do not match'
            return null
          default:
            return null
        }
      },

      testOllama: async () => {
        const url = get().ollamaUrl
        try {
          const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) })
          if (!res.ok) throw new Error('not ok')
          const data = await res.json()
          const models: string[] = data.models?.map((m: { name: string }) => m.name) ?? []
          set({
            ollamaStatus: models.length > 0 ? 'connected' : 'error',
            ollamaModels: models,
            llmModel: models.length > 0 && !get().llmModel ? models[0] : get().llmModel,
          })
          return models.length > 0
        } catch {
          set({ ollamaStatus: 'error', ollamaModels: [] })
          return false
        }
      },

      detectServices: async () => {
        set({ detecting: true })
        const status: ServiceStatus = {
          backend: 'unknown',
          docker: 'unknown',
          ollama: 'unknown',
          postgres: 'unknown',
          redis: 'unknown',
        }

        // Backend
        try {
          const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) })
          status.backend = res.ok ? 'online' : 'offline'
        } catch {
          status.backend = 'offline'
        }

        // Docker (via backend)
        try {
          const res = await fetch(`${API_BASE}/api/docker/containers`, { signal: AbortSignal.timeout(3000) })
          status.docker = res.ok ? 'online' : 'offline'
        } catch {
          status.docker = 'offline'
        }

        // Ollama
        const ollamaUrl = get().ollamaUrl
        try {
          const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
          if (res.ok) {
            status.ollama = 'online'
            const data = await res.json()
            const models: string[] = data.models?.map((m: { name: string }) => m.name) ?? []
            set({ ollamaModels: models, ollamaStatus: models.length > 0 ? 'connected' : 'untested' })
          } else {
            status.ollama = 'offline'
          }
        } catch {
          status.ollama = 'offline'
        }

        // Database health via backend dashboard
        if (status.backend === 'online') {
          try {
            const res = await fetch(`${API_BASE}/api/dashboard/health`, { signal: AbortSignal.timeout(3000) })
            if (res.ok) {
              const health = await res.json()
              if (Array.isArray(health)) {
                for (const svc of health) {
                  if (svc.name?.toLowerCase().includes('postgres') || svc.name?.toLowerCase().includes('database')) {
                    status.postgres = svc.status === 'connected' ? 'online' : 'offline'
                  }
                  if (svc.name?.toLowerCase().includes('redis')) {
                    status.redis = svc.status === 'connected' ? 'online' : 'offline'
                  }
                }
              }
            }
          } catch {
            // Non-critical
          }
        }

        set({ serviceStatus: status, detecting: false })
      },

      testApiKey: async (provider: LLMProvider, key: string) => {
        if (!key) return { ok: false, error: 'No API key provided' }
        try {
          let testUrl = ''
          let headers: Record<string, string> = {}

          switch (provider) {
            case 'anthropic':
              testUrl = 'https://api.anthropic.com/v1/messages'
              headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
              break
            case 'openai':
              testUrl = 'https://api.openai.com/v1/models'
              headers = { 'Authorization': `Bearer ${key}` }
              break
            case 'groq':
              testUrl = 'https://api.groq.com/openai/v1/models'
              headers = { 'Authorization': `Bearer ${key}` }
              break
            default:
              return { ok: true } // No validation endpoint for other providers
          }

          const res = await fetch(testUrl, {
            method: provider === 'anthropic' ? 'POST' : 'GET',
            headers,
            signal: AbortSignal.timeout(8000),
            ...(provider === 'anthropic' ? {
              body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'test' }] }),
            } : {}),
          })
          // 401 = invalid key, anything else including 200/400 means key format is valid
          if (res.status === 401 || res.status === 403) {
            return { ok: false, error: 'Invalid API key' }
          }
          return { ok: true }
        } catch {
          return { ok: false, error: 'Could not reach provider API' }
        }
      },

      submitSetup: async () => {
        const s = get()
        try {
          const response = await fetch(`${API_BASE}/api/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appName: s.appName,
              appUrl: s.appUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
              githubClientId: s.githubClientId,
              githubClientSecret: s.githubClientSecret,
              adminEmail: s.adminEmail,
              adminPassword: s.adminPassword,
              githubPat: s.githubPat,
              githubOwner: s.githubOwner,
              githubRepo: s.githubRepo,
              llmProvider: s.llmProvider,
              llmApiKey: s.llmApiKey,
              llmModel: s.llmModel,
              ollamaUrl: s.ollamaUrl,
              discordBotToken: s.discordBotToken,
              discordGuildId: s.discordGuildId,
              discordChannelId: s.discordChannelId,
              telegramBotToken: s.telegramBotToken,
              telegramChatId: s.telegramChatId,
            }),
          })
          const data = await response.json()
          if (data.ok) {
            set({ isComplete: true })
            // Clear persisted wizard state on success
            localStorage.removeItem('harbinger-setup')
            return { success: true }
          }
          return { success: false, error: data.error || 'Setup failed' }
        } catch {
          return { success: false, error: 'Network error — is the backend running?' }
        }
      },

      checkNeedsSetup: async () => {
        try {
          const url = `${API_BASE}/api/setup/status`
          const response = await fetch(url)
          const data = await response.json()
          return data.needsSetup === true
        } catch {
          return true
        }
      },

      resetWizard: () => {
        set({
          currentStep: 0,
          isComplete: false,
          appName: 'Harbinger',
          appUrl: '',
          llmProvider: 'ollama',
          llmApiKey: '',
          llmModel: '',
          ollamaStatus: 'untested',
          ollamaModels: [],
          githubClientId: '',
          githubClientSecret: '',
          githubPat: '',
          githubOwner: '',
          githubRepo: '',
          discordBotToken: '',
          discordGuildId: '',
          discordChannelId: '',
          telegramBotToken: '',
          telegramChatId: '',
          adminEmail: '',
          adminPassword: '',
          adminPasswordConfirm: '',
        })
        localStorage.removeItem('harbinger-setup')
      },
    }),
    {
      name: 'harbinger-setup',
      partialize: (state) => ({
        // Persist wizard progress but NOT passwords or sensitive data
        currentStep: state.currentStep,
        appName: state.appName,
        appUrl: state.appUrl,
        llmProvider: state.llmProvider,
        llmModel: state.llmModel,
        ollamaUrl: state.ollamaUrl,
        githubOwner: state.githubOwner,
        githubRepo: state.githubRepo,
        adminEmail: state.adminEmail,
      }),
    },
  ),
)
