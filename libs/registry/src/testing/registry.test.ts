import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRegistryDependencyRef } from "../cli/registry.js";

describe("parseRegistryDependencyRef", () => {
  it("parses local refs", () => {
    expect(parseRegistryDependencyRef("button")).toEqual({
      kind: "local",
      raw: "button",
      name: "button",
    });
  });

  it("parses simple namespace refs", () => {
    expect(parseRegistryDependencyRef("@ui/button")).toEqual({
      kind: "namespace",
      raw: "@ui/button",
      namespace: "@ui",
      name: "button",
    });
  });

  it("parses scoped package namespace refs", () => {
    expect(parseRegistryDependencyRef("@diffgazer/keys/navigation")).toEqual({
      kind: "namespace",
      raw: "@diffgazer/keys/navigation",
      namespace: "@diffgazer/keys",
      name: "navigation",
    });
  });
});

describe("@diffgazer/ui registry closure metadata", () => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const registry = JSON.parse(
    readFileSync(resolve(repoRoot, "libs/ui/registry/registry.json"), "utf-8"),
  ) as { items: Array<{ name: string; registryDependencies?: string[]; files: Array<{ path: string }> }> };

  function item(name: string) {
    const found = registry.items.find((entry) => entry.name === name);
    if (!found) throw new Error(`Missing registry item ${name}`);
    return found;
  }

  it("keeps accordion local utility imports reachable", () => {
    expect(item("accordion").registryDependencies).toContain("compose-refs");
  });

  it("keeps dialog and popover portal context imports reachable", () => {
    expect(item("portal").files.map((file) => file.path)).toContain("registry/ui/shared/portal-context.tsx");
    expect(item("dialog").registryDependencies).toContain("portal");
    expect(item("popover").registryDependencies).toContain("portal");
  });
});
