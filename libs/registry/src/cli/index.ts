export { createBundler } from "./bundler/bundle.js";
export type { BundleFile, BundleItem, BundleResult, BundlerConfig } from "./bundler/types.js";
export {
  createAddCommand,
  createDiffCommand,
  createInitCommand,
  createListCommand,
  createRemoveCommand,
} from "./command-factories.js";
export {
  aliasPathSchema,
  type ConfigLoadResult,
  createConfigModule,
  resolveAliasedPaths,
  updateManifest,
} from "./config.js";
export {
  detectPackageManager,
  detectSourceDir,
  type PackageJson,
  type PackageManager,
  readPackageJson,
  readPackageVersion,
} from "./detect.js";
export type { FileOp } from "./file-write-rollback.js";
export { copyGeneratedDir } from "./fs/directories.js";
export { withFileLock } from "./fs/file-lock.js";
export { ensureWithinDir } from "./fs/path-safety.js";
export { readTsConfigPaths } from "./fs/tsconfig-paths.js";
export { atomicWriteFile, writeFileSafe } from "./fs/writes.js";
export { createInstallChecker } from "./install-checker.js";
export { createItemAccessors } from "./item-accessors.js";
export {
  depName,
  getInstalledDeps,
  installDepsWithSpinner,
  normalizeVersionSpec,
  PACKAGE_MANAGER_LOCKFILES,
} from "./package-manager.js";
export { parseEnumOption } from "./parse-enum-option.js";
export { type CliOptions, createCli, runCli } from "./program.js";
export {
  BaseRegistryBundleSchema,
  createRegistryAccessors,
  createRegistryLoader,
  metaField,
  REGISTRY_ORIGIN,
  type RegistryAccessors,
  RegistryContentFileSchema,
  type RegistryContentItem,
  RegistryContentItemSchema,
  type RegistryItem,
} from "./registry.js";
export { heading, info, promptSelect, warn } from "./terminal.js";
export { showSkippedDependencies } from "./workflows/apply-install-plan.js";
export { type InitWorkflowOptions, runInitWorkflow } from "./workflows/init.js";
export { findOrphanedNpmDeps } from "./workflows/remove/orphaned-deps.js";
