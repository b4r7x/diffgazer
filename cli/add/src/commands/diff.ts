import { createDiffCommand, ensureWithinDir, info } from "@diffgazer/registry/cli";
import pc from "picocolors";
import { ctx, type ManifestIntegrationMode, type ManifestItem } from "../context.js";
import {
  buildExpectedChunkContentsForItem,
  extractCssChunkContents,
  findCorruptedCssChunkHashes,
  readCssChunkHashBoundaries,
} from "../utils/css-chunks.js";
import {
  parseInstallName,
  tryGetNamespacedItem,
  validateInstalledOrRegistryNames,
} from "../utils/namespaces.js";
import { resolveInstallPath, resolveProjectPath } from "../utils/paths.js";
import {
  getInstallBaseForFilePath,
  getInstallDirForBase,
  prepareFileContentForIntegration,
  prepareKeysHookFileContent,
} from "../utils/registry.js";

interface DiffScanContext {
  manifest: Record<string, ManifestItem>;
  installedChunks: Map<string, string>;
  corruptedChunks: Set<string>;
}

function resolveIntegrationMode(
  manifest: Record<string, ManifestItem>,
  itemName: string,
  manifestPath: string,
): ManifestIntegrationMode | undefined {
  const entry = manifest[itemName];
  const fileEntry = entry?.files?.find((file) => file.path === manifestPath);
  return fileEntry?.integrationMode ?? entry?.integrationMode;
}

function missingChunkLocalPath(cwd: string, hash: string): string {
  const localPath = resolveProjectPath(cwd, `.diffgazer/.missing-css-chunk-${hash}`);
  ensureWithinDir(localPath, resolveProjectPath(cwd, ".diffgazer"));
  return localPath;
}

function buildCssChunkDriftFiles(
  itemName: string,
  cwd: string,
  scan: DiffScanContext,
  expectedChunks: ReadonlyMap<string, string>,
): Array<
  {
    itemName: string;
    relativePath: string;
    registryContent: string;
  } & ({ localPath: string } | { localContent: string })
> {
  const chunkHashes = scan.manifest[itemName]?.cssChunks ?? [];
  if (chunkHashes.length === 0) return [];

  return chunkHashes.map((hash) => {
    const registryContent = expectedChunks.get(hash) ?? "";
    const installed = scan.installedChunks.get(hash);
    if (scan.corruptedChunks.has(hash)) {
      return {
        itemName,
        relativePath: `styles.css~chunk-${hash}`,
        localContent: `Malformed managed CSS markers for chunk ${hash}. Restore exactly one matching start and end marker in the configured stylesheet.\n${installed ?? ""}`,
        registryContent,
      };
    }
    if (installed === undefined) {
      if (registryContent === "") {
        return {
          itemName,
          relativePath: `styles.css~chunk-${hash}`,
          localPath: missingChunkLocalPath(cwd, hash),
          registryContent,
        };
      }
      return {
        itemName,
        relativePath: `styles.css~chunk-${hash}`,
        localContent: "",
        registryContent,
      };
    }
    return {
      itemName,
      relativePath: `styles.css~chunk-${hash}`,
      localContent: installed,
      registryContent,
    };
  });
}

function buildManifestOnlyDriftFiles(
  itemName: string,
  cwd: string,
  manifest: Record<string, ManifestItem>,
  coveredLocalPaths: Set<string>,
) {
  const files = manifest[itemName]?.files ?? [];
  return files
    .filter((file) => !coveredLocalPaths.has(resolveProjectPath(cwd, file.path)))
    .map((file) => ({
      itemName,
      relativePath: file.retired ? `${file.path}~retired` : `${file.path}~installed`,
      localPath: resolveProjectPath(cwd, file.path),
      registryContent: "",
    }));
}

export const diffCommand = createDiffCommand({
  itemPlural: "items",
  requireConfig: (cwd) => ctx.items.requireConfig(cwd),
  createScanContext: ({ cwd, config }) => ({
    manifest: ctx.config.getManifestItems(cwd) ?? {},
    installedChunks: extractCssChunkContents(cwd, config),
    corruptedChunks: findCorruptedCssChunkHashes(readCssChunkHashBoundaries(cwd, config)),
  }),
  resolveDefaultNames: ({ scan }) => {
    return Object.keys(scan.manifest).filter((name) => name.includes("/"));
  },
  validateRequestedNames: (names, { cwd }) => {
    validateInstalledOrRegistryNames(cwd, names);
  },
  resolveFilesForName: ({ name, cwd, config, scan }) => {
    const parsed = parseInstallName(name);
    const itemName = `${parsed.namespace}/${parsed.name}`;
    const manifestEntry = scan.manifest[itemName];
    const item = tryGetNamespacedItem(name);

    if (!item) {
      info(`${itemName}: ${pc.yellow("upstream item unavailable in current registry")}`);
      const isCssOnlyEntry =
        manifestEntry?.files === undefined && (manifestEntry?.cssChunks?.length ?? 0) > 0;
      return [
        ...(isCssOnlyEntry
          ? []
          : buildManifestOnlyDriftFiles(itemName, cwd, scan.manifest, new Set())),
        ...buildCssChunkDriftFiles(itemName, cwd, scan, new Map()),
      ];
    }

    const isCssOnlyEntry =
      manifestEntry?.files === undefined && (manifestEntry?.cssChunks?.length ?? 0) > 0;
    const fileEntries = (
      isCssOnlyEntry ? [] : item.files.filter((file) => !file.path.endsWith(".css"))
    ).map((file) => {
      const relativePath = ctx.registry.relativePath(file);
      const installBase = getInstallBaseForFilePath(file.path);
      const installDir = getInstallDirForBase(installBase, config);
      const localPath = resolveInstallPath(cwd, installDir, relativePath);
      const manifestPath = `${installDir}/${relativePath}`.replace(/\\/g, "/");

      const registryContent =
        parsed.namespace === "keys"
          ? prepareKeysHookFileContent(file.content, config)
          : prepareFileContentForIntegration(
              file,
              item,
              config,
              resolveIntegrationMode(scan.manifest, itemName, manifestPath),
            );

      return {
        itemName,
        relativePath,
        localPath,
        registryContent,
      };
    });

    const coveredLocalPaths = new Set(fileEntries.map((file) => file.localPath));
    const expectedChunks =
      parsed.namespace === "ui"
        ? buildExpectedChunkContentsForItem(parsed.name)
        : new Map<string, string>();

    return [
      ...fileEntries,
      ...buildManifestOnlyDriftFiles(itemName, cwd, scan.manifest, coveredLocalPaths),
      ...buildCssChunkDriftFiles(itemName, cwd, scan, expectedChunks),
    ];
  },
  noInstalledMessage: "No installed Diffgazer items found.",
  upToDateMessage: "All Diffgazer items are up to date with registry.",
});
