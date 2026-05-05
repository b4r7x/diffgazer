import { resolve } from "node:path";
import { rewriteLocalImportsForKeysPackage } from "../utils/transform.js";
import {
  createAddCommand,
  ensureWithinDir, getInstalledDeps, depName, normalizeVersionSpec,
  parseEnumOption, info,
  type FileOp,
} from "@diffgazer/registry/cli";
import { ctx, type ResolvedConfig, type ManifestInstallMetadata, type RegistryItem } from "../context.js";
import {
  prepareFileContent,
  getInstallBaseForFilePath,
  getInstallDirForBase,
} from "../utils/registry.js";
import {
  resolveKeysHooksFromRegistry,
  resolveKeysCopyHookFiles,
} from "../utils/integration.js";
import {
  applyIntegrationDeps,
  resolveIntegrations,
  type ResolvedIntegrationSelection,
} from "../utils/add-integration.js";
import {
  publicInstallNames,
  splitInstallNames,
  validateInstallNames,
} from "../utils/namespaces.js";

function buildFileOp(
  file: { path: string; content: string },
  item: RegistryItem,
  config: ResolvedConfig,
  cwd: string,
  integrationMode: ResolvedIntegrationSelection["mode"],
  dirs: { componentsDir: string; hooksDir: string; libDir: string },
): FileOp {
  const relativePath = ctx.registry.relativePath(file);
  const rawContent = integrationMode === "@diffgazer/keys"
    ? rewriteLocalImportsForKeysPackage(file.content)
    : file.content;
  const content = prepareFileContent({ ...file, content: rawContent }, item, config);
  const installBase = getInstallBaseForFilePath(file.path);
  const installDir = getInstallDirForBase(installBase, config);
  const targetRoot = installBase === "components"
    ? dirs.componentsDir
    : installBase === "hooks"
      ? dirs.hooksDir
      : dirs.libDir;
  const targetPath = resolve(cwd, installDir, relativePath);
  ensureWithinDir(targetPath, targetRoot);
  return { targetPath, content, relativePath, installDir };
}

function buildComponentFileOps(
  resolved: string[],
  cwd: string,
  config: ResolvedConfig,
  integrationMode: ResolvedIntegrationSelection["mode"],
): FileOp[] {
  const componentsDir = resolve(cwd, config.componentsFsPath);
  const hooksDir = resolve(cwd, config.hooksFsPath);
  const libDir = resolve(cwd, config.libFsPath);
  ensureWithinDir(componentsDir, cwd);
  ensureWithinDir(hooksDir, cwd);
  ensureWithinDir(libDir, cwd);

  const dirs = { componentsDir, hooksDir, libDir };
  return resolved.flatMap((name) => {
    const item = ctx.items.getOrThrow(name);
    return item.files.map((file) => buildFileOp(file, item, config, cwd, integrationMode, dirs));
  });
}

function buildKeysFileOps(
  neededKeysHooks: string[],
  cwd: string,
  config: ResolvedConfig,
): FileOp[] {
  const hooksDir = resolve(cwd, config.hooksFsPath);
  const { files, missingHooks } = resolveKeysCopyHookFiles(neededKeysHooks);

  if (missingHooks.length > 0) {
    throw new Error(
      `Missing bundled keys hook(s): ${missingHooks.join(", ")}\n`
      + "Copy mode requires bundled keys hook sources. Rebuild dgadd and try again.",
    );
  }

  return files.map((file) => {
    const targetPath = resolve(cwd, config.hooksFsPath, file.relativePath);
    ensureWithinDir(targetPath, hooksDir);
    return { targetPath, content: file.content, relativePath: file.relativePath, installDir: config.hooksFsPath };
  });
}

function logIntegrationMode(mode: ResolvedIntegrationSelection["mode"]): void {
  if (mode === "copy") info("Including integration: keyboard-navigation (copy hooks)");
  if (mode === "@diffgazer/keys") info("Including integration: keyboard-navigation + @diffgazer/keys package");
}

function buildIntegrationWarnings(
  selection: ResolvedIntegrationSelection,
  neededHooks: string[],
): string[] {
  if (!selection.hasKeyboardIntegration || selection.mode !== "none") return [];
  return [
    "Components reference keyboard hooks from @/hooks/. "
    + `Install them via 'dgadd ${neededHooks.map((hook) => `keys/${hook}`).join(" ")}' or re-run with --integration=copy.`,
  ];
}

function buildManifestMetadata(
  mode: ResolvedIntegrationSelection["mode"],
  keysVersionSpec: string,
): ManifestInstallMetadata {
  const metadata: ManifestInstallMetadata = { integrationMode: mode };
  if (mode === "@diffgazer/keys" && keysVersionSpec !== "latest") {
    metadata.keysVersion = keysVersionSpec;
  }
  return metadata;
}

function collectFileOps(
  resolved: string[],
  cwd: string,
  config: ResolvedConfig,
  selection: ResolvedIntegrationSelection,
  neededKeysHooks: string[],
): FileOp[] {
  const fileOps = buildComponentFileOps(resolved, cwd, config, selection.mode);
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
    { flags: "--keys-version <version>", description: "Version/tag of @diffgazer/keys used for package mode", default: "latest" },
  ],
  buildPlan: async ({ cwd, config, names, opts }) => {
    const split = splitInstallNames(names);
    const keysVersionSpec = normalizeVersionSpec(opts.keysVersion, "@diffgazer/keys");
    const integrationMode = parseEnumOption(
      String(opts.integration ?? "ask").toLowerCase(),
      ["ask", "none", "copy", "@diffgazer/keys", "keys"] as const,
      "--integration",
    );
    const normalizedIntegrationMode = integrationMode === "keys" ? "@diffgazer/keys" : integrationMode;
    const selection = await resolveIntegrations(split.ui, normalizedIntegrationMode, Boolean(opts.yes));
    logIntegrationMode(selection.mode);

    const resolved = ctx.registry.resolveDeps(split.ui);
    const neededKeysHooks = resolveKeysHooksFromRegistry(
      resolved.map((name) => ctx.items.getOrThrow(name)),
    );

    return {
      resolvedNames: [
        ...resolved.map((name) => `ui/${name}`),
        ...split.keys.map((name) => `keys/${name}`),
      ],
      fileOps: [
        ...collectFileOps(resolved, cwd, config, selection, neededKeysHooks),
        ...buildKeysFileOps(split.keys, cwd, config),
      ],
      missingDeps: computeMissingDeps(resolved, selection, keysVersionSpec, cwd),
      extraDependencies: resolved.filter((r) => !split.ui.includes(r)).map((name) => `ui/${name}`),
      headingMessage: "Adding Diffgazer items...",
      warnBeforeApply: buildIntegrationWarnings(selection, neededKeysHooks),
      onDryRun: () => {
        if (selection.hasKeyboardIntegration && selection.mode === "copy") {
          info("Keys hooks would be installed from bundled offline sources.");
        }
      },
      onApplied: ({ resolvedNames }) => {
        const uiResolvedNames = resolvedNames
          .filter((name) => name.startsWith("ui/"))
          .map((name) => name.slice("ui/".length));
        if (uiResolvedNames.length > 0) {
          ctx.config.updateManifest(cwd, uiResolvedNames, undefined, buildManifestMetadata(selection.mode, keysVersionSpec));
        }
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
