import { ctx, type RegistryItem, type ResolvedConfig } from "../context.js";
import {
  getKeysHookNames,
  getPublicKeysHookNames,
  resolveKeysCopyHookFiles,
} from "./keys-copy-bundle.js";

export type InstallNamespace = "ui" | "keys";
const CLI_INSTALLABLE_TYPES = new Set(["registry:ui", "registry:hook", "registry:lib"]);

export interface InstallName {
  namespace: InstallNamespace;
  name: string;
  publicName: string;
}

export function parseInstallName(value: string): InstallName {
  if (value.startsWith("ui/")) {
    const name = value.slice("ui/".length);
    return { namespace: "ui", name, publicName: `ui/${name}` };
  }
  if (value.startsWith("keys/")) {
    const name = value.slice("keys/".length);
    return { namespace: "keys", name, publicName: `keys/${name}` };
  }
  throw new Error(
    `Invalid item name "${value}". Use a namespaced name: ui/${value} or keys/${value}. ` +
      "Run `dgadd list` to see available items.",
  );
}

export function publicAvailableNames(): string[] {
  const uiItems = ctx.registry
    .getPublicItems()
    .filter((item) => CLI_INSTALLABLE_TYPES.has(item.type));
  const publicKeysHooks = [...getPublicKeysHookNames()];
  return [
    ...uiItems.map((item) => `ui/${item.name}`),
    ...publicKeysHooks.map((name) => `keys/${name}`),
  ];
}

export function allListNames(): string[] {
  const uiItems = ctx.registry.getAllItems().filter((item) => CLI_INSTALLABLE_TYPES.has(item.type));
  return [
    ...uiItems.map((item) => `ui/${item.name}`),
    ...[...getKeysHookNames()].map((name) => `keys/${name}`),
  ];
}

function validateInstallNamesAgainst(
  names: string[],
  uiNames: Set<string>,
  keyNames: Set<string>,
): void {
  for (const raw of names) {
    const parsed = parseInstallName(raw);
    const valid = parsed.namespace === "ui" ? uiNames.has(parsed.name) : keyNames.has(parsed.name);
    if (!valid) {
      throw new Error(
        `Item "${raw}" not found. Run \`dgadd list\` to see available ui/* and keys/* items.`,
      );
    }
  }
}

function installableUiNames(items: RegistryItem[]): Set<string> {
  return new Set(
    items.filter((item) => CLI_INSTALLABLE_TYPES.has(item.type)).map((item) => item.name),
  );
}

export function validateInstallNames(names: string[]): void {
  validateInstallNamesAgainst(
    names,
    installableUiNames(ctx.registry.getAllItems()),
    getKeysHookNames(),
  );
}

// Diff accepts hidden transitives (e.g. ui/portal, ui/dialog-shell) so users
// can inspect drift in dependencies they did not explicitly install.
export function validateAnyInstallableName(names: string[]): void {
  validateInstallNamesAgainst(
    names,
    installableUiNames(ctx.registry.getAllItems()),
    getKeysHookNames(),
  );
}

export function splitInstallNames(names: string[]): {
  ui: string[];
  keys: string[];
} {
  const ui = new Set<string>();
  const keys = new Set<string>();

  for (const raw of names) {
    const parsed = parseInstallName(raw);
    if (parsed.namespace === "ui") ui.add(parsed.name);
    else keys.add(parsed.name);
  }

  return { ui: [...ui], keys: [...keys] };
}

export function getNamespacedItem(name: string): RegistryItem {
  const parsed = parseInstallName(name);
  if (parsed.namespace === "ui") {
    const item = ctx.items.getOrThrow(parsed.name);
    return { ...item, name: parsed.publicName };
  }

  const { files, missingHooks } = resolveKeysCopyHookFiles([parsed.name]);
  if (missingHooks.length > 0) {
    throw new Error(`Keys item "${name}" not found.`);
  }

  return {
    name: parsed.publicName,
    type: "registry:hook",
    title: parsed.name,
    description: `Diffgazer keys hook: ${parsed.name}`,
    dependencies: [],
    registryDependencies: [],
    files: files.map((file) => ({
      path: `registry/hooks/${file.relativePath}`,
      content: file.content,
    })),
    meta: {},
  };
}

export function isNamespacedInstalled(cwd: string, config: ResolvedConfig, name: string): boolean {
  const parsed = parseInstallName(name);
  const manifest = ctx.config.getManifestItems(cwd);
  if (manifest?.[parsed.publicName]) return true;

  if (parsed.namespace === "ui") {
    return ctx.createChecker(cwd, config.componentsFsPath)(parsed.name);
  }

  return false;
}
