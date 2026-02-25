import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { DecisionNodeData } from '../../../types/workflow';

interface DecisionNodeProps {
  data: DecisionNodeData;
}

const DecisionNode: React.FC<DecisionNodeProps> = ({ data }) => {
  return (
    <div className="relative w-32 h-32 flex items-center justify-center transform rotate-45 bg-[#0d0d15] border border-[#1a1a2e] shadow-md">
      <div className="transform -rotate-45 text-white text-xs font-mono text-center p-2">
        {data.condition || 'Condition?'}
      </div>
      <Handle type="target" position={Position.Top} className="!bg-[#f0c040] !w-3 !h-3 !-top-1.5 !-translate-x-1/2" />
      <Handle type="source" position={Position.Left} id="false" className="!bg-red-500 !w-3 !h-3 !-left-1.5 !-translate-y-1/2" style={{ top: '50%' }} />
      <Handle type="source" position={Position.Right} id="true" className="!bg-green-500 !w-3 !h-3 !-right-1.5 !-translate-y-1/2" style={{ top: '50%' }} />
    </div>
  );
};

export default memo(DecisionNode);
