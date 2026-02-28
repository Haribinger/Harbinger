import React, { useCallback, useRef, useState } from 'react';
import { ReactFlow, Controls, Background, BackgroundVariant, MiniMap, useReactFlow, ReactFlowProvider, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowEditorStore } from '../store/workflowEditorStore';
import WorkflowToolbar from '../components/Workflow/WorkflowToolbar';
import NodePalette from '../components/Workflow/NodePalette';
import ValidationPanel from '../components/Workflow/ValidationPanel';
import ToolNode from '../components/Workflow/nodes/ToolNode';
import AgentNode from '../components/Workflow/nodes/AgentNode';
import DecisionNode from '../components/Workflow/nodes/DecisionNode';
import TriggerNode from '../components/Workflow/nodes/TriggerNode';
import OutputNode from '../components/Workflow/nodes/OutputNode';
import VariableNode from '../components/Workflow/nodes/VariableNode';
import LoopNode from '../components/Workflow/nodes/LoopNode';
import HttpRequestNode from '../components/Workflow/nodes/HttpRequestNode';
import DelayNode from '../components/Workflow/nodes/DelayNode';
import CodeNode from '../components/Workflow/nodes/CodeNode';
import NotificationNode from '../components/Workflow/nodes/NotificationNode';
import CustomEdge from '../components/Workflow/edges/CustomEdge';
import ParallelEdge from '../components/Workflow/edges/ParallelEdge';
import { useWorkflowKeyboard } from '../components/Workflow/hooks/useWorkflowKeyboard';
import {
  WorkflowNode,
  TriggerNodeData,
  OutputNodeData,
  VariableNodeData,
  DecisionNodeData,
  LoopNodeData,
  HttpRequestNodeData,
  DelayNodeData,
  CodeNodeData,
  NotificationNodeData,
  AnyNodeData,
} from '../types/workflow';
import {
  isToolNodeData,
  isAgentNodeData,
  isDecisionNodeData,
  isTriggerNodeData,
  isOutputNodeData,
  isVariableNodeData,
  isLoopNodeData,
  isHttpRequestNodeData,
  isDelayNodeData,
  isCodeNodeData,
  isNotificationNodeData,
} from '../types/workflow-guards';

const nodeTypes = {
  toolNode: ToolNode,
  agentNode: AgentNode,
  decisionNode: DecisionNode,
  triggerNode: TriggerNode,
  outputNode: OutputNode,
  variableNode: VariableNode,
  loopNode: LoopNode,
  httpRequestNode: HttpRequestNode,
  delayNode: DelayNode,
  codeNode: CodeNode,
  notificationNode: NotificationNode,
};

const edgeTypes = {
  custom: CustomEdge,
  parallel: ParallelEdge,
};

let id = 0;
const getId = () => `node_${Date.now()}_${id++}`;

