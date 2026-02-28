import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { bugBountyDataApi } from '../api/bugbounty'

// BountyHub store: hunt queue and UI state for the BountyHub page.
// Program data syncing is delegated to `bugBountyStore` (the source of truth).
// This store adds hunt-queue management and BountyHub-specific filters on top.

interface BountyProgram {
  id: string
  name: string
  platform: 'HackerOne' | 'Bugcrowd' | 'Intigriti' | 'YesWeHack' | 'Federacy'
  scopeDomains: string[]
  outOfScope: string[]
  payoutMin: number
  payoutMax: number
  type: 'VDP' | 'Paid'
  status: 'active' | 'paused'
  createdAt: string
}

interface SyncStatus {
  lastSyncTime: string
  totalPrograms: number
  nextSyncTime: string
}

interface BountyFilters {
  platform?: string[]
  minPayout?: number
  maxPayout?: number
  type?: ('VDP' | 'Paid')[]
}

interface BountyHubState {
  programs: BountyProgram[]
  syncStatus: SyncStatus | null
  filters: BountyFilters
  searchTerm: string
  huntQueue: string[] // Program IDs assigned to agents
  isLoading: boolean
  error: string | null

  // Actions
  setPrograms: (programs: BountyProgram[]) => void
  addProgram: (program: BountyProgram) => void
  setSyncStatus: (status: SyncStatus) => void
  setFilters: (filters: BountyFilters) => void
  setSearchTerm: (term: string) => void
  addToHuntQueue: (programId: string) => void
  removeFromHuntQueue: (programId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  syncTargets: () => Promise<void>
}

export const useBountyHubStore = create<BountyHubState>()(
  persist(
    (set, _get) => ({
      programs: [],
      syncStatus: null,
      filters: {},
      searchTerm: '',
      huntQueue: [],
      isLoading: false,
      error: null,

      setPrograms: (programs) => set({ programs }),
      addProgram: (program) =>
        set((state) => ({
          programs: [...state.programs, program],
        })),
      setSyncStatus: (status) => set({ syncStatus: status }),
      setFilters: (filters) => set({ filters }),
      setSearchTerm: (term) => set({ searchTerm: term }),
      addToHuntQueue: (programId) =>
        set((state) => ({
          huntQueue: [...state.huntQueue, programId],
        })),
      removeFromHuntQueue: (programId) =>
        set((state) => ({
          huntQueue: state.huntQueue.filter((id) => id !== programId),
        })),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      syncTargets: async () => {
        set({ isLoading: true, error: null })
        try {
          // Try backend API first
          const token = localStorage.getItem('harbinger-token')
          const res = await fetch('/api/bounty/programs', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).catch(() => null)

          if (res?.ok) {
            const data = await res.json()
            const programs: BountyProgram[] = Array.isArray(data)
              ? data
              : Array.isArray(data?.programs) ? data.programs : []

            set({
              programs,
              syncStatus: {
                lastSyncTime: new Date().toISOString(),
                totalPrograms: programs.length,
                nextSyncTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              },
              isLoading: false,
            })
            return
          }

          // Fallback: fetch all platforms from GitHub bounty-targets-data
          const ghData = await bugBountyDataApi.fetchAll()
          const programs: BountyProgram[] = ghData.programs.map((p, idx) => ({
            id: `${p.platform}-${idx}`,
            name: p.name,
            platform: ({
              hackerone: 'HackerOne',
              bugcrowd: 'Bugcrowd',
              intigriti: 'Intigriti',
              yeswehack: 'YesWeHack',
              federacy: 'Federacy',
            }[p.platform] || p.platform) as BountyProgram['platform'],
            scopeDomains: p.domains.slice(0, 20),
            outOfScope: [],
            payoutMin: 0,
            payoutMax: p.maxBounty ? parseInt(p.maxBounty, 10) || 0 : 0,
            type: (p.maxBounty && parseInt(p.maxBounty, 10) > 0 ? 'Paid' : 'VDP') as 'Paid' | 'VDP',
            status: 'active' as const,
            createdAt: p.launchDate || new Date().toISOString(),
          }))

          set({
            programs,
            syncStatus: {
              lastSyncTime: new Date().toISOString(),
              totalPrograms: programs.length,
              nextSyncTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            },
            isLoading: false,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to sync targets',
            isLoading: false,
          })
        }
      },
    }),
    {
      name: 'harbinger-bounty-hub',
      partialize: (state) => ({
        programs: state.programs,
        syncStatus: state.syncStatus,
        filters: state.filters,
        huntQueue: state.huntQueue,
      }),
    }
  )
)
