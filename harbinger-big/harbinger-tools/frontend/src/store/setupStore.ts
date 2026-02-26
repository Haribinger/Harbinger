import { create } from 'zustand'

// API Base URL from env
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080'

interface SetupState {
  // Setup steps
  currentStep: number
  totalSteps: number
  isComplete: boolean

  // Configuration
  appName: string
  appUrl: string

  // GitHub OAuth
  githubClientId: string
  githubClientSecret: string

  // Admin account
  adminEmail: string
  adminPassword: string
  adminPasswordConfirm: string

  // GitHub PAT for automation
  githubPat: string
  githubOwner: string
  githubRepo: string

  // LLM Configuration
  llmProvider: 'anthropic' | 'openai' | 'google'
  llmApiKey: string
  llmModel: string

  // Actions
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  setComplete: (complete: boolean) => void

  setAppName: (name: string) => void
  setAppUrl: (url: string) => void
  setGitHubClientId: (id: string) => void
  setGitHubClientSecret: (secret: string) => void
  setAdminEmail: (email: string) => void
  setAdminPassword: (password: string) => void
  setAdminPasswordConfirm: (password: string) => void
  setGitHubPat: (pat: string) => void
  setGitHubOwner: (owner: string) => void
  setGitHubRepo: (repo: string) => void
  setLlmProvider: (provider: 'anthropic' | 'openai' | 'google') => void
  setLlmApiKey: (key: string) => void
  setLlmModel: (model: string) => void

  // Validation
  isStepValid: () => boolean
  getStepError: () => string | null

  // API
  submitSetup: () => Promise<{ success: boolean; error?: string }>
  checkNeedsSetup: () => Promise<boolean>
}

export const useSetupStore = create<SetupState>((set, get) => ({
  currentStep: 0,
  totalSteps: 5,
  isComplete: false,

  appName: 'Harbinger',
  appUrl: '',

  githubClientId: '',
  githubClientSecret: '',

  adminEmail: '',
  adminPassword: '',
  adminPasswordConfirm: '',

  githubPat: '',
  githubOwner: '',
  githubRepo: '',

  llmProvider: 'anthropic',
  llmApiKey: '',
  llmModel: '',

  setStep: (step) => set({ currentStep: step }),
  nextStep: () => {
    const { currentStep, totalSteps } = get()
    if (currentStep < totalSteps - 1) {
      set({ currentStep: currentStep + 1 })
    }
  },
  prevStep: () => {
    const { currentStep } = get()
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1 })
    }
  },
  setComplete: (complete) => set({ isComplete: complete }),

  setAppName: (name) => set({ appName: name }),
  setAppUrl: (url) => set({ appUrl: url }),
  setGitHubClientId: (id) => set({ githubClientId: id }),
  setGitHubClientSecret: (secret) => set({ githubClientSecret: secret }),
  setAdminEmail: (email) => set({ adminEmail: email }),
  setAdminPassword: (password) => set({ adminPassword: password }),
  setAdminPasswordConfirm: (password) => set({ adminPasswordConfirm: password }),
  setGitHubPat: (pat) => set({ githubPat: pat }),
  setGitHubOwner: (owner) => set({ githubOwner: owner }),
  setGitHubRepo: (repo) => set({ githubRepo: repo }),
  setLlmProvider: (provider) => set({ llmProvider: provider }),
  setLlmApiKey: (key) => set({ llmApiKey: key }),
  setLlmModel: (model) => set({ llmModel: model }),

  isStepValid: () => {
    const state = get()
    switch (state.currentStep) {
      case 0: // Welcome - always valid
        return true
      case 1: // App config
        return state.appName.length > 0 && state.appUrl.length > 0
      case 2: // GitHub OAuth
        return state.githubClientId.length > 0 && state.githubClientSecret.length > 0
      case 3: // Admin account
        return (
          state.adminEmail.length > 0 &&
          state.adminPassword.length >= 8 &&
          state.adminPassword === state.adminPasswordConfirm
        )
      case 4: // GitHub PAT & LLM
        return (
          state.githubPat.length > 0 &&
          state.githubOwner.length > 0 &&
          state.githubRepo.length > 0 &&
          state.llmApiKey.length > 0
        )
      default:
        return false
    }
  },

  getStepError: () => {
    const state = get()
    switch (state.currentStep) {
      case 1:
        if (!state.appName) return 'App name is required'
        if (!state.appUrl) return 'App URL is required'
        return null
      case 2:
        if (!state.githubClientId) return 'GitHub Client ID is required'
        if (!state.githubClientSecret) return 'GitHub Client Secret is required'
        return null
      case 3:
        if (!state.adminEmail) return 'Admin email is required'
        if (state.adminPassword.length < 8) return 'Password must be at least 8 characters'
        if (state.adminPassword !== state.adminPasswordConfirm) return 'Passwords do not match'
        return null
      case 4:
        if (!state.githubPat) return 'GitHub PAT is required'
        if (!state.githubOwner) return 'GitHub owner is required'
        if (!state.githubRepo) return 'GitHub repo is required'
        if (!state.llmApiKey) return 'LLM API key is required'
        return null
      default:
        return null
    }
  },

  submitSetup: async () => {
    const state = get()
    try {
      const response = await fetch(`${API_BASE}/api/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: state.appName,
          appUrl: state.appUrl,
          githubClientId: state.githubClientId,
          githubClientSecret: state.githubClientSecret,
          adminEmail: state.adminEmail,
          adminPassword: state.adminPassword,
          githubPat: state.githubPat,
          githubOwner: state.githubOwner,
          githubRepo: state.githubRepo,
          llmProvider: state.llmProvider,
          llmApiKey: state.llmApiKey,
          llmModel: state.llmModel,
        }),
      })

      const data = await response.json()
      if (data.ok) {
        set({ isComplete: true })
        return { success: true }
      }
      return { success: false, error: data.error || 'Setup failed' }
    } catch (error) {
      return { success: false, error: 'Network error' }
    }
  },

  checkNeedsSetup: async () => {
    try {
      const response = await fetch('/api/setup/status')
      const data = await response.json()
      return data.needsSetup === true
    } catch {
      return true // Assume setup needed on error
    }
  },
}))
