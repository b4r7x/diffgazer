#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { errorMessage } from "./lib/error-message.mjs";
import { isPackageManifestPath, listRepoFiles } from "./lib/files.mjs";
import { readJson } from "./lib/json.mjs";

// First-publish allowlist. `diffgazer` is live on npm; the scoped packages
// (@diffgazer/ui, @diffgazer/keys, @diffgazer/add) first-publish in the upcoming
// release. Every release-managed package is listed, so the gate now refuses only
// a never-published name outside this set (PACKAGE_GOVERNANCE.md, First-publish
// gate).
const FIRST_PUBLISH_ALLOWLIST = ["diffgazer", "@diffgazer/add", "@diffgazer/ui", "@diffgazer/keys"];

export function isPublicPackage(parsed) {
  return Boolean(parsed.name) && parsed.private !== true;
}

function listPublicPackages() {
  const packages = [];
  for (const file of listRepoFiles().filter(isPackageManifestPath)) {
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
    .filter((pkg) => previousVersionsByFile.get(pkg.file) !== pkg.version)
    .map((pkg) => pkg.name);
}

function getPublishedVersions(name) {
  let parsed;
  // Only the subprocess and the parse belong in the try: a shape error thrown
  // inside it would be re-wrapped as "npm view failed" even though npm exited 0.
  try {
    const output = execFileSync("npm", ["view", name, "versions", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    parsed = JSON.parse(output);
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

  if (typeof parsed === "string") return [parsed];
  if (Array.isArray(parsed) && parsed.every((version) => typeof version === "string")) {
    return parsed;
  }
  throw new Error(`npm view ${name} returned an invalid versions payload`);
}

function versionsFor(publishedVersionsByName, name) {
  return publishedVersionsByName.get(name) ?? [];
}

function ensureReleaseTag(name, version) {
  const tag = `${name}@${version}`;
  try {
    execFileSync("git", ["rev-parse", "--verify", `refs/tags/${tag}`], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    return;
  } catch {
    // Annotated tag at checkout HEAD; changesets/action pushes it via git after publish.
  }
  execFileSync("git", ["tag", "-a", tag, "-m", tag], { stdio: "inherit" });
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
    const publishable = candidates.filter((pkg) => !gated.includes(pkg)).map((pkg) => pkg.name);
    const hint =
      publishable.length > 0
        ? ` To publish only the un-gated subset, name it: pnpm run release ${publishable.join(" ")}`
        : "";
    throw new Error(
      `Publish guard: refusing to first-publish gated packages: ${gated
        .map((pkg) => pkg.name)
        .join(", ")}.${hint}`,
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
  versionedNames = pendingNames,
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

  // `New tag:` is what changesets/action turns into a pushed Git tag and a
  // GitHub Release, so a version already live on npm may only be announced when
  // the checked-out commit versioned it — the retry of a failed publish run for
  // the same Version-PR commit. A package named explicitly on a commit that did
  // not version it is skipped here; re-announcing its live version would ask
  // GitHub to create a release that already exists.
  const versioned = new Set(versionedNames);
  const released = plan.filter((pkg) => pkg.publication === "publish" || versioned.has(pkg.name));
  for (const pkg of released) {
    ensureReleaseTag(pkg.name, pkg.version);
    console.log(`New tag: ${pkg.name}@${pkg.version}`);
  }
  return released.map((pkg) => pkg.name);
}

export function main({
  allowlist = FIRST_PUBLISH_ALLOWLIST,
  requestedNames = process.argv.slice(2),
} = {}) {
  const packages = listPublicPackages();
  const versionedNames = findVersionChangedPackageNames({
    packages,
    previousVersionsByFile: getPreviousVersionsByFile(packages),
  });
  const pendingNames = requestedNames.length > 0 ? requestedNames : versionedNames;
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
    versionedNames,
  });
}

if (
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    main();
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}
