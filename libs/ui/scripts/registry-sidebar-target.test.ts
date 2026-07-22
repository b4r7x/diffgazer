import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Registry, RegistryFile, RegistryItem } from "@diffgazer/registry/schemas";
import { RegistryItemSchema, RegistrySchema } from "@diffgazer/registry/schemas";
import { describe, expect, it } from "vitest";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

// Validate the on-disk JSON against the registry schema instead of asserting a
// cast: a malformed source registry must fail the guard here, not surface as a
// confusing property access later in the resolver.
function readRegistry(): Registry {
  return RegistrySchema.parse(
    JSON.parse(readFileSync(resolve(ROOT, "registry/registry.json"), "utf-8")),
  );
}

// A shipped public registry item is one `registry-item.json` document under
// public/r; the bug lived in these committed handoff files, so the
// regression must exercise them directly, not only the source that builds them.
function readPublicItem(name: string): RegistryItem {
  return RegistryItemSchema.parse(
    JSON.parse(readFileSync(resolve(ROOT, "public/r", `${name}.json`), "utf-8")),
  );
}

function requireItem(registry: Registry, name: string): RegistryItem {
  const item = registry.items.find((candidate) => candidate.name === name);
  if (!item) throw new Error(`registry item "${name}" must exist`);
  return item;
}

const HELPER_NAMES = ["sidebar-variants", "sidebar-intent"] as const;

describe("sidebar source registry item shape", () => {
  const registry = readRegistry();
  const sidebar = requireItem(registry, "sidebar");
  const helpers = HELPER_NAMES.map((name) => requireItem(registry, name));

  const codeFiles = (item: RegistryItem): RegistryFile[] =>
    item.files.filter((file) => file.type !== "registry:style");

  const sidebarRoot = sidebar.files.find((file) => file.path.endsWith("sidebar/sidebar.tsx"));
  if (!sidebarRoot) throw new Error("sidebar.tsx must be a sidebar file");

  it("imports its helpers with sibling-relative specifiers", () => {
    // The co-location contract only matters because the component reaches its
    // helpers relatively; if these imports changed, the assertions below would
    // silently stop protecting anything.
    const sidebarSource = readFileSync(resolve(ROOT, sidebarRoot.path), "utf-8");
    expect(sidebarSource).toContain('from "./sidebar-variants"');
    const itemFile = sidebar.files.find((file) => file.path.endsWith("sidebar/sidebar-item.tsx"));
    if (!itemFile) throw new Error("sidebar-item.tsx must be a sidebar file");
    expect(readFileSync(resolve(ROOT, itemFile.path), "utf-8")).toContain(
      'from "./sidebar-intent"',
    );
  });

  it("keeps every sidebar code file target-free in the source registry", () => {
    // Source contract: the component parts AND both helpers stay no-target
    // `registry:ui` files. The copy/package bundle installs by source path, so a
    // stored target would either fork it from the shadcn handoff (a fixed `src/`
    // target splits the helpers from the component under a non-default alias) or
    // break it outright (the bundle's `normalizeFilePath` rejects `@ui/...`). The
    // subdir-preserving `@ui/` target belongs only to the shadcn handoff and is
    // derived at build time (see the public contract below), never stored here.
    // Only the style file keeps its `~/styles` target.
    for (const item of [sidebar, ...helpers]) {
      expect(item.type).toBe("registry:ui");
      for (const file of codeFiles(item)) {
        expect(file.type).toBe("registry:ui");
        expect(file.target).toBeUndefined();
      }
    }
  });
});

describe("sidebar public registry contract placement", () => {
  // Guards the shipped handoff files directly: the committed `public/r` JSON is
  // what a real `shadcn add` consumes, and it can drift from source when the
  // registry is regenerated stale or a helper JSON is hand-edited. Load the
  // public JSON and assert the component and both helpers carry the build-derived
  // `@ui/<subpath>` target that keeps them co-located under any configured alias.
  const items = ["sidebar", ...HELPER_NAMES].map((name) => readPublicItem(name));

  const codeFiles = (item: RegistryItem): RegistryFile[] =>
    item.files.filter((file) => file.type !== "registry:style");

  it("ships every registry:ui file with an @ui/ subdir-preserving target", () => {
    // F-235: shadcn flattens no-target `registry:ui` files to their basename when
    // the `ui` alias's trailing segment isn't literally "ui", colliding `index.ts`
    // files and breaking cross-folder imports. Every shipped `registry:ui` file
    // must instead pin an `@ui/<path-after-registry/ui/>` target so shadcn resolves
    // it within the configured ui alias root and preserves the component subtree.
    for (const item of items) {
      expect(item.type).toBe("registry:ui");
      for (const file of codeFiles(item)) {
        expect(file.type).toBe("registry:ui");
        expect(file.path.startsWith("registry/ui/")).toBe(true);
        expect(file.target).toBe(`@ui/${file.path.slice("registry/ui/".length)}`);
      }
    }
  });
});
