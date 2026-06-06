import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_PROXY_TARGET = process.env.VITE_API_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 750,
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
