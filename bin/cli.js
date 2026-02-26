#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const command = process.argv[2];
const args = process.argv.slice(3);

// Files tightly coupled to the package version that are auto-updated by init.
// These live in the user's project because GitHub/Docker require them at specific paths,
// but they shouldn't drift from the package version.
const MANAGED_PATHS = [
  '.github/workflows/',
  'docker/event-handler/',
  'docker-compose.yml',
  '.dockerignore',
];

function isManaged(relPath) {
  return MANAGED_PATHS.some(p => relPath === p || relPath.startsWith(p));
}

// Files that must never be scaffolded directly (use .template suffix instead).
const EXCLUDED_FILENAMES = ['CLAUDE.md'];

// Files ending in .template are scaffolded with the suffix stripped.
// e.g. .gitignore.template → .gitignore, CLAUDE.md.template → CLAUDE.md
function destPath(templateRelPath) {
  if (templateRelPath.endsWith('.template')) {
    return templateRelPath.slice(0, -'.template'.length);
  }
  return templateRelPath;
}

function templatePath(userPath, templatesDir) {
  const withSuffix = userPath + '.template';
  if (fs.existsSync(path.join(templatesDir, withSuffix))) {
    return withSuffix;
  }
  return userPath;
}

function printUsage() {
  console.log(`
\x1b[1;33m  ██╗  ██╗ █████╗ ██████╗ ██████╗ ██╗███╗   ██╗ ██████╗ ███████╗██████╗\x1b[0m
\x1b[1;33m  ██║  ██║██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║██╔════╝ ██╔════╝██╔══██╗\x1b[0m
\x1b[1;33m  ███████║███████║██████╔╝██████╔╝██║██╔██╗ ██║██║  ███╗█████╗  ██████╔╝\x1b[0m
\x1b[1;33m  ██╔══██║██╔══██║██╔══██╗██╔══██╗██║██║╚██╗██║██║   ██║██╔══╝  ██╔══██╗\x1b[0m
\x1b[1;33m  ██║  ██║██║  ██║██║  ██║██████╔╝██║██║ ╚████║╚██████╔╝███████╗██║  ██║\x1b[0m
\x1b[1;33m  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝\x1b[0m

Usage: harbinger <command>

\x1b[1mSetup & Configuration\x1b[0m
  init                              Scaffold a new harbinger project
  setup                             Run unified setup wizard (AI, Auth, Channels)
  setup-platform                    Configure Platform only (Bug Bounty UI)
  setup-telegram                    Reconfigure Telegram bot webhook
  setup-discord                     Configure Discord bot integration
  reset-auth                        Regenerate AUTH_SECRET (invalidates all sessions)

\x1b[1mAgent Management\x1b[0m
  agents                            List all registered agents
  agents:templates                  Show available agent templates
  agents:spawn <id>                 Spawn an agent container
  agents:stop <id>                  Stop an agent container
  agents:logs <id>                  View agent container logs
  agents:create <template>          Create new agent from template

\x1b[1mPlatform Status\x1b[0m
  status                            Show platform health and service status
  channels                          List configured channels (Discord, Telegram, Slack)

\x1b[1mSecrets & Variables\x1b[0m
  set-agent-secret <KEY> [VALUE]    Set a GitHub secret with AGENT_ prefix
  set-agent-llm-secret <KEY> [VALUE]  Set a GitHub secret with AGENT_LLM_ prefix
  set-var <KEY> [VALUE]             Set a GitHub repository variable

\x1b[1mProject Management\x1b[0m
  reset [file]                      Restore a template file (or list available)
  diff [file]                       Show differences vs. package templates
`);
}

