import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, posix } from "node:path";

const RELATIVE_JS_IMPORT =
  /((?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(["']))(\.{1,2}\/[^"']+)\.js\2/g;

interface RegistryFile {
  path: string;
  type: string;
  target?: string;
}

interface RegistryItem {
  name: string;
  type: string;
  files: RegistryFile[];
  registryDependencies?: string[];
  meta?: {
    client?: boolean;
    hidden?: boolean;
  };
}

interface Registry {
  items: RegistryItem[];
}

interface ValidationError {
  code: string;
  item: string;
  message: string;
}

const errors: ValidationError[] = [];

function addError(code: string, item: string, message: string) {
  errors.push({ code, item, message });
}

/**
 * Validate that keys registry items have complete import closure.
 * For each hook, check that all its relative imports are included in the files array.
 */
function validateImportClosure(registry: Registry, registryRoot: string) {
  for (const item of registry.items) {
    if (item.type !== "registry:hook") continue;

    const includedFiles = new Set(item.files.map((f) => f.path));

    for (const file of item.files) {
      const filePath = resolve(registryRoot, file.path);
      if (!existsSync(filePath)) {
        addError("REGISTRY_IMPORT_CLOSURE", item.name, `Source file not found: ${file.path}`);
        continue;
      }

      const content = readFileSync(filePath, "utf-8");

      for (const importPathRaw of extractRelativeImports(content)) {
        let importPath = importPathRaw;

        const hasJsExtension = importPath.endsWith(".js");
        if (hasJsExtension) {
          importPath = importPath.slice(0, -3);
        }

        const baseDir = resolve(registryRoot, file.path, "..");
        const resolvedPath = resolve(baseDir, importPath);

        const tryPaths = [
          resolvedPath,
          `${resolvedPath}.ts`,
          `${resolvedPath}.tsx`,
          `${resolvedPath}/index.ts`,
          `${resolvedPath}/index.tsx`,
        ];

        let found = false;
        let foundRelativePath = "";

        for (const tryPath of tryPaths) {
          if (existsSync(tryPath)) {
            found = true;
            foundRelativePath = resolve(tryPath).slice(
              resolve(registryRoot).length + 1
            );
            foundRelativePath = foundRelativePath.replace(/\\/g, "/");
            break;
          }
        }

        if (!found) {
          addError(
            "REGISTRY_IMPORT_CLOSURE",
            item.name,
            `Cannot resolve import "${importPathRaw}" from ${file.path}`
          );
          continue;
        }

        if (!includedFiles.has(foundRelativePath)) {
          addError(
            "REGISTRY_IMPORT_CLOSURE",
            item.name,
            `Missing transitive import in registry: ${importPathRaw} (resolves to ${foundRelativePath})`
          );
        }
      }
    }
  }
}

function extractRelativeImports(content: string): string[] {
  const imports = new Set<string>();
  const patterns = [
    /import\s+(?:type\s+)?[^"']*?\s+from\s+["'](\.[^"']+)["']/g,
    /export\s+(?:type\s+)?[^"']*?\s+from\s+["'](\.[^"']+)["']/g,
    /import\s*\(\s*["'](\.[^"']+)["']\s*\)/g,
    /require\s*\(\s*["'](\.[^"']+)["']\s*\)/g,
    /import\s+["'](\.[^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) imports.add(match[1]);
    }
  }

  return [...imports];
}

/**
 * Validate registry structure for copy payload closure.
 */
function validateRegistryStructure(registry: Registry) {
  if (!registry.items || !Array.isArray(registry.items)) {
    addError("REGISTRY_STRUCTURE", "registry", `Missing or invalid items array`);
    return;
  }

  for (const item of registry.items) {
    if (item.type !== "registry:hook") continue;

    if (!item.files || !Array.isArray(item.files) || item.files.length === 0) {
      addError("REGISTRY_HOOK_FILES", item.name, `Hook missing files array`);
      continue;
    }

    const hasSourceFile = item.files.some(
      (f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx")
    );
    if (!hasSourceFile) {
      addError("REGISTRY_HOOK_FILES", item.name, `Hook has no TypeScript source files`);
    }

    for (const file of item.files) {
      const allowedPrefixes = ["src/hooks/", "src/core/", "src/dom/"];
      if (!allowedPrefixes.some((prefix) => file.path.startsWith(prefix))) {
        addError(
          "REGISTRY_HOOK_PATH",
          item.name,
          `Hook registry file must live under src/hooks/, src/core/, or src/dom/ for shadcn install paths: ${file.path}`,
        );
      }
    }
  }
}

interface PublicRegistryFile {
  path: string;
  target?: string;
  content?: string;
  type?: string;
}

interface PublicRegistryItem {
  name: string;
  type: string;
  files: PublicRegistryFile[];
  meta?: {
    client?: boolean;
    hidden?: boolean;
  };
}

/**
 * Validate that public registry items have correct target-path import closure.
 * Simulates the installed file layout and checks that all relative imports
 * between installed files resolve to other files in the same item.
 */
function validatePublicTargetClosure(publicDir: string) {
  for (const entry of readdirSync(publicDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const itemPath = join(publicDir, entry);
    let item: PublicRegistryItem;
    try {
      item = JSON.parse(readFileSync(itemPath, "utf-8"));
    } catch {
      addError("PUBLIC_TARGET_CLOSURE", entry, `Failed to parse ${entry}`);
      continue;
    }

    if (item.type !== "registry:hook") continue;

    const targetPaths = new Set<string>();
    const targetPathsWithExt = new Set<string>();
    for (const file of item.files) {
      const target = file.target ?? file.path;
      targetPathsWithExt.add(target);
      targetPaths.add(target.replace(/\.(ts|tsx)$/, ""));
    }

    for (const file of item.files) {
      if (typeof file.content !== "string") continue;

      const target = file.target ?? file.path;
      const targetDir = dirname(target);
      const imports = extractRelativeImports(file.content);

      for (const importPath of imports) {
        const resolved = posix.normalize(posix.join(targetDir, importPath));
        const resolvedWithoutExt = resolved.replace(/\.(ts|tsx)$/, "");

        const found =
          targetPaths.has(resolvedWithoutExt) ||
          targetPaths.has(resolved) ||
          targetPathsWithExt.has(resolved) ||
          targetPathsWithExt.has(`${resolved}.ts`) ||
          targetPathsWithExt.has(`${resolved}.tsx`);

        if (!found) {
          addError(
            "PUBLIC_TARGET_CLOSURE",
            item.name,
            `Target import "${importPath}" from ${target} does not resolve to any installed file`,
          );
        }
      }
    }
  }
}

/**
 * Validate that public registry content contains no relative .js import specifiers.
 */
function validateNoJsImportsInPublicContent(publicDir: string) {
  for (const entry of readdirSync(publicDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const itemPath = join(publicDir, entry);
    let item: PublicRegistryItem;
    try {
      item = JSON.parse(readFileSync(itemPath, "utf-8"));
    } catch {
      continue;
    }

    for (const file of item.files) {
      if (typeof file.content !== "string") continue;

      RELATIVE_JS_IMPORT.lastIndex = 0;
      const match = RELATIVE_JS_IMPORT.exec(file.content);
      if (match) {
        addError(
          "PUBLIC_JS_IMPORT",
          item.name,
          `File ${file.target ?? file.path} has relative .js import: "${match[3]}.js"`,
        );
      }
    }
  }
}

export function validateRegistryClosure(registryPath: string): boolean {
  errors.length = 0;
  const registryRoot = resolve(registryPath, "..", "..");

  let registry: Registry;
  try {
    registry = JSON.parse(readFileSync(registryPath, "utf-8"));
  } catch (e) {
    console.error(`Failed to read registry: ${e}`);
    return false;
  }

  validateRegistryStructure(registry);
  validateImportClosure(registry, registryRoot);

  const publicDir = resolve(registryRoot, "public", "r");
  if (existsSync(publicDir)) {
    validatePublicTargetClosure(publicDir);
    validateNoJsImportsInPublicContent(publicDir);
  }

  if (errors.length === 0) {
    return true;
  }

  console.error("\n Registry closure validation failed with errors:\n");
  const groupedErrors = new Map<string, ValidationError[]>();

  for (const error of errors) {
    if (!groupedErrors.has(error.code)) {
      groupedErrors.set(error.code, []);
    }
    groupedErrors.get(error.code)!.push(error);
  }

  for (const [code, items] of groupedErrors) {
    console.error(`[${code}] (${items.length} error${items.length > 1 ? "s" : ""})`);
    for (const error of items) {
      console.error(`  ${error.item}: ${error.message}`);
    }
    console.error("");
  }

  return false;
}

export { validatePublicTargetClosure, validateNoJsImportsInPublicContent, extractRelativeImports };
export type { PublicRegistryItem, PublicRegistryFile };

// Run validation if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const registryPath = resolve(import.meta.dirname, "..", "registry", "registry.json");
  const success = validateRegistryClosure(registryPath);
  process.exit(success ? 0 : 1);
}
