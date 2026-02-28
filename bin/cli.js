#!/usr/bin/env node

/**
 * Harbinger CLI — Command Center
 *
 * Slim dispatcher that routes to modular command handlers in bin/lib/commands/.
 * Keeps init() inline (project scaffolding needs direct template access).
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const command = process.argv[2];
const args = process.argv.slice(3);

// ── First-run detection ────────────────────────────────────────────────────
// If no ~/.harbinger/config.json and no explicit command, offer onboard.
async function checkFirstRun() {
  try {
    const { isFirstRun } = await import('./lib/config.js');
    if (isFirstRun() && !command) {
      const { banner, C } = await import('./lib/ui.js');
      banner('Autonomous Offensive Security Framework');
      console.log(`  ${C.gold('First time?')} Run ${C.bold('harbinger onboard')} to get started.\n`);
    }
  } catch {
    // Config module not available — skip
  }
}

// ── Background update check (non-blocking, once per 24h) ──────────────────
async function maybeCheckUpdate() {
  try {
    const { isUpdateCheckDue } = await import('./lib/config.js');
    if (isUpdateCheckDue()) {
      const { backgroundUpdateCheck } = await import('./lib/commands/update.js');
      // Fire and forget — don't block CLI startup
      backgroundUpdateCheck().catch(() => {});
    }
  } catch {
    // Silent — update check should never interfere
  }
}

// ── Help / usage ───────────────────────────────────────────────────────────
async function printUsage() {
  try {
    const { banner, C, nl } = await import('./lib/ui.js');
    banner('Autonomous Offensive Security Framework');

    const sections = [
      ['Getting Started', [
        ['onboard',                   'First-run guided setup wizard'],
        ['install',                   'Full Docker environment bootstrap'],
        ['install --quick',           'Non-interactive install with defaults'],
        ['doctor',                    'System diagnostics and health checks'],
        ['doctor --fix',              'Auto-repair mode'],
      ]],
      ['Setup & Configuration', [
        ['init',                      'Scaffold a new harbinger project'],
        ['setup',                     'Run unified setup wizard (AI, Auth, Channels)'],
        ['setup-platform',            'Configure Platform only (Bug Bounty UI)'],
        ['setup-telegram',            'Reconfigure Telegram bot webhook'],
        ['setup-discord',             'Configure Discord bot integration'],
        ['reset-auth',                'Regenerate AUTH_SECRET (invalidates sessions)'],
      ]],
      ['Agent Management', [
        ['agents',                    'List all registered agents'],
        ['agents:templates',          'Show available agent templates'],
        ['agents:spawn <id>',         'Spawn an agent container'],
        ['agents:stop <id>',          'Stop an agent container'],
        ['agents:logs <id>',          'View agent container logs'],
        ['agents:create <template>',  'Create new agent from template'],
      ]],
      ['Platform Status', [
        ['status',                    'Platform health dashboard'],
        ['dashboard',                 'Alias for status'],
        ['channels',                  'List configured channels'],
        ['open [page]',               'Open dashboard in browser (or specific page)'],
        ['logs [service]',            'View Docker service logs'],
      ]],
      ['Docker', [
        ['up',                        'Start all Docker services'],
        ['down',                      'Stop all Docker services'],
        ['restart [service]',         'Restart services'],
      ]],
      ['Teleport (CLI ↔ UI)', [
        ['teleport --to-ui',          'Push CLI context → open in browser'],
        ['teleport --from-ui',        'Pull context from Web UI'],
        ['teleport agent <id>',       'Open agent page in browser'],
        ['teleport workflow <id>',    'Open workflow editor in browser'],
      ]],
      ['Updates', [
        ['update',                    'Check for updates and self-update'],
        ['update --check',            'Just check, don\'t install'],
        ['changelog',                 'Display formatted changelog'],
      ]],
      ['Secrets & Variables', [
        ['secrets',                   'Show .env secrets status (safe masked view)'],
        ['env',                       'Show all .env variables (masked)'],
        ['set-agent-secret <K> [V]',  'Set a GitHub secret with AGENT_ prefix'],
        ['set-agent-llm-secret <K> [V]', 'Set GitHub secret with AGENT_LLM_ prefix'],
        ['set-var <KEY> [VALUE]',     'Set a GitHub repository variable'],
      ]],
      ['Project Management', [
        ['reset [file]',              'Restore a template file (or list available)'],
        ['diff [file]',               'Show differences vs. package templates'],
      ]],
    ];

    for (const [title, cmds] of sections) {
      console.log(`  ${C.bold(title)}`);
      for (const [cmd, desc] of cmds) {
        console.log(`    ${C.gold(cmd.padEnd(30))} ${C.dim(desc)}`);
      }
      nl();
    }
  } catch {
    // Fallback if chalk/ui not available
    console.log(`
  HARBINGER — Autonomous Offensive Security Framework

  Usage: harbinger <command>

  Commands: onboard, install, doctor, status, agents, setup, teleport, update
  Run: harbinger --help for full list
`);
  }
}

// ── Init (kept inline — needs direct template access) ──────────────────────

const MANAGED_PATHS = [
  '.github/workflows/',
  'docker/event-handler/',
  'docker-compose.yml',
  '.dockerignore',
];

function isManaged(relPath) {
  return MANAGED_PATHS.some(p => relPath === p || relPath.startsWith(p));
}

const EXCLUDED_FILENAMES = ['CLAUDE.md'];

function destPath(templateRelPath) {
  if (templateRelPath.endsWith('.template')) {
    return templateRelPath.slice(0, -'.template'.length);
  }
  return templateRelPath;
}

function getTemplateFiles(templatesDir) {
  const files = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (!EXCLUDED_FILENAMES.includes(entry.name)) {
        files.push(path.relative(templatesDir, fullPath));
      }
    }
  }
  walk(templatesDir);
  return files;
}

async function init() {
  let cwd = process.cwd();
  const packageDir = path.join(__dirname, '..');
  const templatesDir = path.join(packageDir, 'templates');
  const noManaged = args.includes('--no-managed');

  const entries = fs.readdirSync(cwd);
  if (entries.length > 0) {
    const pkgPath = path.join(cwd, 'package.json');
    let isExistingProject = false;
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = pkg.dependencies || {};
        const devDeps = pkg.devDependencies || {};
        if (deps.harbinger || devDeps.harbinger) {
          isExistingProject = true;
        }
      } catch {}
    }

    if (!isExistingProject) {
      console.log('\nThis directory is not empty.');
      const { text, isCancel } = await import('@clack/prompts');
      const dirName = await text({
        message: 'Project directory name:',
        defaultValue: 'my-harbinger',
      });
      if (isCancel(dirName)) {
        console.log('\nCancelled.\n');
        process.exit(0);
      }
      const newDir = path.resolve(cwd, dirName);
      fs.mkdirSync(newDir, { recursive: true });
      process.chdir(newDir);
      cwd = newDir;
      console.log(`\nCreated ${dirName}/`);
    }
  }

  console.log('\nScaffolding harbinger project...\n');

  const templateFiles = getTemplateFiles(templatesDir);
  const created = [];
  const skipped = [];
  const changed = [];
  const updated = [];

  for (const relPath of templateFiles) {
    const src = path.join(templatesDir, relPath);
    const outPath = destPath(relPath);
    const dest = path.join(cwd, outPath);

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      created.push(outPath);
      console.log(`  Created ${outPath}`);
    } else {
      const srcContent = fs.readFileSync(src);
      const destContent = fs.readFileSync(dest);
      if (srcContent.equals(destContent)) {
        skipped.push(outPath);
      } else if (!noManaged && isManaged(outPath)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        updated.push(outPath);
        console.log(`  Updated ${outPath}`);
      } else {
        changed.push(outPath);
        console.log(`  Skipped ${outPath} (already exists)`);
      }
    }
  }

  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    const dirName = path.basename(cwd);
    const { version } = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    const harbingerDep = version.includes('-') ? version : '^1.0.0';
    const pkg = {
      name: dirName,
      private: true,
      scripts: {
        dev: 'next dev --turbopack',
        build: 'next build',
        start: 'next start',
        setup: 'harbinger setup',
        'setup-telegram': 'harbinger setup-telegram',
        'reset-auth': 'harbinger reset-auth',
      },
      dependencies: {
        harbinger: harbingerDep,
        next: '^15.5.12',
        'next-auth': '5.0.0-beta.30',
        'next-themes': '^0.4.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        tailwindcss: '^4.0.0',
        '@tailwindcss/postcss': '^4.0.0',
      },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('  Created package.json');
  } else {
    console.log('  Skipped package.json (already exists)');
  }

  const gitkeepDirs = ['cron', 'triggers', 'logs', 'tmp', 'data'];
  for (const dir of gitkeepDirs) {
    const gitkeep = path.join(cwd, dir, '.gitkeep');
    if (!fs.existsSync(gitkeep)) {
      fs.mkdirSync(path.join(cwd, dir), { recursive: true });
      fs.writeFileSync(gitkeep, '');
    }
  }

  const defaultSkills = ['brave-search', 'browser-tools'];
  for (const skill of defaultSkills) {
    const symlink = path.join(cwd, '.pi', 'skills', skill);
    if (!fs.existsSync(symlink)) {
      fs.mkdirSync(path.dirname(symlink), { recursive: true });
      fs.symlinkSync(`../../pi-skills/${skill}`, symlink);
      console.log(`  Created .pi/skills/${skill} → ../../pi-skills/${skill}`);
    }
  }

  if (updated.length > 0) {
    console.log('\n  Updated managed files:');
    for (const file of updated) console.log(`    ${file}`);
  }

  if (changed.length > 0) {
    console.log('\n  Updated templates available:');
    console.log('  These files differ from the current package templates.');
    console.log('  This may be from your edits, or from a harbinger update.\n');
    for (const file of changed) console.log(`    ${file}`);
    console.log('\n  To view differences:  npx harbinger diff <file>');
    console.log('  To reset to default:  npx harbinger reset <file>');
  }

  console.log('\nInstalling dependencies...\n');
  execSync('npm install', { stdio: 'inherit', cwd });

  const envPath = path.join(cwd, '.env');
  const { randomBytes } = await import('crypto');
  const harbingerPkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const version = harbingerPkg.version;

  if (!fs.existsSync(envPath)) {
    const authSecret = randomBytes(32).toString('base64');
    const seedEnv = `# harbinger Configuration
# Run "npm run setup" to complete configuration

AUTH_SECRET=${authSecret}
AUTH_TRUST_HOST=true
HARBINGER_VERSION=${version}
`;
    fs.writeFileSync(envPath, seedEnv);
    console.log(`  Created .env (AUTH_SECRET, HARBINGER_VERSION=${version})`);
  } else {
    try {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.match(/^HARBINGER_VERSION=.*/m)) {
        envContent = envContent.replace(/^HARBINGER_VERSION=.*/m, `HARBINGER_VERSION=${version}`);
      } else {
        envContent = envContent.trimEnd() + `\nHARBINGER_VERSION=${version}\n`;
      }
      fs.writeFileSync(envPath, envContent);
      console.log(`  Updated HARBINGER_VERSION to ${version}`);
    } catch {}
  }

  console.log('\nDone! Run: npm run setup\n');
}

