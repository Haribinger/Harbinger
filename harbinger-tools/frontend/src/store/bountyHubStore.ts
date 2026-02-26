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
        set({ isLoading: true, error: null })
        try {
          // Fetch from backend API which aggregates bounty-targets-data
          const res = await fetch('/api/bounty/programs', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('harbinger-token') || ''}`,
            },
          })

          if (res.ok) {
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
          } else {
            // Try GitHub bounty-targets-data directly
            const ghRes = await fetch(
              'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/main/data/hackerone_data.json'
            )

            if (ghRes.ok) {
              const rawData = await ghRes.json()
              const programs: BountyProgram[] = (Array.isArray(rawData) ? rawData : [])
                .slice(0, 200) // Cap at 200 for performance
                .map((entry: any, idx: number) => ({
                  id: `h1-${idx}`,
                  name: entry.name || entry.handle || `Program ${idx}`,
                  platform: 'HackerOne' as const,
                  scopeDomains: Array.isArray(entry.targets?.in_scope)
                    ? entry.targets.in_scope
                        .filter((t: any) => t.asset_type === 'URL' || t.asset_type === 'WILDCARD')
                        .map((t: any) => t.asset_identifier)
                        .slice(0, 20)
                    : [],
                  outOfScope: Array.isArray(entry.targets?.out_of_scope)
                    ? entry.targets.out_of_scope.map((t: any) => t.asset_identifier).slice(0, 10)
                    : [],
                  payoutMin: entry.min_bounty ?? 0,
                  payoutMax: entry.max_bounty ?? 0,
                  type: (entry.min_bounty > 0 ? 'Paid' : 'VDP') as 'Paid' | 'VDP',
                  status: 'active' as const,
                  createdAt: entry.started_accepting_at || new Date().toISOString(),
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
            } else {
              // Keep existing programs if any, report error
              set({
                error: 'Could not reach bounty data sources — check network connection',
                isLoading: false,
              })
            }
          }
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
