/// <reference types="vite/client" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api/redteam': {
        target: 'http://localhost:3004',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/redteam/, '../../../mcp-plugins/mcp-ui'),
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
      '/mcp/hexstrike': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mcp\/hexstrike/, '../../../mcp-plugins/mcp-ui'),
      },
      '/mcp/pentagi': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mcp\/pentagi/, '../../../mcp-plugins/mcp-ui'),
      },
      '../../../mcp-plugins/mcp-ui': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mcp\/ui/, '../../../mcp-plugins/mcp-ui'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
