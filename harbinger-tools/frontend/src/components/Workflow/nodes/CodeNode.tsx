import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface CodeNodeData extends Record<string, unknown> {
  language: 'javascript' | 'python' | 'bash';
  code: string;
  entryFunction: string;
  timeout: number;
  status: 'running' | 'waiting' | 'error' | 'pending' | 'success';
}

interface CodeNodeProps {
  data: CodeNodeData;
}

const LANG_COLORS: Record<string, string> = {
  javascript: '#f7df1e',
  python: '#3776ab',
  bash: '#4eaa25',
};

const LANG_LABELS: Record<string, string> = {
  javascript: 'JS',
  python: 'PY',
  bash: 'SH',
};

const CodeNode: React.FC<CodeNodeProps> = ({ data }) => {
  const statusColor = {
    running: 'bg-green-500',
    waiting: 'bg-yellow-500',
    error: 'bg-red-500',
    pending: 'bg-gray-500',
    success: 'bg-blue-500',
  }[data.status || 'pending'];

  const language = data.language || 'javascript';
  const langColor = LANG_COLORS[language] || '#6b7280';
  const langLabel = LANG_LABELS[language] || language.toUpperCase();

  // Show the first non-empty line of code as a preview
  const firstLine = (data.code || '')
    .split('\n')
    .find((line: string) => line.trim().length > 0) || 'no code';

  return (
    <div
      className="relative w-56 rounded-md shadow-md bg-[#0d0d15] border border-[#1a1a2e] text-white font-mono"
      style={{ borderTopWidth: 2, borderTopColor: '#10b981' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#f0c040]" />

      <div className="flex items-center p-2 border-b border-[#1a1a2e]">
        <div className={`w-3 h-3 rounded-full mr-2 ${statusColor}`} />
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded mr-2"
          style={{ backgroundColor: langColor, color: '#0a0a0f' }}
        >
          {langLabel}
        </span>
        <span className="text-sm font-bold" style={{ color: '#10b981' }}>Code</span>
      </div>

      <div className="p-2 text-xs text-gray-400 space-y-1">
        <p
          className="truncate bg-[#0a0a0f] rounded px-1.5 py-1 text-[10px] text-gray-300"
          title={firstLine}
        >
          {firstLine}
        </p>
        {data.entryFunction && (
          <p className="truncate text-[10px]">
            <span className="text-gray-500">fn:</span> {data.entryFunction}()
          </p>
        )}
        {data.timeout > 0 && (
          <span className="px-1.5 py-0.5 bg-[#1a1a2e] rounded text-[10px] text-gray-300">
            {data.timeout}ms
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-[#10b981]" />
    </div>
  );
};

export default memo(CodeNode);
