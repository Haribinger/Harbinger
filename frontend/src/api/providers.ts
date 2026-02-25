import { apiClient } from './client'
import type { Provider } from '../store/secretsStore'

export interface ModelInfo {
  id: string
  name: string
  description?: string
  contextLength?: number
  pricing?: {
    input: number
    output: number
  }
}

export interface ProviderInfo {
  id: Provider
  name: string
  description: string
  enabled: boolean
  baseUrl?: string
  models: ModelInfo[]
}

export interface ProviderTestResult {
  success: boolean
  message: string
  models?: ModelInfo[]
  error?: string
}

export const providersApi = {
  // Get all providers
  getAll: async (): Promise<ProviderInfo[]> => {
    return apiClient.get<ProviderInfo[]>('/api/providers')
  },

  // Get single provider
  get: async (provider: Provider): Promise<ProviderInfo> => {
    return apiClient.get<ProviderInfo>(`/api/providers/${provider}`)
  },

  // Update provider configuration
  update: async (provider: Provider, config: {
    apiKey?: string
    baseUrl?: string
    enabled?: boolean
    defaultModel?: string
  }): Promise<ProviderInfo> => {
    return apiClient.put<ProviderInfo>(`/api/providers/${provider}`, config)
  },

  // Test provider connection
  test: async (provider: Provider): Promise<ProviderTestResult> => {
    return apiClient.post<ProviderTestResult>(`/api/providers/${provider}/test`)
  },

  // Fetch models for a provider
  fetchModels: async (provider: Provider): Promise<ModelInfo[]> => {
    const result = await apiClient.get<{ models: ModelInfo[] }>(`/api/providers/${provider}/models`)
    return result.models
  },

  // Get Ollama models (special handling for local Ollama)
  fetchOllamaModels: async (baseUrl: string = 'http://localhost:11434'): Promise<string[]> => {
    try {
      const response = await fetch(`${baseUrl}/api/tags`)
      if (!response.ok) throw new Error('Failed to fetch Ollama models')
      const data = await response.json()
      return data.models?.map((m: any) => m.name) || []
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error)
      return []
    }
  },

  // Set active provider
  setActive: async (provider: Provider): Promise<void> => {
    await apiClient.post('/api/providers/active', { provider })
  },
}
