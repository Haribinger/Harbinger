import React, { useState } from 'react';

interface CaidoConfig {
  host: string;
  port: number;
  apiToken: string;
  connected: boolean;
}

const CaidoIntegration: React.FC = () => {
  const [config, setConfig] = useState<CaidoConfig>({
    host: 'localhost',
    port: 8080,
    apiToken: '',
    connected: false,
  });
  const [activeTab, setActiveTab] = useState<'setup' | 'proxy' | 'intercept' | 'replay'>('setup');

  return (
    <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">C</div>
          <h2 className="text-lg font-mono text-white">CAIDO_PROXY</h2>
          <span className={`px-2 py-0.5 rounded text-xs font-mono ${config.connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {config.connected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1a1a2e]">
        {(['setup', 'proxy', 'intercept', 'replay'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-mono uppercase transition-colors ${activeTab === tab ? 'text-[#f0c040] border-b-2 border-[#f0c040]' : 'text-gray-500 hover:text-gray-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'setup' && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm font-mono">Connect Harbinger to your Caido instance via GraphQL API.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-gray-500 uppercase">Host</label>
              <input type="text" value={config.host} onChange={e => setConfig({...config, host: e.target.value})}
                className="w-full bg-[#0d0d15] border border-[#1a1a2e] rounded px-3 py-2 text-white font-mono text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-mono text-gray-500 uppercase">Port</label>
              <input type="number" value={config.port} onChange={e => setConfig({...config, port: parseInt(e.target.value)})}
                className="w-full bg-[#0d0d15] border border-[#1a1a2e] rounded px-3 py-2 text-white font-mono text-sm mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-mono text-gray-500 uppercase">API Token</label>
            <input type="password" value={config.apiToken} onChange={e => setConfig({...config, apiToken: e.target.value})}
              className="w-full bg-[#0d0d15] border border-[#1a1a2e] rounded px-3 py-2 text-white font-mono text-sm mt-1" placeholder="Paste your Caido API token" />
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-[#f0c040] text-black font-mono text-sm font-bold rounded hover:bg-[#f0c040]/90 transition-colors">
              CONNECT
            </button>
            <button className="px-4 py-2 border border-[#1a1a2e] text-gray-400 font-mono text-sm rounded hover:border-gray-500 transition-colors">
              TEST CONNECTION
            </button>
          </div>
          <div className="mt-4 p-3 bg-[#0d0d15] border border-[#1a1a2e] rounded">
            <p className="text-xs font-mono text-gray-500">Don't have Caido? Install it:</p>
            <code className="text-xs font-mono text-[#f0c040] block mt-1">curl -sL https://caido.io/install | sh</code>
            <p className="text-xs font-mono text-gray-500 mt-2">Or run via Docker:</p>
            <code className="text-xs font-mono text-[#f0c040] block mt-1">docker run -p 8080:8080 caido/caido</code>
          </div>
        </div>
      )}

      {activeTab === 'proxy' && (
        <div className="text-center py-8">
          <p className="text-gray-500 font-mono text-sm">Connect to Caido to view proxy traffic</p>
          <p className="text-gray-600 font-mono text-xs mt-2">All HTTP/HTTPS traffic flows through here</p>
        </div>
      )}

      {activeTab === 'intercept' && (
        <div className="text-center py-8">
          <p className="text-gray-500 font-mono text-sm">Intercept and modify requests in real-time</p>
          <p className="text-gray-600 font-mono text-xs mt-2">Forward, drop, or modify any request</p>
        </div>
      )}

      {activeTab === 'replay' && (
        <div className="text-center py-8">
          <p className="text-gray-500 font-mono text-sm">Replay and fuzz requests</p>
          <p className="text-gray-600 font-mono text-xs mt-2">Modify parameters and resend</p>
        </div>
      )}
    </div>
  );
};

export default CaidoIntegration;
