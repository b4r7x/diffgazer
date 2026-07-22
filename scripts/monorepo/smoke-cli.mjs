#!/usr/bin/env node

// Exit-code contract: this smoke runner exits non-zero when a check fails. A
// failed assertion throws, which Node surfaces as a non-zero exit; temp-dir
// cleanup runs in the try/finally blocks around each fixture before the throw
// propagates. Do not swap the throws for process.exit() — that would bypass the
// finally cleanup and leak fixture directories.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runCopyModeSmoke } from "./smoke-cli/copy-mode.mjs";
import { runPackageModeSmoke } from "./smoke-cli/package-mode.mjs";
import { runProductCliSmoke } from "./smoke-cli/product.mjs";

const root = process.cwd();
const dgaddBin = resolve(root, "cli/add/dist/index.js");
const diffgazerBin = resolve(root, "cli/diffgazer/dist/index.js");
const rootPackageManager = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf-8"),
).packageManager;

const ctx = { root, dgaddBin, diffgazerBin, rootPackageManager };

await runProductCliSmoke(ctx);
await runCopyModeSmoke(ctx);
await runPackageModeSmoke(ctx);

console.log("OK: CLI smoke checks passed");
