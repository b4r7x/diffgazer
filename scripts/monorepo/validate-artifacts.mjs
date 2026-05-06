#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertNoDuplicateDemoKeys,
  validateArtifactMirror,
  validateIntegrityBundle,
  validateLibraryArtifacts,
} from "../../apps/docs/scripts/artifact-validation-lib.mjs";

const root = process.cwd();

const checks = [
  ...validateLibraryArtifacts({
    rootDir: resolve(root, "libs/ui"),
    label: "@diffgazer/ui",
  }),
  ...validateLibraryArtifacts({
    rootDir: resolve(root, "libs/keys"),
    label: "@diffgazer/keys",
  }),
  ...validateArtifactMirror(
    resolve(root, "libs/keys/dist/artifacts"),
    resolve(root, "libs/keys/artifacts/dist/artifacts"),
    "@diffgazer/keys-artifacts mirror",
  ),
  ...validateIntegrityBundle(
    resolve(root, "cli/add/src/generated/keys-copy-bundle.json"),
    ["items"],
    "@diffgazer/add keys copy bundle",
  ),
  ...validateIntegrityBundle(
    resolve(root, "cli/add/src/generated/registry-bundle.json"),
    ["items", "theme", "styles"],
    "@diffgazer/add registry bundle",
  ),
];

const registryBundle = JSON.parse(
  readFileSync(resolve(root, "cli/add/src/generated/registry-bundle.json"), "utf-8"),
);
checks.push(...assertNoDuplicateDemoKeys(registryBundle.items ?? [], "@diffgazer/add registry bundle"));

if (checks.length > 0) {
  throw new Error(["Artifact validation failed.", ...checks].join("\n"));
}

console.log("OK: artifact validation passed");
