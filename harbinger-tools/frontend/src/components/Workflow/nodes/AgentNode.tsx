import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AgentNodeData } from '../../../types/workflow';

interface AgentNodeProps {
  data: AgentNodeData;
}

const AgentNode: React.FC<AgentNodeProps> = ({ data }) => {
  const heartbeatColor = data.heartbeat ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="relative w-48 rounded-md shadow-md bg-[#0d0d15] border border-[#1a1a2e] text-white font-mono">
      <Handle type="target" position={Position.Left} className="!bg-[#f0c040]" />
      <div className="flex items-center p-2 border-b border-[#1a1a2e]">
        <img src={data.agentAvatar} alt="Agent Avatar" className="w-6 h-6 rounded-full mr-2" />
        <span className="text-sm font-bold">{data.codename}</span>
      </div>
      <div className="p-2 text-xs text-gray-400">
        <p>Tools: {data.assignedToolsCount}</p>
        <div className="flex items-center mt-1">
          <div className={`w-2 h-2 rounded-full mr-1 ${heartbeatColor}`} />
          <span>Heartbeat</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-[#f0c040]" />
    </div>
  );
};

export default memo(AgentNode);
