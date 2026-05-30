import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

export interface RegistryFile {
  path: string;
}

export interface RegistryItem {
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

const SOURCE_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx"] as const;
const INDEX_FILES = ["index.ts", "index.tsx", "index.js", "index.jsx"] as const;
const KEYS_REGISTRY_PREFIXES = ["@diffgazer-keys/", "@diffgazer/keys/"] as const;

export function normalizeRegistryPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function readSourceFile(root: string, relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf-8");
}

export function existingRegistryPath(root: string, modulePath: string): string | null {
  for (const extension of SOURCE_EXTENSIONS) {
    const path = `${modulePath}${extension}`;
    const resolved = resolve(root, path);
    if (existsSync(resolved) && statSync(resolved).isFile()) return normalizeRegistryPath(path);
  }

  for (const indexFile of INDEX_FILES) {
    const path = `${modulePath}/${indexFile}`;
    if (existsSync(resolve(root, path))) return normalizeRegistryPath(path);
  }

  return null;
}

export function stripTemplateLiterals(source: string): string {
  return source.replace(/`[^`]*`/gs, "``");
}

export function extractLocalImports(source: string): string[] {
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

export function aliasImportBase(specifier: string): string | null {
  if (specifier.startsWith("@/hooks/")) return `registry/hooks/${specifier.slice("@/hooks/".length)}`;
  if (specifier.startsWith("@/lib/")) return `registry/lib/${specifier.slice("@/lib/".length)}`;
  if (specifier.startsWith("@/components/ui/")) return `registry/ui/${specifier.slice("@/components/ui/".length)}`;
  return null;
}

export function resolveImportToRegistryPath(root: string, fromFile: string, specifier: string): string | null {
  const aliasBase = aliasImportBase(specifier);
  if (aliasBase) return existingRegistryPath(root, aliasBase);

  if (!specifier.startsWith(".")) return null;

  const absolutePath = resolve(root, dirname(fromFile), specifier);
  const registryPath = normalizeRegistryPath(relative(root, absolutePath));
  return existingRegistryPath(root, registryPath);
}

export function hasKeysRegistryDependency(item: RegistryItem): boolean {
  return (item.registryDependencies ?? []).some((dep) =>
    KEYS_REGISTRY_PREFIXES.some((prefix) => dep.startsWith(prefix)),
  );
}

export { KEYS_REGISTRY_PREFIXES };
