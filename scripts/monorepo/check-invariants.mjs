#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { createInvariantContext, formatInvariantResult } from "./check-invariants/context.mjs";
import {
  checkDockerArtifactFormatterInputs,
  checkDockerFrozenInstallsCopyPatches,
  checkPnpmPinsMatchRootPackageManager,
} from "./check-invariants/docker.mjs";
import {
  checkDependencyOverridesDocumented,
  checkLicensedPackagesInGovernanceSplit,
  checkSecurityReportingChannelsAgree,
  checkSurfaceEnvExampleKeysStayInRootExample,
} from "./check-invariants/governance.mjs";
import {
  checkAddCliPackageMetadata,
  checkCoreUsesExplicitSubpathExports,
  checkDiffgazerCliPackageMetadata,
  checkInternalLocalDepsUseWorkspaceProtocol,
  checkKeysPackageMetadata,
  checkLicenseFilesMatch,
  checkNestedPackageFilesAreDocumented,
  checkNoLinkOrFileLocalDeps,
  checkNoPublishableInternalDocsManifest,
  checkPublishablePackagesMatchFixedList,
  checkPublishablePackagesShareEngineFloor,
  checkPublishMetadataPolicy,
  checkUiPackageMetadata,
  checkWorkspacePackageList,
} from "./check-invariants/packages.mjs";
import {
  checkE2eScreenshotsUseBaselineDirectory,
  checkNoGitlinkEntries,
  checkNoGitmodules,
  checkNoNestedGitDirectories,
  checkNoNestedPnpmLocks,
  checkNoNestedPnpmWorkspaces,
  checkNoNestedRepoConfig,
  checkRootMetadata,
  checkRootPolicyFiles,
  checkRootWorkspaceFile,
  checkTurboDocsBuildIncludesOutput,
  checkWebBuildUsesTurbo,
  checkWorkspaceGlobs,
} from "./check-invariants/topology.mjs";
import { runValidationChecks } from "./lib/run-checks.mjs";

export { createInvariantContext } from "./check-invariants/context.mjs";

export const INVARIANT_CHECKS = [
  checkRootWorkspaceFile,
  checkRootPolicyFiles,
  checkRootMetadata,
  checkPnpmPinsMatchRootPackageManager,
  checkDockerArtifactFormatterInputs,
  checkDockerFrozenInstallsCopyPatches,
  checkWorkspaceGlobs,
  checkNoGitmodules,
  checkNoGitlinkEntries,
  checkNoNestedRepoConfig,
  checkNoNestedGitDirectories,
  checkNoNestedPnpmLocks,
  checkNoNestedPnpmWorkspaces,
  checkE2eScreenshotsUseBaselineDirectory,
  checkNoLinkOrFileLocalDeps,
  checkInternalLocalDepsUseWorkspaceProtocol,
  checkLicenseFilesMatch,
  checkWorkspacePackageList,
  checkNestedPackageFilesAreDocumented,
  checkCoreUsesExplicitSubpathExports,
  checkUiPackageMetadata,
  checkKeysPackageMetadata,
  checkDiffgazerCliPackageMetadata,
  checkAddCliPackageMetadata,
  checkNoPublishableInternalDocsManifest,
  checkPublishMetadataPolicy,
  checkPublishablePackagesMatchFixedList,
  checkPublishablePackagesShareEngineFloor,
  checkTurboDocsBuildIncludesOutput,
  checkWebBuildUsesTurbo,
  checkSecurityReportingChannelsAgree,
  checkDependencyOverridesDocumented,
  checkLicensedPackagesInGovernanceSplit,
  checkSurfaceEnvExampleKeysStayInRootExample,
];

export function runInvariantChecks(options = {}) {
  const context = createInvariantContext(options);
  const results = [];

  for (const check of options.checks ?? INVARIANT_CHECKS) {
    const result = check(context);
    results.push(result);
    options.onResult?.(result);
  }

  return results;
}

export function getInvariantFailures(results) {
  return results
    .filter((result) => !result.ok)
    .map((result) => `  ${result.name}${result.details ? ` (${result.details})` : ""}`);
}

export function runCli() {
  const results = runInvariantChecks({
    onResult: (result) => {
      console.log(formatInvariantResult(result));
    },
  });
  runValidationChecks(getInvariantFailures(results), { failureHeader: "Invariant checks failed" });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
