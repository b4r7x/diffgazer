import assert from "node:assert/strict";
import { test } from "node:test";
import { collectMissingClosure } from "./registry-closure.mjs";

// Resolver over an in-memory registry keyed by name. Mirrors the smoke
// resolver's contract: returns { id, item } or null when the reference does
// not exist.
function makeResolver(registry) {
  return (ref) => {
    const item = registry[ref];
    return item ? { id: ref, item } : null;
  };
}

test("collectMissingClosure resolves a complete dependency tree", () => {
  const registry = {
    select: { files: [{ path: "select.tsx" }], registryDependencies: ["theme", "utils"] },
    theme: { files: [{ path: "theme.css" }], registryDependencies: [] },
    utils: { files: [{ path: "utils.ts" }], registryDependencies: ["theme"] },
  };

  const missing = collectMissingClosure(["select"], makeResolver(registry));
  assert.deepEqual(missing, []);
});

test("collectMissingClosure catches a transitively-referenced missing dependency", () => {
  const registry = {
    select: { files: [{ path: "select.tsx" }], registryDependencies: ["theme", "icons"] },
    theme: { files: [{ path: "theme.css" }], registryDependencies: [] },
    // "icons" is referenced by select but absent from the registry.
  };

  const missing = collectMissingClosure(["select"], makeResolver(registry));
  assert.deepEqual(missing, [{ ref: "icons", reason: "unresolved" }]);
});

test("collectMissingClosure flags a resolved item that ships no files", () => {
  const registry = {
    button: { files: [{ path: "button.tsx" }], registryDependencies: ["broken"] },
    broken: { files: [], registryDependencies: [] },
  };

  const missing = collectMissingClosure(["button"], makeResolver(registry));
  assert.deepEqual(missing, [{ ref: "broken", reason: "no files" }]);
});

test("collectMissingClosure terminates on cyclic dependencies", () => {
  const registry = {
    a: { files: [{ path: "a.ts" }], registryDependencies: ["b"] },
    b: { files: [{ path: "b.ts" }], registryDependencies: ["a"] },
  };

  const missing = collectMissingClosure(["a"], makeResolver(registry));
  assert.deepEqual(missing, []);
});
