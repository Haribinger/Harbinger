/**
 * harbinger setup / setup-platform / setup-telegram / setup-discord / reset-auth
 * Extracted from the original monolithic cli.js.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { C, ICON } from '../ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageDir = path.join(__dirname, '..', '..', '..');

function runSetupScript(scriptName) {
  const scriptPath = path.join(packageDir, 'setup', scriptName);
  if (!fs.existsSync(scriptPath)) {
    console.error(`\n  ${ICON.fail} Setup script not found: ${scriptName}\n`);
    process.exit(1);
  }
  try {
    execSync(`node ${scriptPath}`, { stdio: 'inherit', cwd: process.cwd() });
  } catch {
    process.exit(1);
  }
}

export function setup() {
  runSetupScript('setup-hub.mjs');
}

export function setupPlatform() {
  runSetupScript('setup-platform.mjs');
}

export function setupTelegram() {
  runSetupScript('setup-telegram.mjs');
}

export async function setupDiscord() {
  const scriptPath = path.join(packageDir, 'setup', 'setup-discord.mjs');
  if (fs.existsSync(scriptPath)) {
    try {
      execSync(`node ${scriptPath}`, { stdio: 'inherit', cwd: process.cwd() });
      return;
    } catch {
      process.exit(1);
    }
  }

  // Inline Discord setup fallback
  const { text, isCancel } = await import('@clack/prompts');
  console.log(`\n  ${ICON.info} Discord Bot Setup\n`);
  console.log('  1. Go to https://discord.com/developers/applications');
  console.log('  2. Create New Application → Bot → Copy Token');
  console.log('  3. Enable Message Content Intent');
  console.log('  4. Invite bot to server with Message + Slash Commands permissions\n');

  const botToken = await text({ message: 'Bot Token:', placeholder: 'MTIz...' });
  if (isCancel(botToken)) { console.log('\nCancelled.\n'); process.exit(0); }

  const guildId = await text({ message: 'Guild/Server ID:', placeholder: 'Right-click server → Copy ID' });
  if (isCancel(guildId)) { console.log('\nCancelled.\n'); process.exit(0); }

  const channelId = await text({ message: 'Channel ID:', placeholder: 'Right-click channel → Copy ID' });
  if (isCancel(channelId)) { console.log('\nCancelled.\n'); process.exit(0); }

  const { updateEnvVariable } = await import(path.join(packageDir, 'setup', 'lib', 'auth.mjs')).catch(() => ({
    updateEnvVariable: (key, val) => {
      const envPath = path.join(process.cwd(), '.env');
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
      const re = new RegExp(`^${key}=.*$`, 'm');
      if (re.test(content)) {
        content = content.replace(re, `${key}=${val}`);
      } else {
        content += `\n${key}=${val}`;
      }
      fs.writeFileSync(envPath, content);
    },
  }));

  updateEnvVariable('DISCORD_BOT_TOKEN', botToken);
  updateEnvVariable('DISCORD_GUILD_ID', guildId);
  updateEnvVariable('DISCORD_CHANNEL_ID', channelId);

  console.log(`\n  ${ICON.ok} Discord bot configured!`);
  console.log('  Restart the backend for changes to take effect.\n');
}

export async function resetAuth() {
  const { randomBytes } = await import('crypto');
  const { updateEnvVariable } = await import(path.join(packageDir, 'setup', 'lib', 'auth.mjs'));

  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error(`\n  ${ICON.fail} No .env file found. Run ${C.gold('harbinger setup')} first.\n`);
    process.exit(1);
  }

  const newSecret = randomBytes(32).toString('base64');
  updateEnvVariable('AUTH_SECRET', newSecret);
  console.log(`\n  ${ICON.ok} AUTH_SECRET regenerated.`);
  console.log('  All existing sessions have been invalidated.');
  console.log('  Restart your server for the change to take effect.\n');
}
