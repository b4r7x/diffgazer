import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ctx, type RegistryItem, type ResolvedConfig } from "../context.js";
import {
  getKeysHookNames,
  resolveKeysCopyHookFiles,
} from "./integration.js";

export type InstallNamespace = "ui" | "keys";

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
  return { namespace: "ui", name: value, publicName: `ui/${value}` };
}

export function publicInstallNames(): string[] {
  return [
    ...ctx.registry.getPublicItems().map((item) => `ui/${item.name}`),
    ...ctx.registry.getPublicItems().map((item) => item.name),
    ...[...getKeysHookNames()].map((name) => `keys/${name}`),
  ];
}

export function validateInstallNames(names: string[]): void {
  const uiNames = new Set(ctx.registry.getPublicItems().map((item) => item.name));
  const keyNames = getKeysHookNames();

  for (const raw of names) {
    const parsed = parseInstallName(raw);
    const valid = parsed.namespace === "ui"
      ? uiNames.has(parsed.name)
      : keyNames.has(parsed.name);
    if (!valid) {
      throw new Error(`Item "${raw}" not found. Run \`dgadd list\` to see available ui/* and keys/* items.`);
    }
  }
}

export function splitInstallNames(names: string[]): {
  ui: string[];
  keys: string[];
  publicNames: string[];
} {
  const ui = new Set<string>();
  const keys = new Set<string>();

  for (const raw of names) {
    const parsed = parseInstallName(raw);
    if (parsed.namespace === "ui") ui.add(parsed.name);
    else keys.add(parsed.name);
  }

  return {
    ui: [...ui],
    keys: [...keys],
    publicNames: [
      ...[...ui].map((name) => `ui/${name}`),
      ...[...keys].map((name) => `keys/${name}`),
    ],
  };
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
  if (parsed.namespace === "ui") {
    return ctx.createChecker(cwd, config.componentsFsPath)(parsed.name);
  }

  const { files } = resolveKeysCopyHookFiles([parsed.name]);
  return files.some((file) => existsSync(resolve(cwd, config.hooksFsPath, file.relativePath)));
}
