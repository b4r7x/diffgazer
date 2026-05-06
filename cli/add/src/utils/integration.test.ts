import assert from "node:assert/strict";
import test from "node:test";
import {
  getKeysHookImportNames,
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

test("resolveKeysHooksFromRegistry extracts flat shadcn keys namespace refs", () => {
  const hooks = resolveKeysHooksFromRegistry([
    {
      registryDependencies: [
        "@diffgazer-keys/navigation",
        "@diffgazer-keys/focus-trap",
        "@diffgazer-keys/navigation",
      ],
    },
  ]);

  assert.deepEqual(hooks.sort(), ["focus-trap", "navigation"]);
});

test("resolveKeysHooksFromRegistry ignores bundled internal keys files", () => {
  const hooks = resolveKeysHooksFromRegistry([
    {
      registryDependencies: [
        "@diffgazer/keys/navigation",
        "@diffgazer/keys/navigation-dispatch",
      ],
    },
  ]);

  assert.deepEqual(hooks, ["navigation"]);
});

test("resolveKeysHooksFromRegistry keeps unknown keys refs visible as missing public hooks", () => {
  const hooks = resolveKeysHooksFromRegistry([
    {
      registryDependencies: [
        "@diffgazer/keys/navigation",
        "@diffgazer/keys/does-not-exist",
      ],
    },
  ]);

  assert.deepEqual(hooks.sort(), ["does-not-exist", "navigation"]);
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

test("resolveKeysCopyHookFiles resolves bundled standalone hooks with transitive imports", () => {
  const { files, missingHooks } = resolveKeysCopyHookFiles(["navigation", "focus-trap", "scroll-lock"]);

  assert.deepEqual(missingHooks, []);
  assert.equal(files.length, 4); // navigation + focus-trap + scroll-lock + navigation-dispatch (transitive)
  assert.ok(files.some((file) => file.relativePath === "use-navigation.ts"));
  assert.ok(files.some((file) => file.relativePath === "use-focus-trap.ts"));
  assert.ok(files.some((file) => file.relativePath === "use-scroll-lock.ts"));
  assert.ok(files.some((file) => file.relativePath === "internal/navigation-dispatch.ts"));
  assert.match(
    files.find((file) => file.relativePath === "use-navigation.ts")?.content ?? "",
    /from "\.\/internal\/navigation-dispatch\.js"/,
  );
  assert.ok(files.every((file) => file.content.length > 0));
});

test("getKeysHookImportNames includes public registry names and copied hook file names", () => {
  const names = getKeysHookImportNames();

  assert.ok(names.has("navigation"));
  assert.ok(names.has("use-navigation"));
  assert.ok(names.has("focus-trap"));
  assert.ok(names.has("use-focus-trap"));
  assert.ok(!names.has("navigation-dispatch"));
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
