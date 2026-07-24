import { defineConfig } from "vite";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Core (NestJS) API — presigned uploads, etc.
      "/api": {
        target: process.env.VITE_CORE_URL ?? "http://localhost:3000",
        changeOrigin: true,
      },
      // S3-compatible storage (RustFS) — presigned upload URLs. Proxying through
      // Vite keeps the browser on one origin (localhost:5173) and eliminates CORS
      // issues since the dev server automatically adds CORS headers.
      "/documents": {
        target: process.env.VITE_S3_URL ?? "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path) => path, // Keep the path as-is
      },
    },
  },
  build: {
    outDir: "build",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
