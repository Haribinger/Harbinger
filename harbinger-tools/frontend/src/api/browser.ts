import { apiClient } from './client'
import type { BrowserSession, ConsoleLog, NetworkRequest } from '../types'

export interface CreateBrowserRequest {
  url?: string
  headless?: boolean
  userAgent?: string
  viewport?: {
    width: number
    height: number
  }
  proxy?: string
}

export interface BrowserScreenshot {
  data: string
  timestamp: string
}

export interface BrowserElement {
  tag: string
  id?: string
  class?: string
  text?: string
  selector: string
}

export const browserApi = {
  // Get all sessions
  getSessions: async (): Promise<BrowserSession[]> => {
    const result = await apiClient.get<unknown>('/api/browsers/sessions')
    return Array.isArray(result) ? result : []
  },

  // Create new browser session
  createSession: async (data: CreateBrowserRequest): Promise<BrowserSession> => {
    return apiClient.post<BrowserSession>('/api/browser/sessions', data)
  },

  // Close session
  closeSession: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/browser/sessions/${id}`)
  },

  // Navigate to URL
  navigate: async (id: string, url: string): Promise<void> => {
    await apiClient.post(`/api/browser/sessions/${id}/navigate`, { url })
  },

  // Take screenshot
  takeScreenshot: async (id: string, fullPage?: boolean): Promise<BrowserScreenshot> => {
    return apiClient.post<BrowserScreenshot>(`/api/browser/sessions/${id}/screenshot`, { fullPage })
  },

  // Get console logs
  getConsoleLogs: async (id: string): Promise<ConsoleLog[]> => {
    return apiClient.get<ConsoleLog[]>(`/api/browser/sessions/${id}/console`)
  },

  // Get network requests
  getNetworkRequests: async (id: string): Promise<NetworkRequest[]> => {
    return apiClient.get<NetworkRequest[]>(`/api/browser/sessions/${id}/network`)
  },

  // Clear logs
  clearLogs: async (id: string): Promise<void> => {
    await apiClient.post(`/api/browser/sessions/${id}/clear`)
  },

  // Execute JavaScript
  executeScript: async (id: string, script: string): Promise<unknown> => {
    return apiClient.post(`/api/browser/sessions/${id}/execute`, { script })
  },

  // Click element
  clickElement: async (id: string, selector: string): Promise<void> => {
    await apiClient.post(`/api/browser/sessions/${id}/click`, { selector })
  },

  // Type text
  typeText: async (id: string, selector: string, text: string): Promise<void> => {
    await apiClient.post(`/api/browser/sessions/${id}/type`, { selector, text })
  },

  // Get page elements
  getElements: async (id: string): Promise<BrowserElement[]> => {
    return apiClient.get<BrowserElement[]>(`/api/browser/sessions/${id}/elements`)
  },

  // Get page source
  getPageSource: async (id: string): Promise<string> => {
    const response = await apiClient.get<{ html: string }>(`/api/browser/sessions/${id}/source`)
    return response.html
  },
}
