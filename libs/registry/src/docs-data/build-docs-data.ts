import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { resolve } from "node:path"
import {
  createDocsHighlighter,
} from "./highlight.js"
import { docsCodeTheme, DOCS_CODE_THEME_NAME } from "./code-theme.js"
import { generateHooksSource } from "./hooks-source.js"
import type { HookRegistryItem } from "./hooks-source.js"
import { generateDemoIndex, findExamples } from "./examples.js"
import { RegistrySchema } from "../registry-types.js"
import type { Registry } from "../registry-types.js"
import { writeJson } from "../utils/json.js"
import { defaultLogger, type Logger } from "../logger.js"
import { buildComponentsData } from "./build-components.js"
import type { ComponentsConfig } from "./build-components.js"
import { buildHooksData } from "./build-hooks.js"
import type { HooksConfig } from "./build-hooks.js"

export interface DemoIndexConfig {
  importPathPrefix: string
  items?: Array<{ name: string }>
}

export interface LibsConfig {
  filter: (item: import("../registry-types.js").RegistryItem) => boolean
  outputFile: string
}

export interface BuildDocsDataConfig {
  libraryId: string
  rootDir: string
  registryPath: string
  examplesDir: string
  outputDir: string

  hooks: HooksConfig
  demoIndex: DemoIndexConfig
  components?: ComponentsConfig
  libs?: LibsConfig
  skipMdxGeneration?: boolean
  logger?: Logger
}

export interface BuildDocsDataResult {
  hooksCount: number
  componentsCount: number
  libsCount: number
}

async function loadRegistry(registryPath: string): Promise<Registry> {
  if (registryPath.endsWith(".json")) {
    return RegistrySchema.parse(JSON.parse(readFileSync(registryPath, "utf-8")))
  }
  return RegistrySchema.parse((await import(registryPath)).default)
}

function buildLibsData(params: {
  registry: Registry
  libsConfig: LibsConfig
  rootDir: string
  outputDir: string
  highlighter: import("./highlight.js").DocsHighlighter
  logger: Logger
}): { libsCount: number } {
  const { registry, libsConfig, rootDir, outputDir, highlighter, logger } = params

  const libItems = registry.items.filter(libsConfig.filter)
  if (libItems.length === 0) return { libsCount: 0 }

  const libsData = generateHooksSource({
    items: libItems,
    rootDir,
    highlighter,
    themeName: DOCS_CODE_THEME_NAME,
    logger,
  })
  writeJson(resolve(outputDir, libsConfig.outputFile), libsData)
  const libsCount = Object.keys(libsData).length
  logger.info(`Wrote ${libsConfig.outputFile} (${libsCount} libs)`)

  return { libsCount }
}

function buildDemoIndex(params: {
  registry: Registry
  componentsConfig?: ComponentsConfig
  demoIndexConfig: DemoIndexConfig
  allHooks: HookRegistryItem[]
  examplesDir: string
  outputDir: string
  logger: Logger
}): void {
  const { registry, componentsConfig, demoIndexConfig, allHooks, examplesDir, outputDir, logger } = params

  const demoItems = demoIndexConfig.items ?? [
    ...(componentsConfig
      ? registry.items.filter(componentsConfig.filter).map((i) => ({ name: i.name }))
      : []),
    ...allHooks.map((h) => ({ name: h.name })),
  ]

  const demoIndexContent = generateDemoIndex({
    items: demoItems,
    examplesDir,
    importPathPrefix: demoIndexConfig.importPathPrefix,
    findExamplesFn: findExamples,
    logger,
  })
  writeFileSync(resolve(outputDir, "demo-index.ts"), demoIndexContent)
  logger.info("Wrote demo-index.ts")
}

export async function buildDocsData(config: BuildDocsDataConfig): Promise<BuildDocsDataResult> {
  const {
    libraryId,
    rootDir,
    registryPath,
    examplesDir,
    outputDir,
    hooks: hooksConfig,
    demoIndex: demoIndexConfig,
    components: componentsConfig,
    libs: libsConfig,
    skipMdxGeneration,
    logger = defaultLogger,
  } = config

  const errors: string[] = []
  let hooksCount = 0
  let componentsCount = 0
  let libsCount = 0

  const registry = await loadRegistry(registryPath)
  const highlighter = await createDocsHighlighter({
    theme: docsCodeTheme,
    themeName: DOCS_CODE_THEME_NAME,
  })

  try {
    mkdirSync(outputDir, { recursive: true })

    if (componentsConfig) {
      const result = await buildComponentsData({
        registry, componentsConfig, outputDir, highlighter, skipMdxGeneration, logger,
      })
      componentsCount = result.componentsCount
      errors.push(...result.errors)
    }

    const hooksResult = await buildHooksData({
      registry, hooksConfig, rootDir, examplesDir, outputDir, highlighter, skipMdxGeneration, logger,
    })
    hooksCount = hooksResult.hooksCount
    errors.push(...hooksResult.errors)

    if (errors.length > 0) {
      throw new Error(`Docs data build failed:\n${errors.map((e) => `- ${e}`).join("\n")}`)
    }

    if (libsConfig) {
      const result = buildLibsData({ registry, libsConfig, rootDir, outputDir, highlighter, logger })
      libsCount = result.libsCount
    }

    buildDemoIndex({
      registry, componentsConfig, demoIndexConfig, allHooks: hooksResult.allHooks, examplesDir, outputDir, logger,
    })

    logger.info(`\n--- Build Summary (${libraryId}) ---`)
    if (componentsCount > 0) logger.info(`Components: ${componentsCount}`)
    if (hooksCount > 0) logger.info(`Hooks: ${hooksCount}`)
    if (libsCount > 0) logger.info(`Libs: ${libsCount}`)
    logger.info("Errors: 0")
    logger.info("Build completed successfully.")
  } finally {
    highlighter.dispose()
  }

  return { hooksCount, componentsCount, libsCount }
}
