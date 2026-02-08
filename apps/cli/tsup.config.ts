import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: false,
  noExternal: ["@stargazer/core", "@stargazer/hooks", "@stargazer/server"],
});
