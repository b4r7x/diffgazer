import { REGISTRY_ITEM_TYPE } from "@diffgazer/registry/schemas";
import { ctx, type ManifestItem, type RegistryItem, type ResolvedConfig } from "../context.js";
import {
  getKeysHookNames,
  getPublicKeysHookNames,
  resolveKeysCopyHookFiles,
} from "./keys-copy-bundle.js";

type InstallNamespace = "ui" | "keys";
const CLI_INSTALLABLE_TYPES = new Set<string>([
  REGISTRY_ITEM_TYPE.ui,
  REGISTRY_ITEM_TYPE.hook,
  REGISTRY_ITEM_TYPE.lib,
]);

interface InstallName {
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

export function validateInstallableNames(names: string[]): void {
  validateInstallNamesAgainst(
    names,
    installableUiNames(ctx.registry.getAllItems()),
    getKeysHookNames(),
  );
}

export function validateInstalledOrRegistryNames(
  cwd: string,
  names: string[],
  manifest?: Record<string, ManifestItem>,
): void {
  const items = manifest ?? ctx.config.getManifestItems(cwd) ?? {};
  for (const raw of names) {
    const parsed = parseInstallName(raw);
    const inRegistry =
      parsed.namespace === "ui"
        ? installableUiNames(ctx.registry.getAllItems()).has(parsed.name)
        : getKeysHookNames().has(parsed.name);
    if (!inRegistry && !items[parsed.publicName]) {
      throw new Error(
        `Item "${raw}" not found. Run \`dgadd list\` to see available ui/* and keys/* items.`,
      );
    }
  }
}

function manifestBackedRegistryItem(parsed: InstallName, record: ManifestItem): RegistryItem {
  return {
    name: parsed.publicName,
    type: parsed.namespace === "ui" ? REGISTRY_ITEM_TYPE.ui : REGISTRY_ITEM_TYPE.hook,
    title: parsed.name,
    description: `Installed item: ${parsed.publicName}`,
    dependencies: [],
    registryDependencies: [],
    files: [],
    meta: record.integrationMode ? { integrationMode: record.integrationMode } : {},
  };
}

export function tryGetNamespacedItem(name: string): RegistryItem | null {
  const parsed = parseInstallName(name);
  if (parsed.namespace === "ui") {
    const item = ctx.registry.getItem(parsed.name);
    if (!item) return null;
    return { ...item, name: parsed.publicName };
  }

  const { files, missingHooks } = resolveKeysCopyHookFiles([parsed.name]);
  if (missingHooks.length > 0) return null;

  return {
    name: parsed.publicName,
    type: REGISTRY_ITEM_TYPE.hook,
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

export function resolveNamespacedItem(
  name: string,
  cwd: string,
  manifest?: Record<string, ManifestItem>,
): RegistryItem {
  const existing = tryGetNamespacedItem(name);
  if (existing) return existing;

  const parsed = parseInstallName(name);
  const record = (manifest ?? ctx.config.getManifestItems(cwd))?.[parsed.publicName];
  if (!record) {
    throw new Error(
      `Item "${name}" not found. Run \`dgadd list\` to see available ui/* and keys/* items.`,
    );
  }
  return manifestBackedRegistryItem(parsed, record);
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
    type: REGISTRY_ITEM_TYPE.hook,
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

export function isNamespacedInstalled(
  cwd: string,
  config: ResolvedConfig,
  name: string,
  manifest?: Record<string, ManifestItem>,
  uiChecker?: (name: string) => boolean,
): boolean {
  const parsed = parseInstallName(name);
  const items = manifest ?? ctx.config.getManifestItems(cwd);
  if (items?.[parsed.publicName]) return true;

  if (parsed.namespace === "ui") {
    const checker = uiChecker ?? ctx.createChecker(cwd, config.componentsFsPath);
    return checker(parsed.name);
  }

  return false;
}
