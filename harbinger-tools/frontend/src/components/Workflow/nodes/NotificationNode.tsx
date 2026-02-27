import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface NotificationNodeData extends Record<string, unknown> {
  channel: 'discord' | 'telegram' | 'slack' | 'email' | 'webhook';
  messageTemplate: string;
  severity: 'info' | 'warning' | 'critical';
  destination: string;
  status: 'running' | 'waiting' | 'error' | 'pending' | 'success';
}

interface NotificationNodeProps {
  data: NotificationNodeData;
}

const CHANNEL_LABELS: Record<string, string> = {
  discord: 'Discord',
  telegram: 'Telegram',
  slack: 'Slack',
  email: 'Email',
  webhook: 'Webhook',
};

const SEVERITY_COLORS: Record<string, string> = {
  info: '#3b82f6',
  warning: '#f59e0b',
  critical: '#ef4444',
};

const NotificationNode: React.FC<NotificationNodeProps> = ({ data }) => {
  const statusColor = {
    running: 'bg-green-500',
    waiting: 'bg-yellow-500',
    error: 'bg-red-500',
    pending: 'bg-gray-500',
    success: 'bg-blue-500',
  }[data.status || 'pending'];

  const channel = data.channel || 'webhook';
  const severity = data.severity || 'info';
  const severityColor = SEVERITY_COLORS[severity] || '#3b82f6';

  return (
    <div
      className="relative w-52 rounded-md shadow-md bg-[#0d0d15] border border-[#1a1a2e] text-white font-mono"
      style={{ borderTopWidth: 2, borderTopColor: '#ec4899' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#f0c040]" />

      <div className="flex items-center p-2 border-b border-[#1a1a2e]">
        <div className={`w-3 h-3 rounded-full mr-2 ${statusColor}`} />
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded mr-2 uppercase"
          style={{ backgroundColor: '#ec4899', color: '#fff' }}
        >
          {CHANNEL_LABELS[channel] || channel}
        </span>
        <div
          className="w-2 h-2 rounded-full ml-auto"
          style={{ backgroundColor: severityColor }}
          title={severity}
        />
      </div>

      <div className="p-2 text-xs text-gray-400 space-y-1">
        <p className="truncate" title={data.messageTemplate}>
          {data.messageTemplate || 'No message template...'}
        </p>
        {data.destination && (
          <p className="truncate text-[10px] text-gray-500">
            <span className="text-gray-600">to:</span> {data.destination}
          </p>
        )}
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
          style={{ backgroundColor: severityColor + '22', color: severityColor }}
        >
          {severity}
        </span>
      </div>

      {/* Sink node -- no source handle */}
    </div>
  );
};

export default memo(NotificationNode);
