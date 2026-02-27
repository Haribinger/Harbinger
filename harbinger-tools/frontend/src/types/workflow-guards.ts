import type {
  AnyNodeData,
  ToolNodeData,
  AgentNodeData,
  DecisionNodeData,
  TriggerNodeData,
  OutputNodeData,
  VariableNodeData,
  LoopNodeData,
  HttpRequestNodeData,
  DelayNodeData,
  CodeNodeData,
  NotificationNodeData,
} from './workflow';

export function isToolNodeData(data: AnyNodeData): data is ToolNodeData {
  return 'toolName' in data && 'category' in data;
}

export function isAgentNodeData(data: AnyNodeData): data is AgentNodeData {
  return 'codename' in data && 'agentId' in data;
}

export function isDecisionNodeData(data: AnyNodeData): data is DecisionNodeData {
  return 'condition' in data && 'trueLabel' in data;
}

export function isTriggerNodeData(data: AnyNodeData): data is TriggerNodeData {
  return 'triggerType' in data && 'enabled' in data;
}

export function isOutputNodeData(data: AnyNodeData): data is OutputNodeData {
  return 'outputType' in data && 'format' in data;
}

export function isVariableNodeData(data: AnyNodeData): data is VariableNodeData {
  return 'variableName' in data && 'expression' in data;
}

export function isLoopNodeData(data: AnyNodeData): data is LoopNodeData {
  return 'iteratorExpression' in data && 'itemVariable' in data;
}

export function isHttpRequestNodeData(data: AnyNodeData): data is HttpRequestNodeData {
  return 'method' in data && 'url' in data && 'bodyType' in data;
}

export function isDelayNodeData(data: AnyNodeData): data is DelayNodeData {
  return 'delayType' in data && 'durationMs' in data;
}

export function isCodeNodeData(data: AnyNodeData): data is CodeNodeData {
  return 'language' in data && 'code' in data && 'entryFunction' in data;
}

export function isNotificationNodeData(data: AnyNodeData): data is NotificationNodeData {
  return 'messageTemplate' in data && 'severity' in data && 'channel' in data;
}

export function getNodeLabel(data: AnyNodeData): string {
  if (isToolNodeData(data)) return data.toolName;
  if (isAgentNodeData(data)) return data.codename;
  if (isTriggerNodeData(data)) return data.triggerType;
  if (isOutputNodeData(data)) return data.outputType;
  if (isVariableNodeData(data)) return data.variableName;
  if (isLoopNodeData(data)) return `Loop: ${data.iteratorExpression}`;
  if (isHttpRequestNodeData(data)) return `${data.method} ${data.url}`;
  if (isDelayNodeData(data)) return `Delay: ${data.durationMs}ms`;
  if (isCodeNodeData(data)) return `Code (${data.language})`;
  if (isNotificationNodeData(data)) return `Notify: ${data.channel}`;
  if (isDecisionNodeData(data)) return data.condition;
  return 'Unknown';
}
