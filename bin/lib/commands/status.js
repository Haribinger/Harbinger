/**
 * harbinger status / dashboard — Box-drawn platform health dashboard
 */

import { C, ICON, box, section, statusLine, table, nl, kv } from '../ui.js';
import { apiFetch, getApiBase, isBackendUp } from '../api.js';

export default async function statusCommand() {
  const base = getApiBase();

  // ── Header ──────────────────────────────────────────────────────────
  const now = new Date().toLocaleString();
  box('HARBINGER STATUS', [
    `${C.dim('Timestamp')}   ${C.white(now)}`,
    `${C.dim('API Base')}    ${C.white(base)}`,
  ]);

  // ── Backend health ──────────────────────────────────────────────────
  const up = await isBackendUp();
  if (!up) {
    nl();
    statusLine(ICON.fail, 'Backend', C.danger('OFFLINE'));
    console.log(`\n      Start with: ${C.gold('cd backend && go run ./cmd/')}`);
    console.log(`      Or Docker:  ${C.gold('docker compose up -d')}\n`);
    return;
  }

  // ── Core services ───────────────────────────────────────────────────
  section('CORE SERVICES');
  statusLine(ICON.ok, 'Backend API', C.success('ONLINE'));

  try {
    const health = await apiFetch('/api/dashboard/health');
    if (Array.isArray(health)) {
      for (const svc of health) {
        const ok = svc.status === 'connected';
        statusLine(
          ok ? ICON.ok : ICON.fail,
          svc.name,
          ok ? C.success(`${svc.status} :${svc.port}`) : C.danger(`${svc.status} :${svc.port}`)
        );
      }
    }
  } catch {}

  // ── Frontend ────────────────────────────────────────────────────────
  try {
    const resp = await fetch('http://localhost:3000', { signal: AbortSignal.timeout(2000) });
    statusLine(resp.ok ? ICON.ok : ICON.fail, 'Frontend', resp.ok ? C.success('ONLINE :3000') : C.danger('ERROR'));
  } catch {
    statusLine(ICON.fail, 'Frontend', C.dim('offline'));
  }

  // ── Agents ──────────────────────────────────────────────────────────
  section('AGENTS');
  try {
    const agents = await apiFetch('/api/agents');
    const list = Array.isArray(agents) ? agents : (agents?.items || []);
    const running = list.filter(a => ['running', 'online', 'working'].includes(a.status));
    const errors = list.filter(a => a.status === 'error');

    kv('Registered', String(list.length));
    kv('Active', running.length > 0 ? C.success(String(running.length)) : '0');
    if (errors.length > 0) kv('Errors', C.danger(String(errors.length)));

    if (list.length > 0) {
      nl();
      const rows = list.slice(0, 8).map(a => {
        const statusColor = ['running', 'online', 'working'].includes(a.status) ? C.success :
                            a.status === 'error' ? C.danger : C.warn;
        return [
          C.dim((a.id || '?').slice(0, 8)),
          C.white(a.name || a.codename || '?'),
          a.type || '?',
          statusColor(a.status || '?'),
        ];
      });
      table(['ID', 'NAME', 'TYPE', 'STATUS'], rows);
      if (list.length > 8) console.log(C.dim(`  ... and ${list.length - 8} more`));
    }
  } catch {}

  // ── Channels ────────────────────────────────────────────────────────
  section('CHANNELS');
  try {
    const ch = await apiFetch('/api/channels');
    const active = [];
    if (ch.discord?.enabled) active.push('Discord');
    if (ch.telegram?.enabled) active.push('Telegram');
    if (ch.slack?.enabled) active.push('Slack');
    if (active.length > 0) {
      kv('Active', C.success(active.join(', ')));
    } else {
      kv('Active', C.dim('none configured'));
    }
  } catch {}

  // ── Docker stats ────────────────────────────────────────────────────
  section('DOCKER');
  try {
    const containers = await apiFetch('/api/docker/containers');
    const list = Array.isArray(containers) ? containers : (containers?.items || []);
    const running = list.filter(c => c.state === 'running' || c.status?.toLowerCase().includes('up'));
    kv('Containers', `${running.length} running / ${list.length} total`);
  } catch {
    kv('Docker', C.dim('not connected'));
  }

  nl();
}
