import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const turboConfig = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../turbo.json", import.meta.url)), "utf8"),
);

// Vite inlines VITE_-prefixed values at build time, so editing `.env.production`
// has to invalidate that package's build. Turbo is trusted to honour a declared
// `inputs` list; this guard only keeps the declaration from being dropped or
// narrowed back to the default input set.
test("docs and landing builds hash their production env files", () => {
  for (const taskId of ["@diffgazer/docs#build", "@diffgazer/landing#build"]) {
    const inputs = turboConfig.tasks?.[taskId]?.inputs;

    assert.ok(Array.isArray(inputs), `${taskId} must declare inputs`);
    assert.ok(inputs.includes("$TURBO_DEFAULT$"), `${taskId} must keep the default input set`);
    assert.ok(inputs.includes(".env*"), `${taskId} must hash .env* files`);
  }
});
