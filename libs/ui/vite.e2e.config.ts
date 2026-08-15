import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@/components/ui": path.resolve(import.meta.dirname, "registry/ui"),
      "@/hooks": path.resolve(import.meta.dirname, "registry/hooks"),
      "@/lib": path.resolve(import.meta.dirname, "registry/lib"),
      "@diffgazer/keys": path.resolve(import.meta.dirname, "../keys/src/index.ts"),
    },
  },
});
