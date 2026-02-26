/**
 * harbinger agents — All agent commands consolidated
 */

import { C, ICON, table, nl, section, box } from '../ui.js';
import { apiFetch } from '../api.js';

export async function listAgents() {
  section('REGISTERED AGENTS');
  const data = await apiFetch('/api/agents');
  const agents = Array.isArray(data) ? data : (data?.items || []);

  if (agents.length === 0) {
    console.log(`\n  ${ICON.info} No agents registered.`);
    console.log(`  Create one: ${C.gold('harbinger agents:create <template>')}\n`);
    return;
  }

  nl();
  const rows = agents.map(a => {
    const statusColor = ['running', 'online', 'working'].includes(a.status) ? C.success :
                        a.status === 'error' ? C.danger : C.warn;
    return [
      C.dim((a.id || '?').slice(0, 8)),
      C.white(a.name || '?'),
      a.type || '?',
      statusColor(a.status || '?'),
      C.gold(a.codename || ''),
    ];
  });
  table(['ID', 'NAME', 'TYPE', 'STATUS', 'CODENAME'], rows);
  nl();
}

export async function listTemplates() {
  section('AGENT TEMPLATES');
  const data = await apiFetch('/api/agents/templates');
  const templates = Array.isArray(data) ? data : [];

  if (templates.length === 0) {
    console.log(`\n  ${ICON.info} No templates available.\n`);
    return;
  }

  nl();
  for (const t of templates) {
    console.log(`  ${C.gold(t.name)} ${C.dim(`(${t.type})`)}`);
    if (t.description) console.log(`  ${C.dim(t.description)}`);
    if (t.capabilities?.length) console.log(`  ${C.dim('Tools:')} ${t.capabilities.join(', ')}`);
    nl();
  }
}

export async function spawnAgent(agentId) {
  if (!agentId) {
    console.error(`\n  ${ICON.fail} Usage: ${C.gold('harbinger agents:spawn <id>')}\n`);
    process.exit(1);
  }
  console.log(`\n  ${ICON.work} Spawning agent ${C.gold(agentId)}...`);
  const result = await apiFetch(`/api/agents/${agentId}/spawn`, { method: 'POST' });
  if (result.ok || result.containerId) {
    console.log(`  ${ICON.ok} Agent spawned. Container: ${C.dim(result.containerId || 'pending')}\n`);
  } else {
    console.error(`  ${ICON.fail} ${result.error || JSON.stringify(result)}\n`);
  }
}

export async function stopAgent(agentId) {
  if (!agentId) {
    console.error(`\n  ${ICON.fail} Usage: ${C.gold('harbinger agents:stop <id>')}\n`);
    process.exit(1);
  }
  console.log(`\n  ${ICON.work} Stopping agent ${C.gold(agentId)}...`);
  const result = await apiFetch(`/api/agents/${agentId}/stop`, { method: 'POST' });
  if (result.ok) {
    console.log(`  ${ICON.ok} Agent stopped.\n`);
  } else {
    console.error(`  ${ICON.fail} ${result.error || JSON.stringify(result)}\n`);
  }
}

export async function agentLogs(agentId) {
  if (!agentId) {
    console.error(`\n  ${ICON.fail} Usage: ${C.gold('harbinger agents:logs <id>')}\n`);
    process.exit(1);
  }
  const result = await apiFetch(`/api/agents/${agentId}/logs`);
  if (result.logs) {
    console.log(result.logs);
  } else if (Array.isArray(result)) {
    for (const line of result) console.log(line.message || line);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

export async function createAgent(templateName) {
  if (!templateName) {
    console.error(`\n  ${ICON.fail} Usage: ${C.gold('harbinger agents:create <template-name>')}`);
    console.error(`  Run ${C.gold('harbinger agents:templates')} to see available templates.\n`);
    process.exit(1);
  }

  const templates = await apiFetch('/api/agents/templates');
  const tmpl = (Array.isArray(templates) ? templates : []).find(
    t => t.name?.toLowerCase() === templateName.toLowerCase() ||
         t.type?.toLowerCase() === templateName.toLowerCase() ||
         t.id === templateName
  );

  if (!tmpl) {
    console.error(`\n  ${ICON.fail} Template "${templateName}" not found.`);
    const names = (Array.isArray(templates) ? templates : []).map(t => t.name || t.type);
    console.error(`  Available: ${C.dim(names.join(', '))}\n`);
    process.exit(1);
  }

  console.log(`\n  ${ICON.work} Creating agent from template: ${C.gold(tmpl.name)}...`);
  const result = await apiFetch('/api/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: tmpl.name,
      type: tmpl.type,
      description: tmpl.description,
      codename: tmpl.codename || tmpl.name?.toUpperCase(),
      color: tmpl.color || '#f0c040',
      capabilities: tmpl.capabilities || [],
      config: tmpl.config || {},
    }),
  });

  if (result.id || result.ok) {
    console.log(`  ${ICON.ok} Agent created: ${C.gold(result.id || result.name)}\n`);
  } else {
    console.error(`  ${ICON.fail} ${result.error || JSON.stringify(result)}\n`);
  }
}
