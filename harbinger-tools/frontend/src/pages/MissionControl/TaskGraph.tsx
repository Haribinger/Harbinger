import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { MissionTask } from '../../api/missions'

// ── Design tokens (Obsidian Command) ─────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  created:  { bg: '#1a1a2e', border: '#374151', text: '#9ca3af' },
  queued:   { bg: '#1a1a2e', border: '#f0c040', text: '#f0c040' },
  running:  { bg: '#0d2818', border: '#22c55e', text: '#22c55e' },
  finished: { bg: '#0d1f0d', border: '#16a34a', text: '#16a34a' },
  failed:   { bg: '#2d0d0d', border: '#ef4444', text: '#ef4444' },
  waiting:  { bg: '#2d1f00', border: '#f0c040', text: '#f0c040' },
  skipped:  { bg: '#1a1a2e', border: '#555555', text: '#555555' },
}

const DEFAULT_STATUS = STATUS_COLORS.created

// ── Task Node ────────────────────────────────────────────────────────────────

interface TaskNodeData {
  label: string
  status: string
  agent: string
  taskId: number
  approvalRequired: boolean
  [key: string]: unknown
}

function TaskNode({ data }: NodeProps<Node<TaskNodeData>>) {
  const colors = STATUS_COLORS[data.status] || DEFAULT_STATUS
  const isRunning = data.status === 'running'
  const isWaiting = data.status === 'waiting'

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        padding: '8px 12px',
        minWidth: 180,
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        fontSize: 11,
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#374151' }} />

      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: colors.border,
            boxShadow: isRunning ? `0 0 6px ${colors.border}` : 'none',
            animation: isRunning ? 'pulse 1.5s infinite' : 'none',
          }}
        />
        <span style={{ color: colors.text, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {data.status}
        </span>
        {data.approvalRequired && (
          <span style={{ color: '#f0c040', fontSize: 10 }}>⚠ GATE</span>
        )}
      </div>

      {/* Task title */}
      <div style={{ color: '#fff', fontWeight: 500, marginBottom: 2, lineHeight: 1.3 }}>
        {data.label}
      </div>

      {/* Agent codename */}
      <div style={{ color: '#9ca3af', fontSize: 10 }}>
        {data.agent || 'unassigned'}
      </div>

      {isWaiting && (
        <div style={{
          marginTop: 4,
          padding: '2px 6px',
          background: '#2d1f00',
          border: '1px solid #f0c040',
          borderRadius: 3,
          color: '#f0c040',
          fontSize: 9,
          textAlign: 'center',
        }}>
          AWAITING APPROVAL
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#374151' }} />
    </div>
  )
}

const nodeTypes = { task: TaskNode }

// ── Layout: auto-position tasks in a DAG ─────────────────────────────────────

function layoutTasksAsDAG(tasks: MissionTask[]): { nodes: Node<TaskNodeData>[]; edges: Edge[] } {
  if (!tasks.length) return { nodes: [], edges: [] }

  const taskMap = new Map(tasks.map((t) => [t.id, t]))

  // Topological layer assignment (same algorithm as Python scheduler)
  const inDegree = new Map<number, number>()
  const dependents = new Map<number, number[]>()

  for (const t of tasks) {
    inDegree.set(t.id, 0)
    dependents.set(t.id, [])
  }

  for (const t of tasks) {
    for (const depId of t.depends_on || []) {
      if (taskMap.has(depId)) {
        dependents.get(depId)!.push(t.id)
        inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1)
      }
    }
  }

  const layers: number[][] = []
  let ready = tasks.filter((t) => (inDegree.get(t.id) || 0) === 0).map((t) => t.id)

  while (ready.length > 0) {
    layers.push([...ready])
    const nextReady: number[] = []
    for (const tid of ready) {
      for (const dep of dependents.get(tid) || []) {
        const newDeg = (inDegree.get(dep) || 1) - 1
        inDegree.set(dep, newDeg)
        if (newDeg === 0) nextReady.push(dep)
      }
    }
    ready = nextReady
  }

  // Position nodes: X by layer index within row, Y by layer depth
  const NODE_W = 220
  const NODE_H = 100
  const GAP_X = 40
  const GAP_Y = 30

  const nodes: Node<TaskNodeData>[] = []
  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx]
    const totalWidth = layer.length * NODE_W + (layer.length - 1) * GAP_X
    const startX = -totalWidth / 2

    for (let i = 0; i < layer.length; i++) {
      const task = taskMap.get(layer[i])!
      nodes.push({
        id: String(task.id),
        type: 'task',
        position: {
          x: startX + i * (NODE_W + GAP_X),
          y: layerIdx * (NODE_H + GAP_Y),
        },
        data: {
          label: task.title,
          status: task.status,
          agent: task.agent_codename || '',
          taskId: task.id,
          approvalRequired: task.approval_required,
        },
      })
    }
  }

  // Edges from depends_on
  const edges: Edge[] = []
  for (const task of tasks) {
    for (const depId of task.depends_on || []) {
      if (taskMap.has(depId)) {
        edges.push({
          id: `e-${depId}-${task.id}`,
          source: String(depId),
          target: String(task.id),
          style: { stroke: '#374151', strokeWidth: 1.5 },
          animated: taskMap.get(depId)?.status === 'running',
        })
      }
    }
  }

  return { nodes, edges }
}

// ── TaskGraph Component ──────────────────────────────────────────────────────

interface TaskGraphProps {
  tasks: MissionTask[]
  onTaskClick?: (taskId: number) => void
}

export default function TaskGraph({ tasks, onTaskClick }: TaskGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => layoutTasksAsDAG(tasks),
    [tasks]
  )

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const taskId = Number(node.id)
      if (onTaskClick && !isNaN(taskId)) onTaskClick(taskId)
    },
    [onTaskClick]
  )

  if (!tasks.length) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#555',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 13,
      }}>
        No tasks in mission DAG
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      proOptions={{ hideAttribution: true }}
      style={{ background: '#0a0a0f' }}
    >
      <Background color="#1a1a2e" gap={20} size={1} />
      <Controls
        style={{ background: '#0d0d15', border: '1px solid #1a1a2e', borderRadius: 6 }}
      />
    </ReactFlow>
  )
}
