#!/usr/bin/env node

/**
 * Platform Setup Wizard — Bug Bounty UI (docker-compose stack)
 * Configures: APP_URL, GitHub OAuth, DB, JWT, frontend .env
 * User never touches .env — all via prompts.
 */

import * as clack from '@clack/prompts';
import open from 'open';
import { ensureEnvExists, setEnvVariables, writeFrontendEnv } from './lib/env-write.mjs';
import { loadEnvFile } from './lib/env.mjs';
import { confirm } from './lib/prompts.mjs';

function handleCancel(value) {
  if (clack.isCancel(value)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }
  return value;
}

async function main() {
  clack.intro('Platform Setup — Bug Bounty UI');
  clack.log.info('Configure the docker-compose stack. All values go to .env — no manual editing.');

  ensureEnvExists();
  const env = loadEnvFile();
  const updates = {};

  // ─── App URL (optional for local dev) ─────────────────────────────────
  clack.log.step('App URL');
  clack.log.info('For local dev, you can skip (use http://localhost:3000). For production/ngrok, enter your public URL.');

  const configureUrl = env?.APP_URL
    ? !(await confirm('Reconfigure APP_URL?', false))
    : await confirm('Set APP_URL? (skip for local-only)', false);

  if (configureUrl) {
    const appUrl = handleCancel(await clack.text({
      message: 'APP_URL (https://... or http://localhost:3000):',
      defaultValue: env?.APP_URL || 'http://localhost:3000',
      validate: (input) => {
        if (!input) return 'URL is required';
        if (!input.startsWith('http://') && !input.startsWith('https://')) {
          return 'URL must start with http:// or https://';
        }
      },
    }));
    updates.APP_URL = appUrl.replace(/\/$/, '');
    updates.APP_HOSTNAME = new URL(updates.APP_URL).hostname;
    clack.log.success(`APP_URL: ${updates.APP_URL}`);
  }

  // ─── GitHub OAuth (optional) ──────────────────────────────────────────
  clack.log.step('GitHub OAuth');
  clack.log.info('Enables "Continue with GitHub" on the login page. Optional for local dev.');

  const configureOAuth = await confirm('Configure GitHub OAuth?', false);

  if (configureOAuth) {
    clack.log.info('Create an OAuth App at https://github.com/settings/developers');
    clack.log.info('Callback URL: {APP_URL}/api/auth/github/callback');

    const openOAuth = await confirm('Open GitHub OAuth Apps page?', true);
    if (openOAuth) {
      await open('https://github.com/settings/applications/new');
    }

    const clientId = handleCancel(await clack.text({
      message: 'GITHUB_CLIENT_ID:',
      defaultValue: env?.GITHUB_CLIENT_ID || '',
      validate: (input) => (configureOAuth && !input ? 'Client ID is required' : undefined),
    }));
    const clientSecret = handleCancel(await clack.password({
      message: 'GITHUB_CLIENT_SECRET:',
    }));

    if (clientId) updates.GITHUB_CLIENT_ID = clientId;
    if (clientSecret) updates.GITHUB_CLIENT_SECRET = clientSecret;
    if (clientId || clientSecret) clack.log.success('GitHub OAuth configured');
  }

  // ─── JWT Secret (auto-generate if missing) ─────────────────────────────
  if (!env?.JWT_SECRET || env.JWT_SECRET === 'change-me-in-production') {
    const { randomBytes } = await import('crypto');
    updates.JWT_SECRET = randomBytes(32).toString('hex');
    clack.log.success('JWT_SECRET auto-generated');
  }

  // ─── AUTH_SECRET (for Next.js if used) ─────────────────────────────────
  if (!env?.AUTH_SECRET) {
    const { randomBytes } = await import('crypto');
    updates.AUTH_SECRET = randomBytes(32).toString('base64');
    clack.log.success('AUTH_SECRET auto-generated');
  }

  // ─── Write all updates ────────────────────────────────────────────────
  if (Object.keys(updates).length > 0) {
    setEnvVariables(updates);
    clack.log.success('Updated .env');
  }

  // ─── Frontend .env ────────────────────────────────────────────────────
  // Empty apiUrl = Vite proxy (relative URLs) for local dev
  writeFrontendEnv({
    apiUrl: '',
    wsUrl: 'ws://localhost:8080/ws',
    mcpUrl: 'http://localhost:3001',
  });
  clack.log.success('Updated frontend/.env');

  clack.outro(
    'Platform config saved to .env.\n\n' +
    '  docker-compose up -d\n\n' +
    'Then open http://localhost:3000'
  );
}

main().catch((err) => {
  clack.log.error(err.message);
  process.exit(1);
});
