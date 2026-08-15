import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validatePublicComponentProps } from "./registry/exports.js";
import { type Registry, UiRegistrySchema } from "./registry/types.js";

const ROOT = resolve(import.meta.dirname, "..");

function readRegistry(): Registry {
  const data = JSON.parse(readFileSync(resolve(ROOT, "registry/registry.json"), "utf-8"));
  return UiRegistrySchema.parse(data);
}

const items = readRegistry().items;
const errors = validatePublicComponentProps(ROOT, items, { requireGeneratedDocs: true });

if (errors.length > 0) {
  throw new Error(
    `Invalid @diffgazer/ui component docs:\n${errors.map((error) => `- ${error}`).join("\n")}`,
  );
}

console.log("[ui] registry docs OK");
