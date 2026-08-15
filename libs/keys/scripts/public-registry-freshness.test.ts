import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateContentFreshness } from "./validate-registry-closure/public-registry.js";

const KEYS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = resolve(KEYS_ROOT, "public", "r");
const FIX_COMMAND = "pnpm --dir libs/keys build:shadcn";

describe("committed public registry freshness", () => {
  it("keeps committed public/r in sync with the source registry", () => {
    const errors = validateContentFreshness(PUBLIC_DIR, KEYS_ROOT);
    expect(errors, errors.map((error) => error.message).join("\n") || FIX_COMMAND).toEqual([]);
  });
});
