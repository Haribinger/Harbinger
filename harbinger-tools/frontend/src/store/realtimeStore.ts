import { create } from 'zustand'
import { realtimeApi } from '../api/realtime'
import type { RealtimeEvent, RealtimeEventType, V2EventType, AgentLiveStatus, CommandStream, OperatorSession, KillSwitchState } from '../api/realtime'

// v2 event types for Agent Watch filtering
const V2_EVENT_TYPES: V2EventType[] = [
  'mission_update', 'task_update', 'subtask_update',
  'action_update', 'tool_output', 'react_iteration',
]

// Max events to keep per agent activity log
const MAX_AGENT_EVENTS = 500
// Max total events in the main buffer
const MAX_EVENTS = 500

interface RealtimeState {
  events: RealtimeEvent[]
  agentStatuses: AgentLiveStatus[]
  streams: CommandStream[]
  operators: OperatorSession[]
  killSwitch: KillSwitchState | null
  isLoading: boolean
  error: string | null
  sseConnected: boolean

  // v2: per-agent activity log keyed by agent codename
  agentActivity: Record<string, RealtimeEvent[]>
  // v2: mission-scoped events keyed by mission ID
  missionEvents: Record<number, RealtimeEvent[]>

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

  // v2: Agent Watch helpers
  getAgentEvents: (agent: string) => RealtimeEvent[]
  getMissionEvents: (missionId: number) => RealtimeEvent[]
  getV2Events: () => RealtimeEvent[]
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
    agentActivity: {},
    missionEvents: {},

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
      set((state) => {
        const newEvents = [event, ...state.events].slice(0, MAX_EVENTS)

        // v2: index by agent codename (from source or payload.agent)
        const agent = (event.payload?.agent as string) || event.source
        const newAgentActivity = { ...state.agentActivity }
        if (agent && V2_EVENT_TYPES.includes(event.type as V2EventType)) {
          const existing = newAgentActivity[agent] || []
          newAgentActivity[agent] = [event, ...existing].slice(0, MAX_AGENT_EVENTS)
        }

        // v2: index by mission ID (from payload.missionId)
        const missionId = event.payload?.missionId as number | undefined
        const newMissionEvents = { ...state.missionEvents }
        if (missionId && V2_EVENT_TYPES.includes(event.type as V2EventType)) {
          const existing = newMissionEvents[missionId] || []
          newMissionEvents[missionId] = [event, ...existing].slice(0, MAX_EVENTS)
        }

        return {
          events: newEvents,
          agentActivity: newAgentActivity,
          missionEvents: newMissionEvents,
        }
      })
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

    // v2: Agent Watch — get events for a specific agent
    getAgentEvents: (agent: string) => {
      return get().agentActivity[agent] || []
    },

    // v2: Mission Control — get events for a specific mission
    getMissionEvents: (missionId: number) => {
      return get().missionEvents[missionId] || []
    },

    // v2: filter to only v2 execution engine events
    getV2Events: () => {
      return get().events.filter((e) => V2_EVENT_TYPES.includes(e.type as V2EventType))
    },
  })
)