// ── Workflow templates for beginner UX ──────────────────────────────────────
const WORKFLOW_TEMPLATES = [
  {
    id: 'recon-pipeline',
    name: 'Recon Pipeline',
    description: 'Subdomain enum → live host probe → port scan → nuclei',
    category: 'Recon',
    color: '#3b82f6',
    nodes: [
      { type: 'triggerNode', x: 100, y: 200, data: { triggerType: 'manual', enabled: true, status: 'pending' } },
      { type: 'toolNode', x: 350, y: 200, data: { toolName: 'subfinder', category: 'Recon', status: 'pending', timeout: 300, retryCount: 1, continueOnError: false, variables: {} } },
      { type: 'toolNode', x: 600, y: 200, data: { toolName: 'httpx', category: 'Recon', status: 'pending', timeout: 300, retryCount: 1, continueOnError: false, variables: {} } },
      { type: 'toolNode', x: 850, y: 200, data: { toolName: 'nuclei', category: 'Web', status: 'pending', timeout: 600, retryCount: 0, continueOnError: true, variables: {} } },
      { type: 'outputNode', x: 1100, y: 200, data: { outputType: 'report', destination: './reports/', format: 'markdown', template: '# Recon Report\n\n{{results}}', status: 'pending' } },
    ],
  },
  {
    id: 'vuln-scan',
    name: 'Vulnerability Scan',
    description: 'Nuclei → SQLi check → XSS check → Report',
    category: 'Web',
    color: '#ef4444',
    nodes: [
      { type: 'triggerNode', x: 100, y: 200, data: { triggerType: 'manual', enabled: true, status: 'pending' } },
      { type: 'agentNode', x: 350, y: 200, data: { codename: 'BREACH', agentType: 'web', agentId: '', autoChain: true, status: 'pending' } },
      { type: 'decisionNode', x: 600, y: 200, data: { condition: '{{prev.output}} contains "critical"', trueLabel: 'Critical', falseLabel: 'Continue' } },
      { type: 'notificationNode', x: 850, y: 100, data: { channel: 'discord', severity: 'critical', destination: '#alerts', messageTemplate: 'Critical finding: {{prev.output}}', status: 'pending' } },
      { type: 'outputNode', x: 850, y: 300, data: { outputType: 'report', destination: './reports/', format: 'markdown', template: '# Vulnerability Report\n\n{{results}}', status: 'pending' } },
    ],
  },
  {
    id: 'osint-sweep',
    name: 'OSINT Sweep',
    description: 'Email harvest → username search → leak check → report',
    category: 'OSINT',
    color: '#06b6d4',
    nodes: [
      { type: 'triggerNode', x: 100, y: 200, data: { triggerType: 'manual', enabled: true, status: 'pending' } },
      { type: 'toolNode', x: 350, y: 200, data: { toolName: 'theHarvester', category: 'OSINT', status: 'pending', timeout: 300, retryCount: 1, continueOnError: false, variables: {} } },
      { type: 'toolNode', x: 600, y: 200, data: { toolName: 'sherlock', category: 'OSINT', status: 'pending', timeout: 300, retryCount: 0, continueOnError: true, variables: {} } },
      { type: 'outputNode', x: 850, y: 200, data: { outputType: 'save', destination: './osint/', format: 'json', template: '', status: 'pending' } },
    ],
  },
  {
    id: 'cron-monitor',
    name: 'Scheduled Monitor',
    description: 'Run a scan every 6 hours and notify on new findings',
    category: 'Automation',
    color: '#f0c040',
    nodes: [
      { type: 'triggerNode', x: 100, y: 200, data: { triggerType: 'cron', cronExpression: '0 */6 * * *', enabled: true, status: 'pending' } },
      { type: 'agentNode', x: 350, y: 200, data: { codename: 'PATHFINDER', agentType: 'recon', agentId: '', autoChain: true, status: 'pending' } },
      { type: 'decisionNode', x: 600, y: 200, data: { condition: '{{prev.output}} != {{env.LAST_RESULT}}', trueLabel: 'New findings', falseLabel: 'No change' } },
      { type: 'notificationNode', x: 850, y: 150, data: { channel: 'telegram', severity: 'info', destination: '', messageTemplate: 'New scan results: {{prev.output | count}} findings', status: 'pending' } },
    ],
  },
];

