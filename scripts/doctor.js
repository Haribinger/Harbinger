#!/usr/bin/env node
/**
 * Harbinger Doctor - Diagnostics and troubleshooting script
 * Run: pnpm doctor
 */

import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { createInterface } from 'readline'
import { get } from 'http'
import { createConnection } from 'net'

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (q) => new Promise(resolve => rl.question(q, resolve))

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  step: (msg) => console.log(`\n${colors.cyan}▶${colors.reset} ${msg}`)
}

const checks = []

function check(name, fn) {
  checks.push({ name, fn })
}

async function runChecks() {
  console.log(`
╔════════════════════════════════════════════════════════╗
║         ${colors.cyan}Harbinger Doctor${colors.reset} - System Diagnostics         ║
║              Bug Bounty Hunting Platform               ║
╚════════════════════════════════════════════════════════╝
`)

  let passed = 0
  let failed = 0

  for (const { name, fn } of checks) {
    try {
      await fn()
      log.success(name)
      passed++
    } catch (err) {
      log.error(`${name}: ${err.message}`)
      failed++
    }
  }

  console.log(`
┌────────────────────────────────────────────────────────┐
│  Results: ${colors.green}${passed} passed${colors.reset} | ${colors.red}${failed} failed${colors.reset}                           │
└────────────────────────────────────────────────────────┘`)

  if (failed > 0) {
    console.log(`\n${colors.yellow}Run 'pnpm fix' to attempt automatic repairs${colors.reset}`)
  }

  rl.close()
}

// ===== CHECKS =====

check('Node.js version >= 18', () => {
  const version = process.version
  const major = parseInt(version.slice(1).split('.')[0])
  if (major < 18) throw new Error(`Node.js ${version} found, >= 18 required`)
})

check('pnpm is installed', () => {
  try {
    execSync('pnpm --version', { stdio: 'pipe' })
  } catch {
    throw new Error('pnpm not found. Install: npm install -g pnpm')
  }
})

check('.env file exists', () => {
  if (!existsSync('.env')) {
    throw new Error('.env not found. Run: cp .env.example .env')
  }
})

check('Required env vars set', () => {
  const env = readFileSync('.env', 'utf8')
  const required = ['JWT_SECRET', 'DB_PASSWORD']
  const missing = required.filter(key => !env.includes(`${key}=`) || env.includes(`${key}=\n`))
  if (missing.length) {
    throw new Error(`Missing: ${missing.join(', ')}`)
  }
})

check('Docker is running', () => {
  try {
    execSync('docker info', { stdio: 'pipe' })
  } catch {
    throw new Error('Docker daemon not running')
  }
})

check('Docker Compose available', () => {
  try {
    execSync('docker compose version', { stdio: 'pipe' })
  } catch {
    throw new Error('docker compose not found')
  }
})

check('Frontend dependencies installed', () => {
  if (!existsSync('harbinger-tools/frontend/node_modules')) {
    throw new Error('Run: cd harbinger-tools/frontend && pnpm install')
  }
})

check('Backend build possible', () => {
  if (!existsSync('backend/go.mod')) {
    throw new Error('Backend go.mod missing')
  }
})

check('config/services.json exists', () => {
  if (!existsSync('config/services.json')) {
    throw new Error('Services config missing')
  }
})

check('Backend API reachable at :8080', async () => {
  await new Promise((resolve, reject) => {
    const req = get('http://localhost:8080/api/health', (res) => {
      res.resume()
      if (res.statusCode < 500) resolve()
      else reject(new Error(`HTTP ${res.statusCode}`))
    })
    req.on('error', () => reject(new Error('Not reachable. Run: docker compose up -d backend')))
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('Timed out')) })
  })
})

check('PostgreSQL reachable at :5432', async () => {
  await new Promise((resolve, reject) => {
    const sock = createConnection({ host: 'localhost', port: 5432 })
    sock.setTimeout(2000)
    sock.on('connect', () => { sock.destroy(); resolve() })
    sock.on('error', () => reject(new Error('Not reachable. Run: docker compose up -d postgres')))
    sock.on('timeout', () => { sock.destroy(); reject(new Error('Timed out')) })
  })
})

// ===== FIX COMMAND =====
async function runFix() {
  log.step('Attempting automatic fixes...')

  // Create .env from example if missing
  if (!existsSync('.env') && existsSync('.env.example')) {
    log.info('Creating .env from .env.example')
    const example = readFileSync('.env.example', 'utf8')
    const jwtSecret = require('crypto').randomBytes(32).toString('hex')
    const dbPassword = require('crypto').randomBytes(16).toString('hex')
    const env = example
      .replace('JWT_SECRET=', `JWT_SECRET=${jwtSecret}`)
      .replace('DB_PASSWORD=', `DB_PASSWORD=${dbPassword}`)
    require('fs').writeFileSync('.env', env)
    log.success('.env created with random secrets')
  }

  // Install dependencies
  if (!existsSync('harbinger-tools/frontend/node_modules')) {
    log.info('Installing frontend dependencies...')
    try {
      execSync('pnpm install', { stdio: 'inherit' })
      log.success('Dependencies installed')
    } catch {
      log.error('Failed to install dependencies')
    }
  }

  console.log('\n✓ Fixes applied. Run "pnpm doctor" again to verify.')
  rl.close()
}

// ===== MAIN =====
const command = process.argv[2]

if (command === 'fix') {
  runFix()
} else {
  runChecks()
}
