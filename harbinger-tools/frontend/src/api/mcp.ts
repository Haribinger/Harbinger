import { apiClient } from './client'
import type { MCP, Tool } from '../types'

export interface CreateMCPRequest {
  name: string
  description?: string
  url: string
  type: 'stdio' | 'sse' | 'http'
  command?: string
  args?: string[]
  env?: Record<string, string>
}

export interface MCPTool extends Tool {
  mcpId: string
  mcpName: string
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

export const mcpApi = {
  // Get all MCP servers
  getAll: async (): Promise<MCP[]> => {
    return apiClient.get<MCP[]>('/api/mcp')
  },

  // Get single MCP
  get: async (id: string): Promise<MCP> => {
    return apiClient.get<MCP>(`/api/mcp/${id}`)
  },

  // Create MCP server
  create: async (data: CreateMCPRequest): Promise<MCP> => {
    return apiClient.post<MCP>('/api/mcp', data)
  },

  // Update MCP server
  update: async (id: string, data: Partial<CreateMCPRequest>): Promise<MCP> => {
    return apiClient.patch<MCP>(`/api/mcp/${id}`, data)
  },

  // Delete MCP server
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/mcp/${id}`)
  },

  // Connect to MCP server
  connect: async (id: string): Promise<void> => {
    await apiClient.post(`/api/mcp/${id}/connect`)
  },

  // Disconnect from MCP server
  disconnect: async (id: string): Promise<void> => {
    await apiClient.post(`/api/mcp/${id}/disconnect`)
  },

  // Get MCP tools
  getTools: async (id: string): Promise<MCPTool[]> => {
    return apiClient.get<MCPTool[]>(`/api/mcp/${id}/tools`)
  },

  // Get MCP resources
  getResources: async (id: string): Promise<MCPResource[]> => {
    return apiClient.get<MCPResource[]>(`/api/mcp/${id}/resources`)
  },

  // Get MCP prompts
  getPrompts: async (id: string): Promise<MCPPrompt[]> => {
    return apiClient.get<MCPPrompt[]>(`/api/mcp/${id}/prompts`)
  },

  // Call MCP tool
  callTool: async (mcpId: string, toolName: string, args: Record<string, unknown>): Promise<{
    content: string
    isError?: boolean
  }> => {
    return apiClient.post(`/api/mcp/${mcpId}/tools/${toolName}`, { args })
  },

  // Test MCP connection
  test: async (url: string, type: 'stdio' | 'sse' | 'http'): Promise<{ success: boolean; message: string }> => {
    return apiClient.post('/api/mcp/test', { url, type })
  },

  // Get builtin tools
  getBuiltinTools: async (): Promise<Tool[]> => {
    return apiClient.get<Tool[]>('/api/mcp/builtin/tools')
  },

  // Execute builtin tool
  executeBuiltinTool: async (toolName: string, args: Record<string, unknown>): Promise<{
    output: string
    error?: string
  }> => {
    return apiClient.post(`/api/mcp/builtin/tools/${toolName}`, { args })
  },
}
