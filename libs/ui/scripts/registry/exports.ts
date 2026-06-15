import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REGISTRY_ITEM_TYPE } from "@diffgazer/registry/schemas";
import type { RegistryItem } from "./fs.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validatePublicExportShape(
  exportsMap: Record<string, unknown>,
  exportPath: string,
): string[] {
  const errors: string[] = [];
  const exportValue = exportsMap[exportPath];

  if (!isRecord(exportValue)) {
    return [
      `package export ${exportPath} must be an object with top-level "types" and "import" conditions`,
    ];
  }

  if (isRecord(exportValue.import)) {
    errors.push(
      `package export ${exportPath} nests "types" under "import"; TypeScript bundler resolution requires top-level "types"`,
    );
  }

  if (typeof exportValue.types !== "string") {
    errors.push(`package export ${exportPath} is missing top-level "types" condition`);
  }

  if (typeof exportValue.import !== "string") {
    errors.push(`package export ${exportPath} is missing top-level "import" condition`);
  }

  return errors;
}

interface GeneratedComponentDocsData {
  props?: Record<string, Record<string, unknown>>;
  docs?: { noProps?: unknown };
}

function countProps(propsTable: Record<string, Record<string, unknown>>): number {
  return Object.values(propsTable).reduce((sum, group) => sum + Object.keys(group).length, 0);
}

export function validatePublicComponentProps(root: string, items: RegistryItem[]): string[] {
  const errors: string[] = [];

  for (const item of items) {
    if (item.type !== REGISTRY_ITEM_TYPE.ui || item.meta?.hidden) continue;

    const dataPath = resolve(root, "docs/generated/components", `${item.name}.json`);
    // Skip when generated docs JSON is absent (clean checkouts before prepare:artifacts).
    if (!existsSync(dataPath)) continue;

    let data: GeneratedComponentDocsData;
    try {
      data = JSON.parse(readFileSync(dataPath, "utf-8")) as GeneratedComponentDocsData;
    } catch (err) {
      errors.push(`${item.name} generated docs JSON is not valid: ${(err as Error).message}`);
      continue;
    }

    if (data.docs?.noProps === true) continue;

    if (countProps(data.props ?? {}) === 0) {
      errors.push(
        `${item.name}: public component has empty props table in docs/generated/components/${item.name}.json. Populate the "props" field in registry/component-docs/${item.name}.ts, or set "noProps: true" on the exported doc if the component intentionally has no public props.`,
      );
    }
  }

  return errors;
}
