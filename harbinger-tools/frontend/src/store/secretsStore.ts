import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Provider IDs — matches what the backend and Settings page use
export type Provider = 'anthropic' | 'openai' | 'groq' | 'ollama' | 'lmstudio' | 'gpt4all' | 'gemini' | 'mistral' | 'google' | 'custom'

export const PROVIDER_MODELS: Record<Provider, string[]> = {
  google: [
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-pro',
  ],
  custom: [],
  anthropic: [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'o1-preview',
    'o1-mini',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ],
  ollama: [],       // populated at runtime via fetchOllamaModels
  lmstudio: [],     // populated at runtime (OpenAI-compatible at localhost:1234)
  gpt4all: [],      // populated at runtime (OpenAI-compatible at localhost:4891)
  gemini: [
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
  mistral: [
    'mistral-large-latest',
    'mistral-small-latest',
    'codestral-latest',
  ],
}

export interface ProviderConfig {
  id: Provider
  apiKey: string
  baseUrl?: string
  defaultModel: string
  enabled: boolean
  models?: string[]   // cached model list from provider API
}

interface Secret {
  id: string
  name: string
  service: string
  key: string
  masked: boolean
  createdAt: string
}

export interface SecretsState {
  // Legacy generic secrets
  secrets: Secret[]
  loading: boolean

  // Multi-provider model config (Record so components can access via providers[id])
  providers: Record<Provider, ProviderConfig>
  activeProvider: Provider
  ollamaUrl: string
  ollamaModels: string[]
  isOllamaConnected: boolean

  // Bug bounty platform API keys
  bugBountyKeys: Record<string, string>

  // Generic secret actions
  addSecret: (name: string, service: string, key: string) => void
  removeSecret: (id: string) => void
  updateSecret: (id: string, key: string) => void
  getSecret: (service: string) => Secret | undefined
  hasSecret: (service: string) => boolean
  getDecryptedKey: (id: string) => string

  // Provider actions
  updateProvider: (id: Provider, updates: Partial<ProviderConfig>) => void
  getProvider: (id: Provider) => ProviderConfig
  setActiveProvider: (id: Provider) => void
  setOllamaUrl: (url: string) => void
  fetchOllamaModels: () => Promise<void>
  exportToEnv: () => string

  // Bug bounty key actions
  setBugBountyKey: (platform: string, key: string) => void
  removeBugBountyKey: (platform: string) => void
}

const defaultProviders: Record<Provider, ProviderConfig> = {
  anthropic: { id: 'anthropic', apiKey: '', defaultModel: 'claude-sonnet-4-6', enabled: false },
  openai:    { id: 'openai',    apiKey: '', defaultModel: 'gpt-4o', enabled: false },
  groq:      { id: 'groq',      apiKey: '', defaultModel: 'llama-3.3-70b-versatile', enabled: false },
  ollama:    { id: 'ollama',    apiKey: '', baseUrl: 'http://localhost:11434', defaultModel: 'llama3.2', enabled: false },
  lmstudio:  { id: 'lmstudio', apiKey: '', baseUrl: 'http://localhost:1234/v1', defaultModel: '', enabled: false },
  gpt4all:   { id: 'gpt4all',  apiKey: '', baseUrl: 'http://localhost:4891/v1', defaultModel: '', enabled: false },
  gemini:    { id: 'gemini',    apiKey: '', defaultModel: 'gemini-2.0-flash-exp', enabled: false },
  mistral:   { id: 'mistral',   apiKey: '', defaultModel: 'mistral-large-latest', enabled: false },
  google:    { id: 'google',    apiKey: '', defaultModel: 'gemini-2.0-flash-exp', enabled: false },
  custom:    { id: 'custom',    apiKey: '', baseUrl: '', defaultModel: '', enabled: false },
}

export const useSecretsStore = create<SecretsState>()(
  persist(
    (set, get) => ({
      secrets: [],
      loading: false,
      providers: defaultProviders,
      activeProvider: 'anthropic',
      ollamaUrl: 'http://localhost:11434',
      ollamaModels: [],
      isOllamaConnected: false,
      bugBountyKeys: {},

      // ── Generic secrets ──────────────────────────────────────────────────────
      addSecret: (name, service, key) => {
        const id = `secret-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        set((state) => ({
          secrets: [...state.secrets, { id, name, service, key, masked: true, createdAt: new Date().toISOString() }],
        }))
      },
      removeSecret: (id) => set((state) => ({ secrets: state.secrets.filter((s) => s.id !== id) })),
      updateSecret: (id, key) =>
        set((state) => ({
          secrets: state.secrets.map((s) => (s.id === id ? { ...s, key, createdAt: new Date().toISOString() } : s)),
        })),
      getSecret: (service) => get().secrets.find((s) => s.service === service),
      hasSecret: (service) => get().secrets.some((s) => s.service === service),
      getDecryptedKey: (id) => get().secrets.find((s) => s.id === id)?.key ?? '',

      // ── Providers ────────────────────────────────────────────────────────────
      updateProvider: (id, updates) =>
        set((state) => ({
          providers: { ...state.providers, [id]: { ...state.providers[id], ...updates } },
        })),

      setActiveProvider: (id) => set({ activeProvider: id }),

      getProvider: (id) => get().providers[id],
      setOllamaUrl: (url) => set({ ollamaUrl: url }),

      fetchOllamaModels: async () => {
        const url = get().ollamaUrl
        try {
          const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) })
          if (!res.ok) throw new Error('not ok')
          const data = await res.json()
          const models: string[] = data.models?.map((m: { name: string }) => m.name) ?? []
          set({ ollamaModels: models, isOllamaConnected: true })
          // Update the ollama provider's available models in PROVIDER_MODELS
          PROVIDER_MODELS.ollama = models
        } catch {
          set({ ollamaModels: [], isOllamaConnected: false })
        }
      },

      exportToEnv: () => {
        const lines: string[] = []
        Object.values(get().providers).forEach((p: ProviderConfig) => {
          if (p.apiKey) {
            const envKey = `${p.id.toUpperCase()}_API_KEY`
            lines.push(`${envKey}=${p.apiKey}`)
          }
          if (p.baseUrl) {
            const envKey = `${p.id.toUpperCase()}_BASE_URL`
            lines.push(`${envKey}=${p.baseUrl}`)
          }
        })
        Object.entries(get().bugBountyKeys).forEach(([platform, key]) => {
          lines.push(`${platform.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY=${key}`)
        })
        return lines.join('\n')
      },

      // ── Bug bounty keys ──────────────────────────────────────────────────────
      setBugBountyKey: (platform, key) =>
        set((state) => ({ bugBountyKeys: { ...state.bugBountyKeys, [platform]: key } })),

      removeBugBountyKey: (platform) =>
        set((state) => {
          const next = { ...state.bugBountyKeys }
          delete next[platform]
          return { bugBountyKeys: next }
        }),
    }),
    { name: 'harbinger-secrets' }
  )
)
