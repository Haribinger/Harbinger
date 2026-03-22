import { apiClient } from './client'

// ── Knowledge Graph Types ──────────────────────────────────────────────────────

export interface GraphNode {
  label: string
  properties: Record<string, unknown>
}

export interface GraphRelation {
  from_label: string
  from_key: string
  from_val: string
  rel_type: string
  to_label: string
  to_key: string
  to_val: string
  properties: Record<string, unknown>
}

export interface GraphNeighbors {
  nodes: GraphNode[]
  relations: GraphRelation[]
}

export interface GraphStats {
  labels: Record<string, number>
  relationships: Record<string, number>
  total_nodes: number
  total_relationships: number
}

export interface GraphSearchResult {
  label: string
  properties: Record<string, unknown>
  score: number
}

export interface BulkIngestRequest {
  nodes: Array<{
    label: string
    unique_key: string
    properties: Record<string, unknown>
  }>
  relations: Array<GraphRelation>
}

// ── API ───────────────────────────────────────────────────────────────────────

export const knowledgeGraphApi = {
  // Nodes
  createNode: async (node: { label: string; unique_key: string; properties: Record<string, unknown> }) =>
    apiClient.post('/api/graph/nodes', node),

  getNode: async (label: string, key: string, value: string) =>
    apiClient.get(`/api/graph/nodes/${label}?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`) as Promise<GraphNode>,

  listNodes: async (label: string, limit = 50, offset = 0) => {
    const result = await apiClient.get(`/api/graph/nodes/${label}?limit=${limit}&offset=${offset}`)
    return Array.isArray(result) ? result as GraphNode[] : []
  },

  deleteNode: async (label: string, key: string, value: string) =>
    apiClient.delete(`/api/graph/nodes/${label}?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`),

  // Relations
  createRelation: async (relation: GraphRelation) =>
    apiClient.post('/api/graph/relations', relation),

  // Queries
  getNeighbors: async (label: string, key: string, value: string, depth = 1) =>
    apiClient.get(`/api/graph/neighbors/${label}?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}&depth=${depth}`) as Promise<GraphNeighbors>,

  search: async (query: string, label?: string, limit = 20) => {
    const params = new URLSearchParams({ q: query, limit: String(limit) })
    if (label) params.set('label', label)
    const result = await apiClient.get(`/api/graph/search?${params}`)
    return Array.isArray(result) ? result as GraphSearchResult[] : []
  },

  getAttackPath: async (missionId: string) => {
    const result = await apiClient.get(`/api/graph/attack-path/${missionId}`)
    return Array.isArray(result) ? result as GraphNode[] : []
  },

  getStats: async () =>
    apiClient.get('/api/graph/stats') as Promise<GraphStats>,

  bulkIngest: async (data: BulkIngestRequest) =>
    apiClient.post('/api/graph/ingest', data),
}
