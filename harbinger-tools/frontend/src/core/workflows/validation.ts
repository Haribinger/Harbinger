import type { WorkflowNode, WorkflowEdge, ValidationResult, ValidationError } from '../../types/workflow';
import {
  isTriggerNodeData,
  isOutputNodeData,
  isDecisionNodeData,
  isToolNodeData,
  isAgentNodeData,
  isHttpRequestNodeData,
  isLoopNodeData,
  isCodeNodeData,
  isNotificationNodeData,
} from '../../types/workflow-guards';

export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (nodes.length === 0) {
    errors.push({ nodeId: '', field: '', message: 'Workflow has no nodes', severity: 'error' });
    return { valid: false, errors, warnings };
  }

  // Must have at least one trigger
  const triggerNodes = nodes.filter(n => n.type === 'triggerNode');
  if (triggerNodes.length === 0) {
    errors.push({ nodeId: '', field: '', message: 'Workflow needs at least one trigger node', severity: 'error' });
  }

  // Check for orphan nodes (no incoming or outgoing edges, excluding triggers)
  const connectedNodeIds = new Set<string>();
  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }
  for (const node of nodes) {
    if (node.type === 'triggerNode') continue;
    if (!connectedNodeIds.has(node.id)) {
      warnings.push({
        nodeId: node.id,
        field: '',
        message: `Node is disconnected from the workflow`,
        severity: 'warning',
      });
    }
  }

  // Validate connectivity from trigger nodes (BFS reachability)
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  const reachable = new Set<string>();
  const queue = triggerNodes.map(n => n.id);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) queue.push(neighbor);
    }
  }

  for (const node of nodes) {
    if (node.type === 'triggerNode') continue;
    if (connectedNodeIds.has(node.id) && !reachable.has(node.id)) {
      warnings.push({
        nodeId: node.id,
        field: '',
        message: 'Node is not reachable from any trigger',
        severity: 'warning',
      });
    }
  }

  // Cycle detection using DFS
  const visited = new Set<string>();
  const inStack = new Set<string>();
  let hasCycle = false;

  function dfs(nodeId: string) {
    if (hasCycle) return;
    visited.add(nodeId);
    inStack.add(nodeId);
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (inStack.has(neighbor)) {
        hasCycle = true;
        errors.push({
          nodeId: neighbor,
          field: '',
          message: 'Cycle detected in workflow graph',
          severity: 'error',
        });
        return;
      }
      if (!visited.has(neighbor)) dfs(neighbor);
    }
    inStack.delete(nodeId);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) dfs(node.id);
  }

  // Validate individual node required fields
  for (const node of nodes) {
    const data = node.data;

    if (isToolNodeData(data)) {
      if (!data.toolName || data.toolName === 'New Tool') {
        errors.push({ nodeId: node.id, field: 'toolName', message: 'Tool name is required', severity: 'error' });
      }
    }

    if (isAgentNodeData(data)) {
      if (!data.codename || data.codename === 'Agent') {
        errors.push({ nodeId: node.id, field: 'codename', message: 'Agent codename is required', severity: 'error' });
      }
    }

    if (isDecisionNodeData(data)) {
      if (!data.condition) {
        errors.push({ nodeId: node.id, field: 'condition', message: 'Decision condition is required', severity: 'error' });
      }
      // Decision nodes should have at least 2 outgoing edges
      const outgoing = edges.filter(e => e.source === node.id);
      if (outgoing.length < 2) {
        warnings.push({ nodeId: node.id, field: '', message: 'Decision node should have true and false branches', severity: 'warning' });
      }
    }

    if (isHttpRequestNodeData(data)) {
      if (!data.url) {
        errors.push({ nodeId: node.id, field: 'url', message: 'URL is required for HTTP request', severity: 'error' });
      }
    }

    if (isLoopNodeData(data)) {
      if (!data.iteratorExpression) {
        errors.push({ nodeId: node.id, field: 'iteratorExpression', message: 'Iterator expression is required', severity: 'error' });
      }
      if (data.maxIterations <= 0) {
        warnings.push({ nodeId: node.id, field: 'maxIterations', message: 'Max iterations should be greater than 0', severity: 'warning' });
      }
    }

    if (isCodeNodeData(data)) {
      if (!data.code) {
        errors.push({ nodeId: node.id, field: 'code', message: 'Code is required', severity: 'error' });
      }
    }

    if (isNotificationNodeData(data)) {
      if (!data.messageTemplate) {
        errors.push({ nodeId: node.id, field: 'messageTemplate', message: 'Message template is required', severity: 'error' });
      }
      if (!data.destination) {
        warnings.push({ nodeId: node.id, field: 'destination', message: 'Notification destination not set', severity: 'warning' });
      }
    }

    if (isOutputNodeData(data)) {
      if (!data.destination) {
        warnings.push({ nodeId: node.id, field: 'destination', message: 'Output destination not set', severity: 'warning' });
      }
    }

    if (isTriggerNodeData(data)) {
      if (data.triggerType === 'cron' && !data.cronExpression) {
        errors.push({ nodeId: node.id, field: 'cronExpression', message: 'Cron expression required for scheduled trigger', severity: 'error' });
      }
      if (data.triggerType === 'webhook' && !data.webhookPath) {
        errors.push({ nodeId: node.id, field: 'webhookPath', message: 'Webhook path required', severity: 'error' });
      }
    }
  }

  // Validate expression syntax in node data
  for (const node of nodes) {
    const dataStr = JSON.stringify(node.data);
    const expressionRegex = /\{\{([^}]*)\}\}/g;
    let match;
    while ((match = expressionRegex.exec(dataStr)) !== null) {
      const expr = match[1].trim();
      if (!expr) {
        warnings.push({
          nodeId: node.id,
          field: '',
          message: 'Empty expression {{}} found',
          severity: 'warning',
        });
      }
    }
  }

  // Warn if no output node
  const hasOutput = nodes.some(n => n.type === 'outputNode' || n.type === 'notificationNode');
  if (!hasOutput) {
    warnings.push({ nodeId: '', field: '', message: 'Workflow has no output or notification node', severity: 'warning' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
