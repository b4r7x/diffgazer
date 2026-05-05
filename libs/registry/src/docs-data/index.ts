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
} from "./types.js"

export {
  createDocsHighlighter,
  highlightCode,
} from "./highlight.js"
export type {
  HighlightLanguage,
  DocsHighlighter,
  CreateHighlighterOptions,
} from "./highlight.js"

export {
  generateHooksSource,
  generateEnrichedHookData,
} from "./hooks-source.js"
export type {
  HookRegistryItem,
  GenerateHooksSourceOptions,
  GenerateEnrichedHookDataOptions,
} from "./hooks-source.js"

export { docsCodeTheme, DOCS_CODE_THEME_NAME } from "./code-theme.js"
export { kebabToCamelCase, toDocExportName, toYamlString, createHookDocLoader } from "./utils.js"
export { findExamples, generateDemoIndex } from "./examples.js"
export { buildDocsData } from "./build-docs-data.js"
export { buildComponentsData } from "./build-components.js"
export { buildHooksData } from "./build-hooks.js"
export type {
  BuildDocsDataConfig,
  BuildDocsDataResult,
  DemoIndexConfig,
  LibsConfig,
} from "./build-docs-data.js"
export type { ComponentsConfig } from "./build-components.js"
export type { HooksConfig } from "./build-hooks.js"
