import {
  createAddCommand,
  depName,
  type FileOp,
  getInstalledDeps,
  info,
  normalizeVersionSpec,
  parseEnumOption,
  readPackageJson,
} from "@diffgazer/registry/cli";
import { REGISTRY_ITEM_TYPE } from "@diffgazer/registry/schemas";
import type { ResolvedConfig } from "../../context.js";
import { ctx, getDefaultKeysVersionSpec } from "../../context.js";
import { planComponentCss } from "../../utils/css-chunks.js";
import { resolveKeysHooksFromRegistry } from "../../utils/keys-copy-bundle.js";
import {
  publicAvailableNames,
  splitInstallNames,
  validateInstallableNames,
} from "../../utils/namespaces.js";
import { buildComponentFileOps, buildKeysFileOps } from "./file-ops.js";
import {
  applyIntegrationDeps,
  type ResolvedIntegrationSelection,
  resolveIntegrations,
} from "./integration.js";
import { buildManifestMetadata, updateOwnedManifestEntries } from "./manifest.js";

// Hidden items not depended upon by any other item are opt-in leaf add-ons
// (directly installable, kept out of the public index); hidden items that ARE
// depended upon are pure transitive internals and MUST NOT be installable.
function installableAddonNames(): string[] {
  const items = ctx.registry.getAllItems();
  const dependedUpon = new Set(
    items.flatMap((item) => item.registryDependencies ?? []).map((dep) => dep.split("/").pop()),
  );
  return items
    .filter(
      (item) =>
        item.meta?.hidden === true &&
        item.type === REGISTRY_ITEM_TYPE.ui &&
        !dependedUpon.has(item.name),
    )
    .map((item) => `ui/${item.name}`);
}

function logIntegrationMode(mode: ResolvedIntegrationSelection["mode"]): void {
  if (mode === "copy") info("Including integration: keyboard-navigation (copy hooks)");
  if (mode === "@diffgazer/keys")
    info("Including integration: keyboard-navigation + @diffgazer/keys package");
}

interface CollectedFileOps {
  fileOps: FileOp[];
  cssChunksByItem: Map<string, string[]>;
}

function collectFileOps(
  resolved: string[],
  cwd: string,
  config: ResolvedConfig,
  selection: ResolvedIntegrationSelection,
  neededKeysHooks: string[],
  overwrite: boolean,
): CollectedFileOps {
  const fileOps = buildComponentFileOps(resolved, cwd, config, selection.mode);
  const cssPlan = planComponentCss(resolved, cwd, config, overwrite);
  if (cssPlan.fileOp) fileOps.push(cssPlan.fileOp);
  if (selection.hasKeyboardIntegration && selection.mode === "copy") {
    fileOps.push(...buildKeysFileOps(neededKeysHooks, cwd, config));
  }
  return { fileOps, cssChunksByItem: cssPlan.chunksByItem };
}

function installedVersion(cwd: string, packageName: string): string | undefined {
  const pkg = readPackageJson(cwd);
  if (!pkg) return undefined;
  return (
    pkg.dependencies?.[packageName] ??
    pkg.devDependencies?.[packageName] ??
    pkg.peerDependencies?.[packageName]
  );
}

function requestedVersion(dep: string): string | undefined {
  const name = depName(dep);
  const versionAt = dep.indexOf("@", name.startsWith("@") ? 1 : 0);
  return versionAt > 0 ? dep.slice(versionAt + 1) : undefined;
}

export function computeMissingDeps(
  resolved: string[],
  selection: ResolvedIntegrationSelection,
  keysVersionSpec: string,
  cwd: string,
): string[] {
  const npmDeps = applyIntegrationDeps(ctx.registry.npmDeps(resolved), selection, keysVersionSpec);
  const installed = getInstalledDeps(cwd);
  return npmDeps.filter((dep) => {
    const name = depName(dep);
    if (!installed.has(name)) return true;
    const requested = requestedVersion(dep);
    if (!requested) return false;
    return installedVersion(cwd, name) !== requested;
  });
}

