import { apiClient } from './client'
import type { DockerContainer, DockerImage, ContainerLog } from '../types'

export interface CreateContainerRequest {
  name: string
  image: string
  command?: string
  ports?: Record<string, string>
  environment?: Record<string, string>
  volumes?: Record<string, string>
  network?: string
  cpuLimit?: number
  memoryLimit?: number
  autoRemove?: boolean
}

export interface ContainerStats {
  cpu: number
  memory: number
  memoryLimit: number
  networkRx: number
  networkTx: number
}

export const dockerApi = {
  // Get all containers
  getContainers: async (): Promise<DockerContainer[]> => {
    const result = await apiClient.get<any>('/api/docker/containers')
    return Array.isArray(result) ? result : []
  },

  // Get all images
  getImages: async (): Promise<DockerImage[]> => {
    const result = await apiClient.get<any>('/api/docker/images')
    return Array.isArray(result) ? result : []
  },

  // Create container
  createContainer: async (data: CreateContainerRequest): Promise<DockerContainer> => {
    return apiClient.post<DockerContainer>('/api/docker/containers', data)
  },

  // Start container
  startContainer: async (id: string): Promise<void> => {
    await apiClient.post(`/api/docker/containers/${id}/start`)
  },

  // Stop container
  stopContainer: async (id: string, timeout?: number): Promise<void> => {
    await apiClient.post(`/api/docker/containers/${id}/stop`, { timeout })
  },

  // Restart container
  restartContainer: async (id: string): Promise<void> => {
    await apiClient.post(`/api/docker/containers/${id}/restart`)
  },

  // Remove container
  removeContainer: async (id: string, force?: boolean): Promise<void> => {
    await apiClient.delete(`/api/docker/containers/${id}?force=${force || false}`)
  },

  // Get container logs
  getContainerLogs: async (id: string, tail?: number): Promise<ContainerLog[]> => {
    return apiClient.get<ContainerLog[]>(`/api/docker/containers/${id}/logs`, { tail })
  },

  // Get container stats
  getContainerStats: async (id: string): Promise<ContainerStats> => {
    return apiClient.get<ContainerStats>(`/api/docker/containers/${id}/stats`)
  },

  // Pull image
  pullImage: async (imageName: string, tag?: string): Promise<void> => {
    await apiClient.post('/api/docker/images/pull', { image: imageName, tag })
  },

  // Remove image
  removeImage: async (id: string, force?: boolean): Promise<void> => {
    await apiClient.delete(`/api/docker/images/${id}?force=${force || false}`)
  },

  // Prune unused images
  pruneImages: async (): Promise<{ deleted: number; reclaimed: number }> => {
    return apiClient.post('/api/docker/images/prune')
  },

  // Get networks
  getNetworks: async (): Promise<Array<{ id: string; name: string; driver: string }>> => {
    return apiClient.get('/api/docker/networks')
  },

  // Get volumes
  getVolumes: async (): Promise<Array<{ name: string; driver: string; size: number }>> => {
    return apiClient.get('/api/docker/volumes')
  },
}
