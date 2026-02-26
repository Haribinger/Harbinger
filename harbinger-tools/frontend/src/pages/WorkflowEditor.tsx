import React, { useCallback, useRef, useState } from 'react';
import { ReactFlow, Controls, Background, BackgroundVariant, MiniMap, useReactFlow, ReactFlowProvider, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowEditorStore } from '../store/workflowEditorStore';
import WorkflowToolbar from '../components/Workflow/WorkflowToolbar';
import NodePalette from '../components/Workflow/NodePalette';
import ToolNode from '../components/Workflow/nodes/ToolNode';
import AgentNode from '../components/Workflow/nodes/AgentNode';
import DecisionNode from '../components/Workflow/nodes/DecisionNode';
import TriggerNode from '../components/Workflow/nodes/TriggerNode';
import OutputNode from '../components/Workflow/nodes/OutputNode';
import VariableNode from '../components/Workflow/nodes/VariableNode';
import { WorkflowNode, TriggerNodeData, OutputNodeData, VariableNodeData, DecisionNodeData } from '../types/workflow';

const nodeTypes = {
  toolNode: ToolNode,
  agentNode: AgentNode,
  decisionNode: DecisionNode,
  triggerNode: TriggerNode,
  outputNode: OutputNode,
  variableNode: VariableNode,
};