const addBaseCommand = createAddCommand<ResolvedConfig>({
  itemLabel: "Item",
  itemPlural: "items",
  listCommand: "dgadd list",
  emptyRequestedMessage: "No items specified. Usage: dgadd add ui/button keys/navigation",
  allIgnoresSpecifiedWarning: "--all flag ignores specified item names.",
  requireConfig: ctx.items.requireConfig,
  // Public index plus opt-in leaf add-ons; gates both --all and explicit names
  // so neither reaches pure transitive internals.
  getPublicNames: () => [...new Set([...publicAvailableNames(), ...installableAddonNames()])],
  validateRequestedNames: validateInstallableNames,
  extraOptions: [
    {
      flags: "--integration <mode>",
      description: "Optional keyboard integration mode: ask | none | copy | keys",
      default: "ask",
    },
    {
      flags: "--keys-version <version>",
      description: "Version/range of @diffgazer/keys used for package mode",
    },
  ],
  buildPlan: async ({ cwd, config, names, opts }) => {
    const namesByNamespace = splitInstallNames(names);
    const keysVersionSpec = normalizeVersionSpec(
      opts.keysVersion ?? getDefaultKeysVersionSpec(),
      "@diffgazer/keys",
    );
    const integrationMode = parseEnumOption(
      String(opts.integration ?? "ask").toLowerCase(),
      ["ask", "none", "copy", "@diffgazer/keys", "keys"] as const,
      "--integration",
    );
    const normalizedIntegrationMode =
      integrationMode === "keys" ? "@diffgazer/keys" : integrationMode;
    const resolved = ctx.registry.resolveDeps(namesByNamespace.ui);
    const selection = await resolveIntegrations(
      resolved,
      normalizedIntegrationMode,
      Boolean(opts.yes),
    );
    logIntegrationMode(selection.mode);

    const neededKeysHooks = resolveKeysHooksFromRegistry(
      resolved.map((name) => ctx.items.getOrThrow(name)),
    );
    const explicitNames = new Set<string>([
      ...namesByNamespace.ui.map((name) => `ui/${name}`),
      ...namesByNamespace.keys.map((name) => `keys/${name}`),
    ]);
    const collected = collectFileOps(
      resolved,
      cwd,
      config,
      selection,
      neededKeysHooks,
      Boolean(opts.overwrite),
    );

    return {
      resolvedNames: [
        ...resolved.map((name) => `ui/${name}`),
        ...namesByNamespace.keys.map((name) => `keys/${name}`),
      ],
      fileOps: [...collected.fileOps, ...buildKeysFileOps(namesByNamespace.keys, cwd, config)],
      missingDeps: computeMissingDeps(resolved, selection, keysVersionSpec, cwd),
      extraDependencies: resolved
        .filter((r) => !namesByNamespace.ui.includes(r))
        .map((name) => `ui/${name}`),
      headingMessage: "Adding Diffgazer items...",
      onDryRun: () => {
        if (selection.hasKeyboardIntegration && selection.mode === "copy") {
          info("Keys hooks would be installed from bundled offline sources.");
        }
      },
      onApplied: ({ writeResult }) => {
        updateOwnedManifestEntries(cwd, {
          writeResult,
          metadata: buildManifestMetadata(selection.mode, keysVersionSpec),
          explicitNames,
          cssChunksByItem: collected.cssChunksByItem,
        });
        if (selection.hasKeyboardIntegration && selection.mode === "copy") {
          info("Keyboard hooks copied alongside components. No additional packages needed.");
          info("For package imports, re-run with --integration=keys to use @diffgazer/keys.");
        }
      },
    };
  },
});

addBaseCommand.description("Add ui/* components or keys/* hooks to your project");

// Guarded and deferred to help render: eager-reading the generated
// keys-version.json at import time would crash every subcommand when it is absent.
addBaseCommand.addHelpText("after", () => {
  try {
    return `\nDefault --keys-version: ${getDefaultKeysVersionSpec()} (caret range of the bundled @diffgazer/keys release)`;
  } catch {
    return "";
  }
});

export const addCommand = addBaseCommand;
