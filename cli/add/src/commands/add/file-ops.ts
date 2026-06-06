import type { FileOp } from "@diffgazer/registry/cli";
import type { RegistryItem, ResolvedConfig } from "../../context.js";
import { ctx } from "../../context.js";
import { resolveKeysCopyHookFiles } from "../../utils/keys-copy-bundle.js";
import { assertInsideProject, resolveInstallPath } from "../../utils/paths.js";
import {
  getInstallBaseForFilePath,
  getInstallDirForBase,
  prepareFileContentForIntegration,
} from "../../utils/registry.js";
import { rewriteRelativeJsExtensionsForCopy } from "../../utils/transform.js";
import type { ResolvedIntegrationSelection } from "./integration.js";

export type OwnedFileOp = FileOp & { sourceNames?: string[] };

export function isOwnedFileOp(op: FileOp): op is OwnedFileOp {
  return "sourceNames" in op;
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

export function buildComponentFileOps(
  resolved: string[],
  cwd: string,
  config: ResolvedConfig,
  integrationMode: ResolvedIntegrationSelection["mode"],
): FileOp[] {
  assertInsideProject(cwd, config.componentsFsPath);
  assertInsideProject(cwd, config.hooksFsPath);
  assertInsideProject(cwd, config.libFsPath);

  return resolved.flatMap((name) => {
    const item = ctx.items.getOrThrow(name);
    return item.files
      .filter((file) => !file.path.endsWith(".css"))
      .map((file) => buildFileOp(file, item, config, cwd, integrationMode));
  });
}

// Multiple keys hooks can resolve to the same installed file (shared helpers
// under hooks/utils/*). Merge those into one owned file op: identical content
// collapses while every requesting hook is recorded as a co-owner, and
// divergent content for the same target is a generator bug worth surfacing.
function mergeKeysHookFileOps(
  resolvedFiles: Array<{ hook: string; relativePath: string; content: string }>,
  cwd: string,
  hooksFsPath: string,
): OwnedFileOp[] {
  const byTargetPath = new Map<string, OwnedFileOp>();
  for (const file of resolvedFiles) {
    const sourceName = `keys/${file.hook}`;
    const targetPath = resolveInstallPath(cwd, hooksFsPath, file.relativePath);
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

    byTargetPath.set(targetPath, {
      targetPath,
      content,
      relativePath: file.relativePath,
      installDir: hooksFsPath,
      sourceName,
      sourceNames: [sourceName],
    });
  }

  return [...byTargetPath.values()];
}

export function buildKeysFileOps(
  neededKeysHooks: string[],
  cwd: string,
  config: ResolvedConfig,
): FileOp[] {
  assertInsideProject(cwd, config.hooksFsPath);
  const resolvedHooks = neededKeysHooks.map((hook) => resolveKeysCopyHookFiles([hook]));
  const missingHooks = resolvedHooks.flatMap((resolved) => resolved.missingHooks);

  if (missingHooks.length > 0) {
    throw new Error(
      `Missing bundled keys hook(s): ${missingHooks.join(", ")}\n`
      + "Copy mode requires bundled keys hook sources. Rebuild dgadd and try again.",
    );
  }

  const resolvedFiles = resolvedHooks.flatMap((resolved) => resolved.files);
  return mergeKeysHookFileOps(resolvedFiles, cwd, config.hooksFsPath);
}
