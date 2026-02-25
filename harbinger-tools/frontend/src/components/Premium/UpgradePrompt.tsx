import React from 'react';
import { LicenseTier, licenseManager } from '../../core/license';

interface UpgradePromptProps {
  feature: string;
  requiredTier: LicenseTier;
}

const TIER_PRICES: Record<LicenseTier, string> = {
  free: '$0', solo: '$49/mo', pro: '$99/mo', redteam: '$299/mo', enterprise: 'Custom',
};

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ feature, requiredTier }) => {
  const currentTier = licenseManager.getTier();
  if (licenseManager.hasFeature(feature)) return null;

  return (
    <div className="bg-[#0d0d15] border border-[#f0c040]/30 rounded-lg p-6 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#f0c040]/10 flex items-center justify-center">
        <svg className="w-6 h-6 text-[#f0c040]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-white font-mono text-lg mb-2">PREMIUM FEATURE</h3>
      <p className="text-gray-400 font-mono text-sm mb-4">
        <span className="text-[#f0c040]">{feature.replace(/-/g, ' ').toUpperCase()}</span> requires {requiredTier.toUpperCase()} tier or above.
      </p>
      <p className="text-gray-500 font-mono text-xs mb-4">
        Current: {currentTier.toUpperCase()} → Upgrade to: {requiredTier.toUpperCase()} ({TIER_PRICES[requiredTier]})
      </p>
      <button className="px-6 py-2 bg-[#f0c040] text-black font-mono font-bold text-sm rounded hover:bg-[#f0c040]/90 transition-colors">
        UPGRADE TO {requiredTier.toUpperCase()}
      </button>
    </div>
  );
};

export default UpgradePrompt;
