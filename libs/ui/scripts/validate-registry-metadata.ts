import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

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

const ROOT = process.env.DIFFGAZER_UI_REGISTRY_ROOT
  ? resolve(process.env.DIFFGAZER_UI_REGISTRY_ROOT)
  : resolve(import.meta.dirname, "..");
const REGISTRY_SCHEMA = "https://ui.shadcn.com/schema/registry.json";
const KEYBOARD_NAVIGATION_INTEGRATION = "keyboard-navigation";
const KEYS_REGISTRY_PREFIXES = ["@diffgazer-keys/", "@diffgazer/keys/"] as const;
const ALLOWED_REGISTRY_DEP_ORIGINS = [
  "https://docs.b4r7.dev",
  "https://r.b4r7.dev",
] as const;
const SOURCE_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx"] as const;
const INDEX_FILES = ["index.ts", "index.tsx", "index.js", "index.jsx"] as const;

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf-8")) as T;
}

function readSourceFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validatePublicExportShape(
  exportsMap: Record<string, unknown>,
  exportPath: string,
): string[] {
  const errors: string[] = [];
  const exportValue = exportsMap[exportPath];

  if (!isRecord(exportValue)) {
    return [`package export ${exportPath} must be an object with top-level "types" and "import" conditions`];
  }

  if (isRecord(exportValue.import)) {
    errors.push(
      `package export ${exportPath} nests "types" under "import"; TypeScript bundler resolution requires top-level "types"`
    );
  }

  if (typeof exportValue.types !== "string") {
    errors.push(`package export ${exportPath} is missing top-level "types" condition`);
  }

  if (typeof exportValue.import !== "string") {
    errors.push(`package export ${exportPath} is missing top-level "import" condition`);
  }

  return errors;
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
    return existsSync(path) && readSourceFile(file.path).includes(needle);
  });
}

function hasKeysRegistryDependency(item: RegistryItem): boolean {
  return (item.registryDependencies ?? []).some((dep) =>
    KEYS_REGISTRY_PREFIXES.some((prefix) => dep.startsWith(prefix))
  );
}

