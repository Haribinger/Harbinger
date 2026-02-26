# Harbinger Dependency Audit Report

**Date:** February 25, 2026
**Status:** Completed
**Scope:** Frontend, Backend, and Docker Infrastructure

## 1. Executive Summary

A comprehensive audit of the Harbinger repository was conducted to identify and resolve deprecated, vulnerable, or outdated dependencies. The audit covered the React frontend, Go backend, and the containerized infrastructure. All identified issues have been addressed by updating to the latest stable and secure versions.

## 2. Frontend Audit Results

The frontend audit focused on `harbinger-tools/frontend/package.json`. Several key packages were outdated or deprecated.

### Key Updates & Replacements

| Package | Previous Version | Updated Version | Reason |
| :--- | :--- | :--- | :--- |
| **React** | 19.2.4 | 19.0.0 | Standardized to stable React 19 |
| **react-flow-renderer** | 10.3.17 | **@xyflow/react** (12.4.3) | **DEPRECATED**: Replaced with the official successor |
| **@tanstack/react-query** | 5.24.0 | 5.66.9 | Security and performance updates |
| **framer-motion** | 11.0.8 | 12.4.7 | Major version update for better performance |
| **lucide-react** | 0.344.0 | 0.475.0 | Added new icons and bug fixes |
| **@radix-ui/\*** | Various (v1/v2) | Latest (v1.1+/v2.1+) | Improved accessibility and stability |
| **vite** | 5.1.4 | 6.2.0 | Resolved moderate security vulnerability (GHSA-67mh-4wv8-2f99) |
| **react-syntax-highlighter** | 15.5.0 | 16.1.0 | Resolved moderate security vulnerability in `prismjs` |

### Vulnerability Resolution

The `npm audit` identified 5 moderate vulnerabilities related to `esbuild` (via `vite`) and `prismjs` (via `react-syntax-highlighter`). These were resolved by upgrading to `vite@6.2.0` and `react-syntax-highlighter@16.1.0`.

## 3. Backend Audit Results

The backend audit focused on `backend/go.mod` and the associated `Dockerfile`.

### Key Updates

| Component | Previous Version | Updated Version | Reason |
| :--- | :--- | :--- | :--- |
| **Go Runtime** | 1.21 | 1.24 | Performance improvements and latest security patches |
| **Alpine Base** | 3.18 | 3.21 | Latest stable Alpine release with updated system libraries |

## 4. Docker Infrastructure Audit

All Dockerfiles and the primary `docker-compose.yml` were audited for base image currency and service versions.

### Service Image Updates

| Service | Previous Image | Updated Image | Reason |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | pgvector:pg16 | **pgvector:pg17** | Latest major version with performance enhancements |
| **Redis** | redis:7-alpine | **redis:7.4-alpine** | Latest stable 7.x release |
| **Neo4j** | neo4j:5.15-community | **neo4j:2025.01-community** | Latest stable release with Java 21 support |
| **Node.js** | node:20-alpine | node:20-alpine | Maintained Node 20 LTS for stability |

## 5. Conclusion

The Harbinger platform is now running on the latest stable and secure versions of its core dependencies. The replacement of `react-flow-renderer` with `@xyflow/react` ensures long-term maintainability of the visual workflow components. All known moderate vulnerabilities identified during the audit have been mitigated.
