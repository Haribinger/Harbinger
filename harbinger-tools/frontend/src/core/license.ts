/*
 * Harbinger License & Feature Gate System
 * Controls access to premium features based on license tier.
 * Free tier is genuinely useful — premium unlocks power features.
 */

export type LicenseTier = 'free' | 'solo' | 'pro' | 'redteam' | 'enterprise';

export interface License {
  tier: LicenseTier;
  key: string | null;
  expiresAt: string | null;
  maxAgents: number;
  maxTargets: number;
  features: string[];
}

const TIER_CONFIG: Record<LicenseTier, Omit<License, 'key' | 'expiresAt'>> = {
  free: {
    tier: 'free',
    maxAgents: 2,
    maxTargets: 5,
    features: ['basic-recon', 'manual-scanning', 'single-agent', 'community-skills', 'local-storage', 'basic-reporting'],
  },
  solo: {
    tier: 'solo',
    maxAgents: 4,
    maxTargets: 25,
    features: ['basic-recon', 'manual-scanning', 'autonomous-hunting', 'multi-agent', 'community-skills', 'premium-skills', 'local-storage', 'basic-reporting', 'auto-reports', 'target-sync', 'roi-tracking', 'cve-alerts', 'duplicate-detection'],
  },
  pro: {
    tier: 'pro',
    maxAgents: 6,
    maxTargets: 100,
    features: ['basic-recon', 'manual-scanning', 'autonomous-hunting', 'multi-agent', 'community-skills', 'premium-skills', 'local-storage', 'cloud-storage', 'basic-reporting', 'auto-reports', 'target-sync', 'roi-tracking', 'cve-alerts', 'duplicate-detection', 'multi-campaign', 'agent-customization', 'caido-integration', 'knowledge-graph', 'export-reports', 'webhook-alerts', 'n8n-workflows'],
  },
  redteam: {
    tier: 'redteam',
    maxAgents: 12,
    maxTargets: 500,
    features: ['basic-recon', 'manual-scanning', 'autonomous-hunting', 'multi-agent', 'community-skills', 'premium-skills', 'local-storage', 'cloud-storage', 'basic-reporting', 'auto-reports', 'target-sync', 'roi-tracking', 'cve-alerts', 'duplicate-detection', 'multi-campaign', 'agent-customization', 'caido-integration', 'knowledge-graph', 'export-reports', 'webhook-alerts', 'n8n-workflows', 'c2-integration', 'vps-orchestration', 'playbooks', 'team-collaboration', 'compliance-reports', 'custom-docker-agents', 'proxy-chains'],
  },
  enterprise: {
    tier: 'enterprise',
    maxAgents: -1,
    maxTargets: -1,
    features: ['all', 'sso-saml', 'rbac', 'dedicated-instance', 'sla-support', 'custom-agents', 'audit-logging', 'api-access', 'white-label'],
  },
};

class LicenseManager {
  private license: License;

  constructor() {
    this.license = this.loadLicense();
  }

  private loadLicense(): License {
    const saved = localStorage.getItem('harbinger_license');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (this.validateKey(parsed.key)) {
          return { ...TIER_CONFIG[parsed.tier as LicenseTier], key: parsed.key, expiresAt: parsed.expiresAt };
        }
      } catch { /* corrupted, fall through */ }
    }
    return { ...TIER_CONFIG.free, key: null, expiresAt: null };
  }

  private validateKey(key: string): boolean {
    if (!key || key.length < 20) return false;
    return key.startsWith('HBG-');
  }

  activate(key: string): { success: boolean; tier: LicenseTier; message: string } {
    if (!this.validateKey(key)) {
      return { success: false, tier: 'free', message: 'Invalid license key format. Keys start with HBG-' };
    }
    const tierMap: Record<string, LicenseTier> = { 'HBG-SOLO': 'solo', 'HBG-PRO-': 'pro', 'HBG-RED-': 'redteam', 'HBG-ENT-': 'enterprise' };
    let detectedTier: LicenseTier = 'solo';
    for (const [prefix, tier] of Object.entries(tierMap)) {
      if (key.startsWith(prefix)) { detectedTier = tier; break; }
    }
    const config = TIER_CONFIG[detectedTier];
    this.license = { ...config, key, expiresAt: null };
    localStorage.setItem('harbinger_license', JSON.stringify({ tier: detectedTier, key, expiresAt: null }));
    return { success: true, tier: detectedTier, message: `Activated ${detectedTier} license` };
  }

  hasFeature(feature: string): boolean {
    if (this.license.features.includes('all')) return true;
    return this.license.features.includes(feature);
  }

  getTier(): LicenseTier { return this.license.tier; }
  getLicense(): License { return { ...this.license }; }
  getTierConfig(tier: LicenseTier) { return TIER_CONFIG[tier]; }
  getAllTiers() { return TIER_CONFIG; }
}

export const licenseManager = new LicenseManager();
export { TIER_CONFIG };
