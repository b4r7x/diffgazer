import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ensureExists } from "../utils/fs.js";
import { readJson } from "../utils/json.js";
import { RegistrySchema } from "../registry-types.js";

interface EnsureSameValueParams {
  label: string;
  a: unknown;
  b: unknown;
  defaultValue?: unknown;
  itemName: string;
  fixCommand: string;
}

function ensureSameValue({ label, a, b, defaultValue, itemName, fixCommand }: EnsureSameValueParams): void {
  const left = defaultValue !== undefined ? (a ?? defaultValue) : a;
  const right = defaultValue !== undefined ? (b ?? defaultValue) : b;
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(
      [
        `Public registry is stale for "${itemName}" (${label} mismatch).`,
        `Run: ${fixCommand}`,
      ].join("\n"),
    );
  }
}

export interface ValidatePublicRegistryFreshOptions {
  rootDir: string;
  fixCommand: string;
  sourceRegistryPath?: string;
  publicRegistryDir?: string;
  transformSourceContent?: (ctx: {
    itemName: string;
    filePath: string;
    content: string;
  }) => string;
}

const PublicItemSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  registryDependencies: z.array(z.string()).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  files: z.array(z.object({
    path: z.string(),
    content: z.string().optional(),
    target: z.string().optional(),
    type: z.string().optional(),
  })).optional(),
}).passthrough();

const valueFields = ["title", "description", "meta"] as const;
const arrayFields = ["dependencies", "registryDependencies"] as const;

export function validatePublicRegistryFresh(options: ValidatePublicRegistryFreshOptions): void {
  const {
    rootDir,
    fixCommand,
    sourceRegistryPath = "registry/registry.json",
    publicRegistryDir = "public/r",
    transformSourceContent,
  } = options;

  const sourceRegistry = readJson(resolve(rootDir, sourceRegistryPath), RegistrySchema);
  const publicRegistry = readJson(resolve(rootDir, publicRegistryDir, "registry.json"), RegistrySchema);
  const sourceItems = sourceRegistry.items ?? [];
  const publicItems = publicRegistry.items ?? [];
  const publicByName = new Map(publicItems.map((item) => [item.name, item]));

  if (sourceItems.length !== publicItems.length) {
    throw new Error(
      [
        "Public registry item count does not match source registry.",
        `Run: ${fixCommand}`,
      ].join("\n"),
    );
  }

  for (const sourceItem of sourceItems) {
    const publicItem = publicByName.get(sourceItem.name);
    if (!publicItem) {
      throw new Error(
        [
          `Public registry missing item "${sourceItem.name}".`,
          `Run: ${fixCommand}`,
        ].join("\n"),
      );
    }

    for (const field of valueFields) {
      ensureSameValue({ label: field, a: sourceItem[field], b: publicItem[field], itemName: sourceItem.name, fixCommand });
    }
    for (const field of arrayFields) {
      ensureSameValue({ label: field, a: sourceItem[field], b: publicItem[field], defaultValue: [], itemName: sourceItem.name, fixCommand });
    }

    const publicItemPath = resolve(rootDir, publicRegistryDir, `${sourceItem.name}.json`);
    ensureExists(publicItemPath, `public registry item JSON (${sourceItem.name})`);

    const publicItemJson = readJson(publicItemPath, PublicItemSchema);
    const publicFilesByPath = new Map((publicItemJson.files ?? []).map((file) => [file.path, file]));

    for (const field of ["name", "type"] as const) {
      ensureSameValue({ label: `item ${field}`, a: sourceItem[field], b: publicItemJson[field], itemName: sourceItem.name, fixCommand });
    }
    for (const field of valueFields) {
      ensureSameValue({ label: `item JSON ${field}`, a: sourceItem[field], b: publicItemJson[field], itemName: sourceItem.name, fixCommand });
    }
    for (const field of arrayFields) {
      ensureSameValue({ label: `item JSON ${field}`, a: sourceItem[field], b: publicItemJson[field], defaultValue: [], itemName: sourceItem.name, fixCommand });
    }

    const sourceFilePaths = (sourceItem.files ?? []).map((file) => file.path);
    const publicFilePaths = (publicItemJson.files ?? []).map((file) => file.path);
    ensureSameValue({
      label: "item JSON files",
      a: sourceFilePaths,
      b: publicFilePaths,
      itemName: sourceItem.name,
      fixCommand,
    });

    for (const sourceFile of sourceItem.files ?? []) {
      const sourcePath = resolve(rootDir, sourceFile.path);
      ensureExists(sourcePath, `source registry file (${sourceItem.name})`);

      const rawContent = readFileSync(sourcePath, "utf-8");
      const sourceContent = transformSourceContent?.({
        itemName: sourceItem.name,
        filePath: sourceFile.path,
        content: rawContent,
      }) ?? rawContent;
      const publicFile = publicFilesByPath.get(sourceFile.path);

      if (!publicFile || typeof publicFile.content !== "string") {
        throw new Error(
          [
            `Public registry file "${sourceFile.path}" missing for "${sourceItem.name}".`,
            `Run: ${fixCommand}`,
          ].join("\n"),
        );
      }

      if (publicFile.content !== sourceContent) {
        throw new Error(
          [
            `Public registry file content is stale for "${sourceFile.path}" (${sourceItem.name}).`,
            `Run: ${fixCommand}`,
          ].join("\n"),
        );
      }

      if (publicFile.target !== sourceFile.target) {
        throw new Error(
          [
            `Public registry file target is stale for "${sourceFile.path}" (${sourceItem.name}).`,
            `Run: ${fixCommand}`,
          ].join("\n"),
        );
      }

      if (publicFile.type !== sourceFile.type) {
        throw new Error(
          [
            `Public registry file type is stale for "${sourceFile.path}" (${sourceItem.name}).`,
            `Run: ${fixCommand}`,
          ].join("\n"),
        );
      }
    }
  }
}
