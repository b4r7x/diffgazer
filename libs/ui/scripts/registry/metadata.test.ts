import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("@diffgazer/ui registry closure metadata", () => {
  const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const registry = JSON.parse(readFileSync(resolve(uiRoot, "registry/registry.json"), "utf-8")) as {
    items: Array<{
      name: string;
      registryDependencies?: string[];
      dependencies?: string[];
      meta?: { hidden?: boolean };
      files: Array<{ path: string }>;
    }>;
  };

  function item(name: string) {
    const found = registry.items.find((entry) => entry.name === name);
    if (!found) throw new Error(`Missing registry item ${name}`);
    return found;
  }

  it("keeps accordion local utility imports reachable", () => {
    expect(item("accordion").registryDependencies).toContain("compose-refs");
  });

  it("uses the direct shadcn keys namespace for registry dependencies", () => {
    const dependencies = registry.items.flatMap((entry) => entry.registryDependencies ?? []);
    expect(dependencies.some((dep) => dep.startsWith("@diffgazer-keys/"))).toBe(true);
    expect(dependencies.some((dep) => dep.startsWith("@diffgazer/keys/"))).toBe(false);
  });

  it("does not declare scroll-lock for dialog-shell copy metadata", () => {
    expect(item("dialog-shell").registryDependencies).not.toContain("@diffgazer-keys/scroll-lock");
  });

  it("keeps logo figlet helpers in a separate hidden optional registry item", () => {
    expect(item("logo").dependencies ?? []).not.toContain("figlet");
    expect(item("logo-figlet").dependencies).toContain("figlet");
    expect(item("logo-figlet").meta?.hidden).toBe(true);
  });

  it("keeps lowlight helpers in a separate hidden optional registry item", () => {
    expect(item("code-block").dependencies ?? []).not.toContain("lowlight");
    expect(item("code-block-highlight").dependencies).toContain("lowlight");
    expect(item("code-block-highlight").meta?.hidden).toBe(true);
  });

  it("keeps dialog and popover portal context imports reachable", () => {
    expect(item("portal").files.map((file) => file.path)).toContain(
      "registry/ui/shared/portal-context.tsx",
    );
    expect(item("dialog").registryDependencies).toContain("portal");
    // Popover composes FloatingPanel, which transitively pulls in portal.
    expect(transitiveRegistryDeps("popover")).toContain("portal");
  });

  function transitiveRegistryDeps(name: string, visited = new Set<string>()): Set<string> {
    if (visited.has(name)) return visited;
    visited.add(name);
    const entry = registry.items.find((e) => e.name === name);
    for (const dep of entry?.registryDependencies ?? []) {
      if (dep.startsWith("@")) continue;
      transitiveRegistryDeps(dep, visited);
    }
    return visited;
  }
});
