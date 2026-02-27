import { create } from 'zustand'
import { API_BASE } from '../config'

type LLMProvider = 'anthropic' | 'openai' | 'groq' | 'ollama' | 'gemini' | 'mistral' | 'google' | 'custom'

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

  // API
  submitSetup: () => Promise<{ success: boolean; error?: string }>
  checkNeedsSetup: () => Promise<boolean>
  testOllama: () => Promise<boolean>
}

export const useSetupStore = create<SetupState>((set, get) => ({
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

  isStepValid: () => {
    const s = get()
    switch (s.currentStep) {
      case 0: return true // Welcome
      case 1: return s.appName.length > 0 // App config — URL optional for local
      case 2: return true // AI provider — all optional, Ollama needs no key
      case 3: return true // GitHub — optional
      case 4: return true // Channels — optional
      case 5: // Admin account
        return (
          s.adminEmail.length > 0 &&
          s.adminPassword.length >= 8 &&
          s.adminPassword === s.adminPasswordConfirm
        )
      case 6: return true // Review — warn but don't block (user may have GH_TOKEN in env)
      default: return false
    }
  },

  getStepError: () => {
    const s = get()
    switch (s.currentStep) {
      case 1:
        if (!s.appName) return 'App name is required'
        return null
      case 5:
        if (!s.adminEmail) return 'Admin email is required'
        if (s.adminPassword.length < 8) return 'Password must be at least 8 characters'
        if (s.adminPassword !== s.adminPasswordConfirm) return 'Passwords do not match'
        return null
      case 6: return null // Warning shown in UI but doesn't block deploy
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
      set({ ollamaStatus: models.length > 0 ? 'connected' : 'error' })
      return models.length > 0
    } catch {
      set({ ollamaStatus: 'error' })
      return false
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
}))
