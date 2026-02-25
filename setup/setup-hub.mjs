#!/usr/bin/env node

/**
 * Unified Setup Hub — all configuration via wizards, no manual .env editing.
 * User chooses what to configure: Platform (Bug Bounty UI), Agent (Telegram, GitHub jobs), or both.
 */

import * as clack from '@clack/prompts';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureEnvExists } from './lib/env-write.mjs';
import { loadEnvFile } from './lib/env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function handleCancel(value) {
  if (clack.isCancel(value)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }
  return value;
}

async function main() {
  clack.intro('Harbinger Setup');
  clack.log.info('All configuration done through wizards — no need to edit .env manually.');

  // Ensure .env exists
  ensureEnvExists();

  // ─── What to configure? ───────────────────────────────────────────────
  const mode = handleCancel(await clack.select({
    message: 'What would you like to configure?',
    options: [
      {
        label: 'Platform only — Bug Bounty UI (docker-compose, GitHub OAuth)',
        value: 'platform',
      },
      {
        label: 'Agent only — Telegram, GitHub jobs, LLM',
        value: 'agent',
      },
      {
        label: 'Both — Platform + Agent',
        value: 'both',
      },
      {
        label: 'Quick start — Platform with defaults (skip prompts)',
        value: 'quick',
      },
    ],
  }));

  if (mode === 'platform' || mode === 'both') {
    const platformScript = path.join(__dirname, 'setup-platform.mjs');
    execSync(`node ${platformScript}`, { stdio: 'inherit', cwd: process.cwd() });
  }

  if (mode === 'agent' || mode === 'both') {
    const agentScript = path.join(__dirname, 'setup.mjs');
    execSync(`node ${agentScript}`, { stdio: 'inherit', cwd: process.cwd() });
  }

  if (mode === 'quick') {
    const { setEnvVariables, writeFrontendEnv } = await import('./lib/env-write.mjs');
    const { randomBytes } = await import('crypto');

    setEnvVariables({
      APP_URL: 'http://localhost:3000',
      APP_HOSTNAME: 'localhost',
      JWT_SECRET: randomBytes(32).toString('hex'),
      AUTH_SECRET: randomBytes(32).toString('base64'),
    });
    writeFrontendEnv({ apiUrl: '', wsUrl: 'ws://localhost:8080/ws', mcpUrl: 'http://localhost:3001' });
    clack.log.success('Platform configured with defaults');
    clack.outro('Run: docker-compose up -d\n\nThen open http://localhost:3000');
    return;
  }

  clack.outro('Setup complete. Run: docker-compose up -d');
}

main().catch((err) => {
  clack.log.error(err.message);
  process.exit(1);
});
