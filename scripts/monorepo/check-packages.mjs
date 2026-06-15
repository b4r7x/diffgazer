#!/usr/bin/env node

// publint + are-the-types-wrong on every published package, run against the
// built package directory (each entry packs its own tarball internally).
//
// attw flags: `--profile esm-only` is the correct profile for the four
// packages, which are all `"type": "module"` with no CJS build — it ignores the
// node10/CJS-resolution problems that are expected and harmless for ESM-only
// publishes while still catching real exports/types resolution breaks under
// node16-esm and bundler resolution. @diffgazer/ui's four `*.css` export
// subpaths carry no types or JS (they are stylesheet assets), so they are
// excluded from attw's type-resolution check; publint still validates them.

import { execFileSync } from "node:child_process";

const PUBLINT = "node_modules/publint/src/cli.js";
const ATTW = "node_modules/@arethetypeswrong/cli/dist/index.js";

const PACKAGES = [
  { name: "@diffgazer/ui", dir: "libs/ui", cssEntrypoints: true },
  { name: "@diffgazer/keys", dir: "libs/keys" },
  { name: "@diffgazer/add", dir: "cli/add" },
  { name: "diffgazer", dir: "cli/diffgazer" },
];

const UI_CSS_ENTRYPOINTS = ["./theme-base.css", "./theme.css", "./sources.css", "./styles.css"];

function run(label, file, args) {
  console.log(`\n=== ${label} ===`);
  try {
    execFileSync("node", [file, ...args], { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

let ok = true;

for (const pkg of PACKAGES) {
  if (!run(`publint ${pkg.name}`, PUBLINT, ["run", pkg.dir])) ok = false;

  const attwArgs = ["--pack", pkg.dir, "--profile", "esm-only"];
  if (pkg.cssEntrypoints) attwArgs.push("--exclude-entrypoints", ...UI_CSS_ENTRYPOINTS);
  if (!run(`attw ${pkg.name}`, ATTW, attwArgs)) ok = false;
}

if (!ok) {
  console.error("\ncheck:packages FAILED");
  process.exit(1);
}
console.log("\ncheck:packages PASSED");
