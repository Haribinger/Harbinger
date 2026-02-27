import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface HttpRequestNodeData extends Record<string, unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  url: string;
  headers: Record<string, string>;
  body: string;
  bodyType: 'json' | 'form' | 'raw' | 'none';
  timeout: number;
  verifySsl: boolean;
  status: 'running' | 'waiting' | 'error' | 'pending' | 'success';
}

interface HttpRequestNodeProps {
  data: HttpRequestNodeData;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  DELETE: '#ef4444',
  PATCH: '#a855f7',
  HEAD: '#6b7280',
  OPTIONS: '#6b7280',
};

const HttpRequestNode: React.FC<HttpRequestNodeProps> = ({ data }) => {
  const statusColor = {
    running: 'bg-green-500',
    waiting: 'bg-yellow-500',
    error: 'bg-red-500',
    pending: 'bg-gray-500',
    success: 'bg-blue-500',
  }[data.status || 'pending'];

  const method = data.method || 'GET';
  const methodColor = METHOD_COLORS[method] || '#6b7280';

  return (
    <div
      className="relative w-56 rounded-md shadow-md bg-[#0d0d15] border border-[#1a1a2e] text-white font-mono"
      style={{ borderTopWidth: 2, borderTopColor: '#0ea5e9' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#f0c040]" />

      <div className="flex items-center p-2 border-b border-[#1a1a2e]">
        <div className={`w-3 h-3 rounded-full mr-2 ${statusColor}`} />
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded mr-2 uppercase"
          style={{ backgroundColor: methodColor, color: '#fff' }}
        >
          {method}
        </span>
        <span className="text-sm font-bold" style={{ color: '#0ea5e9' }}>HTTP</span>
      </div>

      <div className="p-2 text-xs text-gray-400 space-y-1">
        <p className="truncate" title={data.url}>
          {data.url || 'https://...'}
        </p>
        <div className="flex items-center gap-2">
          {data.timeout > 0 && (
            <span className="px-1.5 py-0.5 bg-[#1a1a2e] rounded text-[10px] text-gray-300">
              {data.timeout}ms
            </span>
          )}
          {!data.verifySsl && (
            <span className="px-1.5 py-0.5 bg-[#1a1a2e] rounded text-[10px] text-red-400">
              no-ssl
            </span>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-[#0ea5e9]" />
    </div>
  );
};

export default memo(HttpRequestNode);
