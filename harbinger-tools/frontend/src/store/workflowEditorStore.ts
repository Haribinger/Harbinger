import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyNodeChanges, applyEdgeChanges, addEdge, OnNodesChange, OnEdgesChange, OnConnect } from '@xyflow/react';
import { WorkflowNode, WorkflowEdge, WorkflowTemplate, WorkflowExecution, WorkflowVariable, WorkflowSnapshot } from '../types/workflow';
import { getNodeLabel } from '../types/workflow-guards';
import { WORKFLOW_TEMPLATES } from '../core/workflows/templates';

const MAX_UNDO_STACK = 50;

function deepClone<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

interface WorkflowEditorState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNode: WorkflowNode | null;
  executionState: WorkflowExecution | null;
  templates: WorkflowTemplate[];
  savedWorkflows: WorkflowTemplate[];
  workflowVariables: WorkflowVariable[];

  // Undo/Redo
  undoStack: WorkflowSnapshot[];
  redoStack: WorkflowSnapshot[];

  // Grid
  snapToGrid: boolean;
  gridSize: number;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  setSelectedNode: (node: WorkflowNode | null) => void;
  setExecutionState: (execution: WorkflowExecution | null) => void;
  addTemplate: (template: WorkflowTemplate) => void;
  addSavedWorkflow: (workflow: WorkflowTemplate) => void;
  loadWorkflow: (workflow: WorkflowTemplate) => void;

  addNode: (node: WorkflowNode) => void;
  updateNode: (nodeId: string, data: Record<string, unknown>) => void;
  deleteNode: (nodeId: string) => void;

  // Undo/Redo
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Grid
  toggleSnapToGrid: () => void;

  // Variable management
  addVariable: (variable: WorkflowVariable) => void;
  updateVariable: (name: string, updates: Partial<WorkflowVariable>) => void;
  removeVariable: (name: string) => void;

  // Execution
  startExecution: (workflowId: string) => void;
  updateNodeStatus: (nodeId: string, status: 'running' | 'waiting' | 'error' | 'pending' | 'success') => void;
  setNodeOutput: (nodeId: string, output: unknown) => void;
  addLogEntry: (entry: string) => void;
  stopExecution: () => void;
}

export const useWorkflowEditorStore = create<WorkflowEditorState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNode: null,
      executionState: null,
      workflowVariables: [],
      undoStack: [],
      redoStack: [],
      snapToGrid: false,
      gridSize: 20,
      templates: WORKFLOW_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        nodes: t.nodes as WorkflowNode[],
        edges: t.edges as WorkflowEdge[],
        variables: [],
      })),
      savedWorkflows: [],

      onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) as WorkflowNode[] });
      },
      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) as WorkflowEdge[] });
      },
      onConnect: (connection) => {
        get().pushSnapshot();
        set({ edges: addEdge(connection, get().edges) as WorkflowEdge[] });
      },

      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      setSelectedNode: (node) => set({ selectedNode: node }),
      setExecutionState: (execution) => set({ executionState: execution }),
      addTemplate: (template) => set((state) => ({ templates: [...state.templates, template] })),
      addSavedWorkflow: (workflow) => set((state) => ({
        savedWorkflows: [
          ...state.savedWorkflows.filter(w => w.id !== workflow.id),
          { ...workflow, updatedAt: new Date().toISOString() },
        ],
      })),
      loadWorkflow: (workflow) => {
        get().pushSnapshot();
        set({
          nodes: workflow.nodes,
          edges: workflow.edges,
          selectedNode: null,
          executionState: null,
          workflowVariables: workflow.variables || [],
        });
      },

      addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
      updateNode: (nodeId, data) =>
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
          ),
        })),
      deleteNode: (nodeId) =>
        set((state) => ({
          nodes: state.nodes.filter((node) => node.id !== nodeId),
          edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
          selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode,
        })),

      // Undo/Redo
      pushSnapshot: () => {
        const { nodes, edges } = get();
        const snapshot: WorkflowSnapshot = {
          nodes: deepClone(nodes),
          edges: deepClone(edges),
          timestamp: Date.now(),
        };
        set((state) => ({
          undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), snapshot],
          redoStack: [],
        }));
      },
      undo: () => {
        const { undoStack, nodes, edges } = get();
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        const current: WorkflowSnapshot = {
          nodes: deepClone(nodes),
          edges: deepClone(edges),
          timestamp: Date.now(),
        };
        set({
          nodes: prev.nodes,
          edges: prev.edges,
          undoStack: undoStack.slice(0, -1),
          redoStack: [...get().redoStack, current],
          selectedNode: null,
        });
      },
      redo: () => {
        const { redoStack, nodes, edges } = get();
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        const current: WorkflowSnapshot = {
          nodes: deepClone(nodes),
          edges: deepClone(edges),
          timestamp: Date.now(),
        };
        set({
          nodes: next.nodes,
          edges: next.edges,
          redoStack: redoStack.slice(0, -1),
          undoStack: [...get().undoStack, current],
          selectedNode: null,
        });
      },

      // Grid
      toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

      // Variables
      addVariable: (variable) =>
        set((state) => ({
          workflowVariables: [...state.workflowVariables.filter(v => v.name !== variable.name), variable],
        })),
      updateVariable: (name, updates) =>
        set((state) => ({
          workflowVariables: state.workflowVariables.map(v =>
            v.name === name ? { ...v, ...updates } : v
          ),
        })),
      removeVariable: (name) =>
        set((state) => ({
          workflowVariables: state.workflowVariables.filter(v => v.name !== name),
        })),

      // Execution
      startExecution: (workflowId) => {
        set({
          executionState: {
            id: `exec-${Date.now()}`,
            workflowId,
            status: 'running',
            startTime: new Date(),
            log: [`[${new Date().toLocaleTimeString()}] Workflow execution started`],
            nodeStatuses: {},
            nodeOutputs: {},
            variables: {},
          },
        });
        get().nodes.forEach(node => get().updateNodeStatus(node.id, 'pending'));
      },
      updateNodeStatus: (nodeId, status) => {
        set((state) => {
          if (!state.executionState) return state;
          const nodeData = state.nodes.find(n => n.id === nodeId)?.data;
          const label = nodeData ? getNodeLabel(nodeData) : nodeId;
          return {
            executionState: {
              ...state.executionState,
              nodeStatuses: { ...state.executionState.nodeStatuses, [nodeId]: status },
              log: [
                ...state.executionState.log,
                `[${new Date().toLocaleTimeString()}] ${label}: ${status}`,
              ],
            },
          };
        });
      },
      setNodeOutput: (nodeId, output) => {
        set((state) => {
          if (!state.executionState) return state;
          return {
            executionState: {
              ...state.executionState,
              nodeOutputs: { ...state.executionState.nodeOutputs, [nodeId]: output },
            },
          };
        });
      },
      addLogEntry: (entry) => {
        set((state) => {
          if (!state.executionState) return state;
          return {
            executionState: {
              ...state.executionState,
              log: [...state.executionState.log, `[${new Date().toLocaleTimeString()}] ${entry}`],
            },
          };
        });
      },
      stopExecution: () => {
        set((state) => {
          if (!state.executionState) return state;
          return {
            executionState: {
              ...state.executionState,
              status: 'completed',
              endTime: new Date(),
              log: [...state.executionState.log, `[${new Date().toLocaleTimeString()}] Workflow execution stopped`],
            },
          };
        });
      },
    }),
    {
      name: 'harbinger-workflow-editor',
      partialize: (state) => ({
        savedWorkflows: state.savedWorkflows,
        workflowVariables: state.workflowVariables,
      }),
    }
  )
);
