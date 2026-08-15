import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const EXAMPLE_EXTENSION = ".tsx";
const TEST_EXAMPLE_FILE = /\.(?:test|spec)\.tsx$/i;
const TEST_EXAMPLE_KEY = /\.(?:test|spec)$/i;

export function findExamples(examplesDir: string, itemName: string): string[] {
  const itemDir = resolve(examplesDir, itemName);
  if (!existsSync(itemDir)) return [];

  return readdirSync(itemDir)
    .filter((fileName) => fileName.endsWith(EXAMPLE_EXTENSION) && !TEST_EXAMPLE_FILE.test(fileName))
    .map((fileName) => fileName.slice(0, -EXAMPLE_EXTENSION.length))
    .sort();
}

export function generateDemoIndex(config: {
  items: Array<{ name: string }>;
  examplesDir: string;
  importPathPrefix: string;
  findExamplesFn?: (examplesDir: string, itemName: string) => string[];
}): string {
  const { items, examplesDir, importPathPrefix, findExamplesFn = findExamples } = config;

  const seenKeys = new Map<string, string>();
  const demoImports: string[] = [];
  for (const item of items) {
    const examples = findExamplesFn(examplesDir, item.name);
    for (const exampleName of examples) {
      if (TEST_EXAMPLE_KEY.test(exampleName)) {
        throw new Error(
          `Demo index cannot reference test/spec example "${exampleName}" from "${item.name}"`,
        );
      }
      const existing = seenKeys.get(exampleName);
      if (existing) {
        throw new Error(
          `Demo index key collision: "${exampleName}" from "${item.name}" conflicts with "${existing}"`,
        );
      }
      seenKeys.set(exampleName, item.name);
      demoImports.push(
        `  "${exampleName}": lazy(() => import("${importPathPrefix}/${item.name}/${exampleName}")),`,
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
