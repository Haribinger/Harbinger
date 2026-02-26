import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { VariableNodeData } from '../../../types/workflow';

interface VariableNodeProps {
  data: VariableNodeData;
}

const VariableNode: React.FC<VariableNodeProps> = ({ data }) => {
  return (
    <div className="relative w-48 rounded-lg shadow-md bg-[#0d0d15] border border-cyan-500/30 text-white font-mono">
      <Handle type="target" position={Position.Left} className="!bg-cyan-400 !w-3 !h-3" />
      <div className="flex items-center p-2.5 gap-2">
        <span className="text-lg text-cyan-400">{'{ }'}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-cyan-400">{data.variableName || 'variable'}</span>
          <p className="text-[10px] text-gray-500 capitalize">{data.dataType || 'string'}</p>
        </div>
      </div>
      {data.expression && (
        <div className="px-2.5 pb-2 text-[10px] text-gray-500 font-mono truncate">
          {data.expression}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-cyan-400 !w-3 !h-3" />
    </div>
  );
};

export default memo(VariableNode);
