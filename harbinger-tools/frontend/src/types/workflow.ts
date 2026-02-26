import { Edge, Node } from '@xyflow/react';

// @xyflow/react requires node data types to satisfy Record<string, unknown>

export interface ToolNodeData extends Record<string, unknown> {
  toolName: string;
  category: 'Recon' | 'Web' | 'Cloud' | 'OSINT' | 'Binary' | 'Reporting' | 'Browser';
  status: 'running' | 'waiting' | 'error' | 'pending' | 'success';
  outputPreview: string;
  parameters: Record<string, unknown>;
  // Variable bindings — key is param name, value is expression like {{node_id.output}}
  variables: Record<string, string>;
  timeout: number; // seconds, 0 = no timeout
  retryCount: number;
  continueOnError: boolean;
}

export interface AgentNodeData extends Record<string, unknown> {
  agentAvatar: string;
  codename: string;
  assignedToolsCount: number;
  heartbeat: boolean;
  agentId: string;
  agentType: string;
  autoChain: boolean; // auto-handoff findings to next agent
}

export interface DecisionNodeData extends Record<string, unknown> {
  condition: string;
  // Expression language: {{prev.output}} contains "critical", {{prev.status}} == 200, etc.
  trueLabel: string;
  falseLabel: string;
}

export interface TriggerNodeData extends Record<string, unknown> {
  triggerType: 'manual' | 'cron' | 'webhook' | 'on-finding' | 'on-agent-message' | 'on-event';
  cronExpression: string; // e.g. "0 */6 * * *"
  webhookPath: string; // e.g. "/webhooks/start-recon"
  eventFilter: string; // e.g. "finding.critical"
  enabled: boolean;
}

export interface OutputNodeData extends Record<string, unknown> {
  outputType: 'report' | 'notify' | 'save' | 'broadcast' | 'webhook-out';
  destination: string; // channel name, file path, webhook URL
  format: 'json' | 'markdown' | 'pdf' | 'text';
  template: string; // output template with variable expressions
}

export interface VariableNodeData extends Record<string, unknown> {
  variableName: string;
  expression: string; // transform expression: {{input}} | uppercase, {{input.items}} | count
  dataType: 'string' | 'number' | 'boolean' | 'array' | 'object';
}

export type AnyNodeData = ToolNodeData | AgentNodeData | DecisionNodeData | TriggerNodeData | OutputNodeData | VariableNodeData;
export type WorkflowNode = Node<AnyNodeData>;
export type WorkflowEdge = Edge;

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: WorkflowVariable[];
  version?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowVariable {
  name: string;
  defaultValue: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'secret';
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  log: string[];
  nodeStatuses: Record<string, 'running' | 'waiting' | 'error' | 'pending' | 'success'>;
  nodeOutputs: Record<string, unknown>;
  variables: Record<string, unknown>;
}
