import { resolve } from "node:path";
import { buildShadcnRegistryWithOrigin, REGISTRY_ORIGIN } from "@diffgazer/registry";

const ROOT = resolve(import.meta.dirname, "..");

buildShadcnRegistryWithOrigin({ rootDir: ROOT, defaultOrigin: REGISTRY_ORIGIN });
