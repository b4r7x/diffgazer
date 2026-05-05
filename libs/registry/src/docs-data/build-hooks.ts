import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { resolve } from "node:path"
import type { DocsHighlighter } from "./highlight.js"
import { DOCS_CODE_THEME_NAME } from "./code-theme.js"
import { generateHooksSource, generateEnrichedHookData } from "./hooks-source.js"
import type { HookRegistryItem } from "./hooks-source.js"
import { cleanDir, toYamlString } from "./utils.js"
import type { RegistryItem, Registry } from "../registry-types.js"
import type { EnrichedHookData } from "./types.js"
import { writeJson } from "../utils/json.js"
import type { Logger } from "../logger.js"

export interface HooksConfig {
  contentDir: string
  extraItems?: HookRegistryItem[]
  filter?: (item: RegistryItem) => boolean
  mapItem?: (item: RegistryItem) => HookRegistryItem
  loadHookDoc: (hookName: string) => Promise<import("./types.js").HookDoc | null>
  backwardCompatFile?: string
  backwardCompatItems?: HookRegistryItem[]
}

function defaultHookFilter(item: RegistryItem): boolean {
  return item.type === "registry:hook" && !(item.meta?.hidden)
}

export async function buildHooksData(params: {
  registry: Registry
  hooksConfig: HooksConfig
  rootDir: string
  examplesDir: string
  outputDir: string
  highlighter: DocsHighlighter
  skipMdxGeneration?: boolean
  logger: Logger
}): Promise<{ hooksCount: number; allHooks: HookRegistryItem[]; registryHooks: HookRegistryItem[]; errors: string[] }> {
  const { registry, hooksConfig, rootDir, examplesDir, outputDir, highlighter, skipMdxGeneration, logger } = params
  const errors: string[] = []

  const hookFilter = hooksConfig.filter ?? defaultHookFilter
  const defaultMap = (item: RegistryItem): HookRegistryItem => ({
    name: item.name,
    title: item.title,
    description: item.description ?? "",
    files: item.files,
  })
  const mapItem = hooksConfig.mapItem ?? defaultMap
  const registryHooks: HookRegistryItem[] = registry.items
    .filter(hookFilter)
    .map(mapItem)

  const allHooks = [...registryHooks, ...(hooksConfig.extraItems ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  if (allHooks.length === 0) {
    return { hooksCount: 0, allHooks, registryHooks, errors }
  }

  logger.info(`Found ${allHooks.length} hooks (${registryHooks.length} registry + ${(hooksConfig.extraItems ?? []).length} extra)`)

  let enrichedData: Record<string, EnrichedHookData>
  try {
    enrichedData = await generateEnrichedHookData({
      items: allHooks,
      rootDir,
      highlighter,
      themeName: DOCS_CODE_THEME_NAME,
      loadHookDoc: hooksConfig.loadHookDoc,
      examplesDir,
      logger,
    })
  } catch (err) {
    errors.push(String(err instanceof Error ? err.message : err))
    return { hooksCount: 0, allHooks, registryHooks, errors }
  }

  const hooksDir = resolve(outputDir, "hooks")
  if (existsSync(hooksDir)) {
    rmSync(hooksDir, { recursive: true })
  }
  mkdirSync(hooksDir, { recursive: true })

  for (const [name, data] of Object.entries(enrichedData)) {
    try {
      writeJson(resolve(hooksDir, `${name}.json`), data)
    } catch (err) {
      errors.push(String(err instanceof Error ? err.message : err))
    }
  }
  const hooksCount = Object.keys(enrichedData).length
  logger.info(`Wrote ${hooksCount} per-hook JSON files`)

  const hookList = Object.values(enrichedData)
    .map((h) => ({ name: h.name, title: h.title }))
    .sort((a, b) => a.name.localeCompare(b.name))
  writeJson(resolve(outputDir, "hook-list.json"), hookList)
  logger.info(`Wrote hook-list.json (${hookList.length} entries)`)

  mkdirSync(hooksConfig.contentDir, { recursive: true })

  if (!skipMdxGeneration) {
    cleanDir(hooksConfig.contentDir, ".mdx")
    for (const hookData of Object.values(enrichedData)) {
      const description = hookData.docs?.description ?? hookData.description ?? ""
      writeFileSync(
        resolve(hooksConfig.contentDir, `${hookData.name}.mdx`),
        `---\ntitle: ${toYamlString(hookData.title)}\ndescription: ${toYamlString(description)}\nhook: ${toYamlString(hookData.name)}\n---\n\n<HookDocPage />\n`,
      )
    }
  } else {
    logger.info(`Skipped hook MDX generation (${hooksCount} hooks, hand-authored MDX)`)
  }

  const metaPages = Object.values(enrichedData)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((h) => h.name)
  writeJson(
    resolve(hooksConfig.contentDir, "meta.json"),
    { title: "Hooks", pages: metaPages },
  )
  logger.info(`Wrote ${hooksCount} hook MDX pages + meta.json`)

  if (hooksConfig.backwardCompatFile) {
    const compatItems = hooksConfig.backwardCompatItems ?? registryHooks
    const basicData = generateHooksSource({
      items: compatItems,
      rootDir,
      highlighter,
      themeName: DOCS_CODE_THEME_NAME,
      logger,
    })
    writeJson(resolve(outputDir, hooksConfig.backwardCompatFile), basicData)
    logger.info(`Wrote ${hooksConfig.backwardCompatFile} (${Object.keys(basicData).length} hooks)`)
  }

  return { hooksCount, allHooks, registryHooks, errors }
}
