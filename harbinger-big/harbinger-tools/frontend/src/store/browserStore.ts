import { create } from 'zustand'
import { browserApi } from '../api/browser'
import type { BrowserSession, ConsoleLog, NetworkRequest } from '../types'

interface BrowserState {
  sessions: BrowserSession[]
  selectedSession: BrowserSession | null
  consoleFilters: { level: string | null; search: string }
  networkFilters: { method: string | null; status: string | null; search: string }
  isLoading: boolean
  error: string | null

  // Actions
  setSessions: (sessions: BrowserSession[]) => void
  addSession: (session: BrowserSession) => void
  updateSession: (id: string, updates: Partial<BrowserSession>) => void
  removeSession: (id: string) => void
  setSelectedSession: (session: BrowserSession | null) => void
  fetchSessions: () => Promise<void>
  createSession: (data: { url?: string; headless?: boolean }) => Promise<void>
  closeSession: (id: string) => Promise<void>

  addConsoleLog: (sessionId: string, log: ConsoleLog) => void
  clearConsoleLogs: (sessionId: string) => void

  addNetworkRequest: (sessionId: string, request: NetworkRequest) => void
  updateNetworkRequest: (sessionId: string, id: string, updates: Partial<NetworkRequest>) => void
  clearNetworkRequests: (sessionId: string) => void

  setConsoleFilters: (filters: Partial<BrowserState['consoleFilters']>) => void
  setNetworkFilters: (filters: Partial<BrowserState['networkFilters']>) => void

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useBrowserStore = create<BrowserState>((set, get) => ({
  sessions: [],
  selectedSession: null,
  consoleFilters: { level: null, search: '' },
  networkFilters: { method: null, status: null, search: '' },
  isLoading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((state) => ({ sessions: [...state.sessions, session] })),
  updateSession: (id, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      selectedSession: state.selectedSession?.id === id
        ? { ...state.selectedSession, ...updates }
        : state.selectedSession,
    })),
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      selectedSession: state.selectedSession?.id === id ? null : state.selectedSession,
    })),
  setSelectedSession: (session) => set({ selectedSession: session }),

  // API Actions
  fetchSessions: async () => {
    set({ isLoading: true, error: null })
    try {
      const sessions = await browserApi.getSessions()
      set({ sessions })
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
      set({ error: 'Failed to fetch sessions' })
    } finally {
      set({ isLoading: false })
    }
  },

  createSession: async (data) => {
    const { addSession } = get()
    try {
      const session = await browserApi.createSession(data)
      addSession(session)
    } catch (error) {
      console.error('Failed to create session:', error)
      throw error
    }
  },

  closeSession: async (id) => {
    const { removeSession } = get()
    try {
      await browserApi.closeSession(id)
      removeSession(id)
    } catch (error) {
      console.error('Failed to close session:', error)
      throw error
    }
  },

  addConsoleLog: (sessionId, log) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, consoleLogs: [...s.consoleLogs, log].slice(-500) }
          : s
      ),
    })),
  clearConsoleLogs: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, consoleLogs: [] } : s
      ),
    })),

  addNetworkRequest: (sessionId, request) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, networkRequests: [...s.networkRequests, request].slice(-500) }
          : s
      ),
    })),
  updateNetworkRequest: (sessionId, id, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              networkRequests: s.networkRequests.map((r) =>
                r.id === id ? { ...r, ...updates } : r
              ),
            }
          : s
      ),
    })),
  clearNetworkRequests: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, networkRequests: [] } : s
      ),
    })),

  setConsoleFilters: (filters) =>
    set((state) => ({ consoleFilters: { ...state.consoleFilters, ...filters } })),
  setNetworkFilters: (filters) =>
    set((state) => ({ networkFilters: { ...state.networkFilters, ...filters } })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}))
