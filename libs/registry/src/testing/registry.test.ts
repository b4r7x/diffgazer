import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RegistryItemSchema } from "../registry-types.js";

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

  it("uses the direct shadcn keys namespace for registry dependencies", () => {
    const dependencies = registry.items.flatMap((entry) => entry.registryDependencies ?? []);
    expect(dependencies.some((dep) => dep.startsWith("@diffgazer-keys/"))).toBe(true);
    expect(dependencies.some((dep) => dep.startsWith("@diffgazer/keys/"))).toBe(false);
  });

  it("keeps dialog and popover portal context imports reachable", () => {
    expect(item("portal").files.map((file) => file.path)).toContain("registry/ui/shared/portal-context.tsx");
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

describe("RegistryItemSchema shadcn-compatible fields", () => {
  const fullItem = {
    name: "example",
    type: "registry:ui",
    title: "Example",
    description: "An example component",
    files: [{ path: "registry/ui/example.tsx", content: "export default 42" }],
    dependencies: ["react"],
    registryDependencies: ["button"],
    meta: { category: "forms" },
    devDependencies: ["vitest", "@testing-library/react"],
    cssVars: { light: { primary: "#fff" }, dark: { primary: "#000" } },
    css: ".example { display: block; }",
    envVars: ["NEXT_PUBLIC_API_URL"],
    docs: "https://docs.example.com/example",
    categories: ["forms", "inputs"],
    author: "diffgazer <team@diffgazer.com>",
  };

  it("round-trips all shadcn-compatible fields through parse", () => {
    const parsed = RegistryItemSchema.parse(fullItem);
    expect(parsed.devDependencies).toEqual(["vitest", "@testing-library/react"]);
    expect(parsed.cssVars).toEqual({ light: { primary: "#fff" }, dark: { primary: "#000" } });
    expect(parsed.css).toBe(".example { display: block; }");
    expect(parsed.envVars).toEqual(["NEXT_PUBLIC_API_URL"]);
    expect(parsed.docs).toBe("https://docs.example.com/example");
    expect(parsed.categories).toEqual(["forms", "inputs"]);
    expect(parsed.author).toBe("diffgazer <team@diffgazer.com>");
  });

  it("preserves shadcn fields through JSON round-trip", () => {
    const parsed = RegistryItemSchema.parse(fullItem);
    const serialized = JSON.stringify(parsed);
    const reparsed = RegistryItemSchema.parse(JSON.parse(serialized));
    expect(reparsed.devDependencies).toEqual(parsed.devDependencies);
    expect(reparsed.cssVars).toEqual(parsed.cssVars);
    expect(reparsed.css).toEqual(parsed.css);
    expect(reparsed.envVars).toEqual(parsed.envVars);
    expect(reparsed.docs).toEqual(parsed.docs);
    expect(reparsed.categories).toEqual(parsed.categories);
    expect(reparsed.author).toEqual(parsed.author);
  });

  it("parses items without shadcn-compatible fields", () => {
    const minimal = {
      name: "minimal",
      type: "registry:ui",
      files: [],
    };
    const parsed = RegistryItemSchema.parse(minimal);
    expect(parsed.devDependencies).toBeUndefined();
    expect(parsed.cssVars).toBeUndefined();
    expect(parsed.css).toBeUndefined();
    expect(parsed.envVars).toBeUndefined();
    expect(parsed.docs).toBeUndefined();
    expect(parsed.categories).toBeUndefined();
    expect(parsed.author).toBeUndefined();
  });
});
