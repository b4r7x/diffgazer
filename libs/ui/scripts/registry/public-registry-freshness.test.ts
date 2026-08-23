import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { aggregateThemeStyles } from "@diffgazer/registry";
import type { RegistryItem } from "@diffgazer/registry/schemas";
import { describe, expect, it } from "vitest";
import { validatePublicRegistryFresh } from "../../../registry/src/shadcn/validate.js";

const UI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIX_COMMAND = "pnpm --filter @diffgazer/ui build:shadcn";
const FRESHNESS_TIMEOUT_MS = 20_000;

type RegistrySourceContentTransform = (ctx: {
  itemName: string;
  filePath: string;
  content: string;
}) => string;

async function loadExport<T>(modulePath: string, exportName: string): Promise<T> {
  const loaded = (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
  const value = loaded[exportName];
  if (typeof value !== "function") {
    throw new Error(`Missing export: ${exportName}`);
  }
  return value as T;
}

describe("committed public registry freshness", () => {
  it(
    "keeps committed public/r in sync with the source registry",
    async () => {
      const transformModule = resolve(UI_ROOT, "scripts/registry/rewrite-keys-imports.ts");
      const transformUiContent = await loadExport<
        (content: string, options?: { shimHookBasename?: string }) => string
      >(transformModule, "transformUiPublicRegistryKeysImportContent");
      const transformUiPublicRegistrySourceItem = await loadExport<
        (
          item: RegistryItem,
          options?: {
            stylePolicy?: (itemName: string, content: string) => boolean;
            readSourceFile?: (path: string) => string;
          },
        ) => RegistryItem
      >(transformModule, "transformUiPublicRegistrySourceItem");
      const createUiThemeStyleStripPolicy = await loadExport<
        (options: {
          rootDir: string;
          sourceRegistryPath?: string;
        }) => (itemName: string, content: string) => boolean
      >(transformModule, "createUiThemeStyleStripPolicy");
      const skipSourceItem = await loadExport<(item: RegistryItem) => boolean>(
        transformModule,
        "isHiddenKeysShim",
      );
      const stylePolicy = createUiThemeStyleStripPolicy({
        rootDir: UI_ROOT,
        sourceRegistryPath: "registry/registry.json",
      });

      const transformSourceContent: RegistrySourceContentTransform = ({
        content,
        itemName,
        filePath,
      }) =>
        itemName === "theme" && filePath === "styles/styles.css"
          ? aggregateThemeStyles({
              rootDir: UI_ROOT,
              sourceRegistryPath: "registry/registry.json",
              seedContent: content,
            })
          : transformUiContent(content, {
              shimHookBasename: itemName.startsWith("use-") ? itemName : undefined,
            });

      expect(() =>
        validatePublicRegistryFresh({
          rootDir: UI_ROOT,
          fixCommand: FIX_COMMAND,
          transformSourceItem: ({ item }) =>
            transformUiPublicRegistrySourceItem(item, {
              stylePolicy,
              readSourceFile: (path) => readFileSync(resolve(UI_ROOT, path), "utf-8"),
            }),
          transformSourceContent,
          shouldSkipSourceItem: ({ item }) => skipSourceItem(item),
        }),
      ).not.toThrow();
    },
    FRESHNESS_TIMEOUT_MS,
  );
});
