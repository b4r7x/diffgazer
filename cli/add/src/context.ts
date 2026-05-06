import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  aliasPathSchema,
  BaseRegistryBundleSchema,
  RegistryContentFileSchema,
  RegistryContentItemSchema,
  createConfigModule,
  createInstallChecker,
  createItemAccessors,
  createRegistryAccessors,
  createRegistryLoader,
  readPackageVersion,
  resolveAliasedPaths,
} from "@diffgazer/registry/cli";

export const VERSION = readPackageVersion(import.meta.url, "../package.json");

export const DiffgazerAddConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().optional(),
  aliases: z.object({
    components: aliasPathSchema,
    utils: aliasPathSchema,
    lib: aliasPathSchema,
    hooks: aliasPathSchema,
  }).optional(),
  componentsFsPath: z.string().optional(),
  libFsPath: z.string().optional(),
  hooksFsPath: z.string().optional(),
  rsc: z.boolean().optional(),
  tailwind: z.object({ css: z.string() }).optional(),
  installedComponents: z.record(z.string(), z.object({
    installedAt: z.string(),
    integrationMode: z.enum(["none", "copy", "@diffgazer/keys"]).optional(),
    keysVersion: z.string().optional(),
    files: z.array(z.object({
      path: z.string(),
      hash: z.string(),
      item: z.string(),
      registryIntegrity: z.string().optional(),
      cliVersion: z.string().optional(),
      integrationMode: z.enum(["none", "copy", "@diffgazer/keys"]).optional(),
    })).optional(),
  })).optional(),
});

export type DiffgazerAddConfig = z.infer<typeof DiffgazerAddConfigSchema>;

export type ManifestInstallMetadata = {
  integrationMode?: "none" | "copy" | "@diffgazer/keys";
  keysVersion?: string;
  files?: ManifestOwnedFile[];
};

export type ManifestOwnedFile = {
  path: string;
  hash: string;
  item: string;
  registryIntegrity?: string;
  cliVersion?: string;
  integrationMode?: "none" | "copy" | "@diffgazer/keys";
};

/** dgadd resolved config (component + hook paths). */
export interface ResolvedConfig {
  aliases: {
    components: string;
    utils: string;
    lib: string;
    hooks: string;
  };
  rsc: boolean;
  tailwind: { css: string } | undefined;
  componentsFsPath: string;
  libFsPath: string;
  hooksFsPath: string;
}

export const SOURCE_ALIASES = {
  utils: "@/lib/utils",
  lib: "@/lib/",
  hooks: "@/hooks/",
  components: "@/components/ui/",
} as const;

const DEFAULT_ALIASES = {
  components: "@/components/ui",
  utils: "@/lib/utils",
  lib: "@/lib",
  hooks: "@/hooks",
};

export function resolveConfig(raw: DiffgazerAddConfig, cwd?: string): ResolvedConfig {
  const aliases = { ...DEFAULT_ALIASES, ...raw.aliases };
  const resolved = resolveAliasedPaths(
    { components: raw.componentsFsPath, lib: raw.libFsPath, hooks: raw.hooksFsPath },
    { components: aliases.components, lib: aliases.lib, hooks: aliases.hooks },
    cwd,
  );

  return {
    aliases,
    rsc: raw.rsc ?? false,
    tailwind: raw.tailwind,
    componentsFsPath: resolved.components,
    libFsPath: resolved.lib,
    hooksFsPath: resolved.hooks,
  };
}

export type RegistryFile = z.infer<typeof RegistryContentFileSchema>;
export type RegistryItem = z.infer<typeof RegistryContentItemSchema>;

const CONFIG_FILE = "diffgazer.json";
const __dirname = dirname(fileURLToPath(import.meta.url));

const RegistryBundleSchema = BaseRegistryBundleSchema.extend({
  theme: z.string(),
  styles: z.string(),
});

type RegistryBundle = z.infer<typeof RegistryBundleSchema>;

const loadRegistry = createRegistryLoader(
  resolve(__dirname, "./generated/registry-bundle.json"),
  RegistryBundleSchema,
  (bundle) => ({ items: bundle.items, theme: bundle.theme, styles: bundle.styles }),
);

export function getRegistry(): RegistryBundle {
  return loadRegistry();
}

const registry = createRegistryAccessors({
  loader: () => getRegistry(),
  itemLabel: "Component",
  pathPrefixes: ["registry/ui/", "registry/hooks/", "registry/lib/"],
});

const config = createConfigModule<DiffgazerAddConfig, ResolvedConfig, ManifestInstallMetadata>({
  configFileName: CONFIG_FILE,
  schema: DiffgazerAddConfigSchema,
  resolveConfig,
  manifestKey: "installedComponents",
});

const items = createItemAccessors({
  configFileName: CONFIG_FILE,
  initCommand: "dgadd init",
  itemLabel: "Item",
  listCommand: "dgadd list",
  loadResolved: config.loadResolvedConfig,
  getItem: registry.getItem,
});

export const ctx = {
  registry,
  config,
  items,
  createChecker: (cwd: string, componentsFsPath: string) =>
    createInstallChecker({
      getManifest: () => config.getManifestItems(cwd),
      getItem: registry.getItem,
      getRelativePath: registry.relativePath,
      installDir: resolve(cwd, componentsFsPath),
    }),
} as const;
