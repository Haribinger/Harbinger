/**
 * harbinger secrets / set-agent-secret / set-agent-llm-secret / set-var / env
 * Secret management and .env inspection.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { C, ICON, section, kv, nl, box } from '../ui.js';
import { loadRepoInfo, loadEnv } from '../api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageDir = path.join(__dirname, '..', '..', '..');

async function promptForValue(key) {
  const { password, isCancel } = await import('@clack/prompts');
  const value = await password({
    message: `Enter value for ${key}:`,
    validate: (input) => {
      if (!input) return 'Value is required';
    },
  });
  if (isCancel(value)) {
    console.log('\nCancelled.\n');
    process.exit(0);
  }
  return value;
}

export async function setAgentSecret(key, value) {
  if (!key) {
    console.error(`\n  ${ICON.fail} Usage: ${C.gold('harbinger set-agent-secret <KEY> [VALUE]')}`);
    console.error(`  Example: ${C.gold('harbinger set-agent-secret ANTHROPIC_API_KEY')}\n`);
    process.exit(1);
  }

  if (!value) value = await promptForValue(key);

  const { owner, repo } = loadRepoInfo();
  const prefixedName = `AGENT_${key}`;

  const { setSecret } = await import(path.join(packageDir, 'setup', 'lib', 'github.mjs'));
  const { updateEnvVariable } = await import(path.join(packageDir, 'setup', 'lib', 'auth.mjs'));

  const result = await setSecret(owner, repo, prefixedName, value);
  if (result.success) {
    console.log(`\n  ${ICON.ok} Set GitHub secret: ${C.gold(prefixedName)}`);
    updateEnvVariable(key, value);
    console.log(`  ${ICON.ok} Updated .env: ${C.gold(key)}\n`);
  } else {
    console.error(`\n  ${ICON.fail} Failed to set ${prefixedName}: ${result.error}\n`);
    process.exit(1);
  }
}

export async function setAgentLlmSecret(key, value) {
  if (!key) {
    console.error(`\n  ${ICON.fail} Usage: ${C.gold('harbinger set-agent-llm-secret <KEY> [VALUE]')}`);
    console.error(`  Example: ${C.gold('harbinger set-agent-llm-secret BRAVE_API_KEY')}\n`);
    process.exit(1);
  }

  if (!value) value = await promptForValue(key);

  const { owner, repo } = loadRepoInfo();
  const prefixedName = `AGENT_LLM_${key}`;

  const { setSecret } = await import(path.join(packageDir, 'setup', 'lib', 'github.mjs'));

  const result = await setSecret(owner, repo, prefixedName, value);
  if (result.success) {
    console.log(`\n  ${ICON.ok} Set GitHub secret: ${C.gold(prefixedName)}\n`);
  } else {
    console.error(`\n  ${ICON.fail} Failed to set ${prefixedName}: ${result.error}\n`);
    process.exit(1);
  }
}

export async function setVar(key, value) {
  if (!key) {
    console.error(`\n  ${ICON.fail} Usage: ${C.gold('harbinger set-var <KEY> [VALUE]')}`);
    console.error(`  Example: ${C.gold('harbinger set-var LLM_MODEL claude-sonnet-4-5-20250929')}\n`);
    process.exit(1);
  }

  if (!value) value = await promptForValue(key);

  const { owner, repo } = loadRepoInfo();

  const { setVariable } = await import(path.join(packageDir, 'setup', 'lib', 'github.mjs'));

  const result = await setVariable(owner, repo, key, value);
  if (result.success) {
    console.log(`\n  ${ICON.ok} Set GitHub variable: ${C.gold(key)}\n`);
  } else {
    console.error(`\n  ${ICON.fail} Failed to set ${key}: ${result.error}\n`);
    process.exit(1);
  }
}

// ── harbinger secrets — list .env secrets status ────────────────────────────
export async function listSecrets() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error(`\n  ${ICON.fail} No .env file found. Run ${C.gold('harbinger setup')} first.\n`);
    process.exit(1);
  }

  const env = loadEnv();

  box('SECRETS STATUS', [C.dim('.env — sensitive values masked')]);
  nl();

  const requiredKeys = [
    { key: 'JWT_SECRET', label: 'JWT Secret', minLen: 32 },
    { key: 'DB_PASSWORD', label: 'Database Password', minLen: 8 },
    { key: 'REDIS_PASSWORD', label: 'Redis Password', minLen: 8 },
    { key: 'NEO4J_PASSWORD', label: 'Neo4j Password', minLen: 8 },
    { key: 'AUTH_SECRET', label: 'Auth Secret', minLen: 16 },
  ];

  const optionalKeys = [
    { key: 'GH_TOKEN', label: 'GitHub Token' },
    { key: 'GITHUB_CLIENT_ID', label: 'GitHub OAuth ID' },
    { key: 'GITHUB_CLIENT_SECRET', label: 'GitHub OAuth Secret' },
    { key: 'LLM_API_KEY', label: 'LLM API Key' },
    { key: 'DISCORD_BOT_TOKEN', label: 'Discord Bot Token' },
    { key: 'TELEGRAM_BOT_TOKEN', label: 'Telegram Bot Token' },
  ];

  section('REQUIRED');
  for (const { key, label, minLen } of requiredKeys) {
    const val = env[key] || '';
    if (!val) {
      kv(label, C.danger('MISSING'));
    } else if (val.length < minLen) {
      kv(label, C.warn(`SET (weak — ${val.length} chars)`));
    } else {
      kv(label, C.success(`SET (${val.length} chars)`));
    }
  }

  section('OPTIONAL');
  for (const { key, label } of optionalKeys) {
    const val = env[key] || '';
    if (val) {
      const masked = val.slice(0, 4) + '...' + val.slice(-4);
      kv(label, C.success(masked));
    } else {
      kv(label, C.dim('not configured'));
    }
  }

  nl();
}

// ── harbinger env — show all .env variables ─────────────────────────────────
export async function showEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error(`\n  ${ICON.fail} No .env file found. Run ${C.gold('harbinger setup')} first.\n`);
    process.exit(1);
  }

  const env = loadEnv();
  const sensitiveKeys = ['JWT_SECRET', 'DB_PASSWORD', 'REDIS_PASSWORD', 'NEO4J_PASSWORD', 'AUTH_SECRET',
    'GH_TOKEN', 'GITHUB_CLIENT_SECRET', 'LLM_API_KEY', 'DISCORD_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN'];

  box('ENVIRONMENT', [C.dim(envPath)]);
  nl();

  for (const [key, val] of Object.entries(env)) {
    if (sensitiveKeys.includes(key)) {
      const masked = val.length > 8 ? val.slice(0, 4) + '****' + val.slice(-4) : '****';
      kv(key, C.dim(masked));
    } else {
      kv(key, C.white(val));
    }
  }
  nl();
}
