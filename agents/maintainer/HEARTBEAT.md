# MAINTAINER — Heartbeat Protocol

## Interval
60 seconds

## Health Check Sequence

1. **Process alive** — Agent process responding
2. **Memory usage** — Under 1024MB limit
3. **CPU usage** — Under 2 CPU limit
4. **Disk access** — Can read codebase, can write to workspace
5. **Git access** — Can pull latest, can create branches
6. **API connectivity** — Can reach Harbinger backend `/api/health`

## Status Codes

| Code | Meaning |
|------|---------|
| `healthy` | All checks pass |
| `degraded` | Non-critical check failed (e.g., channel notification) |
| `unhealthy` | Critical check failed (e.g., no codebase access) |
| `idle` | Not scheduled to run, waiting for next cycle |

## Recovery

- On `degraded`: Log warning, continue operation
- On `unhealthy`: Stop current task, notify operator, wait for manual intervention
- On 3 consecutive `unhealthy`: Self-restart container
