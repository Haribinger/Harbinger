/**
 * SafeFixer — Applies low-risk code fixes with rollback capability.
 *
 * Only touches patterns that are safe to auto-fix:
 * - console.log removal (NOT console.error/warn)
 * - Unused import cleanup
 * - Trailing whitespace
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

class SafeFixer {
  constructor(opts = {}) {
    this.projectRoot = opts.projectRoot || process.cwd()
    this.backups = new Map() // file → original content
  }

  /**
   * Identify fixable issues by type.
   * Returns { autoFixable, requiresApproval }
   */
  identify(scans) {
    const autoFixable = []
    const requiresApproval = []

    if (scans.consoleLogs > 0) {
      autoFixable.push({
        type: 'console-log',
        description: `${scans.consoleLogs} console.log statements found`,
        severity: 'low',
      })
    }

    if (scans.anyTypes > 0) {
      requiresApproval.push({
        type: 'any-types',
        description: `${scans.anyTypes} explicit 'any' types found`,
        severity: 'medium',
        suggestion: 'Replace with specific types or use unknown',
      })
    }

    if (scans.depsOutdated > 0) {
      requiresApproval.push({
        type: 'deps-outdated',
        description: `${scans.depsOutdated} outdated dependencies`,
        severity: 'medium',
        suggestion: 'Run pnpm update and test',
      })
    }

    return { autoFixable, requiresApproval }
  }

  /**
   * Apply all safe fixes. Returns array of fix descriptions.
   */
  apply(issues) {
    const applied = []

    for (const issue of issues) {
      switch (issue.type) {
        case 'console-log':
          applied.push(...this.fixConsoleLogs())
          break
        case 'unused-import':
          applied.push(...this.removeUnusedImports())
          break
        default:
          break
      }
    }

    return applied
  }

  /**
   * Remove console.log statements from TypeScript/JavaScript files.
   * Preserves console.error, console.warn, console.info.
   */
  fixConsoleLogs() {
    const fixes = []

    try {
      const files = execSync(
        `rg -l 'console\\.log' --type ts --glob '!node_modules' --glob '!dist' --glob '!*.test.*' --glob '!*.spec.*' ${this.projectRoot} 2>/dev/null || true`,
        { encoding: 'utf-8' }
      ).split('\n').filter(Boolean)

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        this.backups.set(file, content)

        // Remove standalone console.log lines (not part of larger expressions)
        const cleaned = content.replace(
          /^\s*console\.log\(.*?\);?\s*$/gm,
          ''
        )

        // Remove empty lines left behind (collapse double blanks)
        const collapsed = cleaned.replace(/\n{3,}/g, '\n\n')

        if (collapsed !== content) {
          fs.writeFileSync(file, collapsed, 'utf-8')
          const removed = (content.match(/console\.log/g) || []).length
          fixes.push({
            file: path.relative(this.projectRoot, file),
            type: 'console-log-removed',
            count: removed,
          })
        }
      }
    } catch (err) {
      fixes.push({ type: 'error', message: `console.log fix failed: ${err.message}` })
    }

    return fixes
  }

  /**
   * Remove unused imports (TypeScript).
   * Uses a conservative approach — only removes imports not referenced anywhere in the file.
   */
  removeUnusedImports() {
    const fixes = []

    try {
      const files = execSync(
        `rg -l '^import ' --type ts --glob '!node_modules' --glob '!dist' ${this.projectRoot} 2>/dev/null || true`,
        { encoding: 'utf-8' }
      ).split('\n').filter(Boolean)

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')
        let changed = false

        const newLines = lines.filter(line => {
          // Match: import { Foo } from 'bar'
          const match = line.match(/^import\s+\{\s*(\w+)\s*\}\s+from\s+/)
          if (!match) return true

          const importName = match[1]
          // Check if the import is used elsewhere in the file (excluding the import line itself)
          const rest = content.replace(line, '')
          const usagePattern = new RegExp(`\\b${importName}\\b`)
          if (!usagePattern.test(rest)) {
            changed = true
            return false
          }
          return true
        })

        if (changed) {
          this.backups.set(file, content)
          fs.writeFileSync(file, newLines.join('\n'), 'utf-8')
          fixes.push({
            file: path.relative(this.projectRoot, file),
            type: 'unused-import-removed',
          })
        }
      }
    } catch (err) {
      fixes.push({ type: 'error', message: `unused import fix failed: ${err.message}` })
    }

    return fixes
  }

  /**
   * Rollback all changes by restoring backups.
   */
  rollback() {
    for (const [file, content] of this.backups) {
      fs.writeFileSync(file, content, 'utf-8')
    }
    this.backups.clear()
  }
}

module.exports = SafeFixer
