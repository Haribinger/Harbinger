import React, { useCallback, useRef } from 'react';
import ReactFlow, { Controls, Background, MiniMap, useReactFlow, ReactFlowProvider, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowEditorStore } from '../store/workflowEditorStore';
import { shallow } from 'zustand/shallow';
import WorkflowToolbar from '../components/Workflow/WorkflowToolbar';
import NodePalette from '../components/Workflow/NodePalette';
import ToolNode from '../components/Workflow/nodes/ToolNode';
import AgentNode from '../components/Workflow/nodes/AgentNode';
import DecisionNode from '../components/Workflow/nodes/DecisionNode';
import { WorkflowNode } from '../types/workflow';

const nodeTypes = {
  toolNode: ToolNode,
  agentNode: AgentNode,
  decisionNode: DecisionNode,
  // Add other node types here as they are created
};

let id = 0;
const getId = () => `dndnode_${id++}`;

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
  } = useWorkflowEditorStore(
    (state) => ({
      nodes: state.nodes,
      edges: state.edges,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      onConnect: state.onConnect,
      addNode: state.addNode,
      selectedNode: state.selectedNode,
      setSelectedNode: state.setSelectedNode,
      executionState: state.executionState,
      updateNode: state.updateNode,
    }),
    shallow
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const toolName = event.dataTransfer.getData('application/toolname');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let newNode: WorkflowNode;

      if (type === 'toolNode') {
        newNode = {
          id: getId(),
          type,
          position,
          data: {
            toolName: toolName || 'New Tool',
            category: 'Recon', // Default category, can be updated in properties panel
            status: 'pending',
            outputPreview: '',
            parameters: {},
          },
        };
      } else if (type === 'agentNode') {
        newNode = {
          id: getId(),
          type,
          position,
          data: {
            agentAvatar: 'https://via.placeholder.com/24', // Placeholder
            codename: 'Agent ' + id,
            assignedToolsCount: 0,
            heartbeat: true,
            agentId: 'agent_' + id,
          },
        };
      } else if (type === 'decisionNode') {
        newNode = {
          id: getId(),
          type,
          position,
          data: {
            condition: 'if (true)',
          },
        };
      } else if (type === 'triggerNode') {
        newNode = {
          id: getId(),
          type,
          position,
          data: {
            label: 'Trigger',
          },
        };
      } else if (type === 'outputNode') {
        newNode = {
          id: getId(),
          type,
          position,
          data: {
            label: 'Output',
          },
        };
      } else {
        newNode = {
          id: getId(),
          type,
          position,
          data: { label: `${type} node` },
        };
      }

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: WorkflowNode) => {
    setSelectedNode(node);
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

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0a0f] text-white font-mono">
      <WorkflowToolbar />
      <div className="flex flex-grow">
        <NodePalette />
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
            <MiniMap style={{ backgroundColor: '#0d0d15' }} nodeColor={(node) => {
              if (node.type === 'toolNode') return '#f0c040';
              if (node.type === 'agentNode') return '#00b0ff';
              if (node.type === 'decisionNode') return '#ff4081';
              return '#eee';
            }} />
            <Controls />
            <Background variant="dots" gap={12} size={1} color="#1a1a2e" />
          </ReactFlow>
        </div>
        <div className="w-80 p-4 bg-[#0d0d15] border-l border-[#1a1a2e]">
          <h3 className="text-lg font-bold mb-4 text-[#f0c040]">Node Properties</h3>
          {selectedNode ? (
            <div className="space-y-4">
              <p>ID: {selectedNode.id}</p>
              <p>Type: {selectedNode.type}</p>
              {selectedNode.type === 'toolNode' && (
                <>
                  <label className="block text-sm font-bold mb-1">Tool Name:</label>
                  <input
                    type="text"
                    className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                    value={(selectedNode.data as any).toolName || ''}
                    onChange={(e) => handlePropertyChange('toolName', e.target.value)}
                  />
                  <label className="block text-sm font-bold mb-1 mt-2">Category:</label>
                  <select
                    className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                    value={(selectedNode.data as any).category || 'Recon'}
                    onChange={(e) => handlePropertyChange('category', e.target.value)}
                  >
                    <option value="Recon">Recon</option>
                    <option value="Web">Web</option>
                    <option value="Cloud">Cloud</option>
                    <option value="OSINT">OSINT</option>
                    <option value="Binary">Binary</option>
                    <option value="Reporting">Reporting</option>
                  </select>
                  {/* Add more tool-specific properties here */}
                </>
              )}
              {selectedNode.type === 'agentNode' && (
                <>
                  <label className="block text-sm font-bold mb-1">Codename:</label>
                  <input
                    type="text"
                    className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                    value={(selectedNode.data as any).codename || ''}
                    onChange={(e) => handlePropertyChange('codename', e.target.value)}
                  />
                  {/* Add more agent-specific properties here */}
                </>
              )}
              {selectedNode.type === 'decisionNode' && (
                <>
                  <label className="block text-sm font-bold mb-1">Condition:</label>
                  <textarea
                    className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                    rows={3}
                    value={(selectedNode.data as any).condition || ''}
                    onChange={(e) => handlePropertyChange('condition', e.target.value)}
                  />
                </>
              )}
              {/* Add properties for other node types */}
            </div>
          ) : (
            <p className="text-gray-400">Select a node to view properties</p>
          )}
        </div>
      </div>
      <div className="h-48 p-4 bg-[#0d0d15] border-t border-[#1a1a2e] overflow-y-auto text-sm">
        <h3 className="text-lg font-bold mb-2 text-[#f0c040]">Execution Log</h3>
        {executionState?.log.map((entry, index) => (
          <p key={index} className="mb-1">{entry}</p>
        ))}
        {executionState?.log.length === 0 && <p className="text-gray-400">No execution logs yet.</p>}
      </div>
    </div>
  );
};

const WorkflowEditor: React.FC = () => (
  <ReactFlowProvider>
    <WorkflowEditorContent />
  </ReactFlowProvider>
);

export default WorkflowEditor;
