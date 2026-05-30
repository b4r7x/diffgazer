import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  hasKeysRegistryDependency,
  extractLocalImports,
  normalizeRegistryPath,
  resolveImportToRegistryPath,
  type RegistryItem,
} from "../src/validation/registry-validation-fs.js";
import { validateRegistryImportClosure } from "../src/validation/registry-import-validator.js";
import { validateOrphanFiles } from "../src/validation/registry-orphan-validator.js";
import {
  validatePublicComponentProps,
  validatePublicExportShape,
} from "../src/validation/registry-exports-validator.js";

interface Registry {
  $schema?: string;
  items?: RegistryItem[];
}

interface PackageJson {
  exports?: Record<string, unknown>;
  sideEffects?: boolean | string[];
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

const ROOT = process.env.DIFFGAZER_UI_REGISTRY_ROOT
  ? resolve(process.env.DIFFGAZER_UI_REGISTRY_ROOT)
  : resolve(import.meta.dirname, "..");
const REGISTRY_SCHEMA = "https://ui.shadcn.com/schema/registry.json";
const KEYBOARD_NAVIGATION_INTEGRATION = "keyboard-navigation";
const ALLOWED_REGISTRY_DEP_ORIGINS = [
  "https://docs.b4r7.dev",
  "https://r.b4r7.dev",
] as const;

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf-8")) as T;
}

function itemExportPath(item: RegistryItem): string | null {
  if (item.meta?.hidden) return null;
  return publicItemExportPath(item);
}

function publicItemExportPath(item: RegistryItem): string | null {
  if (item.type === "registry:ui") return `./components/${item.name}`;
  if (item.type === "registry:hook") return `./hooks/${item.name}`;
  if (item.type === "registry:lib") return `./lib/${item.name}`;
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
        errors.push(`${exampleRelPath} imports hidden registry path "${specifier}" (resolves to ${importedPath})`);
      }
    }
  }

  return errors;
}

const BARE_KEYS_IMPORT_RE = /from\s+["']@diffgazer\/keys["']/;

function validateNoPublicKeysImports(): string[] {
  const errors: string[] = [];
  const registryDir = resolve(ROOT, "public/r");
  if (!existsSync(registryDir)) return errors;

  for (const entry of readdirSync(registryDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const filePath = resolve(registryDir, entry);
    let data: { meta?: { hidden?: boolean }; files?: { content?: string; path?: string }[] };
    try {
      data = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      continue;
    }

    if (data.meta?.hidden) continue;

    for (const file of data.files ?? []) {
      if (typeof file.content !== "string") continue;
      if (BARE_KEYS_IMPORT_RE.test(file.content)) {
        errors.push(
          `Public (non-hidden) registry item "${entry}" file "${file.path ?? "(unknown)"}" contains bare @diffgazer/keys import; only hidden shims may reference the package directly`,
        );
      }
    }
  }

  return errors;
}

const KEYS_PEER_NAME = "@diffgazer/keys";

// F306: keep package.json's @diffgazer/keys peer in sync with the registry.
// Public, installable components that need keyboard hooks must not force every
// consumer to install keys, so the peer stays optional (HANDOFF-1 / DECISION-1).
function validateKeysPeerOptionalFlag(packageJson: PackageJson, items: RegistryItem[]): string[] {
  const hasPublicKeysItem = items.some((item) => !item.meta?.hidden && hasKeysRegistryDependency(item));
  if (!hasPublicKeysItem) return [];

  if (packageJson.peerDependenciesMeta?.[KEYS_PEER_NAME]?.optional !== true) {
    return [
      `public registry items depend on keys hooks, so package.json peerDependenciesMeta["${KEYS_PEER_NAME}"].optional must be true (HANDOFF-1: keys stays an optional peer)`,
    ];
  }

  return [];
}

function validate(): string[] {
  const registry = readJson<Registry>("registry/registry.json");
  const packageJson = readJson<PackageJson>("package.json");
  const items = registry.items ?? [];
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

  // @diffgazer/keys is intentionally an optional peer: most registry items don't
  // use it, so a Button-only consumer installs no keys. Package-mode consumers who
  // install keyboard-backed components (accordion, select, tabs, etc.) must install
  // keys separately. The tsup alias plugin externalizes keys imports as static ESM
  // specifiers, so importing a keys-backed subpath without keys fails at module load
  // with a native ERR_MODULE_NOT_FOUND naming "@diffgazer/keys" (the actionable
  // signal). This cannot be a figlet-style custom-message lazy load: the hooks are
  // React hooks (cannot be dynamically imported and called conditionally) and the
  // copy-mode import rewriter is anchored to the static import form.
  errors.push(...validateKeysPeerOptionalFlag(packageJson, items));

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
        errors.push(`File declared in registry but missing from disk: ${file.path} (item: ${item.name})`);
      }
    }

    for (const dep of item.registryDependencies ?? []) {
      if (dep.startsWith("@diffgazer/keys/")) {
        errors.push(`${item.name} uses scoped package-style keys dependency "${dep}"; use @diffgazer-keys/<hook>`);
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

    if (itemSourceContains(item, "class-variance-authority") && !item.dependencies?.includes("class-variance-authority")) {
      errors.push(`${item.name} imports class-variance-authority but omits it from dependencies`);
    }

    if (hasClientDirective(item) && item.meta?.client !== true) {
      errors.push(`${item.name} contains a client file but omits meta.client`);
    }

    if (item.meta?.client === true && !clientEntryBarrelHasDirective(item)) {
      errors.push(`${item.name} is client metadata but its source entry barrel omits "use client"`);
    }

    if (
      hasKeysRegistryDependency(item)
      && !item.meta?.optionalIntegrations?.includes(KEYBOARD_NAVIGATION_INTEGRATION)
    ) {
      errors.push(`${item.name} depends on keys registry hooks but omits meta.optionalIntegrations keyboard-navigation`);
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
  throw new Error(`Invalid @diffgazer/ui registry metadata:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

console.log("[ui] registry metadata OK");
