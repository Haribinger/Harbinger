/**
 * Harbinger CLI — API Client
 *
 * Extracted from the original monolithic cli.js. Handles:
 *  - Base URL resolution from .env / config / defaults
 *  - JWT caching in ~/.harbinger/config.json
 *  - Auto-refresh via GH_TOKEN when JWT expires
 */

import fs from 'fs';
import path from 'path';
import { loadConfig, saveConfig } from './config.js';
import { C, ICON } from './ui.js';

/**
 * Resolve the API base URL. Priority:
 *  1. HARBINGER_API in .env (project-level)
 *  2. apiBase in ~/.harbinger/config.json
 *  3. Default: http://localhost:8080
 */
export function getApiBase() {
  // Check project .env first
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/^HARBINGER_API=(.+)$/m);
    if (match) return match[1].trim();
  }
  if (process.env.HARBINGER_API) return process.env.HARBINGER_API;

  const cfg = loadConfig();
  return cfg.apiBase || 'http://localhost:8080';
}

/**
 * Resolve the frontend URL for browser-open commands.
 */
export function getFrontendUrl() {
  const cfg = loadConfig();
  return cfg.frontendUrl || 'http://localhost:3000';
}

/**
 * Read GH_TOKEN from .env or environment.
 */
export function getGHToken() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/^GH_TOKEN=(.+)$/m);
    if (match) return match[1].trim();
  }
  return process.env.GH_TOKEN || '';
}

/**
 * Get a valid JWT, using cache when possible.
 * Falls back to GH_TOKEN → /api/auth/github/token exchange.
 */
export async function getToken() {
  const cfg = loadConfig();

  // Use cached JWT if not expired (with 60s buffer)
  if (cfg.jwt && cfg.jwtExpiry && Date.now() < cfg.jwtExpiry - 60_000) {
    return cfg.jwt;
  }

  // Try GH_TOKEN exchange
  const ghToken = getGHToken();
  if (ghToken) {
    try {
      const base = getApiBase();
      const resp = await fetch(`${base}/api/auth/github/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ghToken }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.token) {
          cfg.jwt = data.token;
          // Default 24h expiry if server doesn't say
          cfg.jwtExpiry = Date.now() + (data.expiresIn || 86400) * 1000;
          saveConfig(cfg);
          return data.token;
        }
      }
    } catch {
      // Fall through — use GH_TOKEN directly as bearer
    }
    return ghToken;
  }

  return cfg.jwt || '';
}

/**
 * Make an authenticated API request. Returns parsed JSON.
 * Exits on connection failure with helpful message.
 */
export async function apiFetch(endpoint, options = {}) {
  const base = getApiBase();
  const token = await getToken();
  const url = `${base}${endpoint}`;

  try {
    const resp = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    return await resp.json();
  } catch (err) {
    console.error(`\n  ${ICON.fail} Cannot reach ${C.dim(url)}`);
    console.error(`      Is the backend running? Try: ${C.gold('cd backend && go run ./cmd/')}\n`);
    process.exit(1);
  }
}

/**
 * Quick health check — returns true if backend responds at /health.
 */
export async function isBackendUp() {
  const base = getApiBase();
  try {
    const resp = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Load repo info (GH_OWNER, GH_REPO) from .env for GitHub API operations.
 */
export function loadRepoInfo() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error(`\n  ${ICON.fail} No .env file found. Run ${C.gold('harbinger setup')} first.\n`);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  if (!env.GH_OWNER || !env.GH_REPO) {
    console.error(`\n  ${ICON.fail} GH_OWNER and GH_REPO not found in .env. Run ${C.gold('harbinger setup')} first.\n`);
    process.exit(1);
  }
  return { owner: env.GH_OWNER, repo: env.GH_REPO };
}

/**
 * Parse .env file into a plain object.
 */
export function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}
