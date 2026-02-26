import React, { useRef } from 'react';
import { useWorkflowEditorStore } from '../../store/workflowEditorStore';
import toast from 'react-hot-toast';

const WorkflowToolbar: React.FC = () => {
  const {
    startExecution,
    stopExecution,
    savedWorkflows,
    loadWorkflow,
    nodes,
    edges,
    executionState,
    addSavedWorkflow,
    setNodes,
    setEdges,
  } = useWorkflowEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const name = prompt('Workflow name:');
    if (!name) return;

    const workflow = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      description: '',
      nodes,
      edges,
      version: '1.0',
      createdAt: new Date().toISOString(),
    };

    addSavedWorkflow(workflow);
    toast.success(`Saved "${name}"`);
  };

  const handleExportJSON = () => {
    const workflow = {
      id: `workflow-${Date.now()}`,
      name: 'Exported Workflow',
      nodes,
      edges,
      version: '1.0',
      exportedAt: new Date().toISOString(),
      harbingerVersion: '1.0.0',
    };

    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harbinger-workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Workflow exported as JSON');
  };

  const handleImportJSON = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
          toast.success(`Imported "${data.name || 'workflow'}"`);
        } else {
          toast.error('Invalid workflow file');
        }
      } catch {
        toast.error('Failed to parse workflow file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadSaved = () => {
    if (savedWorkflows.length === 0) {
      toast.error('No saved workflows');
      return;
    }
    const name = prompt(`Saved workflows:\n${savedWorkflows.map(w => `  - ${w.id}`).join('\n')}\n\nEnter workflow ID:`);
    if (!name) return;
    const wf = savedWorkflows.find(w => w.id === name);
    if (wf) {
      loadWorkflow(wf);
      toast.success(`Loaded "${wf.name}"`);
    } else {
      toast.error('Workflow not found');
    }
  };

  const handleRun = () => {
    if (nodes.length === 0) {
      toast.error('Add nodes before running');
      return;
    }
    startExecution('current-workflow');
    toast.success('Workflow execution started');
  };

  const handleStop = () => {
    stopExecution();
    toast.success('Workflow stopped');
  };

  const handleClear = () => {
    if (!confirm('Clear all nodes and edges?')) return;
    setNodes([]);
    setEdges([]);
    toast.success('Canvas cleared');
  };

  const isRunning = executionState?.status === 'running';

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#0d0d15] border-b border-[#1a1a2e] text-white font-mono">
      <div className="flex items-center gap-2">
        <span className="text-[#f0c040] font-bold text-sm mr-2">WORKFLOWS</span>
        <div className="w-px h-5 bg-[#1a1a2e]" />

        <button
          onClick={handleSave}
          className="px-2.5 py-1 rounded text-xs bg-[#1a1a2e] hover:bg-[#f0c040]/10 hover:text-[#f0c040] border border-[#1a1a2e] hover:border-[#f0c040]/30 transition-colors"
        >
          Save
        </button>
        <button
          onClick={handleLoadSaved}
          className="px-2.5 py-1 rounded text-xs bg-[#1a1a2e] hover:bg-[#f0c040]/10 hover:text-[#f0c040] border border-[#1a1a2e] hover:border-[#f0c040]/30 transition-colors"
        >
          Load
        </button>

        <div className="w-px h-5 bg-[#1a1a2e]" />

        <button
          onClick={handleExportJSON}
          className="px-2.5 py-1 rounded text-xs bg-[#1a1a2e] hover:bg-blue-500/10 hover:text-blue-400 border border-[#1a1a2e] hover:border-blue-500/30 transition-colors"
        >
          Export JSON
        </button>
        <button
          onClick={handleImportJSON}
          className="px-2.5 py-1 rounded text-xs bg-[#1a1a2e] hover:bg-blue-500/10 hover:text-blue-400 border border-[#1a1a2e] hover:border-blue-500/30 transition-colors"
        >
          Import
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />

        <div className="w-px h-5 bg-[#1a1a2e]" />

        <button
          onClick={handleClear}
          className="px-2.5 py-1 rounded text-xs bg-[#1a1a2e] hover:bg-red-500/10 hover:text-red-400 border border-[#1a1a2e] hover:border-red-500/30 transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Node count */}
        <span className="text-[10px] text-gray-500 mr-2">
          {nodes.length} nodes \u00b7 {edges.length} edges
        </span>

        {isRunning ? (
          <button
            onClick={handleStop}
            className="px-3 py-1 rounded text-xs bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors flex items-center gap-1.5"
          >
            <div className="w-2 h-2 rounded-sm bg-red-400" />
            Stop
          </button>
        ) : (
          <button
            onClick={handleRun}
            className="px-3 py-1 rounded text-xs bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 transition-colors flex items-center gap-1.5"
          >
            <div className="w-0 h-0 border-l-[6px] border-l-green-400 border-y-[4px] border-y-transparent" />
            Run
          </button>
        )}
      </div>
    </div>
  );
};

export default WorkflowToolbar;
