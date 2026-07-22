export { buildRegistryArtifacts, copyArtifactsToPackage } from "./artifacts.js";
export { REGISTRY_ORIGIN } from "./constants.js";
export { buildCopyBundle, computeIntegrity } from "./copy-bundle.js";
export { buildDocsData } from "./docs-data/build.js";
export { DOCS_CODE_THEME_NAME, docsCodeTheme } from "./docs-data/code-theme.js";
export { findExamples } from "./docs-data/examples.js";
export type { DocsHighlighter } from "./docs-data/highlight.js";
export {
  getSourceHighlightLanguage,
  highlightCode,
  highlightSourceFile,
} from "./docs-data/highlight.js";
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
  type DocsLibrariesConfig,
  getArtifactLibraries,
  readDocsLibrariesConfig,
} from "./docs-sync/docs-libraries-config.js";
export { collectMissingWorkspaceArtifactFiles } from "./docs-sync/artifact-availability.js";
export {
  type ArtifactSyncValidationParams,
  assertArtifactSyncOutputs,
  collectArtifactSyncValidationErrors,
} from "./docs-sync/output-validation.js";
export {
  collectPathParityErrors,
  collectTreeParityErrors,
} from "./docs-sync/path-parity.js";
export { rewriteDemoIndexForViteGlob } from "./docs-sync/demo-index-rewrite.js";
export { syncDocsFromArtifacts } from "./docs-sync/sync.js";
export {
  computeArtifactFingerprint,
  computeInputsFingerprint,
  computeRequiredArtifactFingerprint,
  computeStrictArtifactFingerprint,
  type InputsFingerprintResult,
} from "./fingerprint.js";
export {
  extractImportSpecifiers,
  extractStaticNamedImports,
  type ImportSpecifier,
  type ImportSpecifierKind,
  type StaticNamedImport,
  stripTemplateLiterals,
} from "./import-specifiers.js";
export { rewriteKeysPackageImportsInContent } from "./keys-import-rewrite.js";
export {
  type ArtifactManifest,
  createArtifactManifest,
  loadValidatedManifest,
  validateManifest,
} from "./manifest.js";
export { normalizeOrigin, resolveRegistryRoute } from "./origin.js";
export { RELATIVE_JS_IMPORT_RE, stripRelativeJsExtensions } from "./relative-js-imports.js";
export { aggregateThemeStyles, buildShadcnRegistryWithOrigin } from "./shadcn/build.js";
