import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Generator, getConfig } from "@tanstack/router-generator";

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(DOCS_ROOT, "src/routeTree.gen.ts");

if (existsSync(OUTPUT)) {
  process.exit(0);
}

const config = getConfig({}, DOCS_ROOT);
const generator = new Generator({ config, root: DOCS_ROOT });
await generator.run();
console.log("[generate-route-tree] Generated src/routeTree.gen.ts");
