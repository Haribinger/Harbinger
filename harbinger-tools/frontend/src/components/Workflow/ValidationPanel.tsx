import React, { useState, useEffect, useCallback } from 'react';
import { useWorkflowEditorStore } from '../../store/workflowEditorStore';
import { validateWorkflow } from '../../core/workflows/validation';
import type { ValidationResult } from '../../types/workflow';

const ValidationPanel: React.FC = () => {
  const { nodes, edges, setSelectedNode } = useWorkflowEditorStore();
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Debounced auto-validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nodes.length > 0) {
        setResult(validateWorkflow(nodes, edges));
      } else {
        setResult(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  const handleClickNode = useCallback((nodeId: string) => {
    if (!nodeId) return;
    const node = nodes.find(n => n.id === nodeId);
    if (node) setSelectedNode(node);
  }, [nodes, setSelectedNode]);

  const errorCount = result?.errors.length ?? 0;
  const warningCount = result?.warnings.length ?? 0;
  const hasIssues = errorCount > 0 || warningCount > 0;

  if (!hasIssues && result) return null;

  return (
    <div className="border-t border-[#1a1a2e] bg-[#0d0d15] font-mono">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-[#1a1a2e]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-bold text-[#f0c040]">Validation</h3>
          {result && (
            <div className="flex items-center gap-2">
              {errorCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  {warningCount} warning{warningCount !== 1 ? 's' : ''}
                </span>
              )}
              {errorCount === 0 && warningCount === 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                  Valid
                </span>
              )}
            </div>
          )}
        </div>
        <span className="text-gray-500 text-xs">{collapsed ? '+' : '-'}</span>
      </button>

      {!collapsed && result && hasIssues && (
        <div className="px-4 pb-2 max-h-32 overflow-y-auto space-y-1">
          {result.errors.map((err, i) => (
            <div
              key={`err-${i}`}
              className="flex items-start gap-2 text-[10px] cursor-pointer hover:bg-red-500/5 rounded px-1 py-0.5"
              onClick={() => handleClickNode(err.nodeId)}
            >
              <span className="text-red-400 mt-0.5 flex-shrink-0">&#x2716;</span>
              <span className="text-red-300">{err.message}</span>
              {err.field && <span className="text-gray-600 ml-auto">{err.field}</span>}
            </div>
          ))}
          {result.warnings.map((warn, i) => (
            <div
              key={`warn-${i}`}
              className="flex items-start gap-2 text-[10px] cursor-pointer hover:bg-yellow-500/5 rounded px-1 py-0.5"
              onClick={() => handleClickNode(warn.nodeId)}
            >
              <span className="text-yellow-400 mt-0.5 flex-shrink-0">&#x26A0;</span>
              <span className="text-yellow-300">{warn.message}</span>
              {warn.field && <span className="text-gray-600 ml-auto">{warn.field}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ValidationPanel;
