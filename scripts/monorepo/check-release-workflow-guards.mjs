#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { runValidationChecks } from "./lib/run-checks.mjs";

export const RELEASE_WORKFLOW_PATH = ".github/workflows/release.yml";

// F-089: the privileged release job must only run for trusted push provenance
// from this repository's main branch. Dropping any of these guards would let a
// pull_request-origin Release Readiness run reach the OIDC/npm-token release
// job, so guard each condition against silent removal.
export const REQUIRED_RELEASE_GUARDS = [
  "workflow_run.event == 'push'",
  "head_repository.full_name == github.repository",
  "head_branch == 'main'",
];

export function collectReleaseGuardFailures(source) {
  let workflow;
  try {
    workflow = parse(source);
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error ? error.message : String(error);
    return [`${RELEASE_WORKFLOW_PATH}: failed to parse workflow YAML: ${message}`];
  }

  const condition = workflow?.jobs?.release?.if;
  if (typeof condition !== "string") {
    return [`${RELEASE_WORKFLOW_PATH}: release job is missing an \`if\` guard`];
  }

  const normalized = condition.replace(/\s+/g, " ");

  return REQUIRED_RELEASE_GUARDS.filter((guard) => !normalized.includes(guard)).map(
    (guard) => `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: ${guard}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runValidationChecks(collectReleaseGuardFailures(readFileSync(RELEASE_WORKFLOW_PATH, "utf8")), {
    failureHeader: "Release workflow provenance guard checks failed",
    successMessage: "OK: release workflow provenance guards present",
  });
}
