import { resolve } from "node:path";
import { defineConfig, type Options } from "tsup";

const registrySourceRoot = resolve(import.meta.dirname, "../../libs/registry/src");
const registrySourceEntries = new Map([
  ["@diffgazer/registry/cli", resolve(registrySourceRoot, "cli/index.ts")],
  ["@diffgazer/registry/schemas", resolve(registrySourceRoot, "schemas.ts")],
]);
const registryRootNamespace = "diffgazer-registry-root";

const registrySourcePlugin: NonNullable<Options["esbuildPlugins"]>[number] = {
  name: "diffgazerRegistrySource",
  setup(build) {
    build.onResolve({ filter: /^@diffgazer\/registry$/ }, () => ({
      path: "@diffgazer/registry",
      namespace: registryRootNamespace,
    }));
    build.onLoad({ filter: /.*/, namespace: registryRootNamespace }, () => ({
      contents: [
        `export { computeIntegrity } from ${JSON.stringify(resolve(registrySourceRoot, "copy-bundle.ts"))};`,
        `export { rewriteKeysPackageImportsInContent } from ${JSON.stringify(resolve(registrySourceRoot, "imports/keys-rewrite.ts"))};`,
        `export { stripRelativeJsExtensions } from ${JSON.stringify(resolve(registrySourceRoot, "imports/relative-js.ts"))};`,
        `export { extractImportSpecifierRanges } from ${JSON.stringify(resolve(registrySourceRoot, "imports/specifiers.ts"))};`,
      ].join("\n"),
      loader: "ts",
      resolveDir: registrySourceRoot,
    }));
    build.onResolve({ filter: /^@diffgazer\/registry\/(?:cli|schemas)$/ }, (args) => {
      const sourcePath = registrySourceEntries.get(args.path);
      return sourcePath ? { path: sourcePath } : undefined;
    });
  },
};

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  splitting: false,
  sourcemap: false,
  dts: false,
  noExternal: [/^@diffgazer\/registry(\/.*)?$/],
  esbuildPlugins: [registrySourcePlugin],
});
