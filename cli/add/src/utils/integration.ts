import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CopyBundleSchema, type CopyBundle } from "@diffgazer/registry/schemas";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveGeneratedFile(fileName: string): string {
  const candidates = [
    resolve(__dirname, "./generated", fileName),
    resolve(__dirname, "../generated", fileName),
  ];
  return candidates.find((path) => existsSync(path)) ?? candidates[0]!;
}

const KEYS_COPY_BUNDLE_PATH = resolveGeneratedFile("keys-copy-bundle.json");

export interface KeysCopyHookFile {
  hook: string;
  relativePath: string;
  content: string;
}

let cachedCopyBundle: CopyBundle | null = null;

function loadCopyBundle(): CopyBundle {
  if (cachedCopyBundle) return cachedCopyBundle;

  if (!existsSync(KEYS_COPY_BUNDLE_PATH)) {
    throw new Error(
      [
        "Missing bundled keys copy hooks.",
        `Expected: ${KEYS_COPY_BUNDLE_PATH}`,
        "Rebuild dgadd package.",
      ].join("\n"),
    );
  }

  const raw = JSON.parse(readFileSync(KEYS_COPY_BUNDLE_PATH, "utf-8")) as unknown;
  const parsed = CopyBundleSchema.parse(raw);
  cachedCopyBundle = parsed;
  return parsed;
}

function toHookRelativePath(path: string): string {
  if (path.startsWith("src/hooks/")) {
    return path.slice("src/hooks/".length);
  }
  if (path.startsWith("hooks/")) {
    return path.slice("hooks/".length);
  }
  if (path.startsWith("src/")) {
    return path.slice("src/".length);
  }
  return path;
}

function toFileStem(path: string): string {
  const fileName = path.split("/").at(-1) ?? path;
  const extensionStart = fileName.lastIndexOf(".");
  return extensionStart === -1 ? fileName : fileName.slice(0, extensionStart);
}

function isHookFilePath(path: string): boolean {
  return path.startsWith("hooks/") || path.startsWith("src/hooks/");
}

function validateAndCollectFiles(
  hookName: string,
  hookFiles: Array<{ path: string; content: string }>,
  seenPaths: Set<string>,
): KeysCopyHookFile[] {
  const result: KeysCopyHookFile[] = [];
  for (const file of hookFiles) {
    const relativePath = toHookRelativePath(file.path);
    if (!relativePath || relativePath.includes("..")) {
      throw new Error(
        `Invalid bundled keys hook file path "${file.path}" for hook "${hookName}".`,
      );
    }
    if (seenPaths.has(relativePath)) continue;
    seenPaths.add(relativePath);
    result.push({ hook: hookName, relativePath, content: file.content });
  }
  return result;
}

export function resolveKeysCopyHookFiles(hooks: string[]): {
  files: KeysCopyHookFile[];
  missingHooks: string[];
} {
  const bundle = loadCopyBundle();
  const byName = new Map(bundle.items.map((hook) => [hook.name, hook] as const));
  const files: KeysCopyHookFile[] = [];
  const missingHooks: string[] = [];
  const seenPaths = new Set<string>();

  for (const hookName of hooks) {
    const hook = byName.get(hookName);
    if (!hook) { missingHooks.push(hookName); continue; }
    files.push(...validateAndCollectFiles(hookName, hook.files, seenPaths));
  }

  return { files, missingHooks };
}

function parseKeysDependencyName(dep: string): string | null {
  if (dep.startsWith("@diffgazer/keys/")) {
    return dep.replace("@diffgazer/keys/", "");
  }
  if (dep.startsWith("@diffgazer-keys/")) {
    return dep.replace("@diffgazer-keys/", "");
  }
  return null;
}

/**
 * Extract keys hook names from registry items by scanning Diffgazer keys namespace refs.
 * Inlined from shared/registry-types.ts (cannot import outside rootDir: "src").
 */
export function resolveKeysHooksFromRegistry(
  items: Array<{ registryDependencies?: string[] }>,
): string[] {
  const names = new Set<string>();
  const publicHookNames = getKeysHookNames();
  const internalDependencyNames = getKeysInternalDependencyNames();

  for (const item of items) {
    for (const dep of item.registryDependencies ?? []) {
      const name = parseKeysDependencyName(dep);
      if (!name) continue;

      if (publicHookNames.has(name)) {
        names.add(name);
      } else if (!internalDependencyNames.has(name)) {
        names.add(name);
      }
    }
  }
  return [...names];
}

export function getKeysHookNames(): Set<string> {
  const bundle = loadCopyBundle();
  return new Set(bundle.items.map((h) => h.name));
}

export function getKeysHookImportNames(): Set<string> {
  const bundle = loadCopyBundle();
  const names = new Set<string>();

  for (const hook of bundle.items) {
    names.add(hook.name);
    for (const file of hook.files) {
      if (isHookFilePath(file.path)) {
        names.add(toFileStem(file.path));
      }
    }
  }

  return names;
}

function getKeysInternalDependencyNames(): Set<string> {
  const bundle = loadCopyBundle();
  const names = new Set<string>();

  for (const hook of bundle.items) {
    for (const file of hook.files) {
      const relativePath = toHookRelativePath(file.path);
      if (relativePath.startsWith("internal/")) {
        names.add(toFileStem(file.path));
      }
    }
  }

  return names;
}
