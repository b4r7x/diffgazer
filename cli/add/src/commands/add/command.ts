import {
  createAddCommand,
  depName,
  type FileOp,
  getInstalledDeps,
  info,
  normalizeVersionSpec,
  parseEnumOption,
} from "@diffgazer/registry/cli";
import type { ResolvedConfig } from "../../context.js";
import { ctx } from "../../context.js";
import { planComponentCss } from "../../utils/css-chunks.js";
import { resolveKeysHooksFromRegistry } from "../../utils/keys-copy-bundle.js";
import {
  publicAvailableNames,
  splitInstallNames,
  validateInstallNames,
} from "../../utils/namespaces.js";
import { buildComponentFileOps, buildKeysFileOps } from "./file-ops.js";
import {
  applyIntegrationDeps,
  DEFAULT_KEYS_VERSION_SPEC,
  type ResolvedIntegrationSelection,
  resolveIntegrations,
} from "./integration.js";
import { buildManifestMetadata, updateOwnedManifestEntries } from "./manifest.js";

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
): CollectedFileOps {
  const fileOps = buildComponentFileOps(resolved, cwd, config, selection.mode);
  const cssPlan = planComponentCss(resolved, cwd, config);
  if (cssPlan.fileOp) fileOps.push(cssPlan.fileOp);
  if (selection.hasKeyboardIntegration && selection.mode === "copy") {
    fileOps.push(...buildKeysFileOps(neededKeysHooks, cwd, config));
  }
  return { fileOps, cssChunksByItem: cssPlan.chunksByItem };
}

function computeMissingDeps(
  resolved: string[],
  selection: ResolvedIntegrationSelection,
  keysVersionSpec: string,
  cwd: string,
): string[] {
  const npmDeps = applyIntegrationDeps(ctx.registry.npmDeps(resolved), selection, keysVersionSpec);
  const installed = getInstalledDeps(cwd);
  return npmDeps.filter((dep) => !installed.has(depName(dep)));
}

const addBaseCommand = createAddCommand<ResolvedConfig>({
  itemLabel: "Item",
  itemPlural: "items",
  listCommand: "dgadd list",
  emptyRequestedMessage: "No items specified. Usage: dgadd add ui/button keys/navigation",
  allIgnoresSpecifiedWarning: "--all flag ignores specified item names.",
  requireConfig: ctx.items.requireConfig,
  getPublicNames: () => publicAvailableNames(),
  validateRequestedNames: validateInstallNames,
  extraOptions: [
    {
      flags: "--integration <mode>",
      description: "Optional keyboard integration mode: ask | none | copy | keys",
      default: "ask",
    },
    {
      flags: "--keys-version <version>",
      description: "Version/range of @diffgazer/keys used for package mode",
      default: DEFAULT_KEYS_VERSION_SPEC,
    },
  ],
  buildPlan: async ({ cwd, config, names, opts }) => {
    const namesByNamespace = splitInstallNames(names);
    const keysVersionSpec = normalizeVersionSpec(opts.keysVersion, "@diffgazer/keys");
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
    const collected = collectFileOps(resolved, cwd, config, selection, neededKeysHooks);

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

export const addCommand = addBaseCommand;
