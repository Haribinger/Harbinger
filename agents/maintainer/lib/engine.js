/**
 * MaintainerEngine — Orchestrates nightly code quality cycles.
 *
 * Workflow: scan → identify → fix → test → report → PR → notify
 */

const { execSync } = require('child_process')
const path = require('path')

class MaintainerEngine {
  constructor(opts = {}) {
    this.projectRoot = opts.projectRoot || process.cwd()
    this.apiBase = opts.apiBase || process.env.HARBINGER_API || 'http://localhost:8080'
    this.dryRun = opts.dryRun || false
    this.channels = opts.channels || [] // ['discord', 'telegram']
  }

  /**
   * Full nightly maintenance cycle.
   * Returns a structured report object.
   */
  async runNightly() {
    const report = {
      startedAt: new Date().toISOString(),
      scans: {},
      fixes: [],
      buildPass: false,
      score: 0,
      prUrl: null,
      errors: [],
    }

    try {
      // 1. Run health scans
      report.scans = this.runScans()

      // 2. Identify fixable issues
      const { autoFixable, requiresApproval } = this.categorize(report.scans)
      report.autoFixable = autoFixable.length
      report.requiresApproval = requiresApproval.length

      // 3. Apply safe fixes
      if (!this.dryRun && autoFixable.length > 0) {
        report.fixes = this.applySafeFixes(autoFixable)
      }

      // 4. Verify build
      report.buildPass = this.verifyBuild()
      if (!report.buildPass && report.fixes.length > 0) {
        this.rollbackFixes()
        report.fixes = []
        report.errors.push('Build failed after fixes — rolled back all changes')
      }

      // 5. Compute health score
      report.score = this.computeScore(report.scans)

      // 6. Store metrics via API
      await this.storeMetrics(report)

      // 7. Create PR if there are committed fixes
      if (report.fixes.length > 0 && !this.dryRun) {
        report.prUrl = this.createPR(report)
      }

      // 8. Notify channels
      await this.notify(report)

    } catch (err) {
      report.errors.push(err.message)
    }

    report.completedAt = new Date().toISOString()
    return report
  }

  /**
   * Run all health scans. Returns structured metrics.
   */
  runScans() {
    const scans = {}

    // Count `any` types in TypeScript
    try {
      const result = execSync(
        `rg -c ': any\\b' --type ts --glob '!node_modules' --glob '!dist' ${this.projectRoot} 2>/dev/null || true`,
        { encoding: 'utf-8' }
      )
      scans.anyTypes = result.split('\n').filter(Boolean).reduce((sum, line) => {
        const count = parseInt(line.split(':').pop(), 10)
        return sum + (isNaN(count) ? 0 : count)
      }, 0)
    } catch { scans.anyTypes = 0 }

    // Count console.log statements
    try {
      const result = execSync(
        `rg -c 'console\\.log' --type ts --type tsx --glob '!node_modules' --glob '!dist' ${this.projectRoot} 2>/dev/null || true`,
        { encoding: 'utf-8' }
      )
      scans.consoleLogs = result.split('\n').filter(Boolean).reduce((sum, line) => {
        const count = parseInt(line.split(':').pop(), 10)
        return sum + (isNaN(count) ? 0 : count)
      }, 0)
    } catch { scans.consoleLogs = 0 }

    // Count outdated dependencies
    try {
      const result = execSync('pnpm outdated --format json 2>/dev/null || echo "[]"', {
        encoding: 'utf-8', cwd: this.projectRoot
      })
      const deps = JSON.parse(result || '[]')
      scans.depsOutdated = Array.isArray(deps) ? deps.length : 0
    } catch { scans.depsOutdated = 0 }

    // Test coverage (placeholder — reads from coverage summary if exists)
    scans.testCoverage = 0
    try {
      const coveragePath = path.join(this.projectRoot, 'coverage', 'coverage-summary.json')
      const coverage = require(coveragePath)
      scans.testCoverage = Math.round(coverage.total?.lines?.pct || 0)
    } catch { /* no coverage data */ }

    // Convention violations
    scans.conventions = 0
    try {
      // Check for hardcoded colors outside design tokens
      const result = execSync(
        `rg -c '#[0-9a-fA-F]{6}' --type tsx --glob '!node_modules' --glob '!*.css' ${this.projectRoot} 2>/dev/null || true`,
        { encoding: 'utf-8' }
      )
      scans.conventions = result.split('\n').filter(Boolean).length
    } catch { /* skip */ }

    return scans
  }

