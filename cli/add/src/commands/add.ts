import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, basename } from "node:path";
import { rewriteRelativeJsExtensionsForCopy } from "../utils/transform.js";
import {
  createAddCommand,
  getInstalledDeps, depName, normalizeVersionSpec,
  parseEnumOption, info,
  type FileOp,
} from "@diffgazer/registry/cli";
import { ctx, getRegistry, VERSION, type DiffgazerAddConfig, type ResolvedConfig, type ManifestInstallMetadata, type RegistryItem, type ManifestOwnedFile } from "../context.js";
import {
  prepareFileContentForIntegration,
  getInstallBaseForFilePath,
  getInstallDirForBase,
} from "../utils/registry.js";
import {
  resolveKeysHooksFromRegistry,
  resolveKeysCopyHookFiles,
} from "../utils/integration.js";
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
import { resolveInstallPath, resolveProjectPath, toPosixPath } from "../utils/paths.js";

type OwnedFileOp = FileOp & { sourceNames?: string[] };

function buildComponentCssFileOps(
  resolved: string[],
  cwd: string,
  config: ResolvedConfig,
): FileOp[] {
  if (!config.tailwind?.css) return [];

  const chunks = collectComponentCss(resolved);
  if (chunks.length === 0) return [];

  const cssPath = toPosixPath(config.tailwind.css);
  const targetPath = resolveProjectPath(cwd, cssPath);
  const existing = existsSync(targetPath) ? readFileSync(targetPath, "utf-8") : "";
  const missing = chunks.filter((chunk) => !existing.includes(chunk));
  if (missing.length === 0) return [];

  return [{
    targetPath,
    content: appendCssChunks(existing, missing),
    relativePath: basename(cssPath),
    installDir: toPosixPath(dirname(cssPath)),
    overwrite: true,
  }];
}

function collectComponentCss(resolved: string[]): string[] {
  const seen = new Set<string>();
  const chunks: string[] = [];

  for (const name of resolved) {
    const item = ctx.items.getOrThrow(name);
    for (const file of item.files) {
      if (!file.path.endsWith(".css") || seen.has(file.path)) continue;
      const content = file.content.trimEnd();
      if (!content) continue;

      seen.add(file.path);
      chunks.push(content);
    }
  }

  return chunks;
}

function appendCssChunks(existing: string, chunks: string[]): string {
  const prefix = existing.length === 0
    ? ""
    : existing.endsWith("\n")
      ? "\n"
      : "\n\n";
  return `${existing}${prefix}${chunks.join("\n\n")}\n`;
}

function buildFileOp(
  file: { path: string; content: string },
  item: RegistryItem,
  config: ResolvedConfig,
  cwd: string,
  integrationMode: ResolvedIntegrationSelection["mode"],
): FileOp {
  const relativePath = ctx.registry.relativePath(file);
  const content = prepareFileContentForIntegration(file, item, config, integrationMode);
  const installBase = getInstallBaseForFilePath(file.path);
  const installDir = getInstallDirForBase(installBase, config);
  const targetPath = resolveInstallPath(cwd, installDir, relativePath);
  return { targetPath, content, relativePath, installDir, sourceName: `ui/${item.name}` };
}

function buildComponentFileOps(
  resolved: string[],
  cwd: string,
  config: ResolvedConfig,
  integrationMode: ResolvedIntegrationSelection["mode"],
): FileOp[] {
  resolveProjectPath(cwd, config.componentsFsPath);
  resolveProjectPath(cwd, config.hooksFsPath);
  resolveProjectPath(cwd, config.libFsPath);

  return resolved.flatMap((name) => {
    const item = ctx.items.getOrThrow(name);
    return item.files
      .filter((file) => !file.path.endsWith(".css"))
      .map((file) => buildFileOp(file, item, config, cwd, integrationMode));
  });
}

function buildKeysFileOps(
  neededKeysHooks: string[],
  cwd: string,
  config: ResolvedConfig,
): FileOp[] {
  resolveProjectPath(cwd, config.hooksFsPath);
  const resolvedHooks = neededKeysHooks.map((hook) => ({
    hook,
    resolved: resolveKeysCopyHookFiles([hook]),
  }));
  const missingHooks = resolvedHooks.flatMap(({ resolved }) => resolved.missingHooks);

  if (missingHooks.length > 0) {
    throw new Error(
      `Missing bundled keys hook(s): ${missingHooks.join(", ")}\n`
      + "Copy mode requires bundled keys hook sources. Rebuild dgadd and try again.",
    );
  }

  const byTargetPath = new Map<string, OwnedFileOp>();
  for (const { resolved } of resolvedHooks) {
    for (const file of resolved.files) {
      const sourceName = `keys/${file.hook}`;
      const targetPath = resolveInstallPath(cwd, config.hooksFsPath, file.relativePath);
      const content = rewriteRelativeJsExtensionsForCopy(file.content);
      const existing = byTargetPath.get(targetPath);

      if (existing) {
        if (existing.content !== content) {
          throw new Error(`Conflicting bundled keys hook content for "${file.relativePath}".`);
        }
        existing.sourceNames = [
          ...new Set([existing.sourceName, ...(existing.sourceNames ?? []), sourceName]
            .filter((name): name is string => name !== undefined)),
        ];
        continue;
      }

      const op: OwnedFileOp = {
        targetPath,
        content,
        relativePath: file.relativePath,
        installDir: config.hooksFsPath,
        sourceName,
        sourceNames: [sourceName],
      };
      byTargetPath.set(targetPath, op);
    }
  }

  return [...byTargetPath.values()];
}

