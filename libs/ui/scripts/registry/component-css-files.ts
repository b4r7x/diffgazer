import { resolve } from "node:path";
import { REGISTRY_ITEM_TYPE, type RegistryItem } from "@diffgazer/registry/schemas";

type CssSourceItem = Pick<RegistryItem, "type" | "files">;

/** Registry CSS paths in first-seen order, deduplicated by their resolved path. */
export function collectComponentCssFiles(items: CssSourceItem[], rootDir: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.type === REGISTRY_ITEM_TYPE.theme) continue;
    for (const file of item.files) {
      if (!file.path.endsWith(".css")) continue;
      const normalizedPath = resolve(rootDir, file.path);
      if (seen.has(normalizedPath)) continue;
      seen.add(normalizedPath);
      paths.push(file.path);
    }
  }
  return paths;
}
