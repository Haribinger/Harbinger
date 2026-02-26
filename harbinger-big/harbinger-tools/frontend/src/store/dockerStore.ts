import { create } from 'zustand'
import { dockerApi } from '../api/docker'
import type { DockerContainer, DockerImage, ContainerLog } from '../types'

interface DockerState {
  containers: DockerContainer[]
  images: DockerImage[]
  logs: Record<string, ContainerLog[]>
  selectedContainer: DockerContainer | null
  isLoading: boolean
  error: string | null
  statsEnabled: boolean
  isConnected: boolean
  connectionStatus: 'connected' | 'disconnected' | 'not_configured' | 'error'

  // Actions
  setContainers: (containers: DockerContainer[]) => void
  addContainer: (container: DockerContainer) => void
  updateContainer: (id: string, updates: Partial<DockerContainer>) => void
  removeContainer: (id: string) => void
  setSelectedContainer: (container: DockerContainer | null) => void

  setImages: (images: DockerImage[]) => void
  addImage: (image: DockerImage) => void
  removeImage: (id: string) => void

  addLog: (containerId: string, log: ContainerLog) => void
  clearLogs: (containerId: string) => void
  setLogs: (containerId: string, logs: ContainerLog[]) => void

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setStatsEnabled: (enabled: boolean) => void
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'not_configured' | 'error') => void

  // API Actions
  fetchContainers: () => Promise<void>
  fetchImages: () => Promise<void>
  startContainer: (id: string) => Promise<void>
  stopContainer: (id: string) => Promise<void>
  removeContainerApi: (id: string) => Promise<void>
  fetchLogs: (id: string, tail?: number) => Promise<void>
}

export const useDockerStore = create<DockerState>((set) => ({
  containers: [],
  images: [],
  logs: {},
  selectedContainer: null,
  isLoading: false,
  error: null,
  statsEnabled: true,
  isConnected: false,
  connectionStatus: 'disconnected',

  setContainers: (containers) => set({ containers }),
  addContainer: (container) =>
    set((state) => ({ containers: [...state.containers, container] })),
  updateContainer: (id, updates) =>
    set((state) => ({
      containers: state.containers.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  removeContainer: (id) =>
    set((state) => ({
      containers: state.containers.filter((c) => c.id !== id),
      logs: { ...state.logs, [id]: [] },
    })),
  setSelectedContainer: (container) => set({ selectedContainer: container }),

  setImages: (images) => set({ images }),
  addImage: (image) =>
    set((state) => ({ images: [...state.images, image] })),
  removeImage: (id) =>
    set((state) => ({
      images: state.images.filter((i) => i.id !== id),
    })),

  addLog: (containerId, log) =>
    set((state) => ({
      logs: {
        ...state.logs,
        [containerId]: [...(state.logs[containerId] || []), log].slice(-1000),
      },
    })),
  clearLogs: (containerId) =>
    set((state) => ({
      logs: { ...state.logs, [containerId]: [] },
    })),
  setLogs: (containerId, logs) =>
    set((state) => ({
      logs: { ...state.logs, [containerId]: logs },
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setStatsEnabled: (statsEnabled) => set({ statsEnabled }),
  setConnectionStatus: (connectionStatus) => set({
    connectionStatus,
    isConnected: connectionStatus === 'connected',
  }),

  // API Actions
  fetchContainers: async () => {
    set({ isLoading: true, error: null })
    try {
      const containers = await dockerApi.getContainers()
      set({ containers, isLoading: false })
    } catch (error) {
      console.error('Failed to fetch containers:', error)
      set({ error: 'Failed to fetch containers', isLoading: false })
    }
  },

  fetchImages: async () => {
    set({ isLoading: true, error: null })
    try {
      const images = await dockerApi.getImages()
      set({ images, isLoading: false })
    } catch (error) {
      console.error('Failed to fetch images:', error)
      set({ error: 'Failed to fetch images', isLoading: false })
    }
  },

  startContainer: async (id: string) => {
    try {
      await dockerApi.startContainer(id)
      set((state) => ({
        containers: state.containers.map((c) =>
          c.id === id ? { ...c, status: 'running' } : c
        ),
      }))
    } catch (error) {
      console.error('Failed to start container:', error)
      throw error
    }
  },

  stopContainer: async (id: string) => {
    try {
      await dockerApi.stopContainer(id)
      set((state) => ({
        containers: state.containers.map((c) =>
          c.id === id ? { ...c, status: 'exited' } : c
        ),
      }))
    } catch (error) {
      console.error('Failed to stop container:', error)
      throw error
    }
  },

  removeContainerApi: async (id: string) => {
    try {
      await dockerApi.removeContainer(id)
      set((state) => ({
        containers: state.containers.filter((c) => c.id !== id),
      }))
    } catch (error) {
      console.error('Failed to remove container:', error)
      throw error
    }
  },

  fetchLogs: async (id: string, tail?: number) => {
    try {
      const logs = await dockerApi.getContainerLogs(id, tail)
      set((state) => ({
        logs: { ...state.logs, [id]: logs },
      }))
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  },
}))
