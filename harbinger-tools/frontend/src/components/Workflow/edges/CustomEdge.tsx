import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';

const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const status = (data as Record<string, unknown>)?.status as string | undefined;

  let strokeColor = '#1a1a2e';
  let strokeWidth = 2;
  let dashArray: string | undefined;
  let animate = false;

  if (status === 'running') {
    strokeColor = '#f0c040';
    strokeWidth = 2.5;
    dashArray = '8 4';
    animate = true;
  } else if (status === 'error') {
    strokeColor = '#ef4444';
    strokeWidth = 2.5;
  } else if (status === 'success') {
    strokeColor = '#22c55e';
  } else if (selected) {
    strokeColor = '#f0c040';
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: dashArray,
        }}
      />
      {animate && (
        <circle r="3" fill="#f0c040">
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {status === 'error' && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="text-red-400 text-[10px] font-mono bg-[#0d0d15] px-1 rounded border border-red-500/30"
          >
            ERROR
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;
