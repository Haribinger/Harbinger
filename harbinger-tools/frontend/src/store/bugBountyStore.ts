import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { bugBountyDataApi } from '../api/bugbounty'
import type { BugBountyProgram, BugBountyData } from '../api/bugbounty'

interface BugBountyState {
  // Data
  programs: BugBountyProgram[]
  domains: string[]
  wildcards: string[]
  lastUpdated: string | null

  // UI State
  selectedPlatform: string | null
  selectedProgram: BugBountyProgram | null
  searchQuery: string
  isLoading: boolean
  error: string | null

  // Actions
  setPrograms: (programs: BugBountyProgram[]) => void
  setDomains: (domains: string[]) => void
  setWildcards: (wildcards: string[]) => void
  setSelectedPlatform: (platform: string | null) => void
  setSelectedProgram: (program: BugBountyProgram | null) => void
  setSearchQuery: (query: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // API Actions
  fetchAll: () => Promise<void>
  fetchByPlatform: (platform: BugBountyProgram['platform']) => Promise<void>
  search: (query: string) => Promise<BugBountyProgram[]>

  // Stats
  getStats: () => { total: number; byPlatform: Record<string, number>; domains: number; wildcards: number }
}

export const useBugBountyStore = create<BugBountyState>()(
  persist(
    (set, get) => ({
      // Data
      programs: [],
      domains: [],
      wildcards: [],
      lastUpdated: null,

      // UI State
      selectedPlatform: null,
      selectedProgram: null,
      searchQuery: '',
      isLoading: false,
      error: null,

      // Actions
      setPrograms: (programs) => set({ programs }),
      setDomains: (domains) => set({ domains }),
      setWildcards: (wildcards) => set({ wildcards }),
      setSelectedPlatform: (selectedPlatform) => set({ selectedPlatform }),
      setSelectedProgram: (selectedProgram) => set({ selectedProgram }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // API Actions
      fetchAll: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await bugBountyDataApi.fetchAll()
          set({
            programs: data.programs,
            domains: data.domains,
            wildcards: data.wildcards,
            lastUpdated: data.lastUpdated,
            isLoading: false,
          })
        } catch (error) {
          console.error('Failed to fetch bug bounty data:', error)
          set({
            error: 'Failed to fetch bug bounty data',
            isLoading: false,
          })
        }
      },

      fetchByPlatform: async (platform) => {
        set({ isLoading: true, error: null })
        try {
          const programs = await bugBountyDataApi.fetchByPlatform(platform)
          set({ programs, isLoading: false })
        } catch (error) {
          console.error('Failed to fetch platform data:', error)
          set({ error: 'Failed to fetch platform data', isLoading: false })
        }
      },

      search: async (query) => {
        if (!query) {
          const { programs } = get()
          return programs
        }
        return await bugBountyDataApi.search(query)
      },

      // Stats
      getStats: () => {
        const { programs, domains, wildcards } = get()
        const byPlatform = programs.reduce((acc, p) => {
          acc[p.platform] = (acc[p.platform] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        return {
          total: programs.length,
          byPlatform,
          domains: domains.length,
          wildcards: wildcards.length,
        }
      },
    }),
    {
      name: 'harbinger-bugbounty',
      partialize: (state) => ({
        programs: state.programs,
        domains: state.domains,
        wildcards: state.wildcards,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
)

export default useBugBountyStore