// ── Docker helper commands ─────────────────────────────────────────────────

function dockerUp(services) {
  const svc = services.length ? services.join(' ') : '';
  execSync(`docker compose up -d ${svc}`, { stdio: 'inherit' });
}

function dockerDown() {
  execSync('docker compose down', { stdio: 'inherit' });
}

function dockerRestart(services) {
  const svc = services.length ? services.join(' ') : '';
  execSync(`docker compose restart ${svc}`, { stdio: 'inherit' });
}

function dockerLogs(service) {
  const svc = service || '';
  execSync(`docker compose logs -f ${svc}`, { stdio: 'inherit' });
}

// ── Changelog ──────────────────────────────────────────────────────────────

async function showChangelog() {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    const content = fs.readFileSync(changelogPath, 'utf-8');
    try {
      const { C } = await import('./lib/ui.js');
      // Simple formatting: highlight version headers in gold
      const formatted = content
        .replace(/^(#{1,3}\s.*)$/gm, (m) => C.gold(m))
        .replace(/^- (.*)$/gm, (_, text) => `  ${C.dim('·')} ${text}`);
      console.log(formatted);
    } catch {
      console.log(content);
    }
  } else {
    console.log('\n  No CHANGELOG.md found.\n');
  }
}

// ── Command dispatcher ─────────────────────────────────────────────────────

await checkFirstRun();
maybeCheckUpdate();

switch (command) {
  // ── Getting started ──────────────────────────────────────────────────
  case 'onboard': {
    const { default: onboard } = await import('./lib/commands/onboard.js');
    await onboard();
    break;
  }
  case 'install': {
    const { default: install } = await import('./lib/commands/install.js');
    await install(args);
    break;
  }
  case 'doctor': {
    const { default: doctor } = await import('./lib/commands/doctor.js');
    await doctor(args);
    break;
  }
  case 'update': {
    const { default: update } = await import('./lib/commands/update.js');
    await update(args);
    break;
  }
  case 'changelog':
    await showChangelog();
    break;

  // ── Setup & config ───────────────────────────────────────────────────
  case 'init':
    await init();
    break;
  case 'setup': {
    const { setup } = await import('./lib/commands/setup.js');
    setup();
    break;
  }
  case 'setup-platform': {
    const { setupPlatform } = await import('./lib/commands/setup.js');
    setupPlatform();
    break;
  }
  case 'setup-telegram': {
    const { setupTelegram } = await import('./lib/commands/setup.js');
    setupTelegram();
    break;
  }
  case 'setup-discord': {
    const { setupDiscord } = await import('./lib/commands/setup.js');
    await setupDiscord();
    break;
  }
  case 'reset-auth': {
    const { resetAuth } = await import('./lib/commands/setup.js');
    await resetAuth();
    break;
  }

  // ── Agents ───────────────────────────────────────────────────────────
  case 'agents': {
    const { listAgents } = await import('./lib/commands/agents.js');
    await listAgents();
    break;
  }
  case 'agents:templates': {
    const { listTemplates } = await import('./lib/commands/agents.js');
    await listTemplates();
    break;
  }
  case 'agents:spawn': {
    const { spawnAgent } = await import('./lib/commands/agents.js');
    await spawnAgent(args[0]);
    break;
  }
  case 'agents:stop': {
    const { stopAgent } = await import('./lib/commands/agents.js');
    await stopAgent(args[0]);
    break;
  }
  case 'agents:logs': {
    const { agentLogs } = await import('./lib/commands/agents.js');
    await agentLogs(args[0]);
    break;
  }
  case 'agents:create': {
    const { createAgent } = await import('./lib/commands/agents.js');
    await createAgent(args[0]);
    break;
  }

  // ── Status ───────────────────────────────────────────────────────────
  case 'status':
  case 'dashboard': {
    const { default: status } = await import('./lib/commands/status.js');
    await status();
    break;
  }
  case 'channels': {
    const { default: channels } = await import('./lib/commands/channels.js');
    await channels();
    break;
  }

  // ── Teleport ─────────────────────────────────────────────────────────
  case 'teleport': {
    const { default: teleport } = await import('./lib/commands/teleport.js');
    await teleport(args);
    break;
  }

  // ── Docker helpers ───────────────────────────────────────────────────
  case 'up':
    dockerUp(args);
    break;
  case 'down':
    dockerDown();
    break;
  case 'restart':
    dockerRestart(args);
    break;
  case 'logs':
    dockerLogs(args[0]);
    break;

  // ── Open ────────────────────────────────────────────────────────────
  case 'open': {
    const page = args[0] || '';
    const { getFrontendUrl } = await import('./lib/api.js');
    const url = page ? `${getFrontendUrl()}/${page}` : getFrontendUrl();
    try {
      const open = (await import('open')).default;
      await open(url);
      console.log(`\n  Opened ${url}\n`);
    } catch {
      console.log(`\n  Open: ${url}\n`);
    }
    break;
  }

  // ── Secrets ──────────────────────────────────────────────────────────
  case 'secrets': {
    const { listSecrets } = await import('./lib/commands/secrets.js');
    await listSecrets();
    break;
  }
  case 'env': {
    const { showEnv } = await import('./lib/commands/secrets.js');
    await showEnv();
    break;
  }
  case 'set-agent-secret': {
    const { setAgentSecret } = await import('./lib/commands/secrets.js');
    await setAgentSecret(args[0], args[1]);
    break;
  }
  case 'set-agent-llm-secret': {
    const { setAgentLlmSecret } = await import('./lib/commands/secrets.js');
    await setAgentLlmSecret(args[0], args[1]);
    break;
  }
  case 'set-var': {
    const { setVar } = await import('./lib/commands/secrets.js');
    await setVar(args[0], args[1]);
    break;
  }

  // ── Templates ────────────────────────────────────────────────────────
  case 'reset': {
    const { reset } = await import('./lib/commands/templates.js');
    reset(args[0]);
    break;
  }
  case 'diff': {
    const { diff } = await import('./lib/commands/templates.js');
    diff(args[0]);
    break;
  }

  // ── Help & fallback ──────────────────────────────────────────────────
  case '--help':
  case '-h':
  case 'help':
    await printUsage();
    break;
  default:
    await printUsage();
    process.exit(command ? 1 : 0);
}
