import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: false,
  noExternal: ["@diffgazer/core", "@diffgazer/hooks", "@diffgazer/server"],
});
