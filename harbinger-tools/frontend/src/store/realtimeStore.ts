import { create } from 'zustand'
import { realtimeApi } from '../api/realtime'
import type { RealtimeEvent, AgentLiveStatus, CommandStream, OperatorSession, KillSwitchState } from '../api/realtime'

interface RealtimeState {
  events: RealtimeEvent[]
  agentStatuses: AgentLiveStatus[]
  streams: CommandStream[]
  operators: OperatorSession[]
  killSwitch: KillSwitchState | null
  isLoading: boolean
  error: string | null
  sseConnected: boolean

  // Actions
  fetchEvents: (filters?: { type?: string; limit?: number }) => Promise<void>
  broadcastEvent: (event: Partial<RealtimeEvent>) => Promise<void>
  fetchAgentStatuses: () => Promise<void>
  updateAgentStatus: (id: string, status: Partial<AgentLiveStatus>) => Promise<void>
  sendHeartbeat: (id: string) => Promise<void>
  fetchStreams: (filters?: { implantId?: string; status?: string }) => Promise<void>
  createStream: (stream: Partial<CommandStream>) => Promise<void>
  appendOutput: (id: string, output: string) => Promise<void>
  fetchOperators: () => Promise<void>
  registerOperator: (op: Partial<OperatorSession>) => Promise<void>
  kickOperator: (id: string) => Promise<void>
  fetchKillSwitch: () => Promise<void>
  toggleKillSwitch: (active: boolean) => Promise<void>
  addLocalEvent: (event: RealtimeEvent) => void
  refresh: () => Promise<void>
}

export const useRealtimeStore = create<RealtimeState>()(
  (set, get) => ({
    events: [],
    agentStatuses: [],
    streams: [],
    operators: [],
    killSwitch: null,
    isLoading: false,
    error: null,
    sseConnected: false,

    fetchEvents: async (filters) => {
      try {
        const data = await realtimeApi.listEvents(filters)
        set({ events: data })
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to fetch events' })
      }
    },

    broadcastEvent: async (event) => {
      try {
        await realtimeApi.broadcastEvent(event)
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to broadcast event' })
      }
    },

    fetchAgentStatuses: async () => {
      try {
        const data = await realtimeApi.getAgentStatuses()
        set({ agentStatuses: data })
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to fetch agent statuses' })
      }
    },

    updateAgentStatus: async (id, status) => {
      try {
        await realtimeApi.updateAgentStatus(id, status)
        get().fetchAgentStatuses()
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to update agent status' })
      }
    },

    sendHeartbeat: async (id) => {
      try {
        await realtimeApi.agentHeartbeat(id)
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to send heartbeat' })
      }
    },

    fetchStreams: async (filters) => {
      try {
        const data = await realtimeApi.listStreams(filters)
        set({ streams: data })
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to fetch streams' })
      }
    },

    createStream: async (stream) => {
      try {
        await realtimeApi.createStream(stream)
        get().fetchStreams()
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to create stream' })
      }
    },

    appendOutput: async (id, output) => {
      try {
        await realtimeApi.appendOutput(id, output)
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to append output' })
      }
    },

    fetchOperators: async () => {
      try {
        const data = await realtimeApi.listOperators()
        set({ operators: data })
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to fetch operators' })
      }
    },

    registerOperator: async (op) => {
      try {
        await realtimeApi.registerOperator(op)
        get().fetchOperators()
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to register operator' })
      }
    },

    kickOperator: async (id) => {
      try {
        await realtimeApi.kickOperator(id)
        get().fetchOperators()
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to kick operator' })
      }
    },

    fetchKillSwitch: async () => {
      try {
        const data = await realtimeApi.getKillSwitch()
        set({ killSwitch: data })
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to fetch kill switch' })
      }
    },

    toggleKillSwitch: async (active) => {
      try {
        await realtimeApi.toggleKillSwitch(active)
        set({ killSwitch: { active } })
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to toggle kill switch' })
      }
    },

    addLocalEvent: (event) => {
      set((state) => ({
        events: [event, ...state.events].slice(0, 200),
      }))
    },

    refresh: async () => {
      const state = get()
      set({ isLoading: true })
      await Promise.all([
        state.fetchEvents({ limit: 100 }),
        state.fetchAgentStatuses(),
        state.fetchStreams(),
        state.fetchOperators(),
        state.fetchKillSwitch(),
      ])
      set({ isLoading: false })
    },
  })
)
