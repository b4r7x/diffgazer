import { existsSync, readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { defaultLogger, type Logger } from "../logger.js"
import type { HookDoc } from "./types.js"

export function kebabToCamelCase(str: string): string {
  return str
    .split("-")
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("")
}

export function toDocExportName(name: string): string {
  return kebabToCamelCase(name) + "Doc"
}

export function toYamlString(value: string): string {
  return JSON.stringify(value)
}

export function cleanDir(dir: string, ext: string): void {
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir)) {
    if (f.endsWith(ext)) rmSync(resolve(dir, f))
  }
}

const HOOK_DOC_OPTIONAL_ARRAY_FIELDS = ["parameters", "notes", "examples", "tags"] as const
const HOOK_DOC_OPTIONAL_OBJECT_FIELDS = ["usage", "returns"] as const

function isHookDoc(value: object): value is HookDoc {
  const record = value as Record<string, unknown>
  for (const field of HOOK_DOC_OPTIONAL_ARRAY_FIELDS) {
    if (field in record && !Array.isArray(record[field])) {
      return false
    }
  }
  for (const field of HOOK_DOC_OPTIONAL_OBJECT_FIELDS) {
    if (field in record && (typeof record[field] !== "object" || record[field] === null)) {
      return false
    }
  }
  if ("description" in record && typeof record.description !== "string") {
    return false
  }
  return true
}

export function createHookDocLoader(
  docsDir: string,
  fileNameTransform?: (hookName: string) => string,
  logger: Logger = defaultLogger,
): (hookName: string) => Promise<HookDoc | null> {
  return async (hookName: string): Promise<HookDoc | null> => {
    const fileName = fileNameTransform ? fileNameTransform(hookName) : hookName
    const docPath = resolve(docsDir, `${fileName}.ts`)
    if (!existsSync(docPath)) return null
    try {
      const mod: unknown = await import(docPath)
      if (!mod || typeof mod !== "object") return null
      const exportName = toDocExportName(fileName)
      const value = (mod as Record<string, unknown>)[exportName]
      if (!value || typeof value !== "object") return null
      if (!isHookDoc(value)) return null
      return value
    } catch (err) {
      logger.warn?.(`Failed to load hook doc: ${err}`)
      return null
    }
  }
}
