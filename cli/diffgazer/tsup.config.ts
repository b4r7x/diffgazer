import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const packageRoot = fileURLToPath(new URL(".", import.meta.url));

const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf-8")) as {
  version: string;
};

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: false,
  noExternal: ["@diffgazer/core", "@diffgazer/server", "@diffgazer/keys"],
  define: {
    __DIFFGAZER_VERSION__: JSON.stringify(packageJson.version),
  },
});
