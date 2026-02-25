import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ToolNodeData } from '../../../types/workflow';

interface ToolNodeProps {
  data: ToolNodeData;
}

const ToolNode: React.FC<ToolNodeProps> = ({ data }) => {
  const statusColor = {
    running: 'bg-green-500',
    waiting: 'bg-yellow-500',
    error: 'bg-red-500',
    pending: 'bg-gray-500',
    success: 'bg-blue-500',
  }[data.status || 'pending'];

  return (
    <div className="relative w-48 rounded-md shadow-md bg-[#0d0d15] border border-[#1a1a2e] text-white font-mono">
      <Handle type="target" position={Position.Left} className="!bg-[#f0c040]" />
      <div className="flex items-center p-2 border-b border-[#1a1a2e]">
        <div className={`w-3 h-3 rounded-full mr-2 ${statusColor}`} />
        <span className="text-sm font-bold">{data.toolName}</span>
      </div>
      <div className="p-2 text-xs text-gray-400">
        <p className="truncate">Output: {data.outputPreview || 'No output yet...'}</p>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-[#f0c040]" />
    </div>
  );
};

export default memo(ToolNode);
