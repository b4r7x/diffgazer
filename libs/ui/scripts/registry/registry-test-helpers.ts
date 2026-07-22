import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Registry, RegistryItem } from "@diffgazer/registry/schemas";
import { RegistrySchema } from "@diffgazer/registry/schemas";

export const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
export const PUBLIC_REGISTRY_DIR = resolve(ROOT, "public/r");

export function readSourceRegistry(): Registry {
  return RegistrySchema.parse(
    JSON.parse(readFileSync(resolve(ROOT, "registry/registry.json"), "utf-8")),
  );
}

export function parseRegistryEntry(raw: unknown): RegistryItem {
  const [item] = RegistrySchema.parse({ items: [raw] }).items;
  if (!item) throw new Error("Missing registry item");
  return item;
}

export function readPublicRegistryItems(): RegistryItem[] {
  const items: RegistryItem[] = [];
  for (const entry of readdirSync(PUBLIC_REGISTRY_DIR)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;
    items.push(
      parseRegistryEntry(JSON.parse(readFileSync(resolve(PUBLIC_REGISTRY_DIR, entry), "utf-8"))),
    );
  }
  return items;
}
