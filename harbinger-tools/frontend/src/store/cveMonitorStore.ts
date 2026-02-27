import { create } from 'zustand'
import { cveApi } from '../api/cve'
import type { CVEEntry, CVEMatch, CVETriageResult } from '../api/cve'

interface CVEMonitorState {
  vulnerabilities: CVEEntry[]
  matches: CVEMatch[]
  triageResults: CVETriageResult[]
  totalInCatalog: number
  catalogVersion: string
  loading: boolean
  refreshing: boolean
  triaging: boolean
  error: string | null
  vendorFilter: string
  cachedAt: string | null

  fetchFeed: (vendor?: string) => Promise<void>
  fetchMatches: () => Promise<void>
  refresh: () => Promise<void>
  setVendorFilter: (vendor: string) => void
  autoTriage: (cveIDs: string[]) => Promise<void>
  triggerAgentScan: (cveID: string, agentType: string) => Promise<void>
}

export const useCVEMonitorStore = create<CVEMonitorState>()((set, get) => ({
  vulnerabilities: [],
  matches: [],
  triageResults: [],
  totalInCatalog: 0,
  catalogVersion: '',
  loading: false,
  refreshing: false,
  triaging: false,
  error: null,
  vendorFilter: '',
  cachedAt: null,

  fetchFeed: async (vendor?: string) => {
    set({ loading: true, error: null })
    try {
      const data = await cveApi.getFeed(vendor)
      set({
        vulnerabilities: data.vulnerabilities || [],
        totalInCatalog: data.totalInCatalog || data.count,
        catalogVersion: data.catalogVersion || '',
        cachedAt: data.cachedAt || null,
        loading: false,
      })
    } catch {
      set({ error: 'Failed to load CVE feed', loading: false })
    }
  },

  fetchMatches: async () => {
    try {
      const data = await cveApi.getMatching()
      set({ matches: data.matches || [] })
    } catch {
      // Non-critical — page still works without scope matches
    }
  },

  refresh: async () => {
    set({ refreshing: true })
    try {
      await cveApi.refresh()
      await get().fetchFeed(get().vendorFilter || undefined)
    } catch {
      set({ error: 'Refresh failed' })
    } finally {
      set({ refreshing: false })
    }
  },

  setVendorFilter: (vendor: string) => set({ vendorFilter: vendor }),

  autoTriage: async (cveIDs: string[]) => {
    set({ triaging: true })
    try {
      const data = await cveApi.autoTriage(cveIDs)
      set({ triageResults: data.results || [], triaging: false })
    } catch {
      set({ error: 'Auto-triage failed', triaging: false })
    }
  },

  triggerAgentScan: async (cveID: string, agentType: string) => {
    try {
      await cveApi.triggerAgentScan(cveID, agentType)
    } catch {
      set({ error: `Failed to trigger ${agentType} scan for ${cveID}` })
    }
  },
}))
