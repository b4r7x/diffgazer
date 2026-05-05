import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveKeysCopyHookFiles,
  resolveKeysHooksFromRegistry,
} from "./integration.js";

test("resolveKeysHooksFromRegistry extracts keys namespace refs and deduplicates", () => {
  const hooks = resolveKeysHooksFromRegistry([
    {
      registryDependencies: [
        "@diffgazer/keys/navigation",
        "@diffgazer/keys/focus-trap",
        "controllable-state",
        "@diffgazer/keys/navigation",
      ],
    },
  ]);

  assert.deepEqual(hooks.sort(), ["focus-trap", "navigation"]);
});

test("resolveKeysHooksFromRegistry returns empty array when no keys deps exist", () => {
  const hooks = resolveKeysHooksFromRegistry([
    { registryDependencies: ["controllable-state", "utils"] },
  ]);

  assert.deepEqual(hooks, []);
});

test("resolveKeysHooksFromRegistry handles items with no registryDependencies", () => {
  const hooks = resolveKeysHooksFromRegistry([{}]);

  assert.deepEqual(hooks, []);
});

test("resolveKeysCopyHookFiles resolves bundled standalone hooks", () => {
  const { files, missingHooks } = resolveKeysCopyHookFiles(["navigation", "focus-trap", "scroll-lock"]);

  assert.deepEqual(missingHooks, []);
  assert.equal(files.length, 3);
  assert.ok(files.some((file) => file.relativePath === "use-navigation.ts"));
  assert.ok(files.some((file) => file.relativePath === "use-focus-trap.ts"));
  assert.ok(files.some((file) => file.relativePath === "use-scroll-lock.ts"));
  assert.ok(files.every((file) => file.content.length > 0));
});

test("resolveKeysCopyHookFiles reports missing hooks without throwing", () => {
  const { files, missingHooks } = resolveKeysCopyHookFiles(["navigation", "does-not-exist"]);

  assert.ok(files.some((file) => file.relativePath === "use-navigation.ts"));
  assert.deepEqual(missingHooks, ["does-not-exist"]);
});

test("resolveKeysCopyHookFiles deduplicates files when the same hook is requested multiple times", () => {
  const { files, missingHooks } = resolveKeysCopyHookFiles(["navigation", "navigation"]);

  assert.deepEqual(missingHooks, []);
  const navFiles = files.filter((f) => f.relativePath === "use-navigation.ts");
  assert.equal(navFiles.length, 1);
});
