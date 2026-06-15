export { buildRegistryArtifacts, copyArtifactsToPackage } from "./artifacts.js";
export { REGISTRY_ORIGIN } from "./constants.js";
export { buildCopyBundle, computeIntegrity } from "./copy-bundle.js";
export { buildDocsData } from "./docs-data/build.js";
export { DOCS_CODE_THEME_NAME, docsCodeTheme } from "./docs-data/code-theme.js";
export { findExamples } from "./docs-data/examples.js";
export type { DocsHighlighter } from "./docs-data/highlight.js";
export { highlightCode } from "./docs-data/highlight.js";
export { createHookDocLoader } from "./docs-data/hook-doc-loader.js";
export type { HookRegistryItem } from "./docs-data/hooks-source.js";
export { kebabToCamelCase } from "./docs-data/naming.js";
export type {
  AnatomyNode,
  CodeBlockLine,
  ComponentDoc,
  ComponentNote,
  ComponentPropsTable,
  ConsumptionItemKind,
  ConsumptionLibrary,
  ConsumptionMetadata,
  ExampleRef,
  HookDoc,
  KeyboardSection,
  PropInfo,
  UsageSection,
} from "./docs-data/types.js";
export {
  type ArtifactLibrary,
  type ArtifactSyncValidationParams,
  assertArtifactSyncOutputs,
  collectArtifactSyncValidationErrors,
  collectMissingWorkspaceArtifactFiles,
  type DocsLibrariesConfig,
  getArtifactLibraries,
  readDocsLibrariesConfig,
  resolveArtifactSyncMode,
  rewriteDemoIndexForViteGlob,
} from "./docs-sync/artifact-sync.js";
export { syncDocsFromArtifacts } from "./docs-sync/sync.js";
export {
  type RewriteKeysImportOptions,
  rewriteKeysPackageImportsInContent,
} from "./keys-import-rewrite.js";
export { KEYS_PACKAGE_IMPORT_TARGETS } from "./keys-imports.js";
export { createArtifactManifest } from "./manifest.js";
export { normalizeOrigin } from "./origin.js";
export { RELATIVE_JS_IMPORT_RE, stripRelativeJsExtensions } from "./relative-js-imports.js";
export { aggregateThemeStyles, buildShadcnRegistryWithOrigin } from "./shadcn/build.js";
export { assertRegistrySourceFilePath, isRelativeSubpath } from "./utils/fs.js";
