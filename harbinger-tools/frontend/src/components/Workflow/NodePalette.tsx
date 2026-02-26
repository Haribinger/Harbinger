import React, { useState } from 'react';

// Real Harbinger tool catalog organized by category
const TOOL_CATALOG: Record<string, { tools: string[]; color: string }> = {
  Recon: {
    tools: ['subfinder', 'httpx', 'naabu', 'amass', 'dnsx', 'katana', 'gau', 'waybackurls', 'assetfinder'],
    color: '#22c55e',
  },
  Web: {
    tools: ['nuclei', 'sqlmap', 'dalfox', 'ffuf', 'feroxbuster', 'nikto', 'wapiti', 'paramspider', 'arjun'],
    color: '#ef4444',
  },
  Cloud: {
    tools: ['ScoutSuite', 'Prowler', 'Pacu', 'cloudsplaining', 'truffleHog', 's3scanner'],
    color: '#3b82f6',
  },
  OSINT: {
    tools: ['theHarvester', 'Sherlock', 'SpiderFoot', 'Maltego', 'recon-ng', 'photon'],
    color: '#a855f7',
  },
  Binary: {
    tools: ['Ghidra', 'radare2', 'pwntools', 'binwalk', 'ROPgadget', 'checksec'],
    color: '#f97316',
  },
  Browser: {
    tools: ['screenshot', 'navigate', 'execute-js', 'click', 'type-text', 'network-log'],
    color: '#06b6d4',
  },
};

// Agent roster
const AGENTS = [
  { codename: 'PATHFINDER', type: 'recon', color: '#22c55e' },
  { codename: 'BREACH', type: 'web', color: '#ef4444' },
  { codename: 'PHANTOM', type: 'cloud', color: '#3b82f6' },
  { codename: 'SPECTER', type: 'osint', color: '#a855f7' },
  { codename: 'CIPHER', type: 'binary', color: '#f97316' },
  { codename: 'SCRIBE', type: 'report', color: '#f0c040' },
];

// Trigger types
const TRIGGERS = [
  { label: 'Manual Start', type: 'manual', icon: '\u25b6' },
  { label: 'Cron Schedule', type: 'cron', icon: '\u23f0' },
  { label: 'Webhook', type: 'webhook', icon: '\u26a1' },
  { label: 'On Finding', type: 'on-finding', icon: '\ud83d\udea8' },
  { label: 'On Agent Message', type: 'on-agent-message', icon: '\ud83d\udce8' },
  { label: 'On Event', type: 'on-event', icon: '\ud83d\udd14' },
];

// Output types
const OUTPUTS = [
  { label: 'Generate Report', type: 'report', icon: '\ud83d\udcdd' },
  { label: 'Send Notification', type: 'notify', icon: '\ud83d\udce2' },
  { label: 'Save to File', type: 'save', icon: '\ud83d\udcbe' },
  { label: 'Broadcast to Agents', type: 'broadcast', icon: '\ud83d\udce1' },
  { label: 'Webhook Out', type: 'webhook-out', icon: '\u26a1' },
];

type PaletteSection = 'tools' | 'agents' | 'flow' | 'data';

