import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listPublicRegistryEntries, readRegistryItem } from "@diffgazer/registry";
import type { Registry, RegistryItem } from "@diffgazer/registry/schemas";
import { RegistrySchema } from "@diffgazer/registry/schemas";

export const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
export const PUBLIC_REGISTRY_DIR = resolve(ROOT, "public/r");

export function readSourceRegistry(): Registry {
  return RegistrySchema.parse(
    JSON.parse(readFileSync(resolve(ROOT, "registry/registry.json"), "utf-8")),
  );
}

export function readPublicRegistryItems(): RegistryItem[] {
  return listPublicRegistryEntries(PUBLIC_REGISTRY_DIR).map(({ itemPath }) =>
    readRegistryItem(itemPath),
  );
}
