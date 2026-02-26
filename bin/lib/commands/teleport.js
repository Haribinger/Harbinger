/**
 * harbinger teleport — CLI<->UI context switching.
 *
 * --to-ui     Push CLI context to backend, open browser at frontend with teleport param
 * --from-ui   Pull context from backend that was pushed by the UI
 * agent <id>  Open the agent page in the browser
 * workflow <id> Open the workflow editor in the browser
 */

import { C, ICON, box, nl } from '../ui.js';
import { apiFetch, getFrontendUrl } from '../api.js';

async function openBrowser(url) {
  try {
    const open = (await import('open')).default;
    await open(url);
    return true;
  } catch {
    return false;
  }
}

export default async function teleportCommand(args = []) {
  const frontendUrl = getFrontendUrl();

  // ── Shortcut: teleport agent <id> ───────────────────────────────────
  if (args[0] === 'agent' && args[1]) {
    const url = `${frontendUrl}/agents?agentId=${encodeURIComponent(args[1])}`;
    console.log(`\n  ${ICON.work} Opening agent ${C.gold(args[1])} in browser...`);
    const opened = await openBrowser(url);
    if (opened) {
      console.log(`  ${ICON.ok} ${C.dim(url)}\n`);
    } else {
      console.log(`  ${ICON.info} Open: ${C.gold(url)}\n`);
    }
    return;
  }

  // ── Shortcut: teleport workflow <id> ────────────────────────────────
  if (args[0] === 'workflow' && args[1]) {
    const url = `${frontendUrl}/workflow-editor/${encodeURIComponent(args[1])}`;
    console.log(`\n  ${ICON.work} Opening workflow ${C.gold(args[1])} in browser...`);
    const opened = await openBrowser(url);
    if (opened) {
      console.log(`  ${ICON.ok} ${C.dim(url)}\n`);
    } else {
      console.log(`  ${ICON.info} Open: ${C.gold(url)}\n`);
    }
    return;
  }

  // ── teleport --to-ui ────────────────────────────────────────────────
  if (args.includes('--to-ui')) {
    console.log(`\n  ${ICON.work} Gathering CLI context...`);

    // Build context payload from current environment
    const context = {
      type: 'cli-session',
      cwd: process.cwd(),
      timestamp: Date.now(),
      env: {},
    };

    // Include non-sensitive env hints
    const safeKeys = ['NODE_ENV', 'HARBINGER_API', 'HARBINGER_VERSION'];
    for (const k of safeKeys) {
      if (process.env[k]) context.env[k] = process.env[k];
    }

    const result = await apiFetch('/api/teleport/push', {
      method: 'POST',
      body: JSON.stringify(context),
    });

    if (result.ok && result.id) {
      const url = `${frontendUrl}?teleport=${encodeURIComponent(result.id)}`;
      console.log(`  ${ICON.ok} Context pushed: ${C.dim(result.id)}`);
      const opened = await openBrowser(url);
      if (opened) {
        console.log(`  ${ICON.ok} Opened browser\n`);
      } else {
        console.log(`  ${ICON.info} Open: ${C.gold(url)}\n`);
      }
    } else {
      console.error(`  ${ICON.fail} Failed to push context: ${result.error || 'unknown error'}\n`);
    }
    return;
  }

  // ── teleport --from-ui ──────────────────────────────────────────────
  if (args.includes('--from-ui')) {
    const id = args.find(a => a.startsWith('--id='))?.split('=')[1];
    if (!id) {
      console.error(`\n  ${ICON.fail} Usage: ${C.gold('harbinger teleport --from-ui --id=<teleport-id>')}\n`);
      process.exit(1);
    }

    console.log(`\n  ${ICON.work} Pulling context ${C.dim(id)}...`);
    const result = await apiFetch(`/api/teleport/pull?id=${encodeURIComponent(id)}`);

    if (result.ok && result.context) {
      box('TELEPORT RECEIVED', [
        `${C.dim('Type')}       ${C.white(result.context.type || 'unknown')}`,
        `${C.dim('Timestamp')}  ${C.white(new Date(result.context.timestamp).toLocaleString())}`,
        `${C.dim('CWD')}        ${C.white(result.context.cwd || '?')}`,
      ]);
      if (result.context.data) {
        console.log(`\n  ${C.dim('Data:')}`);
        console.log(JSON.stringify(result.context.data, null, 2));
      }
    } else if (result.error === 'not_found' || result.error === 'expired') {
      console.log(`  ${ICON.warn} Context not found or expired.\n`);
    } else {
      console.error(`  ${ICON.fail} ${result.error || 'Failed to pull context'}\n`);
    }
    return;
  }

  // ── Default: show help ──────────────────────────────────────────────
  box('TELEPORT', [
    `${C.dim('Switches context between CLI and Web UI')}`,
    '',
    `${C.gold('harbinger teleport --to-ui')}`,
    `  Push current context → open in browser`,
    '',
    `${C.gold('harbinger teleport --from-ui --id=<id>')}`,
    `  Pull context from Web UI into CLI`,
    '',
    `${C.gold('harbinger teleport agent <id>')}`,
    `  Open agent page in browser`,
    '',
    `${C.gold('harbinger teleport workflow <id>')}`,
    `  Open workflow editor in browser`,
  ]);
  nl();
}
