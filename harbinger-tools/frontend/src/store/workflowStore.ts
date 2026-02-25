import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Workflow } from '../types'

interface WorkflowState {
  workflows: Workflow[]
  selectedWorkflow: Workflow | null
  isLoading: boolean
  error: string | null

  // Actions
  setWorkflows: (workflows: Workflow[]) => void
  addWorkflow: (workflow: Workflow) => void
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void
  removeWorkflow: (id: string) => void
  setSelectedWorkflow: (workflow: Workflow | null) => void

  addNode: (workflowId: string, node: Workflow['nodes'][0]) => void
  updateNode: (workflowId: string, nodeId: string, updates: Partial<Workflow['nodes'][0]>) => void
  removeNode: (workflowId: string, nodeId: string) => void

  addEdge: (workflowId: string, edge: Workflow['edges'][0]) => void
  removeEdge: (workflowId: string, edgeId: string) => void

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, _get) => ({
      workflows: [],
      selectedWorkflow: null,
      isLoading: false,
      error: null,

      setWorkflows: (workflows) => set({ workflows }),
      addWorkflow: (workflow) =>
        set((state) => ({ workflows: [...state.workflows, workflow] })),
      updateWorkflow: (id, updates) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
          selectedWorkflow: state.selectedWorkflow?.id === id
            ? { ...state.selectedWorkflow, ...updates }
            : state.selectedWorkflow,
        })),
      removeWorkflow: (id) =>
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id),
          selectedWorkflow: state.selectedWorkflow?.id === id ? null : state.selectedWorkflow,
        })),
      setSelectedWorkflow: (workflow) => set({ selectedWorkflow: workflow }),

      addNode: (workflowId, node) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === workflowId ? { ...w, nodes: [...w.nodes, node] } : w
          ),
        })),
      updateNode: (workflowId, nodeId, updates) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === workflowId
              ? {
                  ...w,
                  nodes: w.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
                }
              : w
          ),
        })),
      removeNode: (workflowId, nodeId) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === workflowId
              ? {
                  ...w,
                  nodes: w.nodes.filter((n) => n.id !== nodeId),
                  edges: w.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
                }
              : w
          ),
        })),

      addEdge: (workflowId, edge) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === workflowId ? { ...w, edges: [...w.edges, edge] } : w
          ),
        })),
      removeEdge: (workflowId, edgeId) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === workflowId
              ? { ...w, edges: w.edges.filter((e) => e.id !== edgeId) }
              : w
          ),
        })),

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'harbinger-workflows',
      partialize: (state) => ({
        workflows: state.workflows,
      }),
    }
  )
)
