import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: false,
  noExternal: ["@diffgazer/core", "@diffgazer/server", "@diffgazer/keys"],
  define: {
    __DIFFGAZER_VERSION__: JSON.stringify(packageJson.version),
  },
});
