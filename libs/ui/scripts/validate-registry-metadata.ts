import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { extractImportSpecifiers } from "@diffgazer/registry";
import { REGISTRY_ITEM_TYPE } from "@diffgazer/registry/schemas";
import { validatePublicComponentProps, validatePublicExportShape } from "./registry/exports.js";
import {
  extractLocalImports,
  hasKeysRegistryDependency,
  normalizeRegistryPath,
  type RegistryItem,
  resolveImportToRegistryPath,
} from "./registry/fs.js";
import { validateRegistryImportClosure } from "./registry/imports.js";
import { validateOrphanFiles } from "./registry/orphans.js";
import { type Registry, UiRegistrySchema } from "./registry/types.js";

interface PackageJson {
  exports?: Record<string, unknown>;
  sideEffects?: boolean | string[];
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

const ROOT = process.env.DIFFGAZER_UI_REGISTRY_ROOT
  ? resolve(process.env.DIFFGAZER_UI_REGISTRY_ROOT)
  : resolve(import.meta.dirname, "..");
const REGISTRY_SCHEMA = "https://ui.shadcn.com/schema/registry.json";
const KEYBOARD_NAVIGATION_INTEGRATION = "keyboard-navigation";
const ALLOWED_REGISTRY_DEP_ORIGINS = ["https://docs.b4r7.dev", "https://r.b4r7.dev"] as const;

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf-8"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readRegistry(): Registry {
  const data = readJson("registry/registry.json");
  const registry = UiRegistrySchema.parse(data);
  return {
    ...registry,
    $schema: isRecord(data) && typeof data.$schema === "string" ? data.$schema : undefined,
  };
}

function itemExportPath(item: RegistryItem): string | null {
  if (item.meta?.hidden) return null;
  return publicItemExportPath(item);
}

function publicItemExportPath(item: RegistryItem): string | null {
  if (item.type === REGISTRY_ITEM_TYPE.ui) return `./components/${item.name}`;
  if (item.type === REGISTRY_ITEM_TYPE.hook) return `./hooks/${item.name}`;
  if (item.type === REGISTRY_ITEM_TYPE.lib) return `./lib/${item.name}`;
  return null;
}

function hasClientDirective(item: RegistryItem): boolean {
  return (item.files ?? []).some((file) => {
    const path = resolve(ROOT, file.path);
    if (!existsSync(path)) return false;
    const source = readFileSync(path, "utf-8").trimStart();
    return source.startsWith('"use client"') || source.startsWith("'use client'");
  });
}

function clientEntryBarrelHasDirective(item: RegistryItem): boolean {
  const entry = (item.files ?? []).find((file) => file.path.endsWith("/index.ts"));
  if (!entry) return true;

  const path = resolve(ROOT, entry.path);
  if (!existsSync(path)) return false;

  const source = readFileSync(path, "utf-8").trimStart();
  return source.startsWith('"use client"') || source.startsWith("'use client'");
}

function itemSourceContains(item: RegistryItem, needle: string): boolean {
  return (item.files ?? []).some((file) => {
    const path = resolve(ROOT, file.path);
    return existsSync(path) && readFileSync(path, "utf-8").includes(needle);
  });
}

function validateExamplesAvoidHiddenPaths(items: RegistryItem[]): string[] {
  const errors: string[] = [];
  const hiddenFiles = new Set<string>();

  for (const item of items) {
    if (!item.meta?.hidden) continue;
    for (const file of item.files ?? []) {
      hiddenFiles.add(normalizeRegistryPath(file.path));
    }
  }

  if (hiddenFiles.size === 0) return errors;

  const examplesDir = resolve(ROOT, "registry/examples");
  if (!existsSync(examplesDir)) return errors;

  function walk(dir: string): string[] {
    const entries: string[] = [];
    for (const entry of readdirSync(dir)) {
      const entryPath = resolve(dir, entry);
      if (statSync(entryPath).isDirectory()) {
        entries.push(...walk(entryPath));
      } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
        entries.push(entryPath);
      }
    }
    return entries;
  }

  for (const exampleFile of walk(examplesDir)) {
    const source = readFileSync(exampleFile, "utf-8");
    if (source.includes("@hidden-imports-ok")) continue;
    const exampleRelPath = normalizeRegistryPath(relative(ROOT, exampleFile));

    for (const specifier of extractLocalImports(source)) {
      const importedPath = resolveImportToRegistryPath(ROOT, exampleRelPath, specifier);
      if (!importedPath) continue;

      if (hiddenFiles.has(importedPath)) {
        errors.push(
          `${exampleRelPath} imports hidden registry path "${specifier}" (resolves to ${importedPath})`,
        );
      }
    }
  }

  return errors;
}

