#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { listRepoFiles } from "./lib/files.mjs";
import { readJson } from "./lib/json.mjs";

// First-publish allowlist. `diffgazer` is already live on npm; the scoped
// packages (@diffgazer/ui, @diffgazer/keys, @diffgazer/add) stay gated per
// PACKAGE_GOVERNANCE.md until each is intentionally un-gated by a reviewed PR
// that adds it here.
const FIRST_PUBLISH_ALLOWLIST = ["diffgazer"];

function listPackageJsonFiles() {
  return listRepoFiles().filter(
    (path) => path.endsWith("package.json") && !path.includes("node_modules/"),
  );
}

export function isPublicPackage(parsed) {
  return Boolean(parsed.name) && parsed.private !== true;
}

function listPublicPackages() {
  const packages = [];
  for (const file of listPackageJsonFiles()) {
    const parsed = readJson(file);
    if (!isPublicPackage(parsed)) continue;
    packages.push({ name: parsed.name, file });
  }
  return packages;
}

function isPublished(name) {
  try {
    execFileSync("npm", ["view", name, "versions", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    if (stderr.includes("E404") || stderr.includes("404 Not Found")) {
      return false;
    }
    throw new Error(`npm view ${name} failed (not an E404):\n${stderr || error.message}`);
  }
}

// Pure decision: which public packages would be a FIRST publish (absent from
// the registry) yet are not in the allowlist. Factored out so the gate can be
// unit-tested without npm/network access.
export function findBlockedFirstPublishes({ packages, publishedNames, allowlist }) {
  const published = new Set(publishedNames);
  const allowed = new Set(allowlist);
  return packages.filter((pkg) => !published.has(pkg.name)).filter((pkg) => !allowed.has(pkg.name));
}

function main() {
  const packages = listPublicPackages();
  const publishedNames = packages.filter((pkg) => isPublished(pkg.name)).map((pkg) => pkg.name);

  const blocked = findBlockedFirstPublishes({
    packages,
    publishedNames,
    allowlist: FIRST_PUBLISH_ALLOWLIST,
  });

  if (blocked.length > 0) {
    const names = blocked.map((pkg) => pkg.name).join(", ");
    console.error(`Publish guard: refusing to first-publish gated packages: ${names}`);
    console.error(
      "These packages are unpublished on npm and not in FIRST_PUBLISH_ALLOWLIST, so the npm",
    );
    console.error(
      "gate documented in PACKAGE_GOVERNANCE.md is still in effect. To intentionally un-gate a",
    );
    console.error("package, open a reviewed PR adding its name to FIRST_PUBLISH_ALLOWLIST in");
    console.error("scripts/monorepo/guard-publish.mjs.");
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
