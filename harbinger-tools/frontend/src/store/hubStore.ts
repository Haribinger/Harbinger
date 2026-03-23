import { create } from 'zustand'
import {
  hubApi,
  type CatalogEntry,
  type ActiveAgent,
  type FeedEvent,
  type HubOverview,
  type TrustTier,
} from '../api/hub'

interface HubStoreState {
  overview: HubOverview | null
  catalog: CatalogEntry[]
  agents: ActiveAgent[]
  feedEvents: FeedEvent[]
  activeTab: 'catalog' | 'active' | 'feed' | 'settings'
  selectedAgent: string | null
  isLoading: boolean
  error: string | null
  commandResponse: unknown | null

  // Actions
  fetchOverview: () => Promise<void>
  fetchCatalog: (capability?: string) => Promise<void>
  fetchAgents: () => Promise<void>
  installAgent: (catalogId: string) => Promise<boolean>
  killAgent: (codename: string) => Promise<void>
  sendCommand: (command: string) => Promise<void>
  setActiveTab: (tab: 'catalog' | 'active' | 'feed' | 'settings') => void
  selectAgent: (codename: string | null) => void
  addFeedEvent: (event: FeedEvent) => void
  refresh: () => Promise<void>
}

const MAX_FEED = 200

export const useHubStore = create<HubStoreState>()(
  (set, get) => ({
    overview: null,
    catalog: [],
    agents: [],
    feedEvents: [],
    activeTab: 'catalog',
    selectedAgent: null,
    isLoading: false,
    error: null,
    commandResponse: null,

    fetchOverview: async () => {
      const overview = await hubApi.getOverview()
      set({ overview })
    },

    fetchCatalog: async (capability) => {
      set({ isLoading: true })
      const catalog = await hubApi.getCatalog(capability)
      set({ catalog: Array.isArray(catalog) ? catalog : [], isLoading: false })
    },

    fetchAgents: async () => {
      const agents = await hubApi.listAgents()
      set({ agents: Array.isArray(agents) ? agents : [] })
    },

    installAgent: async (catalogId) => {
      try {
        set({ isLoading: true, error: null })
        await hubApi.install(catalogId)
        await get().fetchAgents()
        await get().fetchCatalog()
        set({ isLoading: false })
        return true
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Install failed', isLoading: false })
        return false
      }
    },

    killAgent: async (codename) => {
      try {
        await hubApi.killAgent(codename)
        await get().fetchAgents()
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Kill failed' })
      }
    },

    sendCommand: async (command) => {
      try {
        set({ commandResponse: null })
        const result = await hubApi.sendCommand(command)
        set({ commandResponse: result })
      } catch (err: unknown) {
        set({ commandResponse: { error: err instanceof Error ? err.message : 'Command failed' } })
      }
    },

    setActiveTab: (tab) => set({ activeTab: tab }),
    selectAgent: (codename) => set({ selectedAgent: codename }),

    addFeedEvent: (event) => {
      set((s) => {
        const events = [...s.feedEvents, event]
        return { feedEvents: events.length > MAX_FEED ? events.slice(-MAX_FEED) : events }
      })
    },

    refresh: async () => {
      await Promise.all([
        get().fetchOverview(),
        get().fetchCatalog(),
        get().fetchAgents(),
      ])
    },
  })
)
