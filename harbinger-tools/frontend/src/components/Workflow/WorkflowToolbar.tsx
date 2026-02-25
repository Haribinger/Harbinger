import React from 'react';
import { useWorkflowEditorStore } from '../../store/workflowEditorStore';

const WorkflowToolbar: React.FC = () => {
  const { startExecution, stopExecution, savedWorkflows, loadWorkflow, nodes, edges } = useWorkflowEditorStore();

  const handleSave = () => {
    const workflowName = prompt('Enter workflow name:');
    if (workflowName) {
      useWorkflowEditorStore.getState().addSavedWorkflow({
        id: workflowName.toLowerCase().replace(/\s/g, '-'),
        name: workflowName,
        description: 'User-saved workflow',
        nodes: nodes,
        edges: edges,
      });
      alert(`Workflow \'${workflowName}\' saved!`);
    }
  };

  const handleLoad = () => {
    const workflowId = prompt('Enter workflow ID to load (e.g., quick-recon):');
    if (workflowId) {
      const workflowToLoad = savedWorkflows.find(wf => wf.id === workflowId);
      if (workflowToLoad) {
        loadWorkflow(workflowToLoad);
        alert(`Workflow \'${workflowToLoad.name}\' loaded!`);
      } else {
        alert('Workflow not found.');
      }
    }
  };

  const handleRun = () => {
    startExecution('current-workflow');
    alert('Workflow execution started!');
  };

  const handleStop = () => {
    stopExecution();
    alert('Workflow execution stopped.');
  };

  const handleGitCommit = () => {
    alert('Git Commit functionality not yet implemented.');
  };

  const handleShare = () => {
    alert('Share functionality not yet implemented.');
  };

  return (
    <div className="flex items-center justify-between p-2 bg-[#0d0d15] border-b border-[#1a1a2e] text-white font-mono">
      <div className="flex space-x-2">
        <button onClick={handleSave} className="px-3 py-1 rounded bg-[#f0c040] text-black text-sm hover:bg-yellow-400">Save</button>
        <button onClick={handleLoad} className="px-3 py-1 rounded bg-[#f0c040] text-black text-sm hover:bg-yellow-400">Load</button>
        <button onClick={handleRun} className="px-3 py-1 rounded bg-green-600 text-white text-sm hover:bg-green-700">Run</button>
        <button onClick={handleStop} className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700">Stop</button>
      </div>
      <div className="flex space-x-2">
        <button onClick={handleGitCommit} className="px-3 py-1 rounded bg-gray-700 text-white text-sm hover:bg-gray-600">Git Commit</button>
        <button onClick={handleShare} className="px-3 py-1 rounded bg-gray-700 text-white text-sm hover:bg-gray-600">Share</button>
      </div>
    </div>
  );
};

export default WorkflowToolbar;
