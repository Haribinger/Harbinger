import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TriggerNodeData } from '../../../types/workflow';

interface TriggerNodeProps {
  data: TriggerNodeData;
}

const TRIGGER_ICONS: Record<string, string> = {
  manual: '\u25b6',
  cron: '\u23f0',
  webhook: '\u26a1',
  'on-finding': '\ud83d\udea8',
  'on-agent-message': '\ud83d\udce8',
  'on-event': '\ud83d\udd14',
};

const TRIGGER_COLORS: Record<string, string> = {
  manual: 'border-green-500/40 bg-green-500/5',
  cron: 'border-blue-500/40 bg-blue-500/5',
  webhook: 'border-purple-500/40 bg-purple-500/5',
  'on-finding': 'border-red-500/40 bg-red-500/5',
  'on-agent-message': 'border-yellow-500/40 bg-yellow-500/5',
  'on-event': 'border-cyan-500/40 bg-cyan-500/5',
};

const TriggerNode: React.FC<TriggerNodeProps> = ({ data }) => {
  const triggerType = data.triggerType || 'manual';
  const icon = TRIGGER_ICONS[triggerType] || '\u25b6';
  const colorClass = TRIGGER_COLORS[triggerType] || 'border-green-500/40 bg-green-500/5';

  const subtitle = (() => {
    switch (triggerType) {
      case 'cron': return data.cronExpression || 'No schedule set';
      case 'webhook': return data.webhookPath || '/webhooks/...';
      case 'on-finding': return data.eventFilter || 'Any finding';
      case 'on-agent-message': return data.eventFilter || 'Any agent';
      case 'on-event': return data.eventFilter || 'Any event';
      default: return 'Click to start';
    }
  })();

  return (
    <div className={`relative w-52 rounded-lg shadow-md border ${colorClass} text-white font-mono`}>
      <div className="flex items-center p-2.5 gap-2">
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-[#f0c040]">Trigger</span>
          <p className="text-[11px] text-gray-400 capitalize">{triggerType.replace(/-/g, ' ')}</p>
        </div>
        {data.enabled !== false && (
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        )}
      </div>
      <div className="px-2.5 pb-2.5 text-[10px] text-gray-500 truncate">
        {subtitle}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-[#f0c040] !w-3 !h-3" />
    </div>
  );
};

export default memo(TriggerNode);
