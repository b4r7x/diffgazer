#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  collectReleaseGuardFailures,
  collectReleaseRecoveryFailures,
} from "./check-release-workflow-guards/release.mjs";
import { collectChangesetStatusGuardFailures } from "./check-release-workflow-guards/readiness.mjs";
import {
  collectDeployReadinessLinkFailures,
  collectDeployTransactionFailures,
} from "./check-release-workflow-guards/deploy.mjs";
import {
  DEPLOY_WORKFLOW_PATH,
  PACKAGE_GOVERNANCE_PATH,
  RELEASE_READINESS_WORKFLOW_PATH,
  RELEASE_WORKFLOW_PATH,
} from "./check-release-workflow-guards/workflow-source.mjs";
import { runValidationChecks } from "./lib/run-checks.mjs";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runValidationChecks(
    [
      ...collectReleaseGuardFailures(readFileSync(RELEASE_WORKFLOW_PATH, "utf8")),
      ...collectReleaseRecoveryFailures(
        readFileSync(RELEASE_WORKFLOW_PATH, "utf8"),
        readFileSync(PACKAGE_GOVERNANCE_PATH, "utf8"),
      ),
      ...collectChangesetStatusGuardFailures(readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8")),
      ...collectDeployReadinessLinkFailures(
        readFileSync(DEPLOY_WORKFLOW_PATH, "utf8"),
        readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8"),
      ),
      ...collectDeployTransactionFailures(readFileSync(DEPLOY_WORKFLOW_PATH, "utf8")),
    ],
    {
      failureHeader: "Release workflow provenance guard checks failed",
      successMessage: "OK: release workflow provenance guards present",
    },
  );
}
