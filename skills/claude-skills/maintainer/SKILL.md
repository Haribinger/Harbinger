---
name: Maintainer
description: >
  Code quality maintenance skill. Runs health scans, applies safe auto-fixes,
  computes health scores, and creates PRs for nightly maintenance cycles.
  Orchestrates harbinger-healthcheck and harbinger-maintain tools.
agent: MAINTAINER
category: maintainer
---

# Maintainer Skill

## Overview

Automated code quality enforcement for the Harbinger codebase. Runs nightly
at 02:00 UTC or on-demand via workflow dispatch.

## Scripts

- `run-maintenance.sh` — Full scan cycle producing JSON metrics
- `safe-fix.sh` — Creates branch, applies safe fixes, verifies build, opens PR

## Triggers

- Cron: `0 2 * * *`
- Manual: `workflow_dispatch`
- PR: Runs as health check on pull requests

## Outputs

- Health score (0-100)
- Structured JSON metrics
- GitHub PR with fix diff
- Channel notifications
