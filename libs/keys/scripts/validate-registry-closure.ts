import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RegistrySchema } from "@diffgazer/registry/schemas";
import {
  validateContentFreshness,
  validateNoJsImportsInPublicContent,
  validatePublicTargetClosure,
} from "./validate-registry-closure/public-registry.js";
import {
  validateImportClosure,
  validateRegistryStructure,
} from "./validate-registry-closure/source-registry.js";
import type { ValidationError } from "./validate-registry-closure/types.js";

export function validateRegistryClosure(registryPath: string): boolean {
  const registryRoot = resolve(registryPath, "..", "..");

  let registry;
  try {
    registry = RegistrySchema.parse(JSON.parse(readFileSync(registryPath, "utf-8")));
  } catch (e) {
    console.error(`Failed to read registry: ${e}`);
    return false;
  }

  const errors = [
    ...validateRegistryStructure(registry),
    ...validateImportClosure(registry, registryRoot),
  ];

  const publicDir = resolve(registryRoot, "public", "r");
  if (existsSync(publicDir)) {
    errors.push(...validatePublicTargetClosure(publicDir));
    errors.push(...validateNoJsImportsInPublicContent(publicDir));
    errors.push(...validateContentFreshness(publicDir, registryRoot));
  }

  if (errors.length === 0) {
    return true;
  }

  console.error("\n Registry closure validation failed with errors:\n");
  const groupedErrors = new Map<string, ValidationError[]>();

  for (const error of errors) {
    let group = groupedErrors.get(error.code);
    if (!group) {
      group = [];
      groupedErrors.set(error.code, group);
    }
    group.push(error);
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

if (
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  const registryPath = resolve(import.meta.dirname, "..", "registry", "registry.json");
  const success = validateRegistryClosure(registryPath);
  process.exit(success ? 0 : 1);
}
