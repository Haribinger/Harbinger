# MAINTAINER — Skills

## Primary Skills

### code-health-scanning
Runs static analysis across the codebase. Detects `any` types in TypeScript, console.log statements, unused imports, convention violations, and test coverage gaps.

### dependency-management
Audits `package.json` and `go.mod` for outdated, deprecated, or vulnerable dependencies. Reports severity and suggests upgrade paths.

### convention-enforcement
Validates codebase against Harbinger conventions: naming patterns, directory structure, import ordering, color tokens, and design system compliance.

### report-generation
Produces structured health reports with metrics, trends, severity-grouped issues, and actionable recommendations. Outputs JSON for API storage and markdown for PRs.

### safe-fix-application
Applies auto-fixes for low-risk issues: console.log removal, unused import cleanup, trailing whitespace, missing semicolons. Always verifies build passes after fixing.

### pr-creation
Creates GitHub PRs with structured descriptions, health summaries, and diff previews. Labels PRs by severity. Uses `gh` CLI.

### smart-model-routing
Classifies task complexity and routes to the cheapest sufficient model. Local-first: trivial tasks never leave the system.
