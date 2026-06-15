#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runValidationChecks } from "./lib/run-checks.mjs";

export const DEPLOY_RUNBOOK_PATHS = ["deploy/PUBLIC_DEPLOYMENT.md", "deploy/REVERSE_PROXY.md"];

const CONFLICT_MARKER_RE = /^(?:<{7}|={7}|>{7})(?:[ \t].*)?$/;
const TRAILING_WHITESPACE_RE = /[ \t]+$/;

export function collectRunbookStyleFailures(path, source) {
  const failures = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (TRAILING_WHITESPACE_RE.test(line)) {
      failures.push(`${path}:${lineNumber}: trailing whitespace`);
    }

    if (CONFLICT_MARKER_RE.test(line)) {
      failures.push(`${path}:${lineNumber}: conflict marker`);
    }
  });

  return failures;
}

export function collectDeployRunbookFailures(
  paths = DEPLOY_RUNBOOK_PATHS,
  readFile = readFileSync,
) {
  const failures = [];

  for (const path of paths) {
    try {
      failures.push(...collectRunbookStyleFailures(path, readFile(path, "utf8")));
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error ? error.message : String(error);
      failures.push(`${path}: ${message}`);
    }
  }

  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runValidationChecks(collectDeployRunbookFailures(), {
    failureHeader: "Deploy runbook style checks failed",
    successMessage: "OK: deploy runbook style checks passed",
  });
}
