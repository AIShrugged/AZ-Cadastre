import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Core (NestJS) API — presigned uploads, etc.
      '/api': {
        target: process.env.VITE_CORE_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      // The archive register (apps/registry-stub). Proxied for the same reason as
      // /documents — the register answers with no CORS headers, so the browser
      // has to stay on localhost:5173 — and reached at all by the one crossing
      // that is deliberately outside @cadastre/api-contracts: its workbook
      // import (ADR-0011 §1). There were three. The archive search went to /api
      // once the gateway published a route over the lookup (COMM-55), and the
      // sidebar's liveness probe went with the summary (COMM-58, COMM-59) — so
      // this route now exists for the import and nothing else (TECH_DEBT §10).
      '/registry': {
        target: process.env.VITE_REGISTRY_URL ?? 'http://localhost:3100',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/registry/, ''),
      },
      // S3-compatible storage (RustFS) — presigned upload URLs. Proxying through
      // Vite keeps the browser on one origin (localhost:5173) and eliminates CORS
      // issues since the dev server automatically adds CORS headers.
      '/documents': {
        target: process.env.VITE_S3_URL ?? 'http://localhost:9000',
        changeOrigin: true,
        rewrite: path => path, // Keep the path as-is
      },
    },
  },
  build: {
    outDir: 'build',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
