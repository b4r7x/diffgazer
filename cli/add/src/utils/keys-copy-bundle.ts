import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeIntegrity } from "@diffgazer/registry";
import { type CopyBundle, CopyBundleSchema } from "@diffgazer/registry/schemas";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveGeneratedFile(fileName: string): string {
  const fallbackPath = resolve(__dirname, "./generated", fileName);
  const candidates = [
    fallbackPath,
    resolve(__dirname, "../generated", fileName),
  ];
  return candidates.find((path) => existsSync(path)) ?? fallbackPath;
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
  verifyBundleIntegrity(parsed);
  cachedCopyBundle = parsed;
  return parsed;
}

// The bundle ships with an integrity hash over its items; recompute it on load
// so a corrupted or tampered generated file is rejected before its contents are
// copied into a user's project. Mirrors buildCopyBundle's hashing input exactly
// (the items array, without the integrity field).
export function verifyBundleIntegrity(bundle: CopyBundle): void {
  if (!bundle.integrity) {
    throw new Error(
      `Bundled keys copy hooks are missing an integrity hash.\nFile: ${KEYS_COPY_BUNDLE_PATH}\nRebuild dgadd package.`,
    );
  }
  const actual = computeIntegrity(JSON.stringify({ items: bundle.items }));
  if (actual !== bundle.integrity) {
    throw new Error(
      [
        "Bundled keys copy hooks failed integrity verification.",
        `File: ${KEYS_COPY_BUNDLE_PATH}`,
        `Expected: ${bundle.integrity}`,
        `Actual:   ${actual}`,
        "The generated bundle is corrupted or was modified. Rebuild dgadd package.",
      ].join("\n"),
    );
  }
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
 * Extract keys hook names from registry items by scanning Diffgazer keys
 * namespace refs. Returns bare hook names (e.g. "focus-trap") that key the copy
 * bundle and match `parsed.name` on removal. This is intentionally not
 * `resolveKeysHookFiles` from @diffgazer/registry/cli: that helper returns
 * `use-`prefixed hook file basenames for the UI dist build, which would miss
 * every bundle lookup here.
 */
export function resolveKeysHooksFromRegistry(
  items: Array<{ registryDependencies?: string[] }>,
): string[] {
  const names = new Set<string>();
  for (const item of items) {
    for (const dep of item.registryDependencies ?? []) {
      const name = parseKeysDependencyName(dep);
      if (name) names.add(name);
    }
  }
  return [...names];
}

export function getKeysHookNames(): Set<string> {
  const bundle = loadCopyBundle();
  return new Set(bundle.items.map((h) => h.name));
}

export function getPublicKeysHookNames(): Set<string> {
  const bundle = loadCopyBundle();
  return new Set(
    bundle.items
      .filter((hook) => hook.meta?.hidden !== true)
      .map((hook) => hook.name),
  );
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
