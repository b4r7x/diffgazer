import { readFileSync } from "node:fs";
import { posix, resolve } from "node:path";
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
// public/r; F-051 was filed against these committed handoff files, so the
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

// Faithful port of shadcn 4.7.0's file-destination resolver (dist `Et`/`No`/
// `Lo`/`Fo`). The point of the regression is to model the REAL algorithm: the
// registry must land the sidebar component and its variant/intent helpers in
// one directory under ANY configured `ui` alias, not only the default alias
// whose trailing segment happens to be `ui`.
const KNOWN_ALIASES = ["components", "ui", "lib", "hooks"] as const;

interface ResolvedPaths {
  cwd: string;
  ui: string;
  lib: string;
  components: string;
  hooks: string;
}

function isKnownAlias(value: string): value is keyof ResolvedPaths {
  return (KNOWN_ALIASES as readonly string[]).includes(value);
}

// shadcn `Fo`: strip the source path up to the target directory's trailing
// segment; when that segment is absent, flatten to the basename.
function resolveNestedFilePath(sourcePath: string, targetDir: string): string {
  const fileSegments = sourcePath.replace(/^\/|\/$/g, "").split("/");
  const targetSegments = targetDir.replace(/^\/|\/$/g, "").split("/");
  const targetTail = targetSegments[targetSegments.length - 1];
  const tailIndex = targetTail === undefined ? -1 : fileSegments.indexOf(targetTail);
  if (tailIndex === -1) return fileSegments[fileSegments.length - 1] ?? "";
  return fileSegments.slice(tailIndex + 1).join("/");
}

// shadcn `No`: an `@<alias>/<subpath>` target resolves under that alias root
// when the alias is known; for an unknown alias `No` yields a cwd-relative
// target that `Et` then joins under `resolvedPaths.cwd`, so mirror that here.
function resolveAliasTarget(target: string, paths: ResolvedPaths): string | null {
  const match = target.match(/^@([^/]+)\/(.+)$/);
  const alias = match?.[1];
  const subpath = match?.[2];
  if (alias === undefined || subpath === undefined) return null;
  if (!isKnownAlias(alias)) return posix.join(paths.cwd, `${alias}/${subpath}`);
  const aliasRoot = paths[alias];
  const resolved = posix.join(aliasRoot, subpath);
  // shadcn `No` resolves the subpath then throws when it escapes the alias
  // root; mirror that guard so the port also rejects an `@<alias>/../` target
  // instead of silently landing outside the alias.
  if (resolved !== aliasRoot && !resolved.startsWith(`${aliasRoot}/`)) {
    throw new Error(`Target paths using @${alias}/ must stay within the ${alias} root`);
  }
  return resolved;
}

// shadcn `Lo`: the no-target destination directory for a file type.
function targetDirForType(type: string | undefined, paths: ResolvedPaths): string {
  if (type === "registry:ui") return paths.ui;
  if (type === "registry:lib") return paths.lib;
  if (type === "registry:hook") return paths.hooks;
  return paths.components;
}

// shadcn `Et` (normal `shadcn add`: no `--path` override, no `src/` rewrite).
function resolveInstallPath(file: RegistryFile, paths: ResolvedPaths): string {
  if (file.target) {
    if (file.target.startsWith("~/")) return posix.join(paths.cwd, file.target.slice(2));
    const aliased = resolveAliasTarget(file.target, paths);
    if (aliased) return aliased;
    // shadcn strips the first `src/` occurrence anywhere in the target
    // (`n.replace("src/", "")`), not only a leading segment, so mirror the
    // first-occurrence string replace rather than an anchored regex.
    return posix.join(paths.cwd, file.target.replace("src/", ""));
  }
  const dir = targetDirForType(file.type, paths);
  return posix.join(dir, resolveNestedFilePath(file.path, dir));
}

function resolvedPathsFor(uiAlias: string): ResolvedPaths {
  const cwd = "/project";
  return {
    cwd,
    ui: posix.join(cwd, uiAlias),
    lib: posix.join(cwd, "src/lib"),
    components: posix.join(cwd, "src/components"),
    hooks: posix.join(cwd, "src/hooks"),
  };
}

const HELPER_NAMES = ["sidebar-variants", "sidebar-intent"] as const;

