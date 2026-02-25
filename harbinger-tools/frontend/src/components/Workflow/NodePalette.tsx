import React from 'react';

const tools = {
  Recon: ['Nmap', 'Sublist3r', 'Amass'],
  Web: ['Nikto', 'Wapiti', 'Burp Suite'],
  Cloud: ['CloudMapper', 'Prowler'],
  OSINT: ['Maltego', 'theHarvester'],
  Binary: ['Ghidra', 'IDA Pro'],
  Reporting: ['Dradis', 'Faraday'],
};

const NodePalette: React.FC = () => {
  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: string, toolName?: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (toolName) {
      event.dataTransfer.setData('application/toolname', toolName);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 p-4 bg-[#0d0d15] border-r border-[#1a1a2e] text-white font-mono">
      <h3 className="text-lg font-bold mb-4 text-[#f0c040]">Tool Palette</h3>
      {Object.entries(tools).map(([category, toolList]) => (
        <div key={category} className="mb-4">
          <h4 className="text-md font-semibold mb-2">{category}</h4>
          {toolList.map((tool) => (
            <div
              key={tool}
              className="p-2 mb-2 bg-gray-700 rounded cursor-grab hover:bg-gray-600"
              onDragStart={(event) => onDragStart(event, 'toolNode', tool)}
              draggable
            >
              {tool}
            </div>
          ))}
        </div>
      ))}
      <h4 className="text-md font-semibold mb-2 mt-4">Other Nodes</h4>
      <div
        className="p-2 mb-2 bg-gray-700 rounded cursor-grab hover:bg-gray-600"
        onDragStart={(event) => onDragStart(event, 'agentNode')}
        draggable
      >
        Agent Node
      </div>
      <div
        className="p-2 mb-2 bg-gray-700 rounded cursor-grab hover:bg-gray-600"
        onDragStart={(event) => onDragStart(event, 'decisionNode')}
        draggable
      >
        Decision Node
      </div>
      <div
        className="p-2 mb-2 bg-gray-700 rounded cursor-grab hover:bg-gray-600"
        onDragStart={(event) => onDragStart(event, 'triggerNode')}
        draggable
      >
        Trigger Node
      </div>
      <div
        className="p-2 mb-2 bg-gray-700 rounded cursor-grab hover:bg-gray-600"
        onDragStart={(event) => onDragStart(event, 'outputNode')}
        draggable
      >
        Output Node
      </div>
    </aside>
  );
};

export default NodePalette;
