import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export function findExamples(examplesDir: string, itemName: string): string[] {
  const itemDir = resolve(examplesDir, itemName);
  if (!existsSync(itemDir)) return [];

  return readdirSync(itemDir)
    .filter((fileName) => fileName.endsWith(".tsx"))
    .map((fileName) => fileName.replace(".tsx", ""))
    .sort();
}

export function generateDemoIndex(config: {
  items: Array<{ name: string }>;
  examplesDir: string;
  importPathPrefix: string;
  findExamplesFn?: (examplesDir: string, itemName: string) => string[];
  logger?: { warn?: (message: string) => void };
}): string {
  const { items, examplesDir, importPathPrefix, findExamplesFn = findExamples, logger } = config;

  const seenKeys = new Map<string, string>();
  const demoImports: string[] = [];
  for (const item of items) {
    const examples = findExamplesFn(examplesDir, item.name);
    for (const exampleName of examples) {
      const existing = seenKeys.get(exampleName);
      if (existing) {
        logger?.warn?.(
          `Demo index key collision: "${exampleName}" from "${item.name}" overwrites "${existing}"`
        );
      }
      seenKeys.set(exampleName, item.name);
      demoImports.push(
        `  "${exampleName}": lazy(() => import("${importPathPrefix}/${item.name}/${exampleName}")),`
      );
    }
  }

  return `import { lazy } from "react"
import type { ComponentType, LazyExoticComponent } from "react"

export const demos: Record<string, LazyExoticComponent<ComponentType>> = {
${demoImports.join("\n")}
}
`;
}