function stripTemplateLiterals(source: string): string {
  return source.replace(/`[^`]*`/gs, "``");
}

function extractLocalImports(source: string): string[] {
  const imports = new Set<string>();
  const cleaned = stripTemplateLiterals(source);
  const patterns = [
    /\bimport\s+(?:type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s+["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cleaned)) !== null) {
      const specifier = match[1];
      if (
        specifier &&
        (specifier.startsWith("@/hooks/") ||
          specifier.startsWith("@/lib/") ||
          specifier.startsWith("@/components/ui/") ||
          specifier.startsWith("."))
      ) {
        imports.add(specifier);
      }
    }
  }

  return [...imports];
}

function normalizeRegistryPath(path: string): string {
  return path.replace(/\\/g, "/");
}

function existingRegistryPath(modulePath: string): string | null {
  for (const extension of SOURCE_EXTENSIONS) {
    const path = `${modulePath}${extension}`;
    const resolved = resolve(ROOT, path);
    if (existsSync(resolved) && statSync(resolved).isFile()) return normalizeRegistryPath(path);
  }

  for (const indexFile of INDEX_FILES) {
    const path = `${modulePath}/${indexFile}`;
    if (existsSync(resolve(ROOT, path))) return normalizeRegistryPath(path);
  }

  return null;
}

function aliasImportBase(specifier: string): string | null {
  if (specifier.startsWith("@/hooks/")) return `registry/hooks/${specifier.slice("@/hooks/".length)}`;
  if (specifier.startsWith("@/lib/")) return `registry/lib/${specifier.slice("@/lib/".length)}`;
  if (specifier.startsWith("@/components/ui/")) return `registry/ui/${specifier.slice("@/components/ui/".length)}`;
  return null;
}

function resolveImportToRegistryPath(fromFile: string, specifier: string): string | null {
  const aliasBase = aliasImportBase(specifier);
  if (aliasBase) return existingRegistryPath(aliasBase);

  if (!specifier.startsWith(".")) return null;

  const absolutePath = resolve(ROOT, dirname(fromFile), specifier);
  const registryPath = normalizeRegistryPath(relative(ROOT, absolutePath));
  return existingRegistryPath(registryPath);
}

function itemNamesByFile(items: RegistryItem[]): Map<string, string> {
  const namesByFile = new Map<string, string>();

  for (const item of items) {
    for (const file of item.files ?? []) {
      namesByFile.set(normalizeRegistryPath(file.path), item.name);
    }
  }

  return namesByFile;
}

function resolveRegistryDependencyClosure(item: RegistryItem, itemsByName: Map<string, RegistryItem>): Set<string> {
  const closure = new Set<string>([item.name]);
  const pending = [...(item.registryDependencies ?? [])];

  while (pending.length > 0) {
    const dependencyName = pending.pop();
    if (!dependencyName || closure.has(dependencyName)) continue;

    // Always add the dependency name to the closure (including external @diffgazer-keys/* items).
    closure.add(dependencyName);

    const dependency = itemsByName.get(dependencyName);
    if (!dependency) continue;

    pending.push(...(dependency.registryDependencies ?? []));
  }

  return closure;
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
      const importedPath = resolveImportToRegistryPath(exampleRelPath, specifier);
      if (!importedPath) continue;

      if (hiddenFiles.has(importedPath)) {
        errors.push(`${exampleRelPath} imports hidden registry path "${specifier}" (resolves to ${importedPath})`);
      }
    }
  }

  return errors;
}

interface GeneratedComponentDocsData {
  props?: Record<string, Record<string, unknown>>;
  docs?: { noProps?: unknown };
}

function countProps(propsTable: Record<string, Record<string, unknown>>): number {
  return Object.values(propsTable).reduce(
    (sum, group) => sum + Object.keys(group).length,
    0,
  );
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

function validatePublicComponentProps(items: RegistryItem[]): string[] {
  const errors: string[] = [];

  for (const item of items) {
    if (item.type !== "registry:ui" || item.meta?.hidden) continue;

    const dataPath = resolve(ROOT, "docs/generated/components", `${item.name}.json`);
    // Skip when generated docs JSON is absent (clean checkouts before prepare:artifacts).
    if (!existsSync(dataPath)) continue;

    let data: GeneratedComponentDocsData;
    try {
      data = JSON.parse(readFileSync(dataPath, "utf-8")) as GeneratedComponentDocsData;
    } catch (err) {
      errors.push(`${item.name} generated docs JSON is not valid: ${(err as Error).message}`);
      continue;
    }

    if (data.docs?.noProps === true) continue;

    if (countProps(data.props ?? {}) === 0) {
      errors.push(
        `${item.name}: public component has empty props table in docs/generated/components/${item.name}.json. Populate the "props" field in registry/component-docs/${item.name}.ts, or set "noProps: true" on the exported doc if the component intentionally has no public props.`,
      );
    }
  }

  return errors;
}

function validateRegistryImportClosure(items: RegistryItem[]): string[] {
  const errors: string[] = [];
  const itemsByName = new Map(items.map((item) => [item.name, item]));
  const namesByFile = itemNamesByFile(items);

  for (const item of items) {
    const closure = resolveRegistryDependencyClosure(item, itemsByName);

    for (const file of item.files ?? []) {
      const filePath = resolve(ROOT, file.path);
      if (!existsSync(filePath) || file.path.endsWith(".css")) continue;

      for (const specifier of extractLocalImports(readSourceFile(file.path))) {
        const importedPath = resolveImportToRegistryPath(file.path, specifier);
        if (!importedPath) continue;

        const importedItemName = namesByFile.get(importedPath);
        if (importedItemName === item.name) continue;

        if (!importedItemName) {
          errors.push(
            `${item.name} imports ${specifier} from ${file.path}, which resolves to ${importedPath} but is not declared in any registry item's files[]`
          );
          continue;
        }

        if (!closure.has(importedItemName)) {
          // A UI hook shim (e.g. use-focus-trap) that re-exports from @diffgazer/keys
          // is satisfied when the importer already depends on the matching @diffgazer-keys/* item.
          const importedItem = itemsByName.get(importedItemName);
          const shimKeysDeps = (importedItem?.registryDependencies ?? []).filter(
            (dep) => KEYS_REGISTRY_PREFIXES.some((prefix) => dep.startsWith(prefix))
          );
          const satisfiedByKeys = shimKeysDeps.length > 0 && shimKeysDeps.every((dep) => closure.has(dep));

          if (!satisfiedByKeys) {
            errors.push(
              `${item.name} imports ${specifier} from ${file.path}, which resolves to registry item ${importedItemName} but is missing from registryDependencies closure`
            );
          }
        }
      }
    }
  }

  return errors;
}

const ORPHAN_EXCLUDED_SUFFIXES = [".test.ts", ".test.tsx", ".stories.ts", ".stories.tsx"] as const;

function validateOrphanFiles(items: RegistryItem[]): string[] {
  const errors: string[] = [];

  const declaredFiles = new Set<string>();
  const scanDirs = new Set<string>();

  for (const item of items) {
    for (const file of item.files ?? []) {
      const normalized = normalizeRegistryPath(file.path);
      declaredFiles.add(normalized);
      scanDirs.add(dirname(normalized));
    }
  }

  for (const dir of [...scanDirs].sort()) {
    const absoluteDir = resolve(ROOT, dir);
    if (!existsSync(absoluteDir) || !statSync(absoluteDir).isDirectory()) continue;

    for (const entry of readdirSync(absoluteDir)) {
      const entryPath = resolve(absoluteDir, entry);
      if (!statSync(entryPath).isFile()) continue;
      if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) continue;
      if (ORPHAN_EXCLUDED_SUFFIXES.some((suffix) => entry.endsWith(suffix))) continue;

      const registryPath = normalizeRegistryPath(relative(ROOT, entryPath));
      if (!declaredFiles.has(registryPath)) {
        errors.push(`File ${registryPath} exists on disk but is not declared in any registry item's files[]`);
      }
    }
  }

  return errors;
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

  errors.push(...validateRegistryImportClosure(items));
  errors.push(...validateOrphanFiles(items));
  errors.push(...validateExamplesAvoidHiddenPaths(items));
  errors.push(...validatePublicComponentProps(items));
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
