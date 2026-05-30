// Pure registry dependency-closure walk shared by the shadcn smoke test and its
// unit test. Kept free of side effects so it can be imported and unit-tested
// without booting the smoke harness.

// Walk every registryDependency transitively from the given roots and report
// any reference that cannot be resolved or that resolves to an item with no
// installable files. `resolveItem(ref)` returns { id, item } or null when the
// referenced registry item does not exist.
export function collectMissingClosure(rootRefs, resolveItem) {
  const missing = [];
  const visited = new Set();
  const queue = [...rootRefs];

  while (queue.length > 0) {
    const ref = queue.shift();
    const resolved = resolveItem(ref);

    if (!resolved) {
      missing.push({ ref, reason: "unresolved" });
      continue;
    }

    const { id, item } = resolved;
    if (visited.has(id)) continue;
    visited.add(id);

    if (!Array.isArray(item.files) || item.files.length === 0) {
      missing.push({ ref, reason: "no files" });
    }

    for (const dep of item.registryDependencies ?? []) {
      queue.push(dep);
    }
  }

  return missing;
}
