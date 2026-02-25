import { Edge, Node } from '@xyflow/react';

export interface ToolNodeData {
  toolName: string;
  category: 'Recon' | 'Web' | 'Cloud' | 'OSINT' | 'Binary' | 'Reporting';
  status: 'running' | 'waiting' | 'error' | 'pending' | 'success';
  outputPreview: string;
  parameters: Record<string, any>;
}

export interface AgentNodeData {
  agentAvatar: string;
  codename: string;
  assignedToolsCount: number;
  heartbeat: boolean;
  agentId: string;
}

export interface DecisionNodeData {
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
