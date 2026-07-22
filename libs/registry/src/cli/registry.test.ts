import { describe, expect, it } from "vitest";
import { RegistryItemSchema } from "../registry-types.js";
import { RegistryItemSchema as CliRegistryItemSchema, metaField } from "./registry.js";

describe("metaField array validation", () => {
  it("returns a string[] meta value through unchanged", () => {
    const item = { meta: { tags: ["a", "b"] } };
    expect(metaField(item, "tags", [] as string[])).toEqual(["a", "b"]);
  });

  it("falls back when the array contains a non-string element", () => {
    const item = { meta: { tags: ["a", 1] } } as { meta?: Record<string, unknown> };
    expect(metaField(item, "tags", ["default"])).toEqual(["default"]);
  });
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

// The CLI installer schema (cli/registry.ts) is the base RegistryItemSchema
// (registry-types.ts) plus a path-containment refinement on registry files.
// The installer (CLI) schema is a public consumption contract and MUST reject
// absolute and parent-escaping file paths before any path is resolved against a
// consumer's project root. These tests lock that contract: a valid relative item
// parses under both schemas, the CLI schema rejects unsafe paths, and the field
// sets must not drift apart.
describe("RegistryItemSchema base/CLI compatibility", () => {
  const validItem = {
    name: "example",
    type: "registry:ui",
    files: [{ path: "registry/ui/example.tsx", content: "export default 42" }],
    dependencies: ["react"],
    registryDependencies: ["button"],
  };

  it("accepts a valid relative-path item under both the base and CLI schemas", () => {
    const base = RegistryItemSchema.parse(validItem);
    const cli = CliRegistryItemSchema.parse(validItem);
    expect(cli.name).toBe(base.name);
    expect(cli.files.map((f) => f.path)).toEqual(base.files.map((f) => f.path));
  });

  it.each([
    { label: "absolute path", path: "/etc/passwd" },
    { label: "parent-escaping path", path: "../escape.tsx" },
    { label: "windows absolute path", path: "C:\\windows\\system32" },
  ])("the CLI installer schema rejects an unsafe $label", ({ path }) => {
    const unsafe = { ...validItem, files: [{ path, content: "" }] };
    expect(CliRegistryItemSchema.safeParse(unsafe).success).toBe(false);
  });

  it("shares the same item-level field set so neither side drifts", () => {
    expect(Object.keys(CliRegistryItemSchema.shape).sort()).toEqual(
      Object.keys(RegistryItemSchema.shape).sort(),
    );
  });
});
