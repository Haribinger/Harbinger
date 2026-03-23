import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useKnowledgeGraphStore } from '../../store/knowledgeGraphStore'

// ── Node type colors ────────────────────────────────────────────────────────

const LABEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Host:          { bg: '#0d1f2e', border: '#00d4ff', text: '#00d4ff' },
  Service:       { bg: '#0d2818', border: '#22c55e', text: '#22c55e' },
  Vulnerability: { bg: '#2d0d0d', border: '#ef4444', text: '#ef4444' },
  Technique:     { bg: '#2d1f00', border: '#f0c040', text: '#f0c040' },
  Credential:    { bg: '#1f0d2d', border: '#a855f7', text: '#a855f7' },
  Agent:         { bg: '#1a1a0a', border: '#f0c040', text: '#f0c040' },
  Mission:       { bg: '#0d0d2e', border: '#6366f1', text: '#6366f1' },
}

const DEFAULT_COLOR = { bg: '#1a1a2e', border: '#555', text: '#9ca3af' }

// ── Custom node ─────────────────────────────────────────────────────────────

function GraphNodeComponent({ data }: { data: { label: string; nodeLabel: string; properties: Record<string, unknown> } }) {
  const color = LABEL_COLORS[data.nodeLabel] || DEFAULT_COLOR
  const displayProps = Object.entries(data.properties)
    .filter(([k]) => !['_id', 'element_id', 'embedding'].includes(k))
    .slice(0, 4)

  return (
    <div className="px-3 py-2 rounded border font-mono text-xs min-w-[140px] max-w-[220px]"
      style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}>
      <Handle type="target" position={Position.Top} className="!bg-[#555] !w-2 !h-2" />
      <div className="text-[10px] uppercase opacity-60 mb-0.5">{data.nodeLabel}</div>
      <div className="font-bold truncate">{data.label}</div>
      {displayProps.map(([k, v]) => (
        <div key={k} className="text-[10px] opacity-50 truncate">{k}: {String(v)}</div>
      ))}
      <Handle type="source" position={Position.Bottom} className="!bg-[#555] !w-2 !h-2" />
    </div>
  )
}

const nodeTypes: NodeTypes = { graphNode: GraphNodeComponent }

// ── Main component ──────────────────────────────────────────────────────────

