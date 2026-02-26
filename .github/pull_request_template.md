## Summary

<!-- 1-3 bullet points describing what this PR does -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] New agent
- [ ] Documentation update
- [ ] Security enhancement
- [ ] MCP plugin
- [ ] Workflow template
- [ ] Refactor / cleanup

## Components Affected

- [ ] Backend (Go API)
- [ ] Frontend (React SPA)
- [ ] Agent profiles
- [ ] Skills
- [ ] MCP plugins
- [ ] Docker / CI
- [ ] Documentation

## Testing

- [ ] Backend builds: `cd backend && go build -o /dev/null ./cmd/`
- [ ] Frontend builds: `pnpm build:ui`
- [ ] Manual testing done
- [ ] No regressions in existing features

## Checklist

- [ ] Code follows Obsidian Command design system
- [ ] No `console.log` in production code
- [ ] No hardcoded API keys or secrets
- [ ] No `any` types without justification
- [ ] Routes registered in both `/api/` and `/api/v1/` prefixes
- [ ] CHANGELOG.md updated (if user-facing change)
- [ ] Documentation updated (if applicable)
- [ ] Read and followed CLAUDE.md rules