  /**
   * Categorize issues into auto-fixable vs requires-approval.
   */
  categorize(scans) {
    const autoFixable = []
    const requiresApproval = []

    if (scans.consoleLogs > 0) {
      autoFixable.push({ type: 'console-log', count: scans.consoleLogs })
    }
    if (scans.anyTypes > 0) {
      requiresApproval.push({ type: 'any-types', count: scans.anyTypes })
    }
    if (scans.depsOutdated > 0) {
      requiresApproval.push({ type: 'deps-outdated', count: scans.depsOutdated })
    }

    return { autoFixable, requiresApproval }
  }

  /**
   * Apply safe fixes. Returns list of applied fixes.
   */
  applySafeFixes(issues) {
    const SafeFixer = require('./safe-fixer')
    const fixer = new SafeFixer({ projectRoot: this.projectRoot })
    return fixer.apply(issues)
  }

  /**
   * Verify the build passes after fixes.
   */
  verifyBuild() {
    try {
      execSync('cd backend && go build -o /dev/null ./cmd/', {
        cwd: this.projectRoot, stdio: 'pipe', timeout: 60000
      })
      execSync('pnpm build:ui', {
        cwd: this.projectRoot, stdio: 'pipe', timeout: 120000
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Rollback all uncommitted changes.
   */
  rollbackFixes() {
    try {
      execSync('git checkout -- .', { cwd: this.projectRoot, stdio: 'pipe' })
    } catch { /* already clean */ }
  }

  /**
   * Compute health score (0-100).
   */
  computeScore(scans) {
    let score = 100
    score -= (scans.anyTypes || 0) * 2
    score -= (scans.consoleLogs || 0)
    score -= (scans.depsOutdated || 0) * 3
    score += (scans.testCoverage || 0) // bonus for coverage
    return Math.max(0, Math.min(100, score))
  }

  /**
   * Store metrics to the Harbinger API.
   */
  async storeMetrics(report) {
    try {
      const body = JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        any_types: report.scans.anyTypes || 0,
        console_logs: report.scans.consoleLogs || 0,
        test_coverage: report.scans.testCoverage || 0,
        deps_outdated: report.scans.depsOutdated || 0,
        conventions: report.scans.conventions || 0,
        score: report.score,
      })
      await fetch(`${this.apiBase}/api/health/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    } catch (err) {
      report.errors.push(`Failed to store metrics: ${err.message}`)
    }
  }

  /**
   * Create a GitHub PR with the maintenance report.
   */
  createPR(report) {
    const date = new Date().toISOString().split('T')[0]
    const branch = `maintainer/${date}`

    try {
      execSync(`git checkout -b ${branch}`, { cwd: this.projectRoot, stdio: 'pipe' })
      execSync('git add -A', { cwd: this.projectRoot, stdio: 'pipe' })
      execSync(
        `git commit -m "chore(maintainer): nightly maintenance ${date}\n\nScore: ${report.score}/100\nFixed: ${report.fixes.length} issues\nRequires review: ${report.requiresApproval || 0} issues"`,
        { cwd: this.projectRoot, stdio: 'pipe' }
      )
      execSync(`git push origin ${branch}`, { cwd: this.projectRoot, stdio: 'pipe' })

      const prUrl = execSync(
        `gh pr create --title "chore(maintainer): nightly ${date}" --body "## Maintenance Report\n\n- Score: ${report.score}/100\n- Auto-fixed: ${report.fixes.length}\n- Requires review: ${report.requiresApproval || 0}" --base main`,
        { cwd: this.projectRoot, encoding: 'utf-8', stdio: 'pipe' }
      ).trim()

      return prUrl
    } catch (err) {
      report.errors.push(`PR creation failed: ${err.message}`)
      return null
    }
  }

  /**
   * Notify configured channels about the maintenance run.
   */
  async notify(report) {
    const summary = `MAINTAINER Report: Score ${report.score}/100 | Fixed ${report.fixes.length} | Review needed: ${report.requiresApproval || 0}${report.prUrl ? ` | PR: ${report.prUrl}` : ''}`

    for (const channel of this.channels) {
      try {
        await fetch(`${this.apiBase}/api/channels/relay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel,
            agent: 'MAINTAINER',
            message: summary,
          }),
        })
      } catch { /* non-critical, skip */ }
    }
  }
}

module.exports = MaintainerEngine
