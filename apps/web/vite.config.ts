import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolveApiEndpoint } from "./src/lib/api-endpoint";

const API_PROXY_TARGET = resolveApiEndpoint(process.env.VITE_API_URL, "http://127.0.0.1:3000");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        // React, the router and the query client change on dependency bumps, not
        // on app edits, so they get their own long-lived chunk. Routes are
        // already split; without this the entry chunk carries them and breaches
        // the budget above.
        manualChunks: {
          vendor: ["react", "react-dom/client", "@tanstack/react-router", "@tanstack/react-query"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3001,
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
