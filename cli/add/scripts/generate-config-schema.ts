import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SCHEMA_OUTPUT_PATH, serializeConfigJsonSchema } from "../src/config-schema.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");

writeFileSync(SCHEMA_OUTPUT_PATH, serializeConfigJsonSchema());
execFileSync(
  "pnpm",
  ["--dir", REPO_ROOT, "exec", "biome", "format", "--write", SCHEMA_OUTPUT_PATH],
  {
    stdio: "inherit",
  },
);
console.log(`Wrote ${SCHEMA_OUTPUT_PATH}`);
