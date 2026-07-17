import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { log } from "../logger.js";
import { REGISTRY_ITEM_TYPE, type Registry, type RegistryItem } from "../registry-types.js";
import { writeJson } from "../utils/json.js";
import { DOCS_CODE_THEME_NAME } from "./code-theme.js";
import type { DocsHighlighter } from "./highlight.js";
import type { HookRegistryItem } from "./hooks-source.js";
import { generateEnrichedHookData, generateHooksSource } from "./hooks-source.js";
import type { EnrichedHookData } from "./types.js";

export interface HooksConfig {
  contentDir: string;
  extraItems?: HookRegistryItem[];
  filter?: (item: RegistryItem) => boolean;
  mapItem?: (item: RegistryItem) => HookRegistryItem;
  loadHookDoc: (hookName: string) => Promise<import("./types.js").HookDoc | null>;
  aggregateHooksFile?: string;
  aggregateHooksItems?: HookRegistryItem[];
}

function defaultHookFilter(item: RegistryItem): boolean {
  return item.type === REGISTRY_ITEM_TYPE.hook && !item.meta?.hidden;
}

export async function buildHooksData(params: {
  registry: Registry;
  hooksConfig: HooksConfig;
  rootDir: string;
  examplesDir: string;
  outputDir: string;
  highlighter: DocsHighlighter;
}): Promise<{
  hooksCount: number;
  allHooks: HookRegistryItem[];
  registryHooks: HookRegistryItem[];
  errors: string[];
}> {
  const { registry, hooksConfig, rootDir, examplesDir, outputDir, highlighter } = params;
  const errors: string[] = [];

  const hookFilter = hooksConfig.filter ?? defaultHookFilter;
  const defaultMap = (item: RegistryItem): HookRegistryItem => ({
    name: item.name,
    title: item.title,
    description: item.description ?? "",
    files: item.files,
  });
  const mapItem = hooksConfig.mapItem ?? defaultMap;
  const registryHooks: HookRegistryItem[] = registry.items.filter(hookFilter).map(mapItem);

  const allHooks = [...registryHooks, ...(hooksConfig.extraItems ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  if (allHooks.length === 0) {
    return { hooksCount: 0, allHooks, registryHooks, errors };
  }

  log.info(
    `Found ${allHooks.length} hooks (${registryHooks.length} registry + ${(hooksConfig.extraItems ?? []).length} extra)`,
  );

  let enrichedData: Record<string, EnrichedHookData>;
  try {
    enrichedData = await generateEnrichedHookData({
      items: allHooks,
      rootDir,
      highlighter,
      themeName: DOCS_CODE_THEME_NAME,
      loadHookDoc: hooksConfig.loadHookDoc,
      examplesDir,
    });
  } catch (err) {
    errors.push(String(err instanceof Error ? err.message : err));
    return { hooksCount: 0, allHooks, registryHooks, errors };
  }

  const hooksDir = resolve(outputDir, "hooks");
  if (existsSync(hooksDir)) {
    rmSync(hooksDir, { recursive: true });
  }
  mkdirSync(hooksDir, { recursive: true });
  for (const [name, data] of Object.entries(enrichedData)) {
    try {
      const { source, files, ...pageData } = data;

      writeJson(resolve(hooksDir, `${name}.json`), {
        ...pageData,
        files: files.map((file) => file.path),
      });
      writeFileSync(
        resolve(hooksDir, `${name}.source.json`),
        `${JSON.stringify({ source, files })}\n`,
      );
    } catch (err) {
      errors.push(String(err instanceof Error ? err.message : err));
    }
  }
  const hooksCount = Object.keys(enrichedData).length;
  log.info(`Wrote ${hooksCount} per-hook JSON files`);

  const hookList = Object.values(enrichedData)
    .map((h) => ({ name: h.name, title: h.title }))
    .sort((a, b) => a.name.localeCompare(b.name));
  writeJson(resolve(outputDir, "hook-list.json"), hookList);
  log.info(`Wrote hook-list.json (${hookList.length} entries)`);

  mkdirSync(hooksConfig.contentDir, { recursive: true });

  const hookPages = Object.values(enrichedData)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((h) => h.name);
  const hasIndexPage = existsSync(resolve(hooksConfig.contentDir, "index.mdx"));
  const metaPages = hasIndexPage ? ["index", ...hookPages] : hookPages;
  writeJson(resolve(hooksConfig.contentDir, "meta.json"), { title: "Hooks", pages: metaPages });
  log.info(`Wrote meta.json (${hooksCount} hook pages)`);

  if (hooksConfig.aggregateHooksFile) {
    const aggregateItems = hooksConfig.aggregateHooksItems ?? registryHooks;
    const basicData = generateHooksSource({
      items: aggregateItems,
      rootDir,
      highlighter,
      themeName: DOCS_CODE_THEME_NAME,
    });
    writeJson(resolve(outputDir, hooksConfig.aggregateHooksFile), basicData);
    log.info(`Wrote ${hooksConfig.aggregateHooksFile} (${Object.keys(basicData).length} hooks)`);
  }

  return { hooksCount, allHooks, registryHooks, errors };
}
