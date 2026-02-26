# Commit Conventions

## Format
```
type(scope): short description

Longer explanation if needed.
- Bullet points for multiple changes
- Reference issues with #123

Co-Authored-By: Agent Name <agent@harbinger.local>
```

## Types
| Type | When |
|------|------|
| feat | New feature or capability |
| fix | Bug fix |
| docs | Documentation changes only |
| refactor | Code change that neither fixes a bug nor adds a feature |
| style | Whitespace, formatting, missing semicolons |
| test | Adding or fixing tests |
| chore | Build process, dependency updates, maintenance |
| perf | Performance improvement |
| ci | CI/CD configuration changes |

## Scopes
| Scope | Location |
|-------|----------|
| backend | backend/cmd/ |
| frontend | harbinger-tools/frontend/src/ |
| agents | agents/ |
| skills | skills/ |
| ci | .github/workflows/ |
| docker | docker-compose.yml, Dockerfiles |
| mcp | mcp-plugins/ |

## Examples
```
feat(backend): add code health API endpoints
feat(frontend): add scope manager page from Stitch design
fix(backend): validate OAuth state before token exchange
docs(agents): document MAINTAINER nightly schedule
refactor(frontend): split Settings into section components
chore(ci): add PR health check GitHub Action
```