export default function KnowledgeGraph() {
  const {
    stats, searchResults, neighbors, selectedNode, isLoading, error,
    searchQuery, selectedLabel,
    setFilter, fetchStats, searchGraph, getNeighbors, selectNode,
  } = useKnowledgeGraphStore()

  const [localQuery, setLocalQuery] = useState('')

  useEffect(() => { fetchStats() }, [fetchStats])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (localQuery.trim()) {
      searchGraph(localQuery.trim(), selectedLabel || undefined)
    }
  }, [localQuery, selectedLabel, searchGraph])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const data = node.data as { nodeLabel: string; properties: Record<string, unknown> }
    const keyProp = data.properties.ip || data.properties.hostname || data.properties.id || data.properties.name
    if (keyProp) {
      getNeighbors(data.nodeLabel, Object.keys(data.properties)[0], String(keyProp), 2)
    }
  }, [getNeighbors])

  // Build React Flow nodes/edges from neighbors
  const { nodes, edges } = useMemo(() => {
    if (!neighbors) return { nodes: [] as Node[], edges: [] as Edge[] }

    const nodeMap = new Map<string, Node>()
    const edgeList: Edge[] = []

    // Add neighbor nodes in a circle layout
    neighbors.nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(neighbors.nodes.length, 1)
      const radius = 250
      const id = `${n.label}_${JSON.stringify(n.properties).slice(0, 50)}`
      const displayName = String(n.properties.ip || n.properties.hostname || n.properties.id || n.properties.name || n.label)

      nodeMap.set(id, {
        id,
        type: 'graphNode',
        position: { x: 400 + radius * Math.cos(angle), y: 300 + radius * Math.sin(angle) },
        data: { label: displayName, nodeLabel: n.label, properties: n.properties },
      })
    })

    // Add edges from relations
    neighbors.relations.forEach((r, i) => {
      const sourceId = `${r.from_label}_${JSON.stringify({ [r.from_key]: r.from_val }).slice(0, 50)}`
      const targetId = `${r.to_label}_${JSON.stringify({ [r.to_key]: r.to_val }).slice(0, 50)}`

      // Ensure source/target nodes exist
      if (!nodeMap.has(sourceId)) {
        nodeMap.set(sourceId, {
          id: sourceId,
          type: 'graphNode',
          position: { x: 200 + i * 30, y: 100 },
          data: { label: r.from_val, nodeLabel: r.from_label, properties: { [r.from_key]: r.from_val } },
        })
      }
      if (!nodeMap.has(targetId)) {
        nodeMap.set(targetId, {
          id: targetId,
          type: 'graphNode',
          position: { x: 600 + i * 30, y: 500 },
          data: { label: r.to_val, nodeLabel: r.to_label, properties: { [r.to_key]: r.to_val } },
        })
      }

      edgeList.push({
        id: `e_${i}`,
        source: sourceId,
        target: targetId,
        label: r.rel_type,
        labelStyle: { fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' },
        style: { stroke: '#555', strokeWidth: 1.5 },
        animated: r.rel_type === 'HAS_VULN',
      })
    })

    return { nodes: Array.from(nodeMap.values()), edges: edgeList }
  }, [neighbors])

  const nodeLabels = stats ? Object.keys(stats.labels) : []

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a2e]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-mono font-bold text-[#f0c040]">KNOWLEDGE GRAPH</h1>
          <span className="text-xs text-gray-500 font-mono">Neo4j Entity Explorer</span>
        </div>
        {stats && (
          <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
            <span>{stats.total_nodes} nodes</span>
            <span>{stats.total_relationships} relations</span>
            {Object.entries(stats.labels).map(([label, count]) => (
              <span key={label} style={{ color: (LABEL_COLORS[label] || DEFAULT_COLOR).text }}>
                {label}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-[#1a1a2e] bg-[#0d0d15]">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <select value={selectedLabel} onChange={e => setFilter('selectedLabel', e.target.value)}
            className="bg-[#0a0a0f] border border-[#1a1a2e] text-gray-300 text-xs font-mono rounded px-2 py-1.5 w-36">
            <option value="">All labels</option>
            {nodeLabels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input type="text" value={localQuery} onChange={e => setLocalQuery(e.target.value)}
            placeholder="Search entities..." autoComplete="off" spellCheck={false}
            className="flex-1 bg-[#0a0a0f] border border-[#1a1a2e] text-white font-mono text-sm rounded px-3 py-1.5 placeholder:text-gray-700 focus:outline-none focus:border-[#f0c040]" />
          <button type="submit" className="px-4 py-1.5 bg-[#f0c040] text-black text-xs font-mono font-bold rounded hover:bg-[#f0c040]/90">
            SEARCH
          </button>
        </form>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Graph visualization */}
        <div className="flex-1" style={{ backgroundColor: '#0a0a0f' }}>
          {nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 font-mono text-sm">
              <div className="text-center">
                <div className="text-2xl mb-2">🕸</div>
                <div>Search for entities or select a node to explore the graph</div>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              proOptions={{ hideAttribution: true }}
              style={{ backgroundColor: '#0a0a0f' }}
              minZoom={0.2}
              maxZoom={3}
            >
              <Background color="#1a1a2e" gap={20} size={1} />
              <Controls className="!bg-[#0d0d15] !border-[#1a1a2e] [&>button]:!bg-[#0d0d15] [&>button]:!border-[#1a1a2e] [&>button]:!text-white" />
            </ReactFlow>
          )}
        </div>

        {/* Search results sidebar */}
        {searchResults.length > 0 && (
          <div className="w-64 border-l border-[#1a1a2e] overflow-y-auto bg-[#0d0d15]">
            <div className="px-3 py-2 border-b border-[#1a1a2e]">
              <div className="text-xs font-mono text-gray-500 uppercase">Results ({searchResults.length})</div>
            </div>
            {searchResults.map((r, i) => {
              const color = LABEL_COLORS[r.label] || DEFAULT_COLOR
              const name = String(r.properties.ip || r.properties.hostname || r.properties.id || r.properties.name || r.label)
              return (
                <div key={i} className="px-3 py-2 border-b border-[#1a1a2e]/30 hover:bg-[#1a1a2e]/30 cursor-pointer"
                  onClick={() => {
                    const keyProp = Object.keys(r.properties)[0]
                    if (keyProp) getNeighbors(r.label, keyProp, String(r.properties[keyProp]), 2)
                  }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1 rounded" style={{ backgroundColor: color.bg, color: color.text }}>
                      {r.label}
                    </span>
                    <span className="text-xs font-mono text-white truncate">{name}</span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-600 mt-0.5">score: {r.score.toFixed(3)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="absolute bottom-4 right-4 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-xs font-mono px-3 py-2 rounded max-w-sm">
          {error}
        </div>
      )}
    </div>
  )
}
