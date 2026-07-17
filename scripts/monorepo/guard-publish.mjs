#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
    if (typeof parsed.version !== "string" || parsed.version.length === 0) {
      throw new Error(`Public package ${parsed.name} in ${file} has no version`);
    }
    packages.push({ name: parsed.name, version: parsed.version, file });
  }
  return packages;
}

function getPreviousVersionsByFile(packages) {
  try {
    execFileSync("git", ["rev-parse", "--verify", "HEAD^"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    throw new Error(
      `Publish guard: cannot inspect the commit before HEAD. Fetch the repository history before publishing.\n${stderr}`,
    );
  }

  const previousVersions = new Map();
  for (const pkg of packages) {
    const previousPath = execFileSync("git", ["ls-tree", "--name-only", "HEAD^", "--", pkg.file], {
      encoding: "utf8",
    }).trim();
    if (previousPath.length === 0) continue;

    const previousManifest = JSON.parse(
      execFileSync("git", ["show", `HEAD^:${pkg.file}`], { encoding: "utf8" }),
    );
    previousVersions.set(pkg.file, previousManifest.version);
  }
  return previousVersions;
}

export function findVersionChangedPackageNames({ packages, previousVersionsByFile }) {
  return packages
    .filter((pkg) => valueFor(previousVersionsByFile, pkg.file) !== pkg.version)
    .map((pkg) => pkg.name);
}

function getPublishedVersions(name) {
  try {
    const output = execFileSync("npm", ["view", name, "versions", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(output);
    if (typeof parsed === "string") return [parsed];
    if (Array.isArray(parsed) && parsed.every((version) => typeof version === "string")) {
      return parsed;
    }
    throw new Error(`npm view ${name} returned an invalid versions payload`);
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    if (stderr.includes("E404") || stderr.includes("404 Not Found")) {
      return [];
    }
    if (error instanceof SyntaxError) {
      throw new Error(`npm view ${name} returned invalid JSON`, { cause: error });
    }
    throw new Error(`npm view ${name} failed (not an E404):\n${stderr || error.message}`);
  }
}

function valueFor(valuesByName, name) {
  return valuesByName instanceof Map ? valuesByName.get(name) : valuesByName[name];
}

function versionsFor(publishedVersionsByName, name) {
  return valueFor(publishedVersionsByName, name) ?? [];
}

export function createPublishPlan({ packages, publishedVersionsByName, allowlist, pendingNames }) {
  const allowed = new Set(allowlist);
  const packagesByName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const pending = new Set(pendingNames);
  const unknown = [...pending].filter((name) => !packagesByName.has(name));
  if (unknown.length > 0) {
    throw new Error(`Publish guard: unknown public package(s): ${unknown.join(", ")}`);
  }

  const candidates = packages.filter((pkg) => pending.has(pkg.name));
  const gated = candidates.filter(
    (pkg) => versionsFor(publishedVersionsByName, pkg.name).length === 0 && !allowed.has(pkg.name),
  );
  if (gated.length > 0) {
    throw new Error(
      `Publish guard: refusing to first-publish gated packages: ${gated
        .map((pkg) => pkg.name)
        .join(", ")}`,
    );
  }

  return candidates.map((pkg) => ({
    ...pkg,
    publication: versionsFor(publishedVersionsByName, pkg.name).includes(pkg.version)
      ? "recover"
      : "publish",
  }));
}

export function publishPendingPackages({
  packages,
  publishedVersionsByName,
  allowlist = FIRST_PUBLISH_ALLOWLIST,
  pendingNames,
}) {
  const plan = createPublishPlan({
    packages,
    publishedVersionsByName,
    allowlist,
    pendingNames,
  });

  if (plan.length === 0) {
    console.log("Publish guard: no eligible package versions need publication.");
    return [];
  }

  for (const pkg of plan) {
    if (pkg.publication === "recover") continue;
    execFileSync("pnpm", ["--filter", pkg.name, "publish", "--no-git-checks"], {
      stdio: "inherit",
    });
  }

  for (const pkg of plan) {
    console.log(`New tag: ${pkg.name}@${pkg.version}`);
  }
  return plan.map((pkg) => pkg.name);
}

export function main({
  allowlist = FIRST_PUBLISH_ALLOWLIST,
  requestedNames = process.argv.slice(2),
} = {}) {
  const packages = listPublicPackages();
  const pendingNames =
    requestedNames.length > 0
      ? requestedNames
      : findVersionChangedPackageNames({
          packages,
          previousVersionsByFile: getPreviousVersionsByFile(packages),
        });
  const pending = new Set(pendingNames);
  const publishedVersionsByName = new Map(
    packages
      .filter((pkg) => pending.has(pkg.name))
      .map((pkg) => [pkg.name, getPublishedVersions(pkg.name)]),
  );

  return publishPendingPackages({
    packages,
    publishedVersionsByName,
    allowlist,
    pendingNames,
  });
}

if (
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