const WorkflowEditorContent: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    selectedNode,
    setSelectedNode,
    executionState,
    updateNode,
    deleteNode,
    snapToGrid,
    gridSize,
    pushSnapshot,
  } = useWorkflowEditorStore();

  useWorkflowKeyboard();

  const [propertiesTab, setPropertiesTab] = useState<'config' | 'variables' | 'output'>('config');
  const [showTemplates, setShowTemplates] = useState(false);

  // Load a template onto the canvas
  const loadTemplate = useCallback((template: typeof WORKFLOW_TEMPLATES[0]) => {
    pushSnapshot();
    template.nodes.forEach((n, _i) => {
      const newNode: WorkflowNode = {
        id: getId(),
        type: n.type,
        position: { x: n.x, y: n.y },
        data: n.data as AnyNodeData,
      };
      addNode(newNode);
    });
    setShowTemplates(false);
  }, [addNode, pushSnapshot]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const toolName = event.dataTransfer.getData('application/toolname');
      const category = event.dataTransfer.getData('application/category');

      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      pushSnapshot();

      let newNode: WorkflowNode;

      switch (type) {
        case 'toolNode':
          newNode = {
            id: getId(),
            type,
            position,
            data: {
              toolName: toolName || 'New Tool',
              category: (category || 'Recon') as 'Recon',
              status: 'pending' as const,
              outputPreview: '',
              parameters: {},
              variables: {},
              timeout: 300,
              retryCount: 0,
              continueOnError: false,
            },
          };
          break;

        case 'agentNode':
          newNode = {
            id: getId(),
            type,
            position,
            data: {
              agentAvatar: '',
              codename: toolName || 'Agent',
              assignedToolsCount: 0,
              heartbeat: true,
              agentId: '',
              agentType: category || 'general',
              autoChain: true,
            },
          };
          break;

        case 'triggerNode':
          newNode = {
            id: getId(),
            type,
            position,
            data: {
              triggerType: (toolName as TriggerNodeData['triggerType']) || 'manual',
              cronExpression: '',
              webhookPath: '',
              eventFilter: '',
              enabled: true,
            } satisfies TriggerNodeData,
          };
          break;

        case 'outputNode':
          newNode = {
            id: getId(),
            type,
            position,
            data: {
              outputType: (toolName as OutputNodeData['outputType']) || 'report',
              destination: '',
              format: 'markdown',
              template: '',
            } satisfies OutputNodeData,
          };
          break;

        case 'variableNode':
          newNode = {
            id: getId(),
            type,
            position,
            data: {
              variableName: 'myVar',
              expression: '{{prev.output}}',
              dataType: 'string',
            } satisfies VariableNodeData,
          };
          break;

        case 'loopNode':
          newNode = {
            id: getId(),
            type,
            position,
            data: {
              iteratorExpression: '{{prev.output}}',
              itemVariable: 'item',
              indexVariable: 'index',
              maxIterations: 100,
              parallelism: 1,
              status: 'pending',
            } satisfies LoopNodeData,
          };
          break;

        case 'httpRequestNode':
          newNode = {
            id: getId(),
            type,
            position,
            data: {
              method: 'GET',
              url: '',
              headers: {},
              body: '',
              bodyType: 'none',
              timeout: 30,
              verifySsl: true,
              status: 'pending',
            } satisfies HttpRequestNodeData,
          };
          break;

        case 'delayNode':
          newNode = {
            id: getId(),
            type,
            position,
            data: {
              delayType: 'fixed',
              durationMs: 5000,
              minMs: 1000,
              maxMs: 10000,
              untilExpression: '',
              status: 'pending',
            } satisfies DelayNodeData,
          };
          break;

        case 'codeNode':
          newNode = {
            id: getId(),
            type,
            position,
            data: {
              language: 'javascript',
              code: '// Your code here\nreturn input;',
              entryFunction: 'main',
              timeout: 30,
              status: 'pending',
            } satisfies CodeNodeData,
          };
          break;

        case 'notificationNode':
          newNode = {
            id: getId(),
            type,
            position,
            data: {
              channel: 'discord',
              messageTemplate: '{{prev.output}}',
              severity: 'info',
              destination: '',
              status: 'pending',
            } satisfies NotificationNodeData,
          };
          break;

        case 'decisionNode':
        default:
          newNode = {
            id: getId(),
            type: 'decisionNode',
            position,
            data: {
              condition: 'if (true)',
              trueLabel: 'Yes',
              falseLabel: 'No',
            } satisfies DecisionNodeData,
          };
          break;
      }

      addNode(newNode);
    },
    [screenToFlowPosition, addNode, pushSnapshot]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: WorkflowNode) => {
    setSelectedNode(node);
    setPropertiesTab('config');
  }, [setSelectedNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handlePropertyChange = useCallback((key: string, value: unknown) => {
    if (selectedNode) {
      updateNode(selectedNode.id, { [key]: value });
      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, [key]: value } });
    }
  }, [selectedNode, updateNode, setSelectedNode]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedNode) {
      pushSnapshot();
      deleteNode(selectedNode.id);
      setSelectedNode(null);
    }
  }, [selectedNode, deleteNode, setSelectedNode, pushSnapshot]);

  const animatedEdges = edges.map(edge => {
    const sourceNodeStatus = executionState?.nodeStatuses[edge.source];
    const targetNodeStatus = executionState?.nodeStatuses[edge.target];
    const isAnimated = sourceNodeStatus === 'running' && targetNodeStatus === 'waiting';

    return {
      ...edge,
      type: edge.type || 'custom',
      animated: isAnimated,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#f0c040' },
      style: { strokeWidth: 2, stroke: isAnimated ? '#f0c040' : '#1a1a2e' },
      data: {
        status: isAnimated ? 'running' : (sourceNodeStatus === 'success' ? 'success' : undefined),
      },
    };
  });

  const nodeColor = (node: { type?: string }) => {
    switch (node.type) {
      case 'toolNode': return '#f0c040';
      case 'agentNode': return '#00b0ff';
      case 'decisionNode': return '#ff4081';
      case 'triggerNode': return '#22c55e';
      case 'outputNode': return '#f0c040';
      case 'variableNode': return '#06b6d4';
      case 'loopNode': return '#8b5cf6';
      case 'httpRequestNode': return '#0ea5e9';
      case 'delayNode': return '#f59e0b';
      case 'codeNode': return '#10b981';
      case 'notificationNode': return '#ec4899';
      default: return '#eee';
    }
  };

  const selectedData = selectedNode?.data;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0a0f] text-white font-mono relative">
      <WorkflowToolbar />
      <div className="flex flex-grow overflow-hidden">
        <NodePalette />

        {/* Canvas */}
        <div className="reactflow-wrapper flex-grow relative" ref={reactFlowWrapper}>
          {/* Floating templates button */}
          <button
            onClick={() => setShowTemplates(true)}
            className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded border border-[#1a1a2e] bg-[#0d0d15]/90 text-[10px] font-medium text-gray-400 hover:text-[#f0c040] hover:border-[#f0c040]/30 transition-colors backdrop-blur-sm"
          >
            Templates
          </button>

          {/* Empty canvas prompt */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
              <div className="text-center pointer-events-auto">
                <div className="text-lg font-bold text-gray-600 mb-1">Empty Canvas</div>
                <p className="text-[11px] text-gray-600 mb-4 max-w-xs">
                  Drag nodes from the palette on the left, or start from a pre-built template.
                </p>
                <button
                  onClick={() => setShowTemplates(true)}
                  className="px-4 py-2 rounded border border-[#f0c040]/40 bg-[#f0c040]/10 text-[#f0c040] text-xs font-medium hover:bg-[#f0c040]/20 transition-colors"
                >
                  Start from Template
                </button>
              </div>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={animatedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            snapToGrid={snapToGrid}
            snapGrid={[gridSize, gridSize]}
            defaultEdgeOptions={{ type: 'custom' }}
            fitView
          >
            <MiniMap style={{ backgroundColor: '#0d0d15' }} nodeColor={nodeColor} />
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#1a1a2e" />
          </ReactFlow>
        </div>

        {/* Properties Panel */}
        <div className="w-80 flex flex-col bg-[#0d0d15] border-l border-[#1a1a2e] overflow-hidden">
          <div className="p-3 border-b border-[#1a1a2e] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#f0c040]">Properties</h3>
            {selectedNode && (
              <button
                onClick={handleDeleteSelected}
                className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
              >
                Delete
              </button>
            )}
          </div>

          {selectedNode && selectedData ? (
            <div className="flex-1 overflow-y-auto">
              {/* Tabs */}
              <div className="flex border-b border-[#1a1a2e]">
                {(['config', 'variables', 'output'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setPropertiesTab(tab)}
                    className={`flex-1 py-1.5 text-[10px] font-medium capitalize transition-colors ${
                      propertiesTab === tab
                        ? 'text-[#f0c040] border-b border-[#f0c040]'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="p-3 space-y-3">
                {/* Meta */}
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span className="px-1.5 py-0.5 bg-[#1a1a2e] rounded">{selectedNode.type}</span>
                  <span className="font-mono">{selectedNode.id}</span>
                </div>

                {propertiesTab === 'config' && (
                  <>
                    {/* Tool Node Config */}
                    {isToolNodeData(selectedData) && (
                      <>
                        <PropertyField label="Tool Name" value={selectedData.toolName} onChange={(v) => handlePropertyChange('toolName', v)} />
                        <PropertySelect label="Category" value={selectedData.category} options={['Recon', 'Web', 'Cloud', 'OSINT', 'Binary', 'Reporting', 'Browser']} onChange={(v) => handlePropertyChange('category', v)} />
                        <PropertyField label="Timeout (sec)" value={String(selectedData.timeout)} onChange={(v) => handlePropertyChange('timeout', parseInt(v) || 0)} type="number" />
                        <PropertyField label="Retry Count" value={String(selectedData.retryCount)} onChange={(v) => handlePropertyChange('retryCount', parseInt(v) || 0)} type="number" />
                        <PropertyCheckbox label="Continue on Error" checked={selectedData.continueOnError} onChange={(v) => handlePropertyChange('continueOnError', v)} />
                      </>
                    )}

                    {/* Agent Node Config */}
                    {isAgentNodeData(selectedData) && (
                      <>
                        <PropertyField label="Codename" value={selectedData.codename} onChange={(v) => handlePropertyChange('codename', v)} />
                        <PropertyField label="Agent ID" value={selectedData.agentId} onChange={(v) => handlePropertyChange('agentId', v)} placeholder="auto-detected" />
                        <PropertySelect label="Agent Type" value={selectedData.agentType} options={['recon', 'web', 'cloud', 'osint', 'binary', 'report', 'coding-assistant', 'reporter', 'general']} onChange={(v) => handlePropertyChange('agentType', v)} />
                        <PropertyCheckbox label="Auto-chain findings" checked={selectedData.autoChain !== false} onChange={(v) => handlePropertyChange('autoChain', v)} />
                      </>
                    )}

                    {/* Decision Node Config */}
                    {isDecisionNodeData(selectedData) && (
                      <>
                        <PropertyTextarea label="Condition" value={selectedData.condition} onChange={(v) => handlePropertyChange('condition', v)} placeholder='{{prev.output}} contains "critical"' />
                        <PropertyField label="True Label" value={selectedData.trueLabel} onChange={(v) => handlePropertyChange('trueLabel', v)} />
                        <PropertyField label="False Label" value={selectedData.falseLabel} onChange={(v) => handlePropertyChange('falseLabel', v)} />
                      </>
                    )}

                    {/* Trigger Node Config */}
                    {isTriggerNodeData(selectedData) && (
                      <>
                        <PropertySelect label="Trigger Type" value={selectedData.triggerType} options={['manual', 'cron', 'webhook', 'on-finding', 'on-agent-message', 'on-event']} onChange={(v) => handlePropertyChange('triggerType', v)} />
                        {selectedData.triggerType === 'cron' && (
                          <PropertyField label="Cron Expression" value={selectedData.cronExpression} onChange={(v) => handlePropertyChange('cronExpression', v)} placeholder="0 */6 * * *" />
                        )}
                        {selectedData.triggerType === 'webhook' && (
                          <PropertyField label="Webhook Path" value={selectedData.webhookPath} onChange={(v) => handlePropertyChange('webhookPath', v)} placeholder="/webhooks/start" />
                        )}
                        {['on-finding', 'on-agent-message', 'on-event'].includes(selectedData.triggerType) && (
                          <PropertyField label="Event Filter" value={selectedData.eventFilter} onChange={(v) => handlePropertyChange('eventFilter', v)} placeholder="finding.critical" />
                        )}
                        <PropertyCheckbox label="Enabled" checked={selectedData.enabled !== false} onChange={(v) => handlePropertyChange('enabled', v)} />
                      </>
                    )}

                    {/* Output Node Config */}
                    {isOutputNodeData(selectedData) && (
                      <>
                        <PropertySelect label="Output Type" value={selectedData.outputType} options={['report', 'notify', 'save', 'broadcast', 'webhook-out']} onChange={(v) => handlePropertyChange('outputType', v)} />
                        <PropertyField label="Destination" value={selectedData.destination} onChange={(v) => handlePropertyChange('destination', v)} placeholder="#discord, telegram, ./reports/" />
                        <PropertySelect label="Format" value={selectedData.format} options={['json', 'markdown', 'pdf', 'text']} onChange={(v) => handlePropertyChange('format', v)} />
                        <PropertyTextarea label="Template" value={selectedData.template} onChange={(v) => handlePropertyChange('template', v)} placeholder="# {{workflow.name}} Report\n\n{{results}}" />
                      </>
                    )}

                    {/* Variable Node Config */}
                    {isVariableNodeData(selectedData) && (
                      <>
                        <PropertyField label="Variable Name" value={selectedData.variableName} onChange={(v) => handlePropertyChange('variableName', v)} />
                        <PropertyField label="Expression" value={selectedData.expression} onChange={(v) => handlePropertyChange('expression', v)} placeholder="{{prev.output}} | count" />
                        <PropertySelect label="Data Type" value={selectedData.dataType} options={['string', 'number', 'boolean', 'array', 'object']} onChange={(v) => handlePropertyChange('dataType', v)} />
                      </>
                    )}

                    {/* Loop Node Config */}
                    {isLoopNodeData(selectedData) && (
                      <>
                        <PropertyField label="Iterator Expression" value={selectedData.iteratorExpression} onChange={(v) => handlePropertyChange('iteratorExpression', v)} placeholder="{{prev.output}}" />
                        <PropertyField label="Item Variable" value={selectedData.itemVariable} onChange={(v) => handlePropertyChange('itemVariable', v)} />
                        <PropertyField label="Index Variable" value={selectedData.indexVariable} onChange={(v) => handlePropertyChange('indexVariable', v)} />
                        <PropertyField label="Max Iterations" value={String(selectedData.maxIterations)} onChange={(v) => handlePropertyChange('maxIterations', parseInt(v) || 100)} type="number" />
                        <PropertyField label="Parallelism" value={String(selectedData.parallelism)} onChange={(v) => handlePropertyChange('parallelism', parseInt(v) || 1)} type="number" />
                      </>
                    )}

                    {/* HTTP Request Node Config */}
                    {isHttpRequestNodeData(selectedData) && (
                      <>
                        <PropertySelect label="Method" value={selectedData.method} options={['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']} onChange={(v) => handlePropertyChange('method', v)} />
                        <PropertyField label="URL" value={selectedData.url} onChange={(v) => handlePropertyChange('url', v)} placeholder="https://api.example.com/endpoint" />
                        <PropertySelect label="Body Type" value={selectedData.bodyType} options={['none', 'json', 'form', 'raw']} onChange={(v) => handlePropertyChange('bodyType', v)} />
                        {selectedData.bodyType !== 'none' && (
                          <PropertyTextarea label="Body" value={selectedData.body} onChange={(v) => handlePropertyChange('body', v)} placeholder='{"key": "value"}' />
                        )}
                        <PropertyField label="Timeout (sec)" value={String(selectedData.timeout)} onChange={(v) => handlePropertyChange('timeout', parseInt(v) || 30)} type="number" />
                        <PropertyCheckbox label="Verify SSL" checked={selectedData.verifySsl} onChange={(v) => handlePropertyChange('verifySsl', v)} />
                      </>
                    )}

                    {/* Delay Node Config */}
                    {isDelayNodeData(selectedData) && (
                      <>
                        <PropertySelect label="Delay Type" value={selectedData.delayType} options={['fixed', 'random', 'until']} onChange={(v) => handlePropertyChange('delayType', v)} />
                        {selectedData.delayType === 'fixed' && (
                          <PropertyField label="Duration (ms)" value={String(selectedData.durationMs)} onChange={(v) => handlePropertyChange('durationMs', parseInt(v) || 1000)} type="number" />
                        )}
                        {selectedData.delayType === 'random' && (
                          <>
                            <PropertyField label="Min (ms)" value={String(selectedData.minMs)} onChange={(v) => handlePropertyChange('minMs', parseInt(v) || 0)} type="number" />
                            <PropertyField label="Max (ms)" value={String(selectedData.maxMs)} onChange={(v) => handlePropertyChange('maxMs', parseInt(v) || 10000)} type="number" />
                          </>
                        )}
                        {selectedData.delayType === 'until' && (
                          <PropertyField label="Until Expression" value={selectedData.untilExpression} onChange={(v) => handlePropertyChange('untilExpression', v)} placeholder="{{env.READY}} == true" />
                        )}
                      </>
                    )}

                    {/* Code Node Config */}
                    {isCodeNodeData(selectedData) && (
                      <>
                        <PropertySelect label="Language" value={selectedData.language} options={['javascript', 'python', 'bash']} onChange={(v) => handlePropertyChange('language', v)} />
                        <PropertyTextarea label="Code" value={selectedData.code} onChange={(v) => handlePropertyChange('code', v)} placeholder="// Your code here" />
                        <PropertyField label="Entry Function" value={selectedData.entryFunction} onChange={(v) => handlePropertyChange('entryFunction', v)} placeholder="main" />
                        <PropertyField label="Timeout (sec)" value={String(selectedData.timeout)} onChange={(v) => handlePropertyChange('timeout', parseInt(v) || 30)} type="number" />
                      </>
                    )}

                    {/* Notification Node Config */}
                    {isNotificationNodeData(selectedData) && (
                      <>
                        <PropertySelect label="Channel" value={selectedData.channel} options={['discord', 'telegram', 'slack', 'email', 'webhook']} onChange={(v) => handlePropertyChange('channel', v)} />
                        <PropertySelect label="Severity" value={selectedData.severity} options={['info', 'warning', 'critical']} onChange={(v) => handlePropertyChange('severity', v)} />
                        <PropertyField label="Destination" value={selectedData.destination} onChange={(v) => handlePropertyChange('destination', v)} placeholder="#alerts, @user, https://..." />
                        <PropertyTextarea label="Message Template" value={selectedData.messageTemplate} onChange={(v) => handlePropertyChange('messageTemplate', v)} placeholder="Alert: {{prev.output}}" />
                      </>
                    )}
                  </>
                )}

                {propertiesTab === 'variables' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-gray-500">Variable bindings for this node&apos;s parameters. Use expressions like {'{{nodeId.output}}'} to reference outputs from other nodes.</p>

                    {isToolNodeData(selectedData) && (
                      <>
                        <PropertyField label="target" value={selectedData.variables?.target as string || ''} onChange={(v) => handlePropertyChange('variables', { ...selectedData.variables, target: v })} placeholder="{{trigger.data.target}}" />
                        <PropertyField label="wordlist" value={selectedData.variables?.wordlist as string || ''} onChange={(v) => handlePropertyChange('variables', { ...selectedData.variables, wordlist: v })} placeholder="/usr/share/wordlists/common.txt" />
                        <PropertyField label="output_file" value={selectedData.variables?.output_file as string || ''} onChange={(v) => handlePropertyChange('variables', { ...selectedData.variables, output_file: v })} placeholder="{{workflow.name}}-results.json" />
                      </>
                    )}

                    <div className="mt-3 p-2 bg-[#0a0a0f] rounded border border-[#1a1a2e] text-[10px] text-gray-500 space-y-1">
                      <p className="font-medium text-gray-400">Available variables:</p>
                      <p className="font-mono">{'{{prev.output}}'} - previous node output</p>
                      <p className="font-mono">{'{{prev.status}}'} - previous node status</p>
                      <p className="font-mono">{'{{trigger.data}}'} - trigger payload</p>
                      <p className="font-mono">{'{{env.VAR_NAME}}'} - env variable</p>
                      <p className="font-mono">{'{{workflow.name}}'} - workflow name</p>
                    </div>
                  </div>
                )}

                {propertiesTab === 'output' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-gray-500">Node execution output will appear here during workflow runs.</p>

                    {executionState?.nodeStatuses[selectedNode.id] && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">Status:</span>
                        <StatusBadge status={executionState.nodeStatuses[selectedNode.id]} />
                      </div>
                    )}

                    {executionState?.nodeOutputs?.[selectedNode.id] != null && (
                      <pre className="text-[10px] bg-[#0a0a0f] rounded p-2 border border-[#1a1a2e] overflow-x-auto max-h-48 whitespace-pre-wrap">
                        {String(JSON.stringify(executionState.nodeOutputs[selectedNode.id], null, 2))}
                      </pre>
                    )}

                    {!executionState && (
                      <div className="text-[10px] text-gray-600 italic">Run the workflow to see output</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-4 overflow-y-auto">
              <div className="text-center text-gray-500 mb-4">
                <p className="text-sm">Select a node</p>
                <p className="text-[10px] mt-1">Click on any node to edit its properties</p>
              </div>

              {/* Quick start hints */}
              <div className="space-y-2 mb-4">
                <p className="text-[10px] font-bold text-[#f0c040] uppercase tracking-wider">Quick start</p>
                {[
                  { key: '1', text: 'Drag nodes from the left palette' },
                  { key: '2', text: 'Connect handles to create edges' },
                  { key: '3', text: 'Click a node to configure it' },
                  { key: '4', text: 'Use {{prev.output}} for chaining' },
                ].map(hint => (
                  <div key={hint.key} className="flex items-start gap-2 text-[10px]">
                    <span className="w-4 h-4 flex items-center justify-center rounded bg-[#f0c040]/10 text-[#f0c040] font-bold flex-shrink-0">{hint.key}</span>
                    <span className="text-gray-400">{hint.text}</span>
                  </div>
                ))}
              </div>

              {/* Templates button */}
              <button
                onClick={() => setShowTemplates(true)}
                className="w-full py-2 px-3 rounded border border-[#f0c040]/30 bg-[#f0c040]/5 text-[#f0c040] text-xs font-medium hover:bg-[#f0c040]/10 transition-colors"
              >
                Browse Templates
              </button>

              {/* Keyboard shortcuts */}
              <div className="mt-4 space-y-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Shortcuts</p>
                {[
                  { keys: 'Ctrl+Z', action: 'Undo' },
                  { keys: 'Ctrl+Y', action: 'Redo' },
                  { keys: 'Del', action: 'Delete node' },
                  { keys: 'Ctrl+S', action: 'Save workflow' },
                ].map(s => (
                  <div key={s.keys} className="flex items-center justify-between text-[10px]">
                    <kbd className="px-1.5 py-0.5 rounded bg-[#1a1a2e] border border-[#1a1a2e] text-gray-400 font-mono">{s.keys}</kbd>
                    <span className="text-gray-600">{s.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template gallery overlay */}
      {showTemplates && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[640px] max-h-[80vh] bg-[#0d0d15] border border-[#1a1a2e] rounded-lg overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-[#1a1a2e] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#f0c040]">WORKFLOW TEMPLATES</h2>
                <p className="text-[10px] text-gray-500 mt-0.5">Pre-built pipelines — click to load onto canvas</p>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="w-6 h-6 flex items-center justify-center rounded bg-[#1a1a2e] text-gray-400 hover:text-white hover:bg-[#1a1a2e]/80 transition-colors text-sm"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3">
              {WORKFLOW_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => loadTemplate(t)}
                  className="text-left p-4 rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] hover:border-[#f0c040]/40 hover:bg-[#f0c040]/5 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="text-xs font-bold text-white group-hover:text-[#f0c040] transition-colors">{t.name}</span>
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a2e] text-gray-500">{t.category}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">{t.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {t.nodes.map((n, i) => (
                      <span
                        key={i}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-[#1a1a2e] text-gray-500 font-mono"
                      >
                        {n.type.replace('Node', '')}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 text-[10px] text-[#f0c040]/60 group-hover:text-[#f0c040] transition-colors">
                    {t.nodes.length} nodes &middot; Click to load
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Execution Log + Validation */}
      <div className="border-t border-[#1a1a2e] flex flex-col overflow-hidden">
        <div className="h-32 flex flex-col overflow-hidden">
          <div className="px-4 py-1.5 border-b border-[#1a1a2e] flex items-center justify-between bg-[#0d0d15]">
            <h3 className="text-xs font-bold text-[#f0c040]">Execution Log</h3>
            {executionState && (
              <StatusBadge status={executionState.status} />
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 bg-[#0a0a0f] font-mono text-[11px]">
            {executionState?.log.map((entry, index) => (
              <p key={index} className="mb-0.5 text-gray-400">
                <span className="text-gray-600 mr-2">[{String(index).padStart(3, '0')}]</span>
                {entry}
              </p>
            ))}
            {(!executionState || executionState.log.length === 0) && (
              <p className="text-gray-600 italic">Drag nodes from the palette, connect them, and hit Run.</p>
            )}
          </div>
        </div>
        <ValidationPanel />
      </div>
    </div>
  );
};

// Reusable property field components
function PropertyField({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">{label}</label>
      <input
        type={type || 'text'}
        className="w-full p-2 rounded bg-[#0a0a0f] border border-[#1a1a2e] text-xs font-mono focus:outline-none focus:border-[#f0c040]/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function PropertyTextarea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">{label}</label>
      <textarea
        className="w-full p-2 rounded bg-[#0a0a0f] border border-[#1a1a2e] text-xs font-mono focus:outline-none focus:border-[#f0c040]/50 resize-none"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function PropertySelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">{label}</label>
      <select
        className="w-full p-2 rounded bg-[#0a0a0f] border border-[#1a1a2e] text-xs font-mono focus:outline-none focus:border-[#f0c040]/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function PropertyCheckbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-[#1a1a2e] bg-[#0a0a0f] accent-[#f0c040]"
      />
      <span className="text-xs text-gray-400">{label}</span>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-green-500/10 text-green-400 border-green-500/20',
    completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    pending: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    waiting: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${colors[status] || colors.pending}`}>
      {status}
    </span>
  );
}

const WorkflowEditor: React.FC = () => (
  <ReactFlowProvider>
    <WorkflowEditorContent />
  </ReactFlowProvider>
);

export default WorkflowEditor;
