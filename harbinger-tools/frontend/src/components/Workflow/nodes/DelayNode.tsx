import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface DelayNodeData extends Record<string, unknown> {
  delayType: 'fixed' | 'random' | 'until';
  durationMs: number;
  minMs: number;
  maxMs: number;
  untilExpression: string;
  status: 'running' | 'waiting' | 'error' | 'pending' | 'success';
}

interface DelayNodeProps {
  data: DelayNodeData;
}

/** Human-readable duration from milliseconds */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

const DelayNode: React.FC<DelayNodeProps> = ({ data }) => {
  const statusColor = {
    running: 'bg-green-500',
    waiting: 'bg-yellow-500',
    error: 'bg-red-500',
    pending: 'bg-gray-500',
    success: 'bg-blue-500',
  }[data.status || 'pending'];

  const delayType = data.delayType || 'fixed';

  const delayLabel = (): string => {
    switch (delayType) {
      case 'fixed':
        return formatDuration(data.durationMs ?? 0);
      case 'random':
        return `${formatDuration(data.minMs ?? 0)} - ${formatDuration(data.maxMs ?? 0)}`;
      case 'until':
        return data.untilExpression || 'expression';
      default:
        return 'unknown';
    }
  };

  return (
    <div
      className="relative w-48 rounded-md shadow-md bg-[#0d0d15] border border-[#1a1a2e] text-white font-mono"
      style={{ borderTopWidth: 2, borderTopColor: '#f59e0b' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#f0c040]" />

      <div className="flex items-center p-2 border-b border-[#1a1a2e]">
        <div className={`w-3 h-3 rounded-full mr-2 ${statusColor}`} />
        <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>Delay</span>
      </div>

      <div className="p-2 text-xs text-gray-400 space-y-1">
        <span className="px-1.5 py-0.5 bg-[#1a1a2e] rounded text-[10px] text-gray-300 uppercase">
          {delayType}
        </span>
        <p className="truncate mt-1">{delayLabel()}</p>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-[#f59e0b]" />
    </div>
  );
};

export default memo(DelayNode);
