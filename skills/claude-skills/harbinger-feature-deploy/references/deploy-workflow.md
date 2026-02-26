# Deploy Workflow

## Feature Branch Strategy

```
main ← feature/{name} ← bugfix/{name}
```

1. Create branch: `git checkout -b feature/{name}`
2. Implement changes
3. Run pre-deploy checks: `bash skills/claude-skills/harbinger-feature-deploy/scripts/pre-deploy-check.sh`
4. Commit with conventional format
5. Push: `git push -u origin feature/{name}`
6. Create PR: `gh pr create --title "feat: {description}" --body "..."`

## Conventional Commits

Format: `type(scope): description`

Types:
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation only
- `refactor` — Code restructure without behavior change
- `style` — Formatting, missing semicolons
- `test` — Adding tests
- `chore` — Maintenance tasks

Scopes: `backend`, `frontend`, `agents`, `skills`, `ci`, `docker`

Examples:
```
feat(frontend): add scope manager page from Stitch design
fix(backend): handle nil pointer in heartbeat handler
docs(agents): add MAINTAINER agent profile documentation
refactor(frontend): extract ModelRouterSection from Settings
```

## Release Process

1. Ensure all checks pass
2. Update CHANGELOG.md
3. Bump version in package.json
4. Tag: `git tag -a v{X.Y.Z} -m "Release v{X.Y.Z}"`
5. Push tags: `git push --tags`
6. Create GitHub release: `gh release create v{X.Y.Z} --generate-notes`
