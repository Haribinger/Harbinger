import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface LoopNodeData extends Record<string, unknown> {
  iteratorExpression: string;
  itemVariable: string;
  indexVariable: string;
  maxIterations: number;
  parallelism: number;
  status: 'running' | 'waiting' | 'error' | 'pending' | 'success';
}

interface LoopNodeProps {
  data: LoopNodeData;
}

const LoopNode: React.FC<LoopNodeProps> = ({ data }) => {
  const statusColor = {
    running: 'bg-green-500',
    waiting: 'bg-yellow-500',
    error: 'bg-red-500',
    pending: 'bg-gray-500',
    success: 'bg-blue-500',
  }[data.status || 'pending'];

  return (
    <div
      className="relative w-52 rounded-md shadow-md bg-[#0d0d15] border border-[#1a1a2e] text-white font-mono"
      style={{ borderTopWidth: 2, borderTopColor: '#8b5cf6' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#f0c040]" />

      <div className="flex items-center p-2 border-b border-[#1a1a2e]">
        <div className={`w-3 h-3 rounded-full mr-2 ${statusColor}`} />
        <span className="text-sm font-bold" style={{ color: '#8b5cf6' }}>Loop</span>
      </div>

      <div className="p-2 text-xs text-gray-400 space-y-1">
        <p className="truncate">
          <span className="text-gray-500">iter:</span> {data.iteratorExpression || 'undefined'}
        </p>
        <p className="truncate">
          <span className="text-gray-500">var:</span> {data.itemVariable || 'item'}
          {data.indexVariable ? ` [${data.indexVariable}]` : ''}
        </p>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-[#1a1a2e] rounded text-[10px] text-gray-300">
            max {data.maxIterations ?? 100}
          </span>
          {data.parallelism > 1 && (
            <span className="px-1.5 py-0.5 bg-[#1a1a2e] rounded text-[10px] text-gray-300">
              x{data.parallelism}
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="each-item"
        className="!bg-[#8b5cf6]"
        style={{ top: '40%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="complete"
        className="!bg-[#f0c040]"
      />
    </div>
  );
};

export default memo(LoopNode);
