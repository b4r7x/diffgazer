import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const cliCompatibilityFixturesSource = resolve(
  packageRoot,
  "../server/src/shared/lib/ai/providers/fixtures/cli-compatibility",
);

const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf-8")) as {
  version: string;
};

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
  async onSuccess() {
    const fixtureDest = resolve(packageRoot, "dist/fixtures/cli-compatibility");
    mkdirSync(fixtureDest, { recursive: true });
    cpSync(
      resolve(cliCompatibilityFixturesSource, "compatibility-records.json"),
      resolve(fixtureDest, "compatibility-records.json"),
    );
    cpSync(
      resolve(cliCompatibilityFixturesSource, "unsupported-records.json"),
      resolve(fixtureDest, "unsupported-records.json"),
    );
  },
});
