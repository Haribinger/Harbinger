import { useEffect, useCallback } from 'react';
import { useWorkflowEditorStore } from '../../../store/workflowEditorStore';
import toast from 'react-hot-toast';

export function useWorkflowKeyboard() {
  const {
    undo,
    redo,
    deleteNode,
    selectedNode,
    setSelectedNode,
    nodes,
    edges,
    addNode,
    addSavedWorkflow,
    startExecution,
    executionState,
    stopExecution,
    toggleSnapToGrid,
    pushSnapshot,
  } = useWorkflowEditorStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore when typing in inputs/textareas
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const ctrl = e.ctrlKey || e.metaKey;

    // Ctrl+Z — Undo
    if (ctrl && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      undo();
      return;
    }

    // Ctrl+Shift+Z — Redo
    if (ctrl && e.shiftKey && e.key === 'Z') {
      e.preventDefault();
      redo();
      return;
    }

    // Delete / Backspace — Remove selected node
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
      e.preventDefault();
      pushSnapshot();
      deleteNode(selectedNode.id);
      setSelectedNode(null);
      return;
    }

    // Ctrl+S — Save workflow
    if (ctrl && e.key === 's') {
      e.preventDefault();
      const name = `autosave-${Date.now()}`;
      addSavedWorkflow({
        id: name,
        name,
        description: 'Auto-saved workflow',
        nodes,
        edges,
        version: '1.0',
        createdAt: new Date().toISOString(),
      });
      toast.success('Workflow saved');
      return;
    }

    // Ctrl+D — Duplicate selected node
    if (ctrl && e.key === 'd' && selectedNode) {
      e.preventDefault();
      pushSnapshot();
      const newNode = {
        ...selectedNode,
        id: `node_${Date.now()}_dup`,
        position: {
          x: selectedNode.position.x + 50,
          y: selectedNode.position.y + 50,
        },
      };
      addNode(newNode);
      toast.success('Node duplicated');
      return;
    }

    // Ctrl+G — Toggle snap to grid
    if (ctrl && e.key === 'g') {
      e.preventDefault();
      toggleSnapToGrid();
      return;
    }

    // Ctrl+Enter — Run/Stop workflow
    if (ctrl && e.key === 'Enter') {
      e.preventDefault();
      if (executionState?.status === 'running') {
        stopExecution();
        toast.success('Workflow stopped');
      } else {
        if (nodes.length === 0) {
          toast.error('Add nodes before running');
          return;
        }
        startExecution('current-workflow');
        toast.success('Workflow started');
      }
      return;
    }

    // Escape — Deselect node
    if (e.key === 'Escape') {
      setSelectedNode(null);
      return;
    }
  }, [
    undo, redo, deleteNode, selectedNode, setSelectedNode,
    nodes, edges, addNode, addSavedWorkflow, startExecution,
    executionState, stopExecution, toggleSnapToGrid, pushSnapshot,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
