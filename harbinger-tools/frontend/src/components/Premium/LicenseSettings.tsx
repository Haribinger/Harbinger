import React, { useState } from 'react';
import { licenseManager, LicenseTier } from '../../core/license';

const LicenseSettings: React.FC = () => {
  const [licenseKey, setLicenseKey] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const currentLicense = licenseManager.getLicense();

  const handleActivate = () => {
    const result = licenseManager.activate(licenseKey);
    setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
    if (result.success) { setLicenseKey(''); setTimeout(() => window.location.reload(), 1500); }
  };

  const tiers: { tier: LicenseTier; price: string; desc: string }[] = [
    { tier: 'free', price: '$0', desc: '2 agents, 5 targets, basic recon' },
    { tier: 'solo', price: '$49/mo', desc: '4 agents, 25 targets, autonomous hunting' },
    { tier: 'pro', price: '$99/mo', desc: '6 agents, 100 targets, Caido, knowledge graph' },
    { tier: 'redteam', price: '$299/mo', desc: '12 agents, 500 targets, C2, VPS, playbooks' },
    { tier: 'enterprise', price: 'Custom', desc: 'Unlimited everything, SSO, RBAC' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg p-6">
        <h2 className="text-lg font-mono text-white mb-4">LICENSE</h2>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-gray-400 font-mono text-sm">Current Tier:</span>
          <span className="px-3 py-1 bg-[#f0c040]/10 text-[#f0c040] font-mono font-bold text-sm rounded">
            {currentLicense.tier.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-3 mb-4">
          <input type="text" value={licenseKey} onChange={e => setLicenseKey(e.target.value)}
            placeholder="HBG-XXXX-XXXX-XXXX-XXXX"
            className="flex-1 bg-[#0d0d15] border border-[#1a1a2e] rounded px-4 py-2 text-white font-mono text-sm placeholder-gray-600" />
          <button onClick={handleActivate}
            className="px-6 py-2 bg-[#f0c040] text-black font-mono font-bold text-sm rounded hover:bg-[#f0c040]/90 transition-colors">
            ACTIVATE
          </button>
        </div>
        {message && <p className={`font-mono text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>}
      </div>
      <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg p-6">
        <h2 className="text-lg font-mono text-white mb-4">PLANS</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {tiers.map(t => (
            <div key={t.tier} className={`p-4 rounded-lg border transition-colors ${currentLicense.tier === t.tier ? 'border-[#f0c040] bg-[#f0c040]/5' : 'border-[#1a1a2e] bg-[#0d0d15] hover:border-gray-600'}`}>
              <div className="font-mono text-white font-bold text-sm mb-1">{t.tier.toUpperCase()}</div>
              <div className="font-mono text-[#f0c040] text-lg font-bold mb-2">{t.price}</div>
              <div className="font-mono text-gray-500 text-xs">{t.desc}</div>
              {currentLicense.tier === t.tier && <div className="mt-3 text-xs font-mono text-green-400">ACTIVE</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LicenseSettings;
