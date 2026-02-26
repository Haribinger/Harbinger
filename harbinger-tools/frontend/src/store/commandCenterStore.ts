import { create } from 'zustand'

export type TabType = 'chat' | 'terminal' | 'browser' | 'logs' | 'files' | 'settings' | 'graph'

export interface WorkspaceTab {
  id: string
  type: TabType
  label: string
  agentId?: string
  containerId?: string
  closable: boolean
}

export interface ActivityEvent {
  id: string
  agentId: string
  agentName: string
  agentColor: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: string
}

interface CommandCenterState {
  // Workspace tabs
  tabs: WorkspaceTab[]
  activeTabId: string | null

  // Sidebar state
  selectedAgentId: string | null
  agentFilter: string
  statusFilter: string

  // Activity feed
  activityEvents: ActivityEvent[]

  // Panel visibility
  showVMPanel: boolean
  showActivityPanel: boolean

  // Actions
  addTab: (tab: Omit<WorkspaceTab, 'id'>) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setSelectedAgent: (agentId: string | null) => void
  setAgentFilter: (filter: string) => void
  setStatusFilter: (filter: string) => void
  addActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void
  clearActivity: () => void
  toggleVMPanel: () => void
  toggleActivityPanel: () => void

  // Open agent workspace helpers
  openAgentChat: (agentId: string, agentName: string) => void
  openAgentTerminal: (agentId: string, agentName: string) => void
  openAgentLogs: (agentId: string, agentName: string) => void
  openAgentBrowser: (agentId: string, agentName: string) => void
}

let tabCounter = 0
function nextTabId(): string {
  return `tab-${++tabCounter}-${Date.now()}`
}

export const useCommandCenterStore = create<CommandCenterState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  selectedAgentId: null,
  agentFilter: '',
  statusFilter: 'all',
  activityEvents: [],
  showVMPanel: false,
  showActivityPanel: true,

  addTab: (tab) => {
    const id = nextTabId()
    const newTab: WorkspaceTab = { ...tab, id }
    set((s) => ({
      tabs: [...s.tabs, newTab],
      activeTabId: id,
    }))
  },

  removeTab: (tabId) => {
    set((s) => {
      const remaining = s.tabs.filter((t) => t.id !== tabId)
      let activeTabId = s.activeTabId
      if (activeTabId === tabId) {
        activeTabId = remaining.length > 0 ? remaining[remaining.length - 1].id : null
      }
      return { tabs: remaining, activeTabId }
    })
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setSelectedAgent: (agentId) => set({ selectedAgentId: agentId }),

  setAgentFilter: (filter) => set({ agentFilter: filter }),

  setStatusFilter: (filter) => set({ statusFilter: filter }),

  addActivity: (event) => {
    const entry: ActivityEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    }
    set((s) => ({
      activityEvents: [entry, ...s.activityEvents].slice(0, 200), // Keep last 200
    }))
  },

  clearActivity: () => set({ activityEvents: [] }),

  toggleVMPanel: () => set((s) => ({ showVMPanel: !s.showVMPanel })),
  toggleActivityPanel: () => set((s) => ({ showActivityPanel: !s.showActivityPanel })),

  // Helper: open a chat tab for an agent (reuse existing if open)
  openAgentChat: (agentId, agentName) => {
    const existing = get().tabs.find((t) => t.type === 'chat' && t.agentId === agentId)
    if (existing) {
      set({ activeTabId: existing.id, selectedAgentId: agentId })
      return
    }
    get().addTab({ type: 'chat', label: `Chat: ${agentName}`, agentId, closable: true })
    set({ selectedAgentId: agentId })
  },

  openAgentTerminal: (agentId, agentName) => {
    const existing = get().tabs.find((t) => t.type === 'terminal' && t.agentId === agentId)
    if (existing) {
      set({ activeTabId: existing.id, selectedAgentId: agentId })
      return
    }
    get().addTab({ type: 'terminal', label: `Term: ${agentName}`, agentId, closable: true })
    set({ selectedAgentId: agentId })
  },

  openAgentLogs: (agentId, agentName) => {
    const existing = get().tabs.find((t) => t.type === 'logs' && t.agentId === agentId)
    if (existing) {
      set({ activeTabId: existing.id, selectedAgentId: agentId })
      return
    }
    get().addTab({ type: 'logs', label: `Logs: ${agentName}`, agentId, closable: true })
    set({ selectedAgentId: agentId })
  },

  openAgentBrowser: (agentId, agentName) => {
    const existing = get().tabs.find((t) => t.type === 'browser' && t.agentId === agentId)
    if (existing) {
      set({ activeTabId: existing.id, selectedAgentId: agentId })
      return
    }
    get().addTab({ type: 'browser', label: `Browser: ${agentName}`, agentId, closable: true })
    set({ selectedAgentId: agentId })
  },
}))
