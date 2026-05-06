/**
 * Unified tsup config for the /ui npm package.
 *
 * Reads registry.json to auto-discover all entry points.
 * Maps registry types to output directories:
 *   registry:ui   → dist/components/{name}
 *   registry:hook  → dist/hooks/{name}
 *   registry:lib   → dist/lib/{name}
 *
 * Also adds lib/utils for the cn() utility.
 *
 * "use client" directives are stripped during code splitting, so the
 * onSuccess hook re-injects them post-build using each registry item's
 * `meta.client` flag.
 */

import { defineConfig } from "tsup";
import { resolve } from "node:path";
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import type { Plugin } from "esbuild";
import { type Registry, type RegistryItem, extractDiffgazerKeysHookNames } from "./shared/registry-types.js";

/** Maps a registry item to its dist output path (e.g. `components/button`). */
function registryItemToDistKey(item: Pick<RegistryItem, "type" | "name">): string {
  if (item.type === "registry:hook") return `hooks/${item.name}`;
  if (item.type === "registry:lib") return `lib/${item.name}`;
  return `components/${item.name}`;
}

const registryRoot = resolve(import.meta.dirname, "registry");
const registry = JSON.parse(readFileSync(resolve(registryRoot, "registry.json"), "utf-8")) as Registry;

/** Keys hooks derived from registry refs, with `use-` prefix for hook matching. */
const DIFFGAZER_KEYS_HOOKS = new Set([...extractDiffgazerKeysHookNames(registry.items)].map((name) => `use-${name}`));

const entry: Record<string, string> = {};

for (const item of registry.items) {
  if (item.type === "registry:theme") continue;

  const key = registryItemToDistKey(item);

  const file =
    item.files.find((f: { path: string }) => f.path.endsWith("index.ts"))?.path ??
    item.files[0].path;

  entry[key] = resolve(import.meta.dirname, file);
}

// Add utils (cn function)
entry["lib/utils"] = resolve(registryRoot, "lib/utils.ts");

/**
 * Esbuild plugin that rewrites @/ alias imports and drops .css imports.
 *
 * - @/lib/<name> → resolves within build
 * - @/hooks/use-<diffgazer-keys> → external @diffgazer/keys
 * - @/hooks/use-<diffgazer> → resolves within build
 * - @/components/ui/<name> → resolves within build
 * - *.css → empty module (component CSS is aggregated into styles.css in onSuccess)
 */
function aliasPlugin(): Plugin {
  return {
    name: "diffgazerUiResolver",
    setup(build) {
      // Drop CSS imports — component CSS is aggregated into styles.css in onSuccess
      build.onResolve({ filter: /\.css$/ }, () => ({
        path: "css-noop",
        namespace: "css-noop",
      }));
      build.onLoad({ filter: /.*/, namespace: "css-noop" }, () => ({
        contents: "",
        loader: "js",
      }));

      build.onResolve({ filter: /^@\/lib\// }, (args) => {
        const name = args.path.replace("@/lib/", "");
        const asFile = resolve(registryRoot, "lib", `${name}.ts`);
        if (existsSync(asFile)) return { path: asFile };
        return { path: resolve(registryRoot, "lib", name, "index.ts") };
      });

      build.onResolve({ filter: /^@\/hooks\// }, (args) => {
        const hookFile = args.path.replace("@/hooks/", "");
        if (DIFFGAZER_KEYS_HOOKS.has(hookFile)) {
          return { path: "@diffgazer/keys", external: true };
        }
        return { path: resolve(registryRoot, "hooks", `${hookFile}.ts`) };
      });

      build.onResolve({ filter: /^@\/components\/ui\// }, (args) => {
        const name = args.path.replace("@/components/ui/", "");
        return { path: resolve(registryRoot, "ui", name, "index.ts") };
      });
    },
  };
}

export default defineConfig({
  entry,
  format: ["esm"],
  dts: false,
  clean: true,
  splitting: true,
  outDir: "dist",
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@diffgazer/keys",
    "@diffgazer/keys/*",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
    "figlet",
  ],
  esbuildPlugins: [aliasPlugin()],
  async onSuccess() {
    const dist = resolve(import.meta.dirname, "dist");

    // Copy theme CSS files
    const stylesDir = resolve(import.meta.dirname, "styles");
    mkdirSync(dist, { recursive: true });
    cpSync(resolve(stylesDir, "theme-base.css"), resolve(dist, "theme-base.css"));
    cpSync(resolve(stylesDir, "theme.css"), resolve(dist, "theme.css"));
    cpSync(resolve(stylesDir, "styles.css"), resolve(dist, "styles.css"));

    // Append component CSS files to styles.css. Theme CSS is already imported
    // by styles.css and must not be appended after normal CSS rules.
    const componentCssFiles = registry.items.flatMap((item) =>
      item.type === "registry:theme"
        ? []
        : item.files
            .map((file: { path: string }) => file.path)
            .filter((path: string) => path.endsWith(".css")),
    );
    const stylesPath = resolve(dist, "styles.css");
    let stylesContent = readFileSync(stylesPath, "utf-8");
    for (const cssFile of componentCssFiles) {
      const cssPath = resolve(import.meta.dirname, cssFile);
      if (!existsSync(cssPath)) {
        throw new Error(`Registry CSS file is missing: ${cssFile}`);
      }
      stylesContent += `\n${readFileSync(cssPath, "utf-8")}`;
    }
    writeFileSync(stylesPath, stylesContent);

    // Inject "use client" into entry points marked with meta.client in registry.json.
    // esbuild strips these during code splitting, so we re-inject post-build.
    let injected = 0;
    for (const item of registry.items) {
      if (!item.meta?.client) continue;

      const filePath = resolve(dist, `${registryItemToDistKey(item)}.js`);
      if (!existsSync(filePath)) continue;

      const content = readFileSync(filePath, "utf-8");
      if (!content.startsWith('"use client"')) {
        writeFileSync(filePath, `"use client";\n${content}`);
        injected++;
      }
    }
    console.log(`Injected "use client" into ${injected} entry points`);

    // Warn about UI items missing meta.client
    const uiWithoutClient = registry.items.filter(
      (i) => i.type === "registry:ui" && !i.meta?.client
    );
    if (uiWithoutClient.length) {
      throw new Error(`UI items missing meta.client: ${uiWithoutClient.map((i) => i.name).join(", ")}`);
    }

    // Validate all entries produced output
    const missing: string[] = [];
    for (const key of Object.keys(entry)) {
      const outFile = resolve(dist, `${key}.js`);
      if (!existsSync(outFile)) {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new Error(`${missing.length} entry points missing from dist: ${missing.join(", ")}`);
    }
  },
});
