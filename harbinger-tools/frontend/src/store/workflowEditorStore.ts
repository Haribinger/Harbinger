import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge, Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from '@xyflow/react';
import { WorkflowNode, WorkflowEdge, WorkflowTemplate, WorkflowExecution } from '../types/workflow';

interface WorkflowEditorState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNode: WorkflowNode | null;
  executionState: WorkflowExecution | null;
  templates: WorkflowTemplate[];
  savedWorkflows: WorkflowTemplate[]; // Using WorkflowTemplate to store saved workflows for simplicity
  
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
  
  // Actions for the workflow editor
  addNode: (node: WorkflowNode) => void;
  updateNode: (nodeId: string, data: Partial<any>) => void;
  deleteNode: (nodeId: string) => void;
  
  // Execution actions
  startExecution: (workflowId: string) => void;
  updateNodeStatus: (nodeId: string, status: 'running' | 'waiting' | 'error' | 'pending' | 'success') => void;
  addLogEntry: (entry: string) => void;
  stopExecution: () => void;
}

export const useWorkflowEditorStore = create<WorkflowEditorState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  executionState: null,
  templates: [
    {
      id: 'quick-recon',
      name: 'Quick Recon',
      description: 'Performs a quick reconnaissance scan.',
      nodes: [], // Populate with actual nodes later
      edges: [],
    },
    {
      id: 'full-bug-bounty',
      name: 'Full Bug Bounty',
      description: 'Comprehensive bug bounty hunting workflow.',
      nodes: [],
      edges: [],
    },
    {
      id: 'subdomain-takeover',
      name: 'Subdomain Takeover',
      description: 'Workflow to identify and exploit subdomain takeovers.',
      nodes: [],
      edges: [],
    },
    {
      id: 'api-security-audit',
      name: 'API Security Audit',
      description: 'Audits API endpoints for common vulnerabilities.',
      nodes: [],
      edges: [],
    },
  ],
  savedWorkflows: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as WorkflowNode[] });
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) as WorkflowEdge[] });
  },
  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) as WorkflowEdge[] });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setExecutionState: (execution) => set({ executionState: execution }),
  addTemplate: (template) => set((state) => ({ templates: [...state.templates, template] })),
  addSavedWorkflow: (workflow) => set((state) => ({ savedWorkflows: [...state.savedWorkflows, workflow] })),
  loadWorkflow: (workflow) => set({ nodes: workflow.nodes, edges: workflow.edges, selectedNode: null, executionState: null }),

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
    })),

  startExecution: (workflowId) => {
    set({
      executionState: {
        id: `exec-${Date.now()}`,
        workflowId,
        status: 'running',
        startTime: new Date(),
        log: ['Workflow execution started.'],
        nodeStatuses: {},
      },
    });
    // Initialize all nodes to pending status
    get().nodes.forEach(node => get().updateNodeStatus(node.id, 'pending'));
  },
  updateNodeStatus: (nodeId, status) => {
    set((state) => {
      if (!state.executionState) return state;
      return {
        executionState: {
          ...state.executionState,
          nodeStatuses: {
            ...state.executionState.nodeStatuses,
            [nodeId]: status,
          },
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
          log: [...state.executionState.log, entry],
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
          log: [...state.executionState.log, 'Workflow execution stopped.'],
        },
      };
    });
  },
}));