/**
 * Collect all template files as relative paths.
 */
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

  // Guard: warn if the directory is not empty (unless it's an existing harbinger project)
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
      // File doesn't exist — create it
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      created.push(outPath);
      console.log(`  Created ${outPath}`);
    } else {
      // File exists — check if template has changed
      const srcContent = fs.readFileSync(src);
      const destContent = fs.readFileSync(dest);
      if (srcContent.equals(destContent)) {
        skipped.push(outPath);
      } else if (!noManaged && isManaged(outPath)) {
        // Managed file differs — auto-update to match package
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

  // Create package.json if it doesn't exist
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

  // Create .gitkeep files for empty dirs
  const gitkeepDirs = ['cron', 'triggers', 'logs', 'tmp', 'data'];
  for (const dir of gitkeepDirs) {
    const gitkeep = path.join(cwd, dir, '.gitkeep');
    if (!fs.existsSync(gitkeep)) {
      fs.mkdirSync(path.join(cwd, dir), { recursive: true });
      fs.writeFileSync(gitkeep, '');
    }
  }

  // Create default skill symlinks (brave-search, browser-tools)
  const defaultSkills = ['brave-search', 'browser-tools'];
  for (const skill of defaultSkills) {
    const symlink = path.join(cwd, '.pi', 'skills', skill);
    if (!fs.existsSync(symlink)) {
      fs.mkdirSync(path.dirname(symlink), { recursive: true });
      fs.symlinkSync(`../../pi-skills/${skill}`, symlink);
      console.log(`  Created .pi/skills/${skill} → ../../pi-skills/${skill}`);
    }
  }

  // Report updated managed files
  if (updated.length > 0) {
    console.log('\n  Updated managed files:');
    for (const file of updated) {
      console.log(`    ${file}`);
    }
  }

  // Report changed templates
  if (changed.length > 0) {
    console.log('\n  Updated templates available:');
    console.log('  These files differ from the current package templates.');
    console.log('  This may be from your edits, or from a harbinger update.\n');
    for (const file of changed) {
      console.log(`    ${file}`);
    }
    console.log('\n  To view differences:  npx harbinger diff <file>');
    console.log('  To reset to default:  npx harbinger reset <file>');
  }

  // Run npm install
  console.log('\nInstalling dependencies...\n');
  execSync('npm install', { stdio: 'inherit', cwd });

  // Create or update .env with auto-generated infrastructure values
  const envPath = path.join(cwd, '.env');
  const { randomBytes } = await import('crypto');
  const harbingerPkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const version = harbingerPkg.version;

  if (!fs.existsSync(envPath)) {
    // Seed .env for new projects
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
    // Update HARBINGER_VERSION in existing .env
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

/**
 * List all available template files, or restore a specific one.
 */
function reset(filePath) {
  const packageDir = path.join(__dirname, '..');
  const templatesDir = path.join(packageDir, 'templates');
  const cwd = process.cwd();

  if (!filePath) {
    console.log('\nAvailable template files:\n');
    const files = getTemplateFiles(templatesDir);
    for (const file of files) {
      console.log(`  ${destPath(file)}`);
    }
    console.log('\nUsage: harbinger reset <file>');
    console.log('Example: harbinger reset config/SOUL.md\n');
    return;
  }

  const tmplPath = templatePath(filePath, templatesDir);
  const src = path.join(templatesDir, tmplPath);
  const dest = path.join(cwd, filePath);

  if (!fs.existsSync(src)) {
    console.error(`\nTemplate not found: ${filePath}`);
    console.log('Run "harbinger reset" to see available templates.\n');
    process.exit(1);
  }

  if (fs.statSync(src).isDirectory()) {
    console.log(`\nRestoring ${filePath}/...\n`);
    copyDirSyncForce(src, dest, tmplPath);
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`\nRestored ${filePath}\n`);
  }
}

/**
 * Show the diff between a user's file and the package template.
 */
function diff(filePath) {
  const packageDir = path.join(__dirname, '..');
  const templatesDir = path.join(packageDir, 'templates');
  const cwd = process.cwd();

  if (!filePath) {
    // Show all files that differ
    console.log('\nFiles that differ from package templates:\n');
    const files = getTemplateFiles(templatesDir);
    let anyDiff = false;
    for (const file of files) {
      const src = path.join(templatesDir, file);
      const outPath = destPath(file);
      const dest = path.join(cwd, outPath);
      if (fs.existsSync(dest)) {
        const srcContent = fs.readFileSync(src);
        const destContent = fs.readFileSync(dest);
        if (!srcContent.equals(destContent)) {
          console.log(`  ${outPath}`);
          anyDiff = true;
        }
      } else {
        console.log(`  ${outPath} (missing)`);
        anyDiff = true;
      }
    }
    if (!anyDiff) {
      console.log('  All files match package templates.');
    }
    console.log('\nUsage: harbinger diff <file>');
    console.log('Example: harbinger diff config/SOUL.md\n');
    return;
  }

  const tmplPath = templatePath(filePath, templatesDir);
  const src = path.join(templatesDir, tmplPath);
  const dest = path.join(cwd, filePath);

  if (!fs.existsSync(src)) {
    console.error(`\nTemplate not found: ${filePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(dest)) {
    console.log(`\n${filePath} does not exist in your project.`);
    console.log(`Run "harbinger reset ${filePath}" to create it.\n`);
    return;
  }

  try {
    // Use git diff for nice colored output, fall back to plain diff
    execSync(`git diff --no-index -- "${dest}" "${src}"`, { stdio: 'inherit' });
    console.log('\nFiles are identical.\n');
  } catch (e) {
    // git diff exits with 1 when files differ (output already printed)
    console.log(`\n  To reset: harbinger reset ${filePath}\n`);
  }
}

function copyDirSyncForce(src, dest, templateRelBase = '') {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_FILENAMES.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const templateRel = templateRelBase
      ? path.join(templateRelBase, entry.name)
      : entry.name;
    const outName = path.basename(destPath(templateRel));
    const destFile = path.join(dest, outName);
    if (entry.isDirectory()) {
      copyDirSyncForce(srcPath, destFile, templateRel);
    } else {
      fs.copyFileSync(srcPath, destFile);
      console.log(`  Restored ${path.relative(process.cwd(), destFile)}`);
    }
  }
}

function setup() {
  const setupScript = path.join(__dirname, '..', 'setup', 'setup-hub.mjs');
  try {
    execSync(`node ${setupScript}`, { stdio: 'inherit', cwd: process.cwd() });
  } catch {
    process.exit(1);
  }
}

function setupPlatform() {
  const setupScript = path.join(__dirname, '..', 'setup', 'setup-platform.mjs');
  try {
    execSync(`node ${setupScript}`, { stdio: 'inherit', cwd: process.cwd() });
  } catch {
    process.exit(1);
  }
}

function setupTelegram() {
  const setupScript = path.join(__dirname, '..', 'setup', 'setup-telegram.mjs');
  try {
    execSync(`node ${setupScript}`, { stdio: 'inherit', cwd: process.cwd() });
  } catch {
    process.exit(1);
  }
}

async function resetAuth() {
  const { randomBytes } = await import('crypto');
  const { updateEnvVariable } = await import(path.join(__dirname, '..', 'setup', 'lib', 'auth.mjs'));

  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('\n  No .env file found. Run "npm run setup" first.\n');
    process.exit(1);
  }

  const newSecret = randomBytes(32).toString('base64');
  updateEnvVariable('AUTH_SECRET', newSecret);
  console.log('\n  AUTH_SECRET regenerated.');
  console.log('  All existing sessions have been invalidated.');
  console.log('  Restart your server for the change to take effect.\n');
}

/**
 * Load GH_OWNER and GH_REPO from .env
 */
function loadRepoInfo() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('\n  No .env file found. Run "npm run setup" first.\n');
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  if (!env.GH_OWNER || !env.GH_REPO) {
    console.error('\n  GH_OWNER and GH_REPO not found in .env. Run "npm run setup" first.\n');
    process.exit(1);
  }
  return { owner: env.GH_OWNER, repo: env.GH_REPO };
}

/**
 * Prompt for a secret value interactively if not provided as an argument
 */
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

async function setAgentSecret(key, value) {
  if (!key) {
    console.error('\n  Usage: harbinger set-agent-secret <KEY> [VALUE]\n');
    console.error('  Example: harbinger set-agent-secret ANTHROPIC_API_KEY\n');
    process.exit(1);
  }

  if (!value) value = await promptForValue(key);

  const { owner, repo } = loadRepoInfo();
  const prefixedName = `AGENT_${key}`;

  const { setSecret } = await import(path.join(__dirname, '..', 'setup', 'lib', 'github.mjs'));
  const { updateEnvVariable } = await import(path.join(__dirname, '..', 'setup', 'lib', 'auth.mjs'));

  const result = await setSecret(owner, repo, prefixedName, value);
  if (result.success) {
    console.log(`\n  Set GitHub secret: ${prefixedName}`);
    updateEnvVariable(key, value);
    console.log(`  Updated .env: ${key}`);
    console.log('');
  } else {
    console.error(`\n  Failed to set ${prefixedName}: ${result.error}\n`);
    process.exit(1);
  }
}

async function setAgentLlmSecret(key, value) {
  if (!key) {
    console.error('\n  Usage: harbinger set-agent-llm-secret <KEY> [VALUE]\n');
    console.error('  Example: harbinger set-agent-llm-secret BRAVE_API_KEY\n');
    process.exit(1);
  }

  if (!value) value = await promptForValue(key);

  const { owner, repo } = loadRepoInfo();
  const prefixedName = `AGENT_LLM_${key}`;

  const { setSecret } = await import(path.join(__dirname, '..', 'setup', 'lib', 'github.mjs'));

  const result = await setSecret(owner, repo, prefixedName, value);
  if (result.success) {
    console.log(`\n  Set GitHub secret: ${prefixedName}\n`);
  } else {
    console.error(`\n  Failed to set ${prefixedName}: ${result.error}\n`);
    process.exit(1);
  }
}

async function setVar(key, value) {
  if (!key) {
    console.error('\n  Usage: harbinger set-var <KEY> [VALUE]\n');
    console.error('  Example: harbinger set-var LLM_MODEL claude-sonnet-4-5-20250929\n');
    process.exit(1);
  }

  if (!value) value = await promptForValue(key);

  const { owner, repo } = loadRepoInfo();

  const { setVariable } = await import(path.join(__dirname, '..', 'setup', 'lib', 'github.mjs'));

  const result = await setVariable(owner, repo, key, value);
  if (result.success) {
    console.log(`\n  Set GitHub variable: ${key}\n`);
  } else {
    console.error(`\n  Failed to set ${key}: ${result.error}\n`);
    process.exit(1);
  }
}

// ---- API helpers for new commands ----

function getApiBase() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/^HARBINGER_API=(.+)$/m);
    if (match) return match[1].trim();
  }
  return process.env.HARBINGER_API || 'http://localhost:8080';
}

function getToken() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    // Try GH_TOKEN for auth
    const match = content.match(/^GH_TOKEN=(.+)$/m);
    if (match) return match[1].trim();
  }
  return process.env.GH_TOKEN || '';
}

async function apiFetch(endpoint, options = {}) {
  const base = getApiBase();
  const token = getToken();
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
    console.error(`\n  \x1b[31m[x]\x1b[0m Cannot reach ${url}`);
    console.error(`      Is the backend running? Try: cd backend && go run ./cmd/\n`);
    process.exit(1);
  }
}

async function showStatus() {
  console.log('\n  \x1b[1;33m[*]\x1b[0m Harbinger Platform Status\n');

  const base = getApiBase();
  // Health check
  try {
    const resp = await fetch(`${base}/health`);
    const data = await resp.json();
    console.log(`  \x1b[32m[+]\x1b[0m API: ${base} — online`);
  } catch {
    console.log(`  \x1b[31m[x]\x1b[0m API: ${base} — offline`);
    console.log(`      Start with: cd backend && go run ./cmd/\n`);
    return;
  }

  // Services health
  try {
    const health = await apiFetch('/api/dashboard/health');
    if (Array.isArray(health)) {
      for (const svc of health) {
        const icon = svc.status === 'connected' ? '\x1b[32m[+]\x1b[0m' : '\x1b[31m[x]\x1b[0m';
        console.log(`  ${icon} ${svc.name}: :${svc.port} — ${svc.status}`);
      }
    }
  } catch {}

  // Agent count
  try {
    const agents = await apiFetch('/api/agents');
    const list = Array.isArray(agents) ? agents : (agents?.items || []);
    console.log(`\n  \x1b[36m[*]\x1b[0m Agents: ${list.length} registered`);
    const running = list.filter(a => a.status === 'running' || a.status === 'online' || a.status === 'working');
    if (running.length > 0) {
      console.log(`  \x1b[32m[+]\x1b[0m Active: ${running.length}`);
    }
  } catch {}

  // Channels
  try {
    const ch = await apiFetch('/api/channels');
    const active = [];
    if (ch.discord?.enabled) active.push('Discord');
    if (ch.telegram?.enabled) active.push('Telegram');
    if (ch.slack?.enabled) active.push('Slack');
    console.log(`  \x1b[36m[*]\x1b[0m Channels: ${active.length > 0 ? active.join(', ') : 'none configured'}`);
  } catch {}

  console.log('');
}

async function listAgents() {
  console.log('\n  \x1b[1;33m[*]\x1b[0m Registered Agents\n');
  const data = await apiFetch('/api/agents');
  const agents = Array.isArray(data) ? data : (data?.items || []);

  if (agents.length === 0) {
    console.log('  No agents registered. Create one with: harbinger agents:create <template>\n');
    return;
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(`  ${pad('ID', 10)} ${pad('NAME', 16)} ${pad('TYPE', 12)} ${pad('STATUS', 12)} CODENAME`);
  console.log(`  ${'─'.repeat(10)} ${'─'.repeat(16)} ${'─'.repeat(12)} ${'─'.repeat(12)} ${'─'.repeat(16)}`);
  for (const a of agents) {
    const statusColor = ['running', 'online', 'working'].includes(a.status) ? '\x1b[32m' :
                        a.status === 'error' ? '\x1b[31m' : '\x1b[33m';
    console.log(`  ${pad(a.id?.slice(0, 8) || '?', 10)} ${pad(a.name || '?', 16)} ${pad(a.type || '?', 12)} ${statusColor}${pad(a.status || '?', 12)}\x1b[0m ${a.codename || ''}`);
  }
  console.log('');
}

async function listTemplates() {
  console.log('\n  \x1b[1;33m[*]\x1b[0m Agent Templates\n');
  const data = await apiFetch('/api/agents/templates');
  const templates = Array.isArray(data) ? data : [];

  if (templates.length === 0) {
    console.log('  No templates available.\n');
    return;
  }

  for (const t of templates) {
    console.log(`  \x1b[36m${t.name}\x1b[0m (${t.type})`);
    console.log(`    ${t.description || ''}`);
    if (t.capabilities?.length) console.log(`    Capabilities: ${t.capabilities.join(', ')}`);
    console.log('');
  }
}

async function spawnAgent(agentId) {
  if (!agentId) {
    console.error('\n  Usage: harbinger agents:spawn <id>\n');
    process.exit(1);
  }
  console.log(`\n  \x1b[33m[*]\x1b[0m Spawning agent ${agentId}...`);
  const result = await apiFetch(`/api/agents/${agentId}/spawn`, { method: 'POST' });
  if (result.ok || result.containerId) {
    console.log(`  \x1b[32m[+]\x1b[0m Agent spawned! Container: ${result.containerId || 'pending'}\n`);
  } else {
    console.error(`  \x1b[31m[x]\x1b[0m Failed: ${result.error || JSON.stringify(result)}\n`);
  }
}

async function stopAgent(agentId) {
  if (!agentId) {
    console.error('\n  Usage: harbinger agents:stop <id>\n');
    process.exit(1);
  }
  console.log(`\n  \x1b[33m[*]\x1b[0m Stopping agent ${agentId}...`);
  const result = await apiFetch(`/api/agents/${agentId}/stop`, { method: 'POST' });
  if (result.ok) {
    console.log(`  \x1b[32m[+]\x1b[0m Agent stopped.\n`);
  } else {
    console.error(`  \x1b[31m[x]\x1b[0m Failed: ${result.error || JSON.stringify(result)}\n`);
  }
}

async function agentLogs(agentId) {
  if (!agentId) {
    console.error('\n  Usage: harbinger agents:logs <id>\n');
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

async function createAgent(templateName) {
  if (!templateName) {
    console.error('\n  Usage: harbinger agents:create <template-name>\n');
    console.error('  Run "harbinger agents:templates" to see available templates.\n');
    process.exit(1);
  }

  // Get templates
  const templates = await apiFetch('/api/agents/templates');
  const tmpl = (Array.isArray(templates) ? templates : []).find(
    t => t.name?.toLowerCase() === templateName.toLowerCase() ||
         t.type?.toLowerCase() === templateName.toLowerCase() ||
         t.id === templateName
  );

  if (!tmpl) {
    console.error(`\n  \x1b[31m[x]\x1b[0m Template "${templateName}" not found.`);
    console.error('  Available: ' + (Array.isArray(templates) ? templates : []).map(t => t.name || t.type).join(', '));
    console.log('');
    process.exit(1);
  }

  console.log(`\n  \x1b[33m[*]\x1b[0m Creating agent from template: ${tmpl.name}...`);
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
    console.log(`  \x1b[32m[+]\x1b[0m Agent created: ${result.id || result.name}\n`);
  } else {
    console.error(`  \x1b[31m[x]\x1b[0m Failed: ${result.error || JSON.stringify(result)}\n`);
  }
}

async function listChannels() {
  console.log('\n  \x1b[1;33m[*]\x1b[0m Configured Channels\n');
  const ch = await apiFetch('/api/channels');

  for (const [name, config] of Object.entries(ch)) {
    const c = config;
    const icon = c.enabled ? '\x1b[32m[+]\x1b[0m' : '\x1b[31m[-]\x1b[0m';
    const status = c.enabled ? `\x1b[32m${c.status}\x1b[0m` : '\x1b[31mdisabled\x1b[0m';
    console.log(`  ${icon} ${name.charAt(0).toUpperCase() + name.slice(1)}: ${status}${c.hasToken ? '' : ' (no token)'}`);
  }
  console.log('');
}

function setupDiscord() {
  // Check if setup script exists, otherwise inline
  const setupScript = path.join(__dirname, '..', 'setup', 'setup-discord.mjs');
  if (fs.existsSync(setupScript)) {
    try {
      execSync(`node ${setupScript}`, { stdio: 'inherit', cwd: process.cwd() });
      return;
    } catch {
      process.exit(1);
    }
  }

  // Inline Discord setup
  (async () => {
    const { text, isCancel } = await import('@clack/prompts');
    console.log('\n  \x1b[1;33m[*]\x1b[0m Discord Bot Setup\n');
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

    // Write to .env
    const { updateEnvVariable } = await import(path.join(__dirname, '..', 'setup', 'lib', 'auth.mjs')).catch(() => ({
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

    console.log('\n  \x1b[32m[+]\x1b[0m Discord bot configured!');
    console.log('  Restart the backend for changes to take effect.\n');
  })();
}

switch (command) {
  case 'init':
    await init();
    break;
  case 'setup':
    setup();
    break;
  case 'setup-platform':
    setupPlatform();
    break;
  case 'setup-telegram':
    setupTelegram();
    break;
  case 'setup-discord':
    setupDiscord();
    break;
  case 'reset-auth':
    await resetAuth();
    break;
  case 'reset':
    reset(args[0]);
    break;
  case 'diff':
    diff(args[0]);
    break;
  case 'status':
    await showStatus();
    break;
  case 'agents':
    await listAgents();
    break;
  case 'agents:templates':
    await listTemplates();
    break;
  case 'agents:spawn':
    await spawnAgent(args[0]);
    break;
  case 'agents:stop':
    await stopAgent(args[0]);
    break;
  case 'agents:logs':
    await agentLogs(args[0]);
    break;
  case 'agents:create':
    await createAgent(args[0]);
    break;
  case 'channels':
    await listChannels();
    break;
  case 'set-agent-secret':
    await setAgentSecret(args[0], args[1]);
    break;
  case 'set-agent-llm-secret':
    await setAgentLlmSecret(args[0], args[1]);
    break;
  case 'set-var':
    await setVar(args[0], args[1]);
    break;
  default:
    printUsage();
    process.exit(command ? 1 : 0);
}
