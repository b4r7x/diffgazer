import type { FileOp } from "@diffgazer/registry/cli";
import type { RegistryItem, ResolvedConfig } from "../../context.js";
import { ctx } from "../../context.js";
import { resolveKeysCopyHookFiles } from "../../utils/keys-copy-bundle.js";
import { assertInsideProject, resolveInstallPath } from "../../utils/paths.js";
import {
  getInstallBaseForFilePath,
  getInstallDirForBase,
  prepareFileContentForIntegration,
  prepareKeysHookFileContent,
} from "../../utils/registry.js";
import type { ResolvedIntegrationSelection } from "./integration.js";

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
      `Missing bundled keys hook(s): ${missingHooks.join(", ")}\n` +
        "Copy mode requires bundled keys hook sources. Rebuild dgadd and try again.",
    );
  }

  return resolvedHooks.flatMap((resolved) =>
    resolved.files.map((file) => ({
      targetPath: resolveInstallPath(cwd, config.hooksFsPath, file.relativePath),
      content: prepareKeysHookFileContent(file.content, config),
      relativePath: file.relativePath,
      installDir: config.hooksFsPath,
      sourceName: `keys/${file.hook}`,
    })),
  );
}
