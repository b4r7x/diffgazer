import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { log } from "../logger.js";
import { isWithinDir } from "../utils/fs.js";
import { toDocExportName } from "./naming.js";
import type { HookDoc } from "./types.js";

const HOOK_DOC_NAME = /^[a-z0-9][a-z0-9-]*$/;

function assertSafeRelativeFileName(fileName: string): void {
  if (!HOOK_DOC_NAME.test(fileName)) {
    throw new Error(`Invalid hook doc file name: "${fileName}"`);
  }
}

function assertPathInsideRoot(targetPath: string, root: string): void {
  if (!isWithinDir(targetPath, root)) {
    throw new Error(`Hook doc path "${targetPath}" escapes docs root "${root}"`);
  }
}

const HOOK_DOC_OPTIONAL_ARRAY_FIELDS = ["parameters", "notes", "examples", "tags"] as const;
const HOOK_DOC_OPTIONAL_OBJECT_FIELDS = ["usage", "returns"] as const;

function isHookDoc(value: object): value is HookDoc {
  const record = value as Record<string, unknown>;
  for (const field of HOOK_DOC_OPTIONAL_ARRAY_FIELDS) {
    if (field in record && !Array.isArray(record[field])) {
      return false;
    }
  }
  for (const field of HOOK_DOC_OPTIONAL_OBJECT_FIELDS) {
    if (field in record && (typeof record[field] !== "object" || record[field] === null)) {
      return false;
    }
  }
  if ("description" in record && typeof record.description !== "string") {
    return false;
  }
  return true;
}

export function createHookDocLoader(
  docsDir: string,
  fileNameTransform?: (hookName: string) => string,
): (hookName: string) => Promise<HookDoc | null> {
  const resolvedDocsDir = resolve(docsDir);
  return async (hookName: string): Promise<HookDoc | null> => {
    const fileName = fileNameTransform ? fileNameTransform(hookName) : hookName;
    try {
      assertSafeRelativeFileName(fileName);
    } catch (err) {
      log.warn(`Rejected hook doc name: ${err}`);
      return null;
    }
    const docPath = resolve(resolvedDocsDir, `${fileName}.ts`);
    assertPathInsideRoot(docPath, resolvedDocsDir);
    if (!existsSync(docPath)) return null;
    try {
      const mod: unknown = await import(docPath);
      if (!mod || typeof mod !== "object") return null;
      const exportName = toDocExportName(fileName);
      const value = (mod as Record<string, unknown>)[exportName];
      if (!value || typeof value !== "object") return null;
      if (!isHookDoc(value)) return null;
      return value;
    } catch (err) {
      log.warn(`Failed to load hook doc: ${err}`);
      return null;
    }
  };
}
