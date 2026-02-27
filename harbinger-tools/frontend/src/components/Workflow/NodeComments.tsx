import React, { useState, useCallback } from 'react';
import { useWorkflowEditorStore } from '../../store/workflowEditorStore';

interface NodeCommentsProps {
  nodeId: string;
  comment?: string;
}

const NodeComments: React.FC<NodeCommentsProps> = ({ nodeId, comment }) => {
  const { updateNode } = useWorkflowEditorStore();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment || '');

  const handleSave = useCallback(() => {
    updateNode(nodeId, { comment: text || undefined });
    setEditing(false);
  }, [nodeId, text, updateNode]);

  if (!comment && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-[9px] text-gray-600 hover:text-yellow-400 transition-colors"
        title="Add comment"
      >
        + note
      </button>
    );
  }

  if (editing) {
    return (
      <div className="mt-1 p-1.5 bg-yellow-500/5 border border-yellow-500/20 rounded">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-transparent text-[10px] text-yellow-200 font-mono resize-none focus:outline-none"
          rows={2}
          placeholder="Add a note..."
          autoFocus
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) handleSave();
            if (e.key === 'Escape') { setText(comment || ''); setEditing(false); }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="mt-1 p-1.5 bg-yellow-500/5 border border-yellow-500/20 rounded cursor-pointer"
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      <p className="text-[10px] text-yellow-300/80 font-mono truncate">{comment}</p>
    </div>
  );
};

export default NodeComments;