function validateNoPublicKeysImports(): string[] {
  const errors: string[] = [];
  const registryDir = resolve(ROOT, "public/r");
  if (!existsSync(registryDir)) return errors;

  for (const entry of readdirSync(registryDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const filePath = resolve(registryDir, entry);
    let data: { files?: { content?: string; path?: string }[] };
    try {
      data = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      continue;
    }

    for (const file of data.files ?? []) {
      if (typeof file.content !== "string") continue;
      const residual = extractImportSpecifiers(file.content).filter(
        ({ specifier }) => specifier === "@diffgazer/keys",
      );
      if (residual.length > 0) {
        const forms = [...new Set(residual.map(({ kind }) => kind))].join(", ");
        errors.push(
          `Public registry item "${entry}" file "${file.path ?? "(unknown)"}" contains unsupported @diffgazer/keys root import (${forms}); public copy source must use rewritten local hooks`,
        );
      }
    }
  }

  return errors;
}

const KEYS_PEER_NAME = "@diffgazer/keys";

// Package-mode UI entries (accordion.tsx, popover/use-auto-focus.ts, and other
// keyboard-backed exports) statically import @diffgazer/keys at module top, so
// `npm install @diffgazer/ui` without keys throws ERR_MODULE_NOT_FOUND. keys is
// therefore a REQUIRED peer for package mode: it must be present in
// peerDependencies and must NOT be flagged optional in peerDependenciesMeta.
function validateKeysRequiredPeer(packageJson: PackageJson, items: RegistryItem[]): string[] {
  const hasPublicKeysItem = items.some(
    (item) => !item.meta?.hidden && hasKeysRegistryDependency(item),
  );
  if (!hasPublicKeysItem) return [];

  const errors: string[] = [];

  if (packageJson.peerDependencies?.[KEYS_PEER_NAME] === undefined) {
    errors.push(
      `public registry items statically import keys hooks, so package.json peerDependencies must declare "${KEYS_PEER_NAME}" (package-mode UI entries import @diffgazer/keys at runtime, so keys is a required peer)`,
    );
  }

  if (packageJson.peerDependenciesMeta?.[KEYS_PEER_NAME]?.optional === true) {
    errors.push(
      `public registry items statically import keys hooks, so package.json peerDependenciesMeta["${KEYS_PEER_NAME}"].optional must not be true (package-mode UI entries import @diffgazer/keys at runtime, so keys is a required peer)`,
    );
  }

  return errors;
}

function validate(): string[] {
  const registry = readRegistry();
  const packageJson = readJson("package.json") as PackageJson;
  const items = registry.items;
  const exportsMap = packageJson.exports ?? {};
  const errors: string[] = [];

  if (registry.$schema !== REGISTRY_SCHEMA) {
    errors.push(`registry.json $schema must be ${REGISTRY_SCHEMA}`);
  }

  if (packageJson.sideEffects !== true) {
    const sideEffects = Array.isArray(packageJson.sideEffects) ? packageJson.sideEffects : [];
    if (!sideEffects.some((entry) => entry.includes(".css"))) {
      errors.push("package.json sideEffects must preserve CSS exports");
    }
  }

  // @diffgazer/keys is a required peer for package mode. Keyboard-backed exports
  // (accordion, select, tabs, popover, etc.) static-import keys at module top, so
  // the tsup alias plugin externalizes those imports as static ESM specifiers and
  // importing such a subpath without keys fails at module load with a native
  // ERR_MODULE_NOT_FOUND naming "@diffgazer/keys". Because the failure is at import
  // (not a figlet-style lazy call), "optional" would be a lie for package consumers:
  // keys must stay in peerDependencies and must not be flagged optional. Copy/dgadd
  // consumers are unaffected — copy mode rewrites the keys imports to local source.
  errors.push(...validateKeysRequiredPeer(packageJson, items));

  for (const exportPath of Object.keys(exportsMap)) {
    if (exportPath.includes("*")) {
      errors.push(`package export "${exportPath}" uses a wildcard and can expose internals`);
    }

    if (!exportPath.endsWith(".css") && exportPath !== "./package.json") {
      errors.push(...validatePublicExportShape(exportsMap, exportPath));
    }
  }

  for (const item of items) {
    for (const file of item.files ?? []) {
      if (!existsSync(resolve(ROOT, file.path))) {
        errors.push(
          `File declared in registry but missing from disk: ${file.path} (item: ${item.name})`,
        );
      }
    }

    for (const dep of item.registryDependencies ?? []) {
      if (dep.startsWith("@diffgazer/keys/")) {
        errors.push(
          `${item.name} uses scoped package-style keys dependency "${dep}"; use @diffgazer-keys/<hook>`,
        );
      }

      if (dep.startsWith("http://") || dep.startsWith("https://")) {
        try {
          const depUrl = new URL(dep);
          const origin = depUrl.origin;
          if (!ALLOWED_REGISTRY_DEP_ORIGINS.some((allowed) => origin === allowed)) {
            errors.push(
              `${item.name} registryDependency "${dep}" has origin "${origin}" not in allowlist: ${ALLOWED_REGISTRY_DEP_ORIGINS.join(", ")}`,
            );
          }
        } catch {
          errors.push(`${item.name} registryDependency "${dep}" is not a valid URL`);
        }
      }
    }

    if (
      itemSourceContains(item, "class-variance-authority") &&
      !item.dependencies?.includes("class-variance-authority")
    ) {
      errors.push(`${item.name} imports class-variance-authority but omits it from dependencies`);
    }

    if (hasClientDirective(item) && item.meta?.client !== true) {
      errors.push(`${item.name} contains a client file but omits meta.client`);
    }

    if (item.meta?.client === true && !clientEntryBarrelHasDirective(item)) {
      errors.push(`${item.name} is client metadata but its source entry barrel omits "use client"`);
    }

    if (
      hasKeysRegistryDependency(item) &&
      !item.meta?.optionalIntegrations?.includes(KEYBOARD_NAVIGATION_INTEGRATION)
    ) {
      errors.push(
        `${item.name} depends on keys registry hooks but omits meta.optionalIntegrations keyboard-navigation`,
      );
    }

    const exportPath = itemExportPath(item);
    if (exportPath && !Object.hasOwn(exportsMap, exportPath)) {
      errors.push(`${item.name} is public but package.json is missing export ${exportPath}`);
    }

    const hiddenExportPath = item.meta?.hidden ? publicItemExportPath(item) : null;
    if (hiddenExportPath && Object.hasOwn(exportsMap, hiddenExportPath)) {
      errors.push(`${item.name} is hidden but package.json exposes ${hiddenExportPath}`);
    }
  }

  errors.push(...validateRegistryImportClosure(ROOT, items));
  errors.push(...validateOrphanFiles(ROOT, items));
  errors.push(...validateExamplesAvoidHiddenPaths(items));
  errors.push(...validatePublicComponentProps(ROOT, items));
  errors.push(...validateNoPublicKeysImports());

  if (!Object.hasOwn(exportsMap, "./lib/utils")) {
    errors.push("package.json is missing export ./lib/utils");
  }

  return errors;
}

const errors = validate();
if (errors.length > 0) {
  throw new Error(
    `Invalid @diffgazer/ui registry metadata:\n${errors.map((error) => `- ${error}`).join("\n")}`,
  );
}

console.log("[ui] registry metadata OK");
