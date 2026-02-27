/**
 * harbinger update — Version check, self-update, and changelog display.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { C, ICON, box, nl, section } from '../ui.js';
import { markUpdateChecked } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getLocalVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function getRemoteVersion() {
  try {
    const resp = await fetch('https://registry.npmjs.org/harbinger/latest', {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.version;
    }
  } catch {}

  // Fallback: check GitHub releases
  try {
    const resp = await fetch('https://api.github.com/repos/kdairatchi/harbinger/releases/latest', {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.tag_name?.replace(/^v/, '') || null;
    }
  } catch {}

  return null;
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

export default async function updateCommand(args = []) {
  const checkOnly = args.includes('--check');
  const local = getLocalVersion();

  box('HARBINGER UPDATE', [
    `${C.dim('Current version')}  ${C.gold(`v${local}`)}`,
  ]);
  nl();

  console.log(`  ${ICON.work} Checking for updates...`);
  const remote = await getRemoteVersion();
  markUpdateChecked();

  if (!remote) {
    console.log(`  ${ICON.warn} Could not reach update server.`);
    console.log(`  ${C.dim('Check manually: https://github.com/Haribinger/Harbinger/releases')}\n`);
    return;
  }

  const cmp = compareVersions(local, remote);
  if (cmp >= 0) {
    console.log(`  ${ICON.ok} You are on the latest version ${C.gold(`v${local}`)}\n`);
    return;
  }

  console.log(`  ${ICON.info} Update available: ${C.dim(`v${local}`)} ${C.gold('→')} ${C.success(`v${remote}`)}`);
  nl();

  if (checkOnly) {
    console.log(`  Run ${C.gold('harbinger update')} to install.\n`);
    return;
  }

  // Perform update
  console.log(`  ${ICON.work} Updating to v${remote}...`);
  try {
    execSync('pnpm add -g harbinger@latest', { stdio: 'inherit' });
    console.log(`\n  ${ICON.ok} Updated to v${remote}`);
  } catch {
    // Might not be globally installed — try local
    try {
      execSync('pnpm update harbinger@latest', { stdio: 'inherit' });
      console.log(`\n  ${ICON.ok} Updated to v${remote}`);
    } catch {
      console.error(`\n  ${ICON.fail} Update failed. Try manually:`);
      console.error(`  ${C.gold('pnpm add -g harbinger@latest')}\n`);
      return;
    }
  }

  // Post-update doctor
  nl();
  console.log(`  ${ICON.info} Running post-update diagnostics...`);
  try {
    const { default: doctor } = await import('./doctor.js');
    await doctor([]);
  } catch {
    console.log(`  ${ICON.warn} Run ${C.gold('harbinger doctor')} to verify.\n`);
  }
}

/**
 * Background version check — non-blocking, shows banner if outdated.
 * Called from the main dispatcher on startup.
 */
export async function backgroundUpdateCheck() {
  try {
    const local = getLocalVersion();
    const remote = await getRemoteVersion();
    if (remote && compareVersions(local, remote) < 0) {
      console.log(C.dim(`  Update available: v${local} → v${remote}. Run: harbinger update`));
    }
    markUpdateChecked();
  } catch {
    // Silent — background check should never fail visibly
  }
}
