import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
    (set, get) => ({
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
        set({ isLoading: true, error: null });
        try {
          // Mock data for now - in production, this would fetch from bounty-targets-data
          const mockPrograms: BountyProgram[] = [
            {
              id: 'h1-1',
              name: 'Example Corp Security Program',
              platform: 'HackerOne',
              scopeDomains: ['example.com', 'api.example.com', 'app.example.com'],
              outOfScope: ['legacy.example.com'],
              payoutMin: 100,
              payoutMax: 50000,
              type: 'Paid',
              status: 'active',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'bc-1',
              name: 'Tech Startup Bug Bounty',
              platform: 'Bugcrowd',
              scopeDomains: ['startup.io', 'api.startup.io'],
              outOfScope: [],
              payoutMin: 50,
              payoutMax: 10000,
              type: 'Paid',
              status: 'active',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'int-1',
              name: 'European SaaS VDP',
              platform: 'Intigriti',
              scopeDomains: ['saas.eu', 'platform.saas.eu'],
              outOfScope: ['admin.saas.eu'],
              payoutMin: 0,
              payoutMax: 5000,
              type: 'VDP',
              status: 'active',
              createdAt: new Date().toISOString(),
            },
          ];

          set({
            programs: mockPrograms,
            syncStatus: {
              lastSyncTime: new Date().toISOString(),
              totalPrograms: mockPrograms.length,
              nextSyncTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            },
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to sync targets',
            isLoading: false,
          });
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
