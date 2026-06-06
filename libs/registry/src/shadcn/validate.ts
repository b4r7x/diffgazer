import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { RegistryFileSchema, RegistryItemSchema, RegistrySchema } from "../registry-types.js";
import { ensureExists, isRelativeSubpath } from "../utils/fs.js";
import { readJson } from "../utils/json.js";

type RegistryItem = z.infer<typeof RegistrySchema>["items"][number];

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
  transformSourceItem?: (ctx: {
    itemName: string;
    item: RegistryItem;
  }) => RegistryItem;
  transformSourceContent?: (ctx: {
    itemName: string;
    filePath: string;
    content: string;
  }) => string;
}

const PublicItemSchema = RegistryItemSchema.extend({
  files: z.array(RegistryFileSchema).optional(),
}).passthrough();

// Keys of the Zod shape are exactly `keyof RegistryItem`, so this assertion is sound
// and lets call sites index `RegistryItem` without per-field casts.
const itemFields = (Object.keys(RegistryItemSchema.shape) as (keyof RegistryItem)[]).filter(
  (field) => field !== "files",
);
const fileMetadataFields = Object.keys(RegistryFileSchema.shape).filter((field) => field !== "content");
const arrayDefaultFields = new Set(["dependencies", "registryDependencies", "devDependencies", "envVars", "categories"]);

function compareItemFields(
  prefix: string,
  expectedItem: RegistryItem,
  actualItem: Partial<RegistryItem>,
  itemName: string,
  fixCommand: string,
): void {
  for (const field of itemFields) {
    ensureSameValue({
      label: `${prefix}${field}`,
      a: expectedItem[field],
      b: actualItem[field],
      defaultValue: arrayDefaultFields.has(field) ? [] : undefined,
      itemName,
      fixCommand,
    });
  }
}

function ensureSafeFilePath(path: string, itemName: string, origin: string): void {
  if (!isRelativeSubpath(path)) {
    throw new Error(
      `Unsafe registry file path "${path}" in ${origin} for "${itemName}". ` +
        "Registry file paths must be relative and must not contain '..' segments.",
    );
  }
}

export function validatePublicRegistryFresh(options: ValidatePublicRegistryFreshOptions): void {
  const {
    rootDir,
    fixCommand,
    sourceRegistryPath = "registry/registry.json",
    publicRegistryDir = "public/r",
    transformSourceItem,
    transformSourceContent,
  } = options;

  const sourceRegistry = readJson(resolve(rootDir, sourceRegistryPath), RegistrySchema);
  const publicRegistry = readJson(resolve(rootDir, publicRegistryDir, "registry.json"), RegistrySchema);
  const allSourceItems = sourceRegistry.items;
  // Hidden items are intentionally stripped from the public registry index by
  // afterBuild transforms. Only compare visible items for the count check.
  const visibleSourceItems = allSourceItems.filter(
    (item) => !(item.meta as Record<string, unknown> | undefined)?.hidden,
  );
  const publicItems = publicRegistry.items;
  const publicByName = new Map(publicItems.map((item) => [item.name, item]));

  if (visibleSourceItems.length !== publicItems.length) {
    throw new Error(
      [
        "Public registry item count does not match source registry.",
        `Run: ${fixCommand}`,
      ].join("\n"),
    );
  }

  for (const sourceItem of allSourceItems) {
    const isHidden = (sourceItem.meta as Record<string, unknown> | undefined)?.hidden;
    const expectedItem = transformSourceItem?.({
      itemName: sourceItem.name,
      item: sourceItem,
    }) ?? sourceItem;

    // Visible items must appear in the public registry index.
    // Hidden items are stripped from the index by afterBuild transforms,
    // so skip the index-level check for them.
    if (!isHidden) {
      const publicItem = publicByName.get(sourceItem.name);
      if (!publicItem) {
        throw new Error(
          [
            `Public registry missing item "${sourceItem.name}".`,
            `Run: ${fixCommand}`,
          ].join("\n"),
        );
      }

      compareItemFields("", expectedItem, publicItem, sourceItem.name, fixCommand);

      for (const file of publicItem.files) {
        ensureSafeFilePath(file.path, sourceItem.name, "public registry index");
        if (file.target) ensureSafeFilePath(file.target, sourceItem.name, "public registry index");
      }
      ensureSameValue({
        label: "index files",
        a: expectedItem.files.map((file) => file.path),
        b: publicItem.files.map((file) => file.path),
        itemName: sourceItem.name,
        fixCommand,
      });
    }

    // Both hidden and visible items must have a per-item JSON file on disk
    // with correct content.
    const publicItemPath = resolve(rootDir, publicRegistryDir, `${sourceItem.name}.json`);
    ensureExists(publicItemPath, `public registry item JSON (${sourceItem.name})`);

    const publicItemJson = readJson(publicItemPath, PublicItemSchema);

    for (const file of expectedItem.files) {
      ensureSafeFilePath(file.path, sourceItem.name, "source registry");
      if (file.target) ensureSafeFilePath(file.target, sourceItem.name, "source registry");
    }
    for (const file of publicItemJson.files ?? []) {
      ensureSafeFilePath(file.path, sourceItem.name, "public registry");
      if (file.target) ensureSafeFilePath(file.target, sourceItem.name, "public registry");
    }

    const publicFilesByPath = new Map((publicItemJson.files ?? []).map((file) => [file.path, file]));

    compareItemFields("item JSON ", expectedItem, publicItemJson, sourceItem.name, fixCommand);

    const sourceFilePaths = expectedItem.files.map((file) => file.path);
    const publicFilePaths = (publicItemJson.files ?? []).map((file) => file.path);
    ensureSameValue({
      label: "item JSON files",
      a: sourceFilePaths,
      b: publicFilePaths,
      itemName: sourceItem.name,
      fixCommand,
    });

    for (const expectedFile of expectedItem.files) {
      const sourcePath = resolve(rootDir, expectedFile.path);
      ensureExists(sourcePath, `source registry file (${sourceItem.name})`);

      const rawContent = readFileSync(sourcePath, "utf-8");
      const sourceContent = transformSourceContent?.({
        itemName: sourceItem.name,
        filePath: expectedFile.path,
        content: rawContent,
      }) ?? rawContent;
      const publicFile = publicFilesByPath.get(expectedFile.path);

      if (!publicFile || typeof publicFile.content !== "string") {
        throw new Error(
          [
            `Public registry file "${expectedFile.path}" missing for "${sourceItem.name}".`,
            `Run: ${fixCommand}`,
          ].join("\n"),
        );
      }

      if (publicFile.content !== sourceContent) {
        throw new Error(
          [
            `Public registry file content is stale for "${expectedFile.path}" (${sourceItem.name}).`,
            `Run: ${fixCommand}`,
          ].join("\n"),
        );
      }

      for (const field of fileMetadataFields) {
        ensureSameValue({
          label: `file ${field} is stale`,
          a: expectedFile[field as keyof typeof expectedFile],
          b: publicFile[field as keyof typeof publicFile],
          itemName: sourceItem.name,
          fixCommand,
        });
      }
    }
  }
}
