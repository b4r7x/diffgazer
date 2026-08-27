import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listPublicRegistryEntries } from "@diffgazer/registry";
import type { RegistryItem } from "@diffgazer/registry/schemas";
import type { PublicRegistryIndexJson, PublicRegistryItemJson } from "./public-registry-json.js";

const UI_REGISTRY_PATH_PREFIX = "registry/ui/";
const LIB_REGISTRY_PATH_PREFIX = "registry/lib/";
const HOOK_REGISTRY_PATH_PREFIX = "registry/hooks/";
const UI_TARGET_PREFIX = "@ui/";
const LIB_TARGET_PREFIX = "@lib/";
const HOOK_TARGET_PREFIX = "@hooks/";

// shadcn 4.7.0 resolves a no-target `registry:ui` file's destination by finding the
// trailing segment of the configured `ui` alias directory inside the file path. When
// that segment isn't literally "ui" (e.g. an alias of `@/app/interface/components`,
// trailing segment "components"), it never matches a `registry/ui/...` path, so every
// file collapses to its basename: `index.ts` files across components collide and
// cross-folder relative imports (`../dialog`, `../icons/chevron`) break. Pinning each
// file to an `@ui/<subpath>` target makes shadcn resolve it within the configured ui
// alias root instead, preserving the component subtree under any alias. For the default
// `@/components/ui` alias the destination is identical, so the target is a no-op there.
//
// The same flattening hits nested `registry:lib` and `registry:hook` subtrees (e.g.
// `registry/lib/diff/index.ts` → `index.ts` when `aliases.lib` does not end in `lib`),
// breaking `@/lib/diff` imports. Pin `@lib/<subpath>` / `@hooks/<subpath>` only when the
// path has a nested directory — flat `registry/lib/utils.ts` files already land correctly.
//
// The source registry keeps these files target-free so the copy/package bundle, which
// installs by source path, is untouched — the target lives only in the shadcn handoff.
export function deriveUiRegistryTarget(file: {
  path?: string;
  type?: string;
  target?: string;
}): string | undefined {
  const path = file.path;
  if (!path) return file.target;

  if (file.type === "registry:ui" && path.startsWith(UI_REGISTRY_PATH_PREFIX)) {
    return `${UI_TARGET_PREFIX}${path.slice(UI_REGISTRY_PATH_PREFIX.length)}`;
  }

  if (file.type === "registry:lib" && path.startsWith(LIB_REGISTRY_PATH_PREFIX)) {
    const subpath = path.slice(LIB_REGISTRY_PATH_PREFIX.length);
    if (subpath.includes("/")) return `${LIB_TARGET_PREFIX}${subpath}`;
  }

  if (file.type === "registry:hook" && path.startsWith(HOOK_REGISTRY_PATH_PREFIX)) {
    const subpath = path.slice(HOOK_REGISTRY_PATH_PREFIX.length);
    if (subpath.includes("/")) return `${HOOK_TARGET_PREFIX}${subpath}`;
  }

  return file.target;
}

// Mirror the build-time targets onto the source item so the expected shape matches
// the shipped public registry file-by-file during freshness validation.
export function applyUiRegistryTargets(item: RegistryItem): RegistryItem {
  let changed = false;
  const files = item.files.map((file) => {
    const target = deriveUiRegistryTarget(file);
    if (target === file.target) return file;
    changed = true;
    return { ...file, target };
  });
  return changed ? { ...item, files } : item;
}

function applyUiRegistryTargetsToItems(items: PublicRegistryItemJson[] | undefined): boolean {
  let changed = false;
  for (const item of items ?? []) {
    for (const file of item.files ?? []) {
      const target = deriveUiRegistryTarget(file);
      if (target === file.target) continue;
      file.target = target;
      changed = true;
    }
  }
  return changed;
}

// afterBuild transform: stamp the derived `@ui/` targets onto the generated public
// registry index and every per-item JSON so a real `shadcn add` preserves structure.
export function applyUiRegistryTargetsInPublicRegistry(outputDir: string): void {
  const indexPath = join(outputDir, "registry.json");
  const index = JSON.parse(readFileSync(indexPath, "utf-8")) as PublicRegistryIndexJson;
  if (applyUiRegistryTargetsToItems(index.items)) {
    writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  }

  for (const { itemPath } of listPublicRegistryEntries(outputDir)) {
    const item = JSON.parse(readFileSync(itemPath, "utf-8")) as PublicRegistryItemJson;
    if (applyUiRegistryTargetsToItems([item])) {
      writeFileSync(itemPath, `${JSON.stringify(item, null, 2)}\n`);
    }
  }
}
