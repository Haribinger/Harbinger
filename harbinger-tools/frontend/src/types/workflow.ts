import { Edge, Node } from '@xyflow/react';

// @xyflow/react requires node data types to satisfy Record<string, unknown>
export interface ToolNodeData extends Record<string, unknown> {
  toolName: string;
  category: 'Recon' | 'Web' | 'Cloud' | 'OSINT' | 'Binary' | 'Reporting';
  status: 'running' | 'waiting' | 'error' | 'pending' | 'success';
  outputPreview: string;
  parameters: Record<string, unknown>;
}

export interface AgentNodeData extends Record<string, unknown> {
  agentAvatar: string;
  codename: string;
  assignedToolsCount: number;
  heartbeat: boolean;
  agentId: string;
}

export interface DecisionNodeData extends Record<string, unknown> {
  condition: string;
}

export type WorkflowNode = Node<ToolNodeData | AgentNodeData | DecisionNodeData>;
export type WorkflowEdge = Edge;

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  log: string[];
  nodeStatuses: Record<string, 'running' | 'waiting' | 'error' | 'pending' | 'success'>;
}
