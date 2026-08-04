#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { readJson } from "./lib/json.mjs";
import { runValidationChecks } from "./lib/run-checks.mjs";

// `changeset status --since=origin/main` only asks whether some file in
// .changeset/ claims the changed package, and this repo deliberately carries
// long-lived pending changesets on main — so it stays green for every further
// change to a package one of them already claims. These two trees are the
// reviewable public handoff contract, so a change to them has to bring its own
// changeset rather than inherit an earlier campaign's release note.
const GUARDED_SURFACES = [
  { prefix: "libs/ui/public/r/", packageName: "@diffgazer/ui" },
  { prefix: "libs/keys/public/r/", packageName: "@diffgazer/keys" },
];

const CHANGESET_DIR = ".changeset";
const BUMP_TYPES = new Set(["patch", "minor", "major"]);
const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function declaredPackages(source) {
  const frontMatter = FRONT_MATTER_RE.exec(source);
  if (!frontMatter) return [];

  let parsed;
  try {
    parsed = parse(frontMatter[1]);
  } catch {
    return [];
  }
  if (parsed === null || typeof parsed !== "object") return [];

  // A `none` bump releases nothing, so it documents nothing either.
  return Object.entries(parsed)
    .filter(([, bump]) => BUMP_TYPES.has(bump))
    .map(([packageName]) => packageName);
}

export function collectChangesetCoverageFailures({ changedPaths, readChangeset }) {
  const declared = new Set(
    changedPaths
      .filter((path) => path.startsWith(`${CHANGESET_DIR}/`) && path.endsWith(".md"))
      .flatMap((path) => declaredPackages(readChangeset(path))),
  );

  const failures = [];
  for (const { prefix, packageName } of GUARDED_SURFACES) {
    const touched = changedPaths.filter((path) => path.startsWith(prefix));
    if (touched.length === 0 || declared.has(packageName)) continue;
    failures.push(
      `${touched.length} file(s) under ${prefix} changed (e.g. ${touched[0]}) but no changeset in this change set declares "${packageName}"`,
    );
  }
  return failures;
}

function git(args, rootDir) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function refExists(ref, rootDir) {
  try {
    git(["rev-parse", "--verify", `${ref}^{commit}`], rootDir);
    return true;
  } catch {
    return false;
  }
}

// The base branch comes from the changesets config so this gate and
// `changeset status` always compare against the same branch. A clone without a
// fetched remote falls back to the local branch instead of silently comparing
// against nothing.
function resolveBaseRef(rootDir) {
  const { baseBranch } = readJson(join(rootDir, CHANGESET_DIR, "config.json"));
  const candidates = [`origin/${baseBranch}`, baseBranch];
  const ref = candidates.find((candidate) => refExists(candidate, rootDir));
  if (!ref) {
    throw new Error(
      `Changeset coverage: no base ref to diff against (tried ${candidates.join(", ")}). Fetch the base branch first.`,
    );
  }
  return ref;
}

// Everything this change set touches: tracked changes since the merge base,
// staged and unstaged alike, plus untracked files — which is where a brand-new
// changeset lives until it is committed.
function listChangedPaths(rootDir) {
  const mergeBase = git(["merge-base", resolveBaseRef(rootDir), "HEAD"], rootDir);
  const tracked = git(["diff", "--name-only", mergeBase], rootDir);
  const untracked = git(["ls-files", "--others", "--exclude-standard"], rootDir);
  return [...new Set(`${tracked}\n${untracked}`.split("\n").filter(Boolean))];
}

export function checkChangesetCoverage(rootDir = process.cwd()) {
  return collectChangesetCoverageFailures({
    changedPaths: listChangedPaths(rootDir),
    // `changeset version` deletes the changesets it consumes, and a deleted file
    // covers nothing.
    readChangeset: (path) => {
      const fullPath = join(rootDir, path);
      return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
    },
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runValidationChecks(checkChangesetCoverage(), {
    failureHeader: [
      "Changeset coverage check failed",
      "Add a changeset in this change set with `pnpm run changeset`; one already committed on the base branch does not count.",
    ].join("\n"),
    successMessage: "OK: public registry changes carry a changeset",
  });
}
