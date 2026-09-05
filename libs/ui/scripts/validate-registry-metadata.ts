import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractImportSpecifiers } from "@diffgazer/registry";
import { hasUseClientDirective } from "@diffgazer/registry/build-checks";
import { REGISTRY_ITEM_TYPE, RegistrySchema } from "@diffgazer/registry/schemas";
import {
  validateExamplesAvoidHiddenPaths,
  validateExamplesAvoidKeysPackage,
  validateExamplesDeclareClientBoundary,
} from "./registry/examples.js";
import { validatePublicExportShape } from "./registry/exports.js";
import { hasKeysRegistryDependency, isRecord } from "./registry/fs.js";
import { validateRegistryImportClosure } from "./registry/imports.js";
import { validateOrphanFiles } from "./registry/orphans.js";
import { validateNoBuildEnvReads, validateNoPublicKeysImports } from "./registry/shipped-source.js";
import type { Registry, RegistryItem } from "./registry/types.js";

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
const ALLOWED_REGISTRY_DEP_ORIGINS = [
  "https://docs.diffgazer.b4r7.dev",
  "https://r.b4r7.dev",
] as const;
const KEYS_PEER_NAME = "@diffgazer/keys";

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf-8"));
}

function readRegistry(): Registry {
  const data = readJson("registry/registry.json");
  const registry = RegistrySchema.parse(data);
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
  return item.files.some((file) => {
    const path = resolve(ROOT, file.path);
    if (!existsSync(path)) return false;
    return hasUseClientDirective(readFileSync(path, "utf-8"));
  });
}

function clientEntryBarrelHasDirective(item: RegistryItem): boolean {
  const entry = item.files.find((file) => file.path.endsWith("/index.ts"));
  if (!entry) return true;

  const path = resolve(ROOT, entry.path);
  if (!existsSync(path)) return false;

  return hasUseClientDirective(readFileSync(path, "utf-8"));
}

function itemPackageImports(item: RegistryItem): Set<string> {
  const packages = new Set<string>();

  for (const file of item.files) {
    const path = resolve(ROOT, file.path);
    if (!existsSync(path) || file.path.endsWith(".css")) continue;

    for (const { specifier } of extractImportSpecifiers(readFileSync(path, "utf-8"))) {
      if (specifier.startsWith(".") || specifier.startsWith("@/")) continue;
      const segments = specifier.split("/");
      packages.add(segments.slice(0, specifier.startsWith("@") ? 2 : 1).join("/"));
    }
  }

  return packages;
}

function peerPackages(packageJson: PackageJson): { required: Set<string>; optional: Set<string> } {
  const required = new Set<string>();
  const optional = new Set<string>();

  for (const peer of Object.keys(packageJson.peerDependencies ?? {})) {
    const target =
      packageJson.peerDependenciesMeta?.[peer]?.optional === true ? optional : required;
    target.add(peer);
  }

  return { required, optional };
}

// `dependencies` is the install instruction copy/dgadd consumers receive, so it must
// match what the item's files actually import. Required peers (react, keys) are always
// present and never listed; optional peers may be declared without an import because the
// consumer constructs them and passes them in (code-block-highlight takes a lowlight instance).
function validateDeclaredDependencies(
  item: RegistryItem,
  peers: { required: Set<string>; optional: Set<string> },
): string[] {
  const declared = new Set(item.dependencies ?? []);
  const imported = itemPackageImports(item);
  const errors: string[] = [];

  for (const dependency of declared) {
    if (imported.has(dependency) || peers.optional.has(dependency)) continue;
    errors.push(`${item.name} declares dependency "${dependency}" but no file imports it`);
  }

  for (const dependency of imported) {
    if (peers.required.has(dependency) || declared.has(dependency)) continue;
    errors.push(`${item.name} imports "${dependency}" but omits it from dependencies`);
  }

  return errors;
}

// Package-mode UI entries (accordion.tsx, popover/use-auto-focus.ts, and other
// keyboard-backed exports) static-import @diffgazer/keys at module top, and the
// tsup alias plugin externalizes those as static ESM specifiers, so importing
// such a subpath without keys fails at module load with ERR_MODULE_NOT_FOUND.
// The failure is at import, not a lazy call, so keys is a REQUIRED peer: present
// in peerDependencies and not flagged optional in peerDependenciesMeta. Copy/dgadd
// consumers are unaffected — copy mode rewrites keys imports to local source.
function validateKeysRequiredPeer(packageJson: PackageJson, items: RegistryItem[]): string[] {
  const hasPublicKeysItem = items.some(
    (item) => !item.meta?.hidden && hasKeysRegistryDependency(item),
  );
  if (!hasPublicKeysItem) return [];

  const errors: string[] = [];

  if (packageJson.peerDependencies?.[KEYS_PEER_NAME] === undefined) {
    errors.push(
      `package.json peerDependencies must declare "${KEYS_PEER_NAME}" (public registry items import it at module load)`,
    );
  }

  if (packageJson.peerDependenciesMeta?.[KEYS_PEER_NAME]?.optional === true) {
    errors.push(`package.json peerDependenciesMeta["${KEYS_PEER_NAME}"].optional must not be true`);
  }

  return errors;
}

function validate(): string[] {
  const registry = readRegistry();
  const packageJson = readJson("package.json") as PackageJson;
  const items = registry.items;
  const exportsMap = packageJson.exports ?? {};
  const peers = peerPackages(packageJson);
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
    for (const file of item.files) {
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

    errors.push(...validateDeclaredDependencies(item, peers));

    if (hasClientDirective(item) && item.meta?.client !== true) {
      errors.push(`${item.name} contains a client file but omits meta.client`);
    }

    if (item.meta?.client === true && !hasClientDirective(item)) {
      errors.push(`${item.name} declares meta.client but no source file starts with "use client"`);
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
  errors.push(...validateExamplesAvoidHiddenPaths(ROOT, items));
  errors.push(...validateExamplesAvoidKeysPackage(ROOT));
  errors.push(...validateExamplesDeclareClientBoundary(ROOT));
  errors.push(...validateNoBuildEnvReads(ROOT));
  errors.push(...validateNoPublicKeysImports(ROOT));

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
