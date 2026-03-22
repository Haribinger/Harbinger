import { apiClient } from './client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Mission {
  id: number
  title: string
  description: string | null
  status: string
  mission_type: string
  target: string | null
  scope: Record<string, unknown> | null
  autonomy_level: number
  trace_id: string | null
  user_id: string | null
  created_at: string
  updated_at: string
}

export interface MissionTask {
  id: number
  mission_id: number
  title: string
  description: string | null
  status: string
  agent_codename: string | null
  docker_image: string | null
  container_id: string | null
  depends_on: number[]
  approval_required: boolean
  priority: number
  input: Record<string, unknown> | null
  result: Record<string, unknown> | null
  position: number
  created_at: string
}

export interface AgentStatus {
  codename: string
  status: string
  current_task: string | null
  container_id: string | null
}

export interface MissionState {
  mission_id: number
  title: string
  status: string
  tasks: MissionTask[]
  agents: AgentStatus[]
  subscriber_count: number
  event_count: number
}

export interface WarRoomEvent {
  id: string
  type: string
  source: string
  target: string
  channel: string
  payload: Record<string, unknown>
  timestamp: number
  _replay?: boolean
}

export interface CreateMissionRequest {
  title: string
  description?: string
  target?: string
  mission_type?: string
  autonomy_level?: number
  scope?: Record<string, unknown>
}

export interface CreateTaskRequest {
  title: string
  description?: string
  agent_codename?: string
  docker_image?: string
  depends_on?: number[]
  approval_required?: boolean
  priority?: number
  input?: Record<string, unknown>
  position?: number
}

// ── API Client ───────────────────────────────────────────────────────────────

export const missionsApi = {
  // Mission CRUD
  list: () =>
    apiClient.get<Mission[]>('/api/v2/missions'),

  get: (id: number) =>
    apiClient.get<Mission>(`/api/v2/missions/${id}`),

  create: (data: CreateMissionRequest) =>
    apiClient.post<Mission>('/api/v2/missions', data),

  execute: (id: number) =>
    apiClient.post<{ status: string; mission_id: number }>(
      `/api/v2/missions/${id}/execute`
    ),

  // Task CRUD
  listTasks: (missionId: number) =>
    apiClient.get<MissionTask[]>(`/api/v2/missions/${missionId}/tasks`),

  createTask: (missionId: number, data: CreateTaskRequest) =>
    apiClient.post<MissionTask>(`/api/v2/missions/${missionId}/tasks`, data),

  getTask: (taskId: number) =>
    apiClient.get<MissionTask>(`/api/v2/tasks/${taskId}`),

  updateTask: (taskId: number, data: Partial<MissionTask>) =>
    apiClient.patch<MissionTask>(`/api/v2/tasks/${taskId}`, data),

  deleteTask: (taskId: number) =>
    apiClient.delete(`/api/v2/tasks/${taskId}`),

  // Approval
  approveTask: (taskId: number, approved: boolean) =>
    apiClient.post<{ ok: boolean }>(`/api/v2/tasks/${taskId}/approve`, { approved }),

  listPendingApprovals: () =>
    apiClient.get<{ pending: number[] }>('/api/v2/approvals/pending'),

  // War Room
  getWarRoomState: (missionId: number) =>
    apiClient.get<MissionState>(`/api/v2/warroom/${missionId}/state`),

  getRecentEvents: (missionId: number, limit = 50) =>
    apiClient.get<{ ok: boolean; events: WarRoomEvent[] }>(
      `/api/v2/warroom/${missionId}/events`,
      { limit }
    ),

  injectCommand: (missionId: number, agentCodename: string, command: string, timeout = 300) =>
    apiClient.post<{ ok: boolean }>(`/api/v2/warroom/${missionId}/inject`, {
      agent_codename: agentCodename,
      command,
      timeout,
    }),

  reassignTask: (missionId: number, taskId: number, newAgent: string, reason = '') =>
    apiClient.post<{ ok: boolean }>(`/api/v2/warroom/${missionId}/reassign`, {
      task_id: taskId,
      new_agent: newAgent,
      reason,
    }),
}
