export { buildRegistryArtifacts, copyArtifactsToPackage } from "./artifacts.js";
export type {
  CopyArtifactsToPackageOptions,
  BuildRegistryArtifactsOptions,
  BuildRegistryArtifactsResult,
  CopyDirEntry,
  RequiredPathEntry,
  AfterCopyContext,
} from "./artifacts.js";
export {
  buildShadcnRegistryWithOrigin,
  runShadcnRegistryBuild,
  ensurePublicRegistryReady,
  validatePublicRegistryFresh,
  resolveLocalShadcnBin,
} from "./shadcn/index.js";
export type {
  BuildShadcnRegistryWithOriginOptions,
  BuildShadcnRegistryWithOriginResult,
  RunShadcnRegistryBuildOptions,
  ValidatePublicRegistryFreshOptions,
  EnsurePublicRegistryReadyOptions,
} from "./shadcn/index.js";

export { loadArtifactsFromPackage } from "./artifact-loader.js";
export type { LoadedArtifacts, LoadFromPackageOptions } from "./artifact-loader.js";

export { syncDocsFromArtifacts } from "./docs/index.js";
export { resolveSyncOutputPaths } from "./docs/paths.js";
export type {
  SyncDocsOptions,
  SyncDocsResult,
  SyncLibraryConfig,
  SyncOutputPathsConfig,
  LoadedLibraryArtifacts,
  AfterSyncContext,
} from "./docs/types.js";
export { DEFAULT_OUTPUT_PATHS } from "./docs/types.js";

export { validateManifest, ArtifactManifestSchema, createArtifactManifest, loadValidatedManifest } from "./manifest.js";
export type {
  ArtifactManifest,
  ArtifactManifestDocs,
  ArtifactManifestRegistry,
  ArtifactManifestIntegrity,
  CreateArtifactManifestOptions,
} from "./manifest.js";

export { ARTIFACT_MANIFEST_FILENAME, ARTIFACT_FINGERPRINT_FILENAME, ARTIFACT_MANIFEST_REL_PATH, DEFAULT_ARTIFACT_ROOT, REGISTRY_ORIGIN } from "./constants.js";
export { computeInputsFingerprint } from "./fingerprint.js";
export { buildCopyBundle, computeIntegrity, CopyBundleItemSchema, CopyBundleSchema } from "./copy-bundle.js";
export type {
  CopyBundle,
  CopyBundleItem,
  BuildCopyBundleOptions,
  BuildCopyBundleResult,
} from "./copy-bundle.js";
export {
  normalizeOrigin,
  rewriteOriginsInDir,
} from "./origin.js";
export type {
  OriginRewriteOptions,
  NormalizeOriginOptions,
  RewriteOriginsResult,
} from "./origin.js";
export { ensureExists, resetDir } from "./utils/fs.js";

export type {
  DocNote,
  ExampleRef,
  UsageSection,
  HookParameter,
  HookReturn,
  HookDoc,
  CodeBlockToken,
  CodeBlockLine,
  HookSourceData,
  EnrichedHookData,
  AnatomyNode,
  ComponentNote,
  KeyboardSection,
  ComponentDoc,
} from "./docs-data/index.js";

export {
  createDocsHighlighter,
  highlightCode,
  generateHooksSource,
  generateEnrichedHookData,
  docsCodeTheme,
  DOCS_CODE_THEME_NAME,
  kebabToCamelCase,
  toDocExportName,
  toYamlString,
  createHookDocLoader,
  findExamples,
  generateDemoIndex,
  buildDocsData,
} from "./docs-data/index.js";
export type {
  HighlightLanguage,
  DocsHighlighter,
  CreateHighlighterOptions,
  HookRegistryItem,
  GenerateHooksSourceOptions,
  GenerateEnrichedHookDataOptions,
  BuildDocsDataConfig,
  BuildDocsDataResult,
  HooksConfig,
  DemoIndexConfig,
  ComponentsConfig,
  LibsConfig,
} from "./docs-data/index.js";

export {
  RegistryFileSchema,
  RegistryItemSchema,
  RegistrySchema,
  type RegistryFile,
  type RegistryItem,
  type Registry,
} from "./registry-types.js";

export { defaultLogger } from "./logger.js";
export type { Logger } from "./logger.js";
