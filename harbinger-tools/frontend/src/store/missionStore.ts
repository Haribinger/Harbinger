import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { missionsApi } from '../api/missions'
import type { Mission, MissionTask, MissionState, WarRoomEvent, AgentStatus } from '../api/missions'

interface MissionStore {
  // State
  missions: Mission[]
  activeMission: Mission | null
  tasks: MissionTask[]
  agents: AgentStatus[]
  events: WarRoomEvent[]
  pendingApprovals: number[]
  isLoading: boolean
  error: string | null
  subscriberCount: number

  // Actions — missions
  fetchMissions: () => Promise<void>
  createMission: (title: string, target?: string, missionType?: string) => Promise<Mission | null>
  setActiveMission: (id: number) => Promise<void>
  executeMission: (id: number) => Promise<void>

  // Actions — tasks
  fetchTasks: (missionId: number) => Promise<void>
  createTask: (missionId: number, title: string, agent: string, deps?: number[]) => Promise<MissionTask | null>
  approveTask: (taskId: number, approved: boolean) => Promise<void>
  reassignTask: (taskId: number, newAgent: string, reason?: string) => Promise<void>
  deleteTask: (taskId: number) => Promise<void>

  // Actions — war room
  fetchWarRoomState: (missionId: number) => Promise<void>
  fetchRecentEvents: (missionId: number) => Promise<void>
  injectCommand: (agentCodename: string, command: string) => Promise<void>
  addEvent: (event: WarRoomEvent) => void

  // Actions — approvals
  fetchPendingApprovals: () => Promise<void>

  // Refresh all
  refresh: () => Promise<void>
}

export const useMissionStore = create<MissionStore>()(
  persist(
    (set, get) => ({
      missions: [],
      activeMission: null,
      tasks: [],
      agents: [],
      events: [],
      pendingApprovals: [],
      isLoading: false,
      error: null,
      subscriberCount: 0,

      fetchMissions: async () => {
        set({ isLoading: true, error: null })
        try {
          const result = await missionsApi.list()
          const missions = Array.isArray(result) ? result : []
          set({ missions, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch missions', isLoading: false })
        }
      },

      createMission: async (title, target, missionType) => {
        try {
          const mission = await missionsApi.create({
            title,
            target: target || undefined,
            mission_type: missionType || 'custom',
          })
          set((s) => ({ missions: [mission, ...s.missions] }))
          return mission
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create mission' })
          return null
        }
      },

      setActiveMission: async (id) => {
        set({ isLoading: true })
        try {
          const mission = await missionsApi.get(id)
          set({ activeMission: mission })
          await get().fetchWarRoomState(id)
          set({ isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Mission not found', isLoading: false })
        }
      },

      executeMission: async (id) => {
        try {
          await missionsApi.execute(id)
          // Refresh state after execution starts
          await get().setActiveMission(id)
          await get().fetchMissions()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to execute mission' })
        }
      },

      fetchTasks: async (missionId) => {
        try {
          const result = await missionsApi.listTasks(missionId)
          const tasks = Array.isArray(result) ? result : []
          set({ tasks })
        } catch {
          set({ tasks: [] })
        }
      },

      createTask: async (missionId, title, agent, deps) => {
        try {
          const task = await missionsApi.createTask(missionId, {
            title,
            agent_codename: agent,
            depends_on: deps || [],
          })
          set((s) => ({ tasks: [...s.tasks, task] }))
          return task
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create task' })
          return null
        }
      },

      approveTask: async (taskId, approved) => {
        try {
          await missionsApi.approveTask(taskId, approved)
          const { activeMission } = get()
          if (activeMission) await get().fetchWarRoomState(activeMission.id)
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to approve task' })
        }
      },

      reassignTask: async (taskId, newAgent, reason) => {
        const { activeMission } = get()
        if (!activeMission) return
        try {
          await missionsApi.reassignTask(activeMission.id, taskId, newAgent, reason)
          await get().fetchWarRoomState(activeMission.id)
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to reassign task' })
        }
      },

      deleteTask: async (taskId) => {
        try {
          await missionsApi.deleteTask(taskId)
          set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }))
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to delete task' })
        }
      },

      fetchWarRoomState: async (missionId) => {
        try {
          const state: MissionState = await missionsApi.getWarRoomState(missionId)
          set({
            tasks: state.tasks || [],
            agents: state.agents || [],
            subscriberCount: state.subscriber_count,
          })
        } catch {
          // War room may not be available — degrade gracefully
        }
      },

      fetchRecentEvents: async (missionId) => {
        try {
          const data = await missionsApi.getRecentEvents(missionId, 100)
          set({ events: data.events || [] })
        } catch {
          // Events may not be available yet
        }
      },

      injectCommand: async (agentCodename, command) => {
        const { activeMission } = get()
        if (!activeMission) return
        try {
          await missionsApi.injectCommand(activeMission.id, agentCodename, command)
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to inject command' })
        }
      },

      addEvent: (event) => {
        set((s) => ({
          events: [...s.events.slice(-499), event],
        }))
      },

      fetchPendingApprovals: async () => {
        try {
          const data = await missionsApi.listPendingApprovals()
          set({ pendingApprovals: data.pending || [] })
        } catch {
          // Approvals endpoint may not be available
        }
      },

      refresh: async () => {
        const { activeMission } = get()
        await get().fetchMissions()
        if (activeMission) {
          await get().fetchWarRoomState(activeMission.id)
          await get().fetchRecentEvents(activeMission.id)
          await get().fetchPendingApprovals()
        }
      },
    }),
    {
      name: 'harbinger-missions',
      partialize: (state) => ({
        activeMission: state.activeMission,
      }),
    }
  )
)