function logIntegrationMode(mode: ResolvedIntegrationSelection["mode"]): void {
  if (mode === "copy") info("Including integration: keyboard-navigation (copy hooks)");
  if (mode === "@diffgazer/keys") info("Including integration: keyboard-navigation + @diffgazer/keys package");
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

function sha256(content: string): string {
  return `sha256-${createHash("sha256").update(content).digest("hex")}`;
}

// Adoption policy: a skipped file is only adopted into a new item's ownership
// when an existing manifest entry already owns the same path with the SAME
// registryIntegrity. A version mismatch refuses adoption rather than silently
// claiming files written by an older CLI/registry combination.
function isManifestTrusted(
  manifestPath: string,
  manifest: NonNullable<DiffgazerAddConfig["installedComponents"]>,
  registryIntegrity: string | undefined,
): boolean {
  if (!registryIntegrity) return false;
  for (const record of Object.values(manifest)) {
    for (const file of record.files ?? []) {
      if (file.path !== manifestPath) continue;
      if (file.registryIntegrity === registryIntegrity) return true;
    }
  }
  return false;
}

function buildOwnedFilesByItem(
  cwd: string,
  writeResult: { results: Array<{ op: FileOp; result: "written" | "skipped" | "overwritten" }> },
  mode: ResolvedIntegrationSelection["mode"],
): Map<string, ManifestOwnedFile[]> {
  const registryIntegrity = getRegistry().integrity;
  const byItem = new Map<string, ManifestOwnedFile[]>();
  const writtenByTargetPath = new Map<string, ManifestOwnedFile>();
  const existingManifest = (ctx.config.getManifestItems(cwd) ?? {}) as NonNullable<DiffgazerAddConfig["installedComponents"]>;

  function getSourceNames(op: FileOp): string[] {
    const ownedOp = op as OwnedFileOp;
    return [...new Set([ownedOp.sourceName, ...(ownedOp.sourceNames ?? [])].filter((name): name is string => name !== undefined))];
  }

  function addOwnedFile(sourceName: string, op: FileOp): void {
    const path = toPosixPath(`${op.installDir}/${op.relativePath}`);
    const existingFiles = byItem.get(sourceName) ?? [];
    if (existingFiles.some((file) => file.path === path)) return;

    const ownedFile = {
      path,
      hash: sha256(op.content),
      item: sourceName,
      registryIntegrity,
      cliVersion: VERSION,
      integrationMode: mode,
    };
    existingFiles.push(ownedFile);
    byItem.set(sourceName, existingFiles);
  }

  for (const { op, result } of writeResult.results) {
    const sourceNames = getSourceNames(op);
    if (result === "skipped" || sourceNames.length === 0) continue;
    for (const sourceName of sourceNames) {
      addOwnedFile(sourceName, op);
    }
    writtenByTargetPath.set(op.targetPath, {
      path: toPosixPath(`${op.installDir}/${op.relativePath}`),
      hash: sha256(op.content),
      item: sourceNames[0]!,
      registryIntegrity,
      cliVersion: VERSION,
      integrationMode: mode,
    });
  }

  for (const { op, result } of writeResult.results) {
    const sourceNames = getSourceNames(op);
    if (result !== "skipped" || sourceNames.length === 0) continue;

    const expectedHash = sha256(op.content);
    const written = writtenByTargetPath.get(op.targetPath);
    if (written && written.hash === expectedHash) {
      for (const sourceName of sourceNames) {
        addOwnedFile(sourceName, op);
      }
      continue;
    }

    if (!existsSync(op.targetPath)) continue;
    const onDiskHash = sha256(readFileSync(op.targetPath, "utf-8"));
    if (onDiskHash !== expectedHash) continue;

    const manifestPath = toPosixPath(`${op.installDir}/${op.relativePath}`);
    if (!isManifestTrusted(manifestPath, existingManifest, registryIntegrity)) continue;

    for (const sourceName of sourceNames) {
      addOwnedFile(sourceName, op);
    }
  }
  return byItem;
}

function updateOwnedManifestEntries(
  cwd: string,
  writeResult: { results: Array<{ op: FileOp; result: "written" | "skipped" | "overwritten" }> },
  metadata: ManifestInstallMetadata,
): void {
  const filesByItem = buildOwnedFilesByItem(cwd, writeResult, metadata.integrationMode ?? "none");
  for (const name of filesByItem.keys()) {
    ctx.config.updateManifest(cwd, [name], undefined, { ...metadata, files: filesByItem.get(name) ?? [] });
  }
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
    const split = splitInstallNames(names);
    const keysVersionSpec = normalizeVersionSpec(opts.keysVersion, "@diffgazer/keys");
    const integrationMode = parseEnumOption(
      String(opts.integration ?? "ask").toLowerCase(),
      ["ask", "none", "copy", "@diffgazer/keys", "keys"] as const,
      "--integration",
    );
    const normalizedIntegrationMode = integrationMode === "keys" ? "@diffgazer/keys" : integrationMode;
    const resolved = ctx.registry.resolveDeps(split.ui);
    const selection = await resolveIntegrations(resolved, normalizedIntegrationMode, Boolean(opts.yes));
    logIntegrationMode(selection.mode);

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
