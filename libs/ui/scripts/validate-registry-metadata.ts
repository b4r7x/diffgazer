import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface RegistryFile {
  path: string;
}

interface RegistryItem {
  name: string;
  type: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
  meta?: {
    client?: boolean;
    hidden?: boolean;
    optionalIntegrations?: string[];
  };
}

interface Registry {
  $schema?: string;
  items?: RegistryItem[];
}

interface PackageJson {
  exports?: Record<string, unknown>;
  sideEffects?: boolean | string[];
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

const ROOT = resolve(import.meta.dirname, "..");
const REGISTRY_SCHEMA = "https://ui.shadcn.com/schema/registry.json";
const KEYBOARD_NAVIGATION_INTEGRATION = "keyboard-navigation";
const KEYS_REGISTRY_PREFIXES = ["@diffgazer-keys/", "@diffgazer/keys/"] as const;

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf-8")) as T;
}

function readSourceFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

function itemExportPath(item: RegistryItem): string | null {
  if (item.meta?.hidden) return null;
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

function itemSourceContains(item: RegistryItem, needle: string): boolean {
  return (item.files ?? []).some((file) => {
    const path = resolve(ROOT, file.path);
    return existsSync(path) && readSourceFile(file.path).includes(needle);
  });
}

function hasKeysRegistryDependency(item: RegistryItem): boolean {
  return (item.registryDependencies ?? []).some((dep) =>
    KEYS_REGISTRY_PREFIXES.some((prefix) => dep.startsWith(prefix))
  );
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

  if (packageJson.peerDependenciesMeta?.["@diffgazer/keys"]?.optional) {
    errors.push("@diffgazer/keys must not be marked optional while package entries can import it");
  }

  for (const exportPath of Object.keys(exportsMap)) {
    if (exportPath.includes("*")) {
      errors.push(`package export "${exportPath}" uses a wildcard and can expose internals`);
    }
  }

  for (const item of items) {
    for (const file of item.files ?? []) {
      if (file.path.endsWith(".css") && !existsSync(resolve(ROOT, file.path))) {
        errors.push(`${item.name} references missing CSS file ${file.path}`);
      }
    }

    for (const dep of item.registryDependencies ?? []) {
      if (dep.startsWith("@diffgazer/keys/")) {
        errors.push(`${item.name} uses scoped package-style keys dependency "${dep}"; use @diffgazer-keys/<hook>`);
      }
    }

    if (itemSourceContains(item, "class-variance-authority") && !item.dependencies?.includes("class-variance-authority")) {
      errors.push(`${item.name} imports class-variance-authority but omits it from dependencies`);
    }

    if (hasClientDirective(item) && item.meta?.client !== true) {
      errors.push(`${item.name} contains a client file but omits meta.client`);
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
  }

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