let id = 0;
const getId = () => `node_${Date.now()}_${id++}`;

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
  } = useWorkflowEditorStore();

  const [propertiesTab, setPropertiesTab] = useState<'config' | 'variables' | 'output'>('config');

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

      let newNode: WorkflowNode;

      switch (type) {
        case 'toolNode':
          newNode = {
            id: getId(),
            type,
            position,
            data: {
              toolName: toolName || 'New Tool',
              category: (category as any) || 'Recon',
              status: 'pending',
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
            } as TriggerNodeData,
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
            } as OutputNodeData,
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
            } as VariableNodeData,
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
            } as DecisionNodeData,
          };
          break;
      }

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: WorkflowNode) => {
    setSelectedNode(node);
    setPropertiesTab('config');
  }, [setSelectedNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handlePropertyChange = useCallback((key: string, value: any) => {
    if (selectedNode) {
      updateNode(selectedNode.id, { [key]: value });
      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, [key]: value } });
    }
  }, [selectedNode, updateNode, setSelectedNode]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedNode) {
      deleteNode(selectedNode.id);
      setSelectedNode(null);
    }
  }, [selectedNode, deleteNode, setSelectedNode]);

  const animatedEdges = edges.map(edge => {
    const sourceNodeStatus = executionState?.nodeStatuses[edge.source];
    const targetNodeStatus = executionState?.nodeStatuses[edge.target];
    const isAnimated = sourceNodeStatus === 'running' && targetNodeStatus === 'waiting';

    return {
      ...edge,
      animated: isAnimated,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#f0c040' },
      style: { strokeWidth: 2, stroke: isAnimated ? '#f0c040' : '#1a1a2e' },
    };
  });

  const nodeColor = (node: any) => {
    switch (node.type) {
      case 'toolNode': return '#f0c040';
      case 'agentNode': return '#00b0ff';
      case 'decisionNode': return '#ff4081';
      case 'triggerNode': return '#22c55e';
      case 'outputNode': return '#f0c040';
      case 'variableNode': return '#06b6d4';
      default: return '#eee';
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0a0f] text-white font-mono">
      <WorkflowToolbar />
      <div className="flex flex-grow overflow-hidden">
        <NodePalette />

        {/* Canvas */}
        <div className="reactflow-wrapper flex-grow" ref={reactFlowWrapper}>
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

          {selectedNode ? (
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
                    {selectedNode.type === 'toolNode' && (
                      <>
                        <PropertyField label="Tool Name" value={(selectedNode.data as any).toolName || ''} onChange={(v) => handlePropertyChange('toolName', v)} />
                        <PropertySelect label="Category" value={(selectedNode.data as any).category || 'Recon'} options={['Recon', 'Web', 'Cloud', 'OSINT', 'Binary', 'Reporting', 'Browser']} onChange={(v) => handlePropertyChange('category', v)} />
                        <PropertyField label="Timeout (sec)" value={String((selectedNode.data as any).timeout || 300)} onChange={(v) => handlePropertyChange('timeout', parseInt(v) || 0)} type="number" />
                        <PropertyField label="Retry Count" value={String((selectedNode.data as any).retryCount || 0)} onChange={(v) => handlePropertyChange('retryCount', parseInt(v) || 0)} type="number" />
                        <PropertyCheckbox label="Continue on Error" checked={(selectedNode.data as any).continueOnError || false} onChange={(v) => handlePropertyChange('continueOnError', v)} />
                      </>
                    )}

                    {/* Agent Node Config */}
                    {selectedNode.type === 'agentNode' && (
                      <>
                        <PropertyField label="Codename" value={(selectedNode.data as any).codename || ''} onChange={(v) => handlePropertyChange('codename', v)} />
                        <PropertyField label="Agent ID" value={(selectedNode.data as any).agentId || ''} onChange={(v) => handlePropertyChange('agentId', v)} placeholder="auto-detected" />
                        <PropertySelect label="Agent Type" value={(selectedNode.data as any).agentType || 'general'} options={['recon', 'web', 'cloud', 'osint', 'binary', 'report', 'coding-assistant', 'reporter', 'general']} onChange={(v) => handlePropertyChange('agentType', v)} />
                        <PropertyCheckbox label="Auto-chain findings" checked={(selectedNode.data as any).autoChain !== false} onChange={(v) => handlePropertyChange('autoChain', v)} />
                      </>
                    )}

                    {/* Decision Node Config */}
                    {selectedNode.type === 'decisionNode' && (
                      <>
                        <PropertyTextarea label="Condition" value={(selectedNode.data as any).condition || ''} onChange={(v) => handlePropertyChange('condition', v)} placeholder='{{prev.output}} contains "critical"' />
                        <PropertyField label="True Label" value={(selectedNode.data as any).trueLabel || 'Yes'} onChange={(v) => handlePropertyChange('trueLabel', v)} />
                        <PropertyField label="False Label" value={(selectedNode.data as any).falseLabel || 'No'} onChange={(v) => handlePropertyChange('falseLabel', v)} />
                      </>
                    )}

                    {/* Trigger Node Config */}
                    {selectedNode.type === 'triggerNode' && (
                      <>
                        <PropertySelect label="Trigger Type" value={(selectedNode.data as any).triggerType || 'manual'} options={['manual', 'cron', 'webhook', 'on-finding', 'on-agent-message', 'on-event']} onChange={(v) => handlePropertyChange('triggerType', v)} />
                        {(selectedNode.data as any).triggerType === 'cron' && (
                          <PropertyField label="Cron Expression" value={(selectedNode.data as any).cronExpression || ''} onChange={(v) => handlePropertyChange('cronExpression', v)} placeholder="0 */6 * * *" />
                        )}
                        {(selectedNode.data as any).triggerType === 'webhook' && (
                          <PropertyField label="Webhook Path" value={(selectedNode.data as any).webhookPath || ''} onChange={(v) => handlePropertyChange('webhookPath', v)} placeholder="/webhooks/start" />
                        )}
                        {['on-finding', 'on-agent-message', 'on-event'].includes((selectedNode.data as any).triggerType) && (
                          <PropertyField label="Event Filter" value={(selectedNode.data as any).eventFilter || ''} onChange={(v) => handlePropertyChange('eventFilter', v)} placeholder="finding.critical" />
                        )}
                        <PropertyCheckbox label="Enabled" checked={(selectedNode.data as any).enabled !== false} onChange={(v) => handlePropertyChange('enabled', v)} />
                      </>
                    )}

                    {/* Output Node Config */}
                    {selectedNode.type === 'outputNode' && (
                      <>
                        <PropertySelect label="Output Type" value={(selectedNode.data as any).outputType || 'report'} options={['report', 'notify', 'save', 'broadcast', 'webhook-out']} onChange={(v) => handlePropertyChange('outputType', v)} />
                        <PropertyField label="Destination" value={(selectedNode.data as any).destination || ''} onChange={(v) => handlePropertyChange('destination', v)} placeholder="#discord, telegram, ./reports/" />
                        <PropertySelect label="Format" value={(selectedNode.data as any).format || 'markdown'} options={['json', 'markdown', 'pdf', 'text']} onChange={(v) => handlePropertyChange('format', v)} />
                        <PropertyTextarea label="Template" value={(selectedNode.data as any).template || ''} onChange={(v) => handlePropertyChange('template', v)} placeholder="# {{workflow.name}} Report\n\n{{results}}" />
                      </>
                    )}

                    {/* Variable Node Config */}
                    {selectedNode.type === 'variableNode' && (
                      <>
                        <PropertyField label="Variable Name" value={(selectedNode.data as any).variableName || ''} onChange={(v) => handlePropertyChange('variableName', v)} />
                        <PropertyField label="Expression" value={(selectedNode.data as any).expression || ''} onChange={(v) => handlePropertyChange('expression', v)} placeholder="{{prev.output}} | count" />
                        <PropertySelect label="Data Type" value={(selectedNode.data as any).dataType || 'string'} options={['string', 'number', 'boolean', 'array', 'object']} onChange={(v) => handlePropertyChange('dataType', v)} />
                      </>
                    )}
                  </>
                )}

                {propertiesTab === 'variables' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-gray-500">Variable bindings for this node's parameters. Use expressions like {'{{nodeId.output}}'} to reference outputs from other nodes.</p>

                    {/* Show editable key-value pairs for tool parameters */}
                    {selectedNode.type === 'toolNode' && (
                      <>
                        <PropertyField label="target" value={(selectedNode.data as any).variables?.target || ''} onChange={(v) => handlePropertyChange('variables', { ...(selectedNode.data as any).variables, target: v })} placeholder="{{trigger.data.target}}" />
                        <PropertyField label="wordlist" value={(selectedNode.data as any).variables?.wordlist || ''} onChange={(v) => handlePropertyChange('variables', { ...(selectedNode.data as any).variables, wordlist: v })} placeholder="/usr/share/wordlists/common.txt" />
                        <PropertyField label="output_file" value={(selectedNode.data as any).variables?.output_file || ''} onChange={(v) => handlePropertyChange('variables', { ...(selectedNode.data as any).variables, output_file: v })} placeholder="{{workflow.name}}-results.json" />
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
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center text-gray-500">
                <p className="text-sm">Select a node</p>
                <p className="text-[10px] mt-1">Click on any node to edit its properties</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Execution Log */}
      <div className="h-36 border-t border-[#1a1a2e] flex flex-col overflow-hidden">
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
