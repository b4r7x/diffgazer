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
  // The bundled server pulls in CommonJS dependencies (undici and friends) that
  // esbuild leaves as `__require(...)` calls. ESM output has no `require`, so
  // without this the binary throws `Dynamic require of "assert" is not
  // supported` the moment the TUI boots its server.
  banner: {
    js: [
      'import { createRequire as __createRequire } from "node:module";',
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  define: {
    __DIFFGAZER_VERSION__: JSON.stringify(packageJson.version),
  },
});
