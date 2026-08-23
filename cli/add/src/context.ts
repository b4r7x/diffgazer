import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  aliasPathSchema,
  BaseRegistryBundleSchema,
  createConfigModule,
  createInstallChecker,
  createItemAccessors,
  createRegistryAccessors,
  createRegistryLoader,
  type RegistryContentFileSchema,
  type RegistryContentItemSchema,
  readPackageVersion,
  resolveAliasedPaths,
} from "@diffgazer/registry/cli";
import { z } from "zod";
import {
  normalizeProjectRelativePath,
  resolveProjectPath,
  toRelativePosixSegments,
} from "./utils/paths.js";

export const VERSION = readPackageVersion(import.meta.url, "../package.json");

const CssChunkHashSchema = z.string().regex(/^[a-f0-9]{16}$/, {
  error: "CSS chunk hashes must be sixteen lowercase hexadecimal characters",
});

const ManifestIntegrationModeSchema = z.enum(["none", "copy", "@diffgazer/keys"]);

// looseObject, not object: the published editor schema deliberately allows
// unknown keys, so parsing must preserve them — `dgadd add` rewrites the same
// file and a plain object would silently delete anything it did not declare.
export const DiffgazerAddConfigSchema = z.looseObject({
  $schema: z.string().optional(),
  version: z.string().optional(),
  aliases: z
    .object({
      components: aliasPathSchema,
      utils: aliasPathSchema,
      lib: aliasPathSchema,
      hooks: aliasPathSchema,
    })
    .optional(),
  componentsFsPath: z.string().optional(),
  libFsPath: z.string().optional(),
  hooksFsPath: z.string().optional(),
  rsc: z.boolean().optional(),
  tailwind: z.object({ css: z.string() }).optional(),
  installedItems: z
    .record(
      z.string(),
      z.object({
        installedAt: z.string(),
        integrationMode: ManifestIntegrationModeSchema.optional(),
        keysVersion: z.string().optional(),
        // "explicit" — user passed this name to `dgadd add`. "transitive" — pulled in as
        // a registry dependency. Used to decide cascade-remove eligibility.
        installedAs: z.enum(["explicit", "transitive"]).optional(),
        // Install-time dependency edges (`ui/button`, `keys/focus-trap`) captured when the
        // item was written. Removal uses this graph instead of the live registry bundle so
        // retained older installations still protect shared transitives after registry drift.
        requires: z.array(z.string()).optional(),
        cssChunks: z.array(CssChunkHashSchema).optional(),
        files: z
          .array(
            z.object({
              path: z.string(),
              hash: z.string(),
              item: z.string(),
              registryIntegrity: z.string().optional(),
              cliVersion: z.string().optional(),
              integrationMode: ManifestIntegrationModeSchema.optional(),
              retired: z.literal(true).optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export type DiffgazerAddConfig = z.infer<typeof DiffgazerAddConfigSchema>;

/** A single zod-proved manifest entry keyed by installed item name. */
export type ManifestItem = NonNullable<DiffgazerAddConfig["installedItems"]>[string];

/** Everything a manifest entry carries except the timestamp the writer stamps. */
export type ManifestInstallMetadata = Omit<ManifestItem, "installedAt">;

export type ManifestOwnedFile = NonNullable<ManifestItem["files"]>[number];

export type ManifestIntegrationMode = z.infer<typeof ManifestIntegrationModeSchema>;

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
  stylesFsPath: string;
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

export function resolveConfig(raw: DiffgazerAddConfig, cwd: string): ResolvedConfig {
  const aliases = { ...DEFAULT_ALIASES, ...raw.aliases };
  const tailwindCss = raw.tailwind ? normalizeProjectRelativePath(raw.tailwind.css) : undefined;
  if (tailwindCss) resolveProjectPath(cwd, tailwindCss);
  const tailwind = tailwindCss === undefined ? undefined : { css: tailwindCss };
  const rawResolved = resolveAliasedPaths(
    { components: raw.componentsFsPath, lib: raw.libFsPath, hooks: raw.hooksFsPath },
    { components: aliases.components, lib: aliases.lib, hooks: aliases.hooks },
    cwd,
  );
  const resolved = {
    components: toRelativePosixSegments(
      relative(resolve(cwd), resolveProjectPath(cwd, rawResolved.components)),
    ),
    lib: toRelativePosixSegments(relative(resolve(cwd), resolveProjectPath(cwd, rawResolved.lib))),
    hooks: toRelativePosixSegments(
      relative(resolve(cwd), resolveProjectPath(cwd, rawResolved.hooks)),
    ),
  };

  return {
    aliases,
    rsc: raw.rsc ?? false,
    tailwind,
    componentsFsPath: resolved.components,
    libFsPath: resolved.lib,
    hooksFsPath: resolved.hooks,
    stylesFsPath: deriveStylesFsPath(tailwindCss, resolved.lib, cwd),
  };
}

// dgadd init writes theme files alongside the Tailwind entry CSS (typically
// `src/styles/styles.css`), so the theme registry item's `styles/*.css` paths
// install into that same directory. Fall back to a sibling `styles/` next to
// the lib dir when no tailwind config is present.
function deriveStylesFsPath(
  tailwindCss: string | undefined,
  libFsPath: string,
  cwd: string,
): string {
  if (tailwindCss) {
    const dir = toRelativePosixSegments(dirname(tailwindCss));
    return toRelativePosixSegments(relative(resolve(cwd), resolveProjectPath(cwd, dir)));
  }
  const parent = toRelativePosixSegments(dirname(libFsPath));
  return parent === "." ? "styles" : `${parent}/styles`;
}

export type RegistryFile = z.infer<typeof RegistryContentFileSchema>;
export type RegistryItem = z.infer<typeof RegistryContentItemSchema>;

const CONFIG_FILE = "diffgazer.json";
const __dirname = dirname(fileURLToPath(import.meta.url));

const RegistryBundleSchema = BaseRegistryBundleSchema.extend({
  theme: z.string(),
  styles: z.string(),
});

export const getRegistry = createRegistryLoader(
  resolve(__dirname, "./generated/registry-bundle.json"),
  RegistryBundleSchema,
  (bundle) => ({ items: bundle.items, theme: bundle.theme, styles: bundle.styles }),
);

const KeysVersionSchema = z.object({ versionSpec: z.string().min(1) });

let cachedKeysVersionSpec: string | null = null;

// Derived at build time by generate-keys-copy-bundle.ts from libs/keys/package.json,
// so the default --keys-version range tracks the bundled @diffgazer/keys release with
// no hand edits. Read at runtime (not statically imported) so type-check stays
// independent of the gitignored generated file and the path resolves the same from
// src (tests/tsx) and the tsup bundle.
export function getDefaultKeysVersionSpec(): string {
  if (cachedKeysVersionSpec) return cachedKeysVersionSpec;
  const path = resolve(__dirname, "./generated/keys-version.json");
  const { versionSpec } = KeysVersionSchema.parse(JSON.parse(readFileSync(path, "utf-8")));
  cachedKeysVersionSpec = versionSpec;
  return versionSpec;
}

const registry = createRegistryAccessors({
  loader: getRegistry,
  itemLabel: "Component",
  pathPrefixes: ["registry/ui/", "registry/hooks/", "registry/lib/", "styles/"],
});

const config = createConfigModule<DiffgazerAddConfig, ResolvedConfig, ManifestItem>({
  configFileName: CONFIG_FILE,
  schema: DiffgazerAddConfigSchema,
  resolveConfig,
  manifestKey: "installedItems",
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
      getItem: registry.getItem,
      getRelativePath: registry.relativePath,
      installDir: resolve(cwd, componentsFsPath),
    }),
} as const;
