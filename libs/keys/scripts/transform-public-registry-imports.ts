import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RELATIVE_JS_IMPORT = /(from\s+|import\(\s*|require\(\s*)(["'])(\.{1,2}\/[^"']+)\.js\2/g;

export function transformKeysPublicRegistryImportContent(content: string): string {
  return content.replace(
    RELATIVE_JS_IMPORT,
    (_match: string, prefix: string, quote: string, specifier: string) =>
      `${prefix}${quote}${specifier}${quote}`,
  );
}

interface RegistryFileWithContent {
  content?: string;
}

interface PublicRegistryItemJson {
  files?: RegistryFileWithContent[];
}

export function transformKeysPublicRegistryImports(outputDir: string): void {
  for (const entry of readdirSync(outputDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const itemPath = join(outputDir, entry);
    const item = JSON.parse(readFileSync(itemPath, "utf-8")) as PublicRegistryItemJson;
    let changed = false;

    for (const file of item.files ?? []) {
      if (typeof file.content !== "string") continue;

      const nextContent = transformKeysPublicRegistryImportContent(file.content);
      if (nextContent === file.content) continue;

      file.content = nextContent;
      changed = true;
    }

    if (changed) {
      writeFileSync(itemPath, `${JSON.stringify(item, null, 2)}\n`);
    }
  }
}
