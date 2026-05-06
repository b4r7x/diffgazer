import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Registry, RegistryItem } from "../src/index.js";

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
 * RDY-002: Validate that keys registry items have complete import closure.
 * For each hook, check that all its relative imports are included in the files array.
 */
function validateImportClosure(registry: Registry, registryRoot: string) {
  for (const item of registry.items) {
    if (item.type !== "registry:hook") continue;

    // Collect all files in this item
    const includedFiles = new Set(item.files.map((f) => f.path));

    // For each source file, check its imports
    for (const file of item.files) {
      const filePath = resolve(registryRoot, file.path);
      if (!existsSync(filePath)) {
        addError("RDY-002", item.name, `Source file not found: ${file.path}`);
        continue;
      }

      const content = readFileSync(filePath, "utf-8");

      // Extract all relative imports from the file
      // Matches: import ... from "../path" (may have .js or .ts extension)
      const importRegex = /from\s+["'](\.\.[^"']+)["']/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        let importPath = match[1];

        // If import ends with .js, remove it for resolution (source files are .ts)
        const hasJsExtension = importPath.endsWith(".js");
        if (hasJsExtension) {
          importPath = importPath.slice(0, -3);
        }

        // Resolve relative path
        const baseDir = resolve(registryRoot, file.path, "..");
        const resolvedPath = resolve(baseDir, importPath);

        // Try different extensions
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
            // Convert back to registry path (relative to registryRoot)
            foundRelativePath = resolve(tryPath).slice(
              resolve(registryRoot).length + 1
            );
            // Normalize to use forward slashes
            foundRelativePath = foundRelativePath.replace(/\\/g, "/");
            break;
          }
        }

        if (!found) {
          addError(
            "RDY-002",
            item.name,
            `Cannot resolve import "${match[1]}" from ${file.path}`
          );
          continue;
        }

        // Check if this import is included in the files array
        if (!includedFiles.has(foundRelativePath)) {
          addError(
            "RDY-002",
            item.name,
            `Missing transitive import in registry: ${match[1]} (resolves to ${foundRelativePath})`
          );
        }
      }
    }
  }
}

/**
 * RDY-016: Validate registry structure for copy payload closure.
 */
function validateRegistryStructure(registry: Registry) {
  if (!registry.items || !Array.isArray(registry.items)) {
    addError("structure", "registry", `Missing or invalid items array`);
    return;
  }

  for (const item of registry.items) {
    if (item.type !== "registry:hook") continue;

    if (!item.files || !Array.isArray(item.files) || item.files.length === 0) {
      addError("RDY-016", item.name, `Hook missing files array`);
      continue;
    }

    // Hooks should have at least one .ts file
    const hasSourceFile = item.files.some(
      (f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx")
    );
    if (!hasSourceFile) {
      addError("RDY-016", item.name, `Hook has no TypeScript source files`);
    }
  }
}

export function validateRegistryClosure(registryPath: string): boolean {
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

  if (errors.length === 0) {
    return true;
  }

  console.error("\n❌ Registry closure validation failed with errors:\n");
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

// Run validation if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const registryPath = resolve(import.meta.dirname, "..", "registry", "registry.json");
  const success = validateRegistryClosure(registryPath);
  process.exit(success ? 0 : 1);
}
