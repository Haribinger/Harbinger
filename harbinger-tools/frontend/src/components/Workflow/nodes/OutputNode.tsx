import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { OutputNodeData } from '../../../types/workflow';

interface OutputNodeProps {
  data: OutputNodeData;
}

const OUTPUT_ICONS: Record<string, string> = {
  report: '\ud83d\udcdd',
  notify: '\ud83d\udce2',
  save: '\ud83d\udcbe',
  broadcast: '\ud83d\udce1',
  'webhook-out': '\u26a1',
};

const OutputNode: React.FC<OutputNodeProps> = ({ data }) => {
  const outputType = data.outputType || 'report';
  const icon = OUTPUT_ICONS[outputType] || '\ud83d\udcdd';

  return (
    <div className="relative w-52 rounded-lg shadow-md bg-[#0d0d15] border border-[#f0c040]/30 text-white font-mono">
      <Handle type="target" position={Position.Left} className="!bg-[#f0c040] !w-3 !h-3" />
      <div className="flex items-center p-2.5 gap-2">
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-[#f0c040]">Output</span>
          <p className="text-[11px] text-gray-400 capitalize">{outputType.replace(/-/g, ' ')}</p>
        </div>
      </div>
      <div className="px-2.5 pb-2.5">
        {data.destination && (
          <p className="text-[10px] text-gray-500 truncate">
            \u2192 {data.destination}
          </p>
        )}
        {data.format && (
          <span className="text-[9px] px-1.5 py-0.5 bg-[#1a1a2e] rounded text-gray-400 uppercase">
            {data.format}
          </span>
        )}
      </div>
    </div>
  );
};

export default memo(OutputNode);
