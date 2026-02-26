/**
 * harbinger doctor — System diagnostics with box-drawn results.
 * Absorbs and enhances the original scripts/doctor.js.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import net from 'net';
import http from 'http';
import { C, ICON, box, section, statusLine, nl, step } from '../ui.js';

const checks = [];
const results = [];

function addCheck(name, fn, fix) {
  checks.push({ name, fn, fix });
}

async function tcpProbe(host, port, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    sock.setTimeout(timeoutMs);
    sock.on('connect', () => { sock.destroy(); resolve(); });
    sock.on('error', () => reject(new Error(`${host}:${port} not reachable`)));
    sock.on('timeout', () => { sock.destroy(); reject(new Error(`${host}:${port} timed out`)); });
  });
}

async function httpProbe(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      if (res.statusCode < 500) resolve();
      else reject(new Error(`HTTP ${res.statusCode}`));
    });
    req.on('error', () => reject(new Error(`${url} not reachable`)));
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timed out')); });
  });
}

function cmdExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function cmdVersion(cmd) {
  try {
    return execSync(`${cmd} --version`, { stdio: 'pipe' }).toString().trim().split('\n')[0];
  } catch {
    return null;
  }
}

// ── Toolchain checks ──────────────────────────────────────────────────────

addCheck('Node.js >= 18', () => {
  const major = parseInt(process.version.slice(1).split('.')[0]);
  if (major < 18) throw new Error(`Found ${process.version}, need >= 18`);
}, 'Install Node.js 18+ from https://nodejs.org');

addCheck('pnpm installed', () => {
  if (!cmdExists('pnpm')) throw new Error('pnpm not found');
}, 'npm install -g pnpm');

addCheck('Docker running', () => {
  try {
    execSync('docker info', { stdio: 'pipe' });
  } catch {
    throw new Error('Docker daemon not running');
  }
}, 'Start Docker Desktop or: sudo systemctl start docker');

addCheck('Docker Compose available', () => {
  try {
    execSync('docker compose version', { stdio: 'pipe' });
  } catch {
    throw new Error('docker compose not found');
  }
}, 'Install Docker Compose v2');

addCheck('Go toolchain', () => {
  if (!cmdExists('go')) throw new Error('go not found');
}, 'Install Go 1.24+ from https://go.dev/dl');

// ── Project files ─────────────────────────────────────────────────────────

addCheck('.env file exists', () => {
  if (!fs.existsSync('.env')) throw new Error('.env not found');
}, 'cp .env.example .env && harbinger setup');

addCheck('Required env vars', () => {
  if (!fs.existsSync('.env')) throw new Error('.env missing');
  const env = fs.readFileSync('.env', 'utf8');
  const required = ['JWT_SECRET', 'DB_PASSWORD'];
  const missing = required.filter(k => !env.match(new RegExp(`^${k}=.+`, 'm')));
  if (missing.length) throw new Error(`Missing: ${missing.join(', ')}`);
}, 'Run: harbinger setup');

addCheck('No weak JWT_SECRET', () => {
  if (!fs.existsSync('.env')) return; // covered above
  const env = fs.readFileSync('.env', 'utf8');
  const match = env.match(/^JWT_SECRET=(.+)$/m);
  if (match && match[1].length < 32) throw new Error('JWT_SECRET is too short (< 32 chars)');
}, 'Regenerate with: harbinger reset-auth');

addCheck('backend/go.mod exists', () => {
  if (!fs.existsSync('backend/go.mod')) throw new Error('Backend source missing');
});

addCheck('Frontend node_modules', () => {
  const frontendNM = path.join('harbinger-tools', 'frontend', 'node_modules');
  if (!fs.existsSync(frontendNM)) throw new Error('Frontend deps not installed');
}, 'pnpm install');

// ── Service connectivity ──────────────────────────────────────────────────

addCheck('Backend API :8080', async () => {
  await httpProbe('http://localhost:8080/api/health');
}, 'cd backend && go run ./cmd/');

addCheck('Frontend :3000', async () => {
  await tcpProbe('localhost', 3000);
}, 'pnpm dev');

addCheck('PostgreSQL :5432', async () => {
  await tcpProbe('localhost', 5432);
}, 'docker compose up -d postgres');

addCheck('Redis :6379', async () => {
  await tcpProbe('localhost', 6379);
}, 'docker compose up -d redis');

addCheck('Neo4j :7474', async () => {
  await tcpProbe('localhost', 7474);
}, 'docker compose up -d neo4j');

// ── Disk space ────────────────────────────────────────────────────────────

addCheck('Disk space > 1 GB', () => {
  try {
    const output = execSync('df -BG . | tail -1', { stdio: 'pipe' }).toString();
    const parts = output.split(/\s+/);
    const avail = parseInt(parts[3]);
    if (avail < 1) throw new Error(`Only ${avail}GB available`);
  } catch (e) {
    if (e.message.includes('GB')) throw e;
    // df might not be available on all platforms — skip
  }
});

// ── Run ───────────────────────────────────────────────────────────────────

export default async function doctorCommand(args = []) {
  const fixMode = args.includes('--fix');
  const passed = [];
  const failed = [];

  box('HARBINGER DOCTOR', [
    C.dim('System diagnostics and health checks'),
    fixMode ? C.warn('Auto-repair mode enabled') : '',
  ].filter(Boolean));
  nl();

  for (let i = 0; i < checks.length; i++) {
    const { name, fn, fix } = checks[i];
    try {
      await fn();
      statusLine(ICON.ok, name, C.success('pass'));
      passed.push(name);
    } catch (err) {
      statusLine(ICON.fail, name, C.danger(err.message));
      failed.push({ name, error: err.message, fix });

      if (fixMode && fix) {
        console.log(`        ${C.gold('→')} Attempting fix: ${C.dim(fix)}`);
        try {
          execSync(fix, { stdio: 'inherit' });
          console.log(`        ${ICON.ok} Fix applied`);
        } catch {
          console.log(`        ${ICON.fail} Auto-fix failed`);
        }
      }
    }
  }

  // ── Results panel ─────────────────────────────────────────────────────
  nl();
  box('RESULTS', [
    `${C.success(`${passed.length} passed`)}  ${C.danger(`${failed.length} failed`)}  ${C.dim(`${checks.length} total`)}`,
    '',
    ...(failed.length > 0 ? [
      C.dim('Failed checks:'),
      ...failed.map(f => `  ${C.danger('·')} ${f.name}${f.fix ? C.dim(` → ${f.fix}`) : ''}`),
    ] : [C.success('All systems operational')]),
  ]);

  if (failed.length > 0 && !fixMode) {
    console.log(`\n  Run ${C.gold('harbinger doctor --fix')} to attempt automatic repairs.\n`);
  }

  nl();
}
