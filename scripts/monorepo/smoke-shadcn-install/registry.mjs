import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeOrigin, REGISTRY_ORIGIN, resolveRegistryRoute } from "@diffgazer/registry";
import { collectMissingClosure } from "../registry-closure.mjs";

const registryOrigin = normalizeOrigin(process.env.REGISTRY_ORIGIN, {
  defaultOrigin: REGISTRY_ORIGIN,
});

export const keysItems = ["navigation", "focus-restore", "focus-trap", "focusable"];
export const keysInstallItems = ["navigation", "focus-trap"];
export const uiItems = [
  "theme",
  "checkbox",
  "dialog",
  "select",
  "popover",
  "tooltip",
  "command-palette",
  "block-bar",
  "diff-view",
  "menu",
  "navigation-list",
  "code-block",
  "sidebar",
  "tabs",
  "accordion",
  "stepper",
];

export function registryRouteFromUrl(value) {
  return resolveRegistryRoute(value, { origin: registryOrigin });
}

function loadRegistryItem(registryDir, name) {
  const path = join(registryDir, `${name}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function allRegistryIndexNames(registryDir) {
  const index = JSON.parse(readFileSync(join(registryDir, "registry.json"), "utf-8"));
  return (index.items ?? []).map((item) => item.name);
}

function publicRegistryFileNames(registryDir) {
  return readdirSync(registryDir)
    .filter((entry) => entry.endsWith(".json") && entry !== "registry.json")
    .map((entry) => entry.slice(0, -".json".length));
}

// The browsable index plus hidden leaf add-ons nothing depends on (code-block-highlight, logo-figlet).
// Hidden items that ARE depended upon (portal, dialog-shell, *-variants) are transitive-only internals,
// exercised through their parents, never as install roots.
export function directlyInstallableUiNames(registryDir) {
  const indexNames = allRegistryIndexNames(registryDir);
  const indexSet = new Set(indexNames);
  const fileNames = publicRegistryFileNames(registryDir);

  const dependedUpon = new Set();
  for (const name of fileNames) {
    const item = loadRegistryItem(registryDir, name);
    for (const dep of item?.registryDependencies ?? []) {
      const target = dep
        .split("/")
        .pop()
        ?.replace(/\.json$/, "");
      if (target) dependedUpon.add(target);
    }
  }

  const hiddenAddons = fileNames.filter((name) => {
    if (indexSet.has(name)) return false;
    const item = loadRegistryItem(registryDir, name);
    return item?.type === "registry:ui" && item?.meta?.hidden === true && !dependedUpon.has(name);
  });

  return [...indexNames, ...hiddenAddons];
}

// Fixture-relative path a registry file lands at after `shadcn add` resolves the components.json
// aliases (ui → @/components/ui, hooks → @/hooks, lib → @/lib) and explicit `target` fields
// (@ui/ → src/components/ui; ~/ → project root; bare src/ verbatim).
export function installedFilePathForFile(file) {
  if (file.target) {
    if (file.target.startsWith("@ui/")) {
      return `src/components/ui/${file.target.slice("@ui/".length)}`;
    }
    if (file.target.startsWith("~/")) return file.target.slice(2);
    return file.target;
  }
  const aliasPrefixes = [
    ["registry/ui/", "src/components/ui/"],
    ["registry/hooks/", "src/hooks/"],
    ["registry/lib/", "src/lib/"],
  ];
  for (const [from, to] of aliasPrefixes) {
    if (file.path.startsWith(from)) return `${to}${file.path.slice(from.length)}`;
  }
  return null;
}

export function assertAllPublicItemsInstalled(fixture, registryDir, names, label) {
  for (const name of names) {
    const item = loadRegistryItem(registryDir, name);
    if (!item) {
      throw new Error(`${label} registry item "${name}" not found at ${registryDir}/${name}.json`);
    }
    for (const file of item.files ?? []) {
      const relative = installedFilePathForFile(file);
      if (!relative) {
        throw new Error(
          `${label} item "${name}" file "${file.path}" has no known install target mapping`,
        );
      }
      if (!existsSync(join(fixture, relative))) {
        throw new Error(`${label} item "${name}" did not install expected file: ${relative}`);
      }
    }
  }
}

// Index names that install as registry:ui (excludes hooks/lib/theme); drives the side-effect imports.
export function uiComponentNames(registryDir, names) {
  return names.filter((name) => loadRegistryItem(registryDir, name)?.type === "registry:ui");
}

// Side-effect imports for the hidden leaf add-ons — their files colocate under subfolders, so the flat
// `@/components/ui/${name}` mapping doesn't apply; derive specifiers from each add-on's installed paths.
export function addonSideEffectImports(registryDir, addonNames) {
  const specifiers = [];
  for (const name of addonNames) {
    for (const file of loadRegistryItem(registryDir, name)?.files ?? []) {
      if (!/\.tsx?$/.test(file.path)) continue;
      const installed = installedFilePathForFile(file);
      if (!installed?.startsWith("src/")) continue;
      specifiers.push(`@/${installed.slice("src/".length).replace(/\.tsx?$/, "")}`);
    }
  }
  return specifiers;
}

// Top-level keys entry hooks land at src/hooks/<name>.ts; utils/ helpers arrive transitively.
export function keysEntryHookNames(keysRegistryDir, keysNames) {
  const hooks = new Set();
  for (const name of keysNames) {
    for (const file of loadRegistryItem(keysRegistryDir, name)?.files ?? []) {
      const installed = installedFilePathForFile(file);
      const hook = installed && /^src\/hooks\/([a-z0-9-]+)\.ts$/.exec(installed)?.[1];
      if (hook) hooks.add(hook);
    }
  }
  return [...hooks];
}

// A standalone keys entry hook nothing in the UI graph imports never enters the Vite build, so a
// bundler-specific resolution/transform failure would escape tsc-only coverage. Derive a `@/hooks/${name}`
// side-effect specifier for each installed keys entry hook that no public UI item imports.
export function standaloneKeysHookImports(keysRegistryDir, keysNames, uiRegistryDir) {
  const importedByUi = new Set();
  for (const name of publicRegistryFileNames(uiRegistryDir)) {
    for (const file of loadRegistryItem(uiRegistryDir, name)?.files ?? []) {
      for (const match of file.content?.matchAll(/@\/hooks\/([a-z0-9-]+)/g) ?? []) {
        importedByUi.add(match[1]);
      }
    }
  }
  return keysEntryHookNames(keysRegistryDir, keysNames)
    .filter((hook) => !importedByUi.has(hook))
    .map((hook) => `@/hooks/${hook}`);
}

// Reads the built app and installed sources from disk (not the registry the import list is derived from)
// so an unwired standalone import, or a derivation that stops covering an installed entry hook, fails loudly.
export function findUnbundledKeysEntryHooks(entryHookNames, appSource, installedUiSources) {
  const importedByUi = new Set();
  for (const source of installedUiSources) {
    for (const match of source.matchAll(/@\/hooks\/([a-z0-9-]+)/g) ?? []) importedByUi.add(match[1]);
  }
  return entryHookNames.filter(
    (hook) => !importedByUi.has(hook) && !appSource.includes(`import '@/hooks/${hook}';`),
  );
}

export function assertRegistryItemsExist(registryDir, names, label) {
  for (const name of names) {
    if (!loadRegistryItem(registryDir, name)) {
      throw new Error(`${label} registry item "${name}" not found at ${registryDir}/${name}.json`);
    }
  }
}

// Cross-registry check: every r/keys URL dependency must point at a keys item that exists in libs/keys/public/r.
export function assertCrossRegistryTargetsExist(registryDir, names, keysRegistryDir, label) {
  for (const name of names) {
    const item = loadRegistryItem(registryDir, name);
    for (const dep of item.registryDependencies ?? []) {
      const route = registryRouteFromUrl(dep);
      if (!route) continue;
      const [, namespace, fileName] = route.split("/");
      if (namespace !== "keys") continue;
      const targetName = fileName.replace(/\.json$/, "");
      if (!loadRegistryItem(keysRegistryDir, targetName)) {
        throw new Error(
          `${label} item "${name}" registry dependency "${dep}" points at a keys item that does not exist in ${keysRegistryDir}`,
        );
      }
    }
  }
}

export function assertKeysTargets(registryDir, names) {
  for (const name of names) {
    const item = loadRegistryItem(registryDir, name);
    for (const file of item.files ?? []) {
      if (!file.target) {
        throw new Error(`Keys item "${name}" file "${file.path}" missing target field`);
      }
    }
  }
}

export function assertNoJsImportSpecifiers(registryDir, names) {
  for (const name of names) {
    const item = loadRegistryItem(registryDir, name);
    for (const file of item.files ?? []) {
      if (!file.content) continue;
      if (/from\s+["'][^"']*\.js["']/.test(file.content)) {
        throw new Error(
          `Keys item "${name}" file "${file.path}" contains .js import specifier in public registry`,
        );
      }
    }
  }
}

export function assertDirectRegistryDependencies(registryDir, names, label) {
  for (const name of names) {
    const item = loadRegistryItem(registryDir, name);
    for (const dep of item.registryDependencies ?? []) {
      if (dep.startsWith("http://") || dep.startsWith("https://")) {
        if (!registryRouteFromUrl(dep)) {
          throw new Error(
            `${label} item "${name}" registry dependency "${dep}" is not a localizable registry URL`,
          );
        }
        continue;
      }
      if (dep.startsWith("@")) {
        throw new Error(
          `${label} item "${name}" registry dependency "${dep}" is namespaced, not direct URL ready`,
        );
      }
      throw new Error(
        `${label} item "${name}" registry dependency "${dep}" is bare, not direct URL ready`,
      );
    }
  }
}

function makeRegistryResolver(registryDirs) {
  return (ref) => {
    const route = registryRouteFromUrl(ref);
    if (!route) return null;

    const [, namespace, fileName] = route.split("/");
    const registryDir = registryDirs.get(namespace);
    if (!registryDir) return null;

    const name = fileName.replace(/\.json$/, "");
    const item = loadRegistryItem(registryDir, name);
    return item ? { id: route, item } : null;
  };
}

export function assertRegistryClosure(registryDirs, rootRefs, label) {
  const missing = collectMissingClosure(rootRefs, makeRegistryResolver(registryDirs));
  if (missing.length > 0) {
    const details = missing.map(({ ref, reason }) => `${ref} (${reason})`).join(", ");
    throw new Error(`${label} registry dependency closure is incomplete: ${details}`);
  }
}
