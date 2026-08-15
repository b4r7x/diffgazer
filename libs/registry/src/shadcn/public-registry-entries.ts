import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type RegistryItem, RegistryItemSchema } from "../registry-types.js";

export interface PublicRegistryEntry {
  /** File name inside the public registry directory, for error messages. */
  entry: string;
  itemPath: string;
}

/** Every item file in a public registry directory; the index itself is not an item. */
export function listPublicRegistryEntries(publicDir: string): PublicRegistryEntry[] {
  return readdirSync(publicDir)
    .filter((entry) => entry.endsWith(".json") && entry !== "registry.json")
    .map((entry) => ({ entry, itemPath: join(publicDir, entry) }));
}

export function readRegistryItem(itemPath: string): RegistryItem {
  return RegistryItemSchema.parse(JSON.parse(readFileSync(itemPath, "utf-8")));
}
