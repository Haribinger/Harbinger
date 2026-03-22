import { apiClient } from './client'

// ── Memory Layer Types ─────────────────────────────────────────────────────────

export interface MemorySearchResult {
  layer: string    // L1, L2, L3, L4, L5
  score: number
  content: string
  type: string     // working, finding, memory, entity, pattern
  metadata: Record<string, unknown>
}

export interface MemoryLayerStats {
  L1_working: { status: string; active_missions: number; keys_count: number }
  L2_mission: { status: string; findings_count: number; missions_with_findings: number }
  L3_knowledge: { status: string; memories_count: number; with_embeddings: number; without_embeddings: number }
  L4_graph: { status: string; nodes: number; relationships: number; labels: Record<string, number> }
  L5_identity: { status: string; agents_with_patterns: number; total_patterns: number }
}

export interface MemoryDashboard {
  layers: MemoryLayerStats
  embedding_provider: string
  embedding_dimension: number
  graph_connected: boolean
  redis_connected: boolean
}

export interface UnifiedSearchRequest {
  query: string
  mission_id?: string
  agent_id?: string
  layers?: string[]
  limit?: number
}

// ── API ───────────────────────────────────────────────────────────────────────

export const memoryLayerApi = {
  // L1 Working Memory
  setWorking: async (missionId: string, key: string, value: string) =>
    apiClient.post('/api/memory/working/set', { mission_id: missionId, key, value }),

  getWorking: async (missionId: string, key: string) =>
    apiClient.get(`/api/memory/working/${missionId}/${key}`) as Promise<{ value: string }>,

  getAllWorking: async (missionId: string) =>
    apiClient.get(`/api/memory/working/${missionId}`) as Promise<Record<string, string>>,

  appendWorking: async (missionId: string, key: string, value: string) =>
    apiClient.post('/api/memory/working/append', { mission_id: missionId, key, value }),

  clearWorking: async (missionId: string) =>
    apiClient.delete(`/api/memory/working/${missionId}`),

  // Summarization
  summarize: async (text: string, toolName?: string) =>
    apiClient.post('/api/memory/summarize', { text, tool_name: toolName }) as Promise<{ summary: string }>,

  // Dashboard
  getDashboard: async () =>
    apiClient.get('/api/memory/dashboard') as Promise<MemoryDashboard>,

  // Unified Search
  searchAll: async (request: UnifiedSearchRequest) => {
    const result = await apiClient.post('/api/memory/search-all', request)
    return Array.isArray(result)
      ? result as MemorySearchResult[]
      : Array.isArray((result as Record<string, unknown>)?.items)
        ? (result as Record<string, unknown>).items as MemorySearchResult[]
        : []
  },
}
