// Central configuration — single source of truth for all env-derived values.
//
// How API_BASE works:
//   - Local dev (pnpm dev):  VITE_API_URL is unset → API_BASE = '' → Vite proxy handles /api/*
//   - Docker build:          VITE_API_URL='' (Dockerfile ARG) → API_BASE = '' → nginx proxy handles /api/*
//   - Custom deployment:     VITE_API_URL='https://api.example.com' → API_BASE = that URL
//
// The empty-string default means "same origin" — all /api/* requests are relative,
// so both Vite dev proxy and Docker nginx proxy work automatically.

const env = (import.meta as any).env || {}

/** Base URL for all API requests. Empty string = relative (same-origin proxy). */
export const API_BASE: string = env.VITE_API_URL ?? ''

/** WebSocket URL (if separate from API). */
export const WS_URL: string = env.VITE_WS_URL ?? ''

/** MCP service URL. */
export const MCP_URL: string = env.VITE_MCP_URL ?? ''