// The default alias ends in `ui`; the others do NOT. shadcn flattens no-target
// `registry:ui` files under any alias whose trailing segment is not `ui`, so
// these non-default shapes are the ones that split helpers from the component
// unless every co-located file resolves under the same directory.
const UI_ALIASES = ["src/components/ui", "app/interface/components", "packages/design/kit"];

describe("sidebar direct shadcn install placement", () => {
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

  it("ships every sidebar code file as a no-target registry:ui file", () => {
    // Option B contract: the component parts AND both helpers are no-target
    // `registry:ui` files, so shadcn resolves them by type into the same ui
    // directory. A fixed `src/` target splits the helpers from the component
    // under a non-default alias; an `@ui/` target on the component files still
    // co-locates but breaks the copy/package bundle path (its `normalizeFilePath`
    // rejects `@ui/...`). Only the style file keeps its `~/styles` target.
    for (const item of [sidebar, ...helpers]) {
      expect(item.type).toBe("registry:ui");
      for (const file of codeFiles(item)) {
        expect(file.type).toBe("registry:ui");
        expect(file.target).toBeUndefined();
      }
    }
  });

  it.each(UI_ALIASES)("co-locates the component and helpers under ui alias %s", (uiAlias) => {
    const paths = resolvedPathsFor(uiAlias);
    const componentDir = posix.dirname(resolveInstallPath(sidebarRoot, paths));

    const installDirs = new Set<string>();
    for (const item of [sidebar, ...helpers]) {
      for (const file of codeFiles(item)) {
        installDirs.add(posix.dirname(resolveInstallPath(file, paths)));
      }
    }

    // Every code file — component parts and both helpers — must land beside
    // sidebar.tsx so the relative `./sidebar-variants` / `./sidebar-intent`
    // imports resolve after a direct `shadcn add` under any configured alias.
    expect([...installDirs]).toEqual([componentDir]);
  });

  it("flattens no-target registry:ui files under a non-ui alias", () => {
    // Locks in the shadcn `Fo` behaviour that drives the contract above: with
    // no target, sidebar.tsx keeps its `sidebar/` prefix only when the alias
    // ends in `ui`; otherwise it flattens to the basename.
    expect(resolveNestedFilePath("registry/ui/sidebar/sidebar.tsx", "/project/app/ui")).toBe(
      "sidebar/sidebar.tsx",
    );
    expect(
      resolveNestedFilePath("registry/ui/sidebar/sidebar.tsx", "/project/app/components"),
    ).toBe("sidebar.tsx");
  });
});

describe("sidebar public registry contract placement", () => {
  // Guards the shipped handoff files directly: the committed `public/r` JSON is
  // what a real `shadcn add` consumes, and it can drift from source when the
  // registry is regenerated stale or a helper JSON is hand-edited. Load the
  // public JSON and run the same co-location resolver so the reviewable contract
  // is protected, not only the source that generates it.
  const sidebar = readPublicItem("sidebar");
  const helpers = HELPER_NAMES.map((name) => readPublicItem(name));

  const codeFiles = (item: RegistryItem): RegistryFile[] =>
    item.files.filter((file) => file.type !== "registry:style");

  const sidebarRoot = sidebar.files.find((file) => file.path.endsWith("sidebar/sidebar.tsx"));
  if (!sidebarRoot) throw new Error("public sidebar.json must ship sidebar.tsx");

  it("ships every helper as a no-target registry:ui file", () => {
    // The precondition F-051 broke: a fixed `src/`-rooted helper target resolves
    // outside the configured ui alias, and an `@ui/` target on the component
    // files co-locates but breaks the copy bundle. Every shipped helper must
    // instead be a no-target `registry:ui` file so it follows the component
    // through shadcn's by-type destination resolution into the same ui
    // directory under any alias.
    for (const item of helpers) {
      expect(item.type).toBe("registry:ui");
      for (const file of codeFiles(item)) {
        expect(file.type).toBe("registry:ui");
        expect(file.target).toBeUndefined();
      }
    }
  });

  it.each(
    UI_ALIASES,
  )("co-locates the shipped component and helpers under ui alias %s", (uiAlias) => {
    const paths = resolvedPathsFor(uiAlias);
    const componentDir = posix.dirname(resolveInstallPath(sidebarRoot, paths));

    const installDirs = new Set<string>();
    for (const item of [sidebar, ...helpers]) {
      for (const file of codeFiles(item)) {
        installDirs.add(posix.dirname(resolveInstallPath(file, paths)));
      }
    }

    expect([...installDirs]).toEqual([componentDir]);
  });
});
