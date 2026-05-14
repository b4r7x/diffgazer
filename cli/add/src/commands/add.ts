import {
  createAddCommand,
  getInstalledDeps, depName, normalizeVersionSpec,
  parseEnumOption, info,
  type FileOp,
} from "@diffgazer/registry/cli";
import { ctx } from "../context.js";
import { resolveKeysHooksFromRegistry } from "../utils/integration.js";
import {
  applyIntegrationDeps,
  DEFAULT_KEYS_VERSION_SPEC,
  resolveIntegrations,
  type ResolvedIntegrationSelection,
} from "../utils/add-integration.js";
import {
  publicInstallNames,
  splitInstallNames,
  validateInstallNames,
} from "../utils/namespaces.js";
import type { ResolvedConfig } from "../context.js";
import { buildComponentCssFileOps } from "./add/css-ops.js";
import { buildComponentFileOps, buildKeysFileOps } from "./add/file-ops.js";
import { buildManifestMetadata, updateOwnedManifestEntries } from "./add/manifest.js";

function logIntegrationMode(mode: ResolvedIntegrationSelection["mode"]): void {
  if (mode === "copy") info("Including integration: keyboard-navigation (copy hooks)");
  if (mode === "@diffgazer/keys") info("Including integration: keyboard-navigation + @diffgazer/keys package");
}

function collectFileOps(
  resolved: string[],
  cwd: string,
  config: ResolvedConfig,
  selection: ResolvedIntegrationSelection,
  neededKeysHooks: string[],
): FileOp[] {
  const fileOps = buildComponentFileOps(resolved, cwd, config, selection.mode);
  fileOps.push(...buildComponentCssFileOps(resolved, cwd, config));
  if (selection.hasKeyboardIntegration && selection.mode === "copy") {
    fileOps.push(...buildKeysFileOps(neededKeysHooks, cwd, config));
  }
  return fileOps;
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
  getPublicNames: () => publicInstallNames(),
  validateRequestedNames: validateInstallNames,
  extraOptions: [
    { flags: "--integration <mode>", description: "Optional keyboard integration mode: ask | none | copy | keys", default: "ask" },
    { flags: "--keys-version <version>", description: "Version/range of @diffgazer/keys used for package mode", default: DEFAULT_KEYS_VERSION_SPEC },
  ],
  buildPlan: async ({ cwd, config, names, opts }) => {
    const namesByNamespace = splitInstallNames(names);
    const keysVersionSpec = normalizeVersionSpec(opts.keysVersion, "@diffgazer/keys");
    const integrationMode = parseEnumOption(
      String(opts.integration ?? "ask").toLowerCase(),
      ["ask", "none", "copy", "@diffgazer/keys", "keys"] as const,
      "--integration",
    );
    const normalizedIntegrationMode = integrationMode === "keys" ? "@diffgazer/keys" : integrationMode;
    const resolved = ctx.registry.resolveDeps(namesByNamespace.ui);
    const selection = await resolveIntegrations(resolved, normalizedIntegrationMode, Boolean(opts.yes));
    logIntegrationMode(selection.mode);

    const neededKeysHooks = resolveKeysHooksFromRegistry(
      resolved.map((name) => ctx.items.getOrThrow(name)),
    );

    return {
      resolvedNames: [
        ...resolved.map((name) => `ui/${name}`),
        ...namesByNamespace.keys.map((name) => `keys/${name}`),
      ],
      fileOps: [
        ...collectFileOps(resolved, cwd, config, selection, neededKeysHooks),
        ...buildKeysFileOps(namesByNamespace.keys, cwd, config),
      ],
      missingDeps: computeMissingDeps(resolved, selection, keysVersionSpec, cwd),
      extraDependencies: resolved.filter((r) => !namesByNamespace.ui.includes(r)).map((name) => `ui/${name}`),
      headingMessage: "Adding Diffgazer items...",
      onDryRun: () => {
        if (selection.hasKeyboardIntegration && selection.mode === "copy") {
          info("Keys hooks would be installed from bundled offline sources.");
        }
      },
      onApplied: ({ resolvedNames, writeResult }) => {
        updateOwnedManifestEntries(
          cwd,
          writeResult,
          buildManifestMetadata(selection.mode, keysVersionSpec),
        );
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
