import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs"
import { resolve } from "node:path"
import type { DocsHighlighter } from "./highlight.js"
import { cleanDir, toYamlString } from "./utils.js"
import type { RegistryItem, Registry } from "../registry-types.js"
import { writeJson } from "../utils/json.js"
import type { Logger } from "../logger.js"

export interface ComponentsConfig {
  contentDir: string
  filter: (item: RegistryItem) => boolean
  processComponent: (
    item: RegistryItem,
    highlighter: DocsHighlighter,
    registry: Registry,
  ) => Promise<Record<string, unknown> | null>
}

function getDescription(data: Record<string, unknown> | undefined, item: RegistryItem): string {
  if (data?.description != null && typeof data.description === "string") {
    return data.description
  }
  return item.description ?? ""
}

export async function buildComponentsData(params: {
  registry: Registry
  componentsConfig: ComponentsConfig
  outputDir: string
  highlighter: DocsHighlighter
  skipMdxGeneration?: boolean
  logger: Logger
}): Promise<{ componentsCount: number; errors: string[] }> {
  const { registry, componentsConfig, outputDir, highlighter, skipMdxGeneration, logger } = params
  const errors: string[] = []

  const componentItems = registry.items.filter(componentsConfig.filter)
  const sortedItems = [...componentItems].sort((a, b) => a.name.localeCompare(b.name))

  const componentsDir = resolve(outputDir, "components")
  mkdirSync(componentsDir, { recursive: true })
  cleanDir(componentsDir, ".json")

  const componentDataMap: Record<string, Record<string, unknown>> = {}

  for (const item of componentItems) {
    logger.info(`Processing: ${item.name}`)
    try {
      const data = await componentsConfig.processComponent(item, highlighter, registry)
      if (data) {
        componentDataMap[item.name] = data
      }
    } catch (err) {
      errors.push(String(err instanceof Error ? err.message : err))
    }
  }

  for (const [name, data] of Object.entries(componentDataMap)) {
    writeJson(resolve(componentsDir, `${name}.json`), data)
  }
  const componentsCount = Object.keys(componentDataMap).length
  logger.info(`Wrote ${componentsCount} per-component JSON files`)

  const componentList = sortedItems
    .filter((item) => componentDataMap[item.name])
    .map((item) => ({
      name: item.name,
      title: item.title ?? item.name,
      description: getDescription(componentDataMap[item.name], item),
    }))
  writeJson(resolve(outputDir, "component-list.json"), componentList)
  logger.info(`Wrote component-list.json (${componentList.length} entries)`)

  mkdirSync(componentsConfig.contentDir, { recursive: true })

  const componentPages = sortedItems.filter((item) => componentDataMap[item.name]).map((item) => item.name)
  writeJson(
    resolve(componentsConfig.contentDir, "meta.json"),
    { title: "Components", pages: componentPages },
  )

  if (!skipMdxGeneration) {
    cleanDir(componentsConfig.contentDir, ".mdx")
    for (const item of sortedItems) {
      if (!componentDataMap[item.name]) continue
      const desc = getDescription(componentDataMap[item.name], item)
      writeFileSync(
        resolve(componentsConfig.contentDir, `${item.name}.mdx`),
        `---\ntitle: ${toYamlString(item.title ?? item.name)}\ndescription: ${toYamlString(desc)}\ncomponent: ${toYamlString(item.name)}\n---\n\n<ComponentDocPage name="${item.name}" />\n`,
      )
    }
    logger.info(`Wrote ${componentPages.length} component MDX pages`)
  } else {
    logger.info(`Skipped component MDX generation (${componentPages.length} components, hand-authored MDX)`)
  }

  return { componentsCount, errors }
}
