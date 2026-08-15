import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Generator, getConfig } from "@tanstack/router-generator";
// Shared with vite.config.ts: the build plugin and this standalone generator
// (used by `test` and `type-check`) must emit the same routeTree.gen.ts, and the
// artifact is gitignored so any divergence would be silent.
import routeTreeConfig from "../config/route-tree.json" with { type: "json" };

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const config = getConfig(
  { routeFileIgnorePattern: routeTreeConfig.routeFileIgnorePattern },
  DOCS_ROOT,
);
const generator = new Generator({ config, root: DOCS_ROOT });
await generator.run();
console.log("[generate-route-tree] Generated src/routeTree.gen.ts");
