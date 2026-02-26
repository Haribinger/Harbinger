/**
 * harbinger channels — List configured channels.
 */

import { C, ICON, section, nl } from '../ui.js';
import { apiFetch } from '../api.js';

export default async function channelsCommand() {
  section('CONFIGURED CHANNELS');
  nl();

  const ch = await apiFetch('/api/channels');

  for (const [name, config] of Object.entries(ch)) {
    const c = config;
    const icon = c.enabled ? ICON.ok : ICON.fail;
    const status = c.enabled ? C.success(c.status || 'enabled') : C.danger('disabled');
    const tokenNote = c.hasToken ? '' : C.dim(' (no token)');
    console.log(`  ${icon} ${C.white(name.charAt(0).toUpperCase() + name.slice(1))}  ${status}${tokenNote}`);
  }
  nl();
}