const NodePalette: React.FC = () => {
  const [activeSection, setActiveSection] = useState<PaletteSection>('tools');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Recon');
  const [searchQuery, setSearchQuery] = useState('');

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: string, extra?: Record<string, string>) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => {
        event.dataTransfer.setData(`application/${k}`, v);
      });
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const sections: { id: PaletteSection; label: string }[] = [
    { id: 'tools', label: 'Tools' },
    { id: 'agents', label: 'Agents' },
    { id: 'flow', label: 'Flow' },
    { id: 'data', label: 'Data' },
  ];

  // Filter tools by search
  const filterTools = (tools: string[]) => {
    if (!searchQuery) return tools;
    return tools.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  return (
    <aside className="w-64 flex flex-col bg-[#0d0d15] border-r border-[#1a1a2e] text-white font-mono overflow-hidden">
      {/* Section tabs */}
      <div className="flex border-b border-[#1a1a2e]">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeSection === s.id
                ? 'text-[#f0c040] border-b-2 border-[#f0c040]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="p-2 border-b border-[#1a1a2e]">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0a0a0f] border border-[#1a1a2e] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#f0c040]/50"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Tools Section */}
        {activeSection === 'tools' && (
          <div className="space-y-1">
            {Object.entries(TOOL_CATALOG).map(([category, { tools, color }]) => {
              const filtered = filterTools(tools);
              if (searchQuery && filtered.length === 0) return null;
              return (
                <div key={category}>
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#1a1a2e] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs font-medium">{category}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{filtered.length}</span>
                  </button>
                  {(expandedCategory === category || searchQuery) && (
                    <div className="ml-4 space-y-0.5 mt-0.5">
                      {filtered.map((tool) => (
                        <div
                          key={tool}
                          className="px-2 py-1.5 rounded text-xs cursor-grab hover:bg-[#1a1a2e] transition-colors flex items-center gap-2 border border-transparent hover:border-[#1a1a2e]"
                          onDragStart={(e) => onDragStart(e, 'toolNode', { toolname: tool, category })}
                          draggable
                        >
                          <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: color }} />
                          <span className="text-gray-300">{tool}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Agents Section */}
        {activeSection === 'agents' && (
          <div className="space-y-1">
            {AGENTS.filter(a => !searchQuery || a.codename.toLowerCase().includes(searchQuery.toLowerCase())).map((agent) => (
              <div
                key={agent.codename}
                className="px-3 py-2 rounded-lg cursor-grab hover:bg-[#1a1a2e] transition-colors border border-transparent hover:border-[#1a1a2e]"
                onDragStart={(e) => onDragStart(e, 'agentNode', { toolname: agent.codename, category: agent.type })}
                draggable
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: agent.color + '20', color: agent.color, border: `1px solid ${agent.color}40` }}>
                    {agent.codename[0]}
                  </div>
                  <div>
                    <span className="text-xs font-bold">{agent.codename}</span>
                    <p className="text-[10px] text-gray-500 capitalize">{agent.type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Flow Control Section */}
        {activeSection === 'flow' && (
          <div className="space-y-3">
            {/* Triggers */}
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-gray-500 px-2 mb-1">Triggers</h4>
              {TRIGGERS.filter(t => !searchQuery || t.label.toLowerCase().includes(searchQuery.toLowerCase())).map((trigger) => (
                <div
                  key={trigger.type}
                  className="px-3 py-2 rounded cursor-grab hover:bg-[#1a1a2e] transition-colors border border-transparent hover:border-green-500/20 flex items-center gap-2"
                  onDragStart={(e) => onDragStart(e, 'triggerNode', { toolname: trigger.type })}
                  draggable
                >
                  <span className="text-sm">{trigger.icon}</span>
                  <span className="text-xs text-gray-300">{trigger.label}</span>
                </div>
              ))}
            </div>

            {/* Decision */}
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-gray-500 px-2 mb-1">Logic</h4>
              <div
                className="px-3 py-2 rounded cursor-grab hover:bg-[#1a1a2e] transition-colors border border-transparent hover:border-pink-500/20 flex items-center gap-2"
                onDragStart={(e) => onDragStart(e, 'decisionNode')}
                draggable
              >
                <span className="text-sm text-pink-400">\u25c7</span>
                <span className="text-xs text-gray-300">Decision / If-Else</span>
              </div>
            </div>

            {/* Outputs */}
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-gray-500 px-2 mb-1">Outputs</h4>
              {OUTPUTS.filter(o => !searchQuery || o.label.toLowerCase().includes(searchQuery.toLowerCase())).map((output) => (
                <div
                  key={output.type}
                  className="px-3 py-2 rounded cursor-grab hover:bg-[#1a1a2e] transition-colors border border-transparent hover:border-[#f0c040]/20 flex items-center gap-2"
                  onDragStart={(e) => onDragStart(e, 'outputNode', { toolname: output.type })}
                  draggable
                >
                  <span className="text-sm">{output.icon}</span>
                  <span className="text-xs text-gray-300">{output.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data / Variables Section */}
        {activeSection === 'data' && (
          <div className="space-y-3">
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-gray-500 px-2 mb-1">Variables</h4>
              <div
                className="px-3 py-2 rounded cursor-grab hover:bg-[#1a1a2e] transition-colors border border-transparent hover:border-cyan-500/20 flex items-center gap-2"
                onDragStart={(e) => onDragStart(e, 'variableNode')}
                draggable
              >
                <span className="text-sm text-cyan-400">{'{ }'}</span>
                <span className="text-xs text-gray-300">Variable / Transform</span>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-gray-500 px-2 mb-1">Expressions</h4>
              <div className="px-3 py-2 text-[10px] text-gray-500 leading-relaxed space-y-1.5">
                <p className="font-medium text-gray-400">Variable syntax:</p>
                <p className="font-mono bg-[#0a0a0f] rounded px-2 py-1">{'{{nodeId.output}}'}</p>
                <p className="font-mono bg-[#0a0a0f] rounded px-2 py-1">{'{{prev.status}}'}</p>
                <p className="font-mono bg-[#0a0a0f] rounded px-2 py-1">{'{{trigger.data}}'}</p>
                <p className="font-mono bg-[#0a0a0f] rounded px-2 py-1">{'{{env.TARGET}}'}</p>
                <p className="mt-2 font-medium text-gray-400">Filters:</p>
                <p className="font-mono bg-[#0a0a0f] rounded px-2 py-1">{'{{output}} | count'}</p>
                <p className="font-mono bg-[#0a0a0f] rounded px-2 py-1">{'{{output}} | first'}</p>
                <p className="font-mono bg-[#0a0a0f] rounded px-2 py-1">{'{{output}} | uppercase'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default NodePalette;
