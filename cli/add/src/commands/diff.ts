import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDiffCommand } from "@diffgazer/registry/cli";
import { ctx, type DiffgazerAddConfig, type ResolvedConfig } from "../context.js";
import {
  prepareFileContentForIntegration,
  getInstallBaseForFilePath,
  getInstallDirForBase,
} from "../utils/registry.js";
import {
  getNamespacedItem,
  parseInstallName,
  validateAnyInstallableName,
} from "../utils/namespaces.js";
import { resolveInstallPath } from "../utils/paths.js";
import {
  buildExpectedChunkContentsForItem,
  extractCssChunkContents,
} from "./add/css-ops.js";

type InstalledComponents = NonNullable<DiffgazerAddConfig["installedComponents"]>;
type IntegrationMode = NonNullable<InstalledComponents[string]>["integrationMode"];

function resolveIntegrationMode(cwd: string, itemName: string, manifestPath: string): IntegrationMode {
  const manifest = ctx.config.getManifestItems(cwd) as InstalledComponents | undefined;
  const entry = manifest?.[itemName];
  const fileEntry = entry?.files?.find((file) => file.path === manifestPath);
  return fileEntry?.integrationMode ?? entry?.integrationMode;
}

// Materialize each extracted chunk to a tmp file so the diff workflow's
// readFileSync(localPath) sees the chunk content rather than the full
// styles.css. Unique dir via mkdtempSync, removed by cleanup handlers
// registered the first time a scratch file is requested. A bare
// `process.on("exit")` handler covers normal completion and the `process.exit`
// the CLI error handler performs, but never runs on default SIGINT/SIGTERM
// disposition — so those signals get their own handlers that clean up and
// re-exit with the conventional code.
let chunkScratchDir: string | null = null;

function chunkScratchPath(itemName: string, hash: string): string {
  if (!chunkScratchDir) {
    chunkScratchDir = mkdtempSync(join(tmpdir(), "dgadd-diff-"));
    installScratchCleanupHandlers();
  }
  const safeName = itemName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(chunkScratchDir, `${safeName}-${hash}.css`);
}

function cleanupChunkScratchDir(): void {
  if (!chunkScratchDir) return;
  try {
    rmSync(chunkScratchDir, { recursive: true, force: true });
  } catch {
    // Non-critical: a failed rm only leaves an OS-tmp dir the OS reclaims.
  }
  chunkScratchDir = null;
}

const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const;

function installScratchCleanupHandlers(): void {
  process.once("exit", cleanupChunkScratchDir);
  for (const signal of Object.keys(SIGNAL_EXIT_CODES) as Array<keyof typeof SIGNAL_EXIT_CODES>) {
    process.once(signal, () => {
      cleanupChunkScratchDir();
      process.exit(SIGNAL_EXIT_CODES[signal]);
    });
  }
}

interface ChunkDriftFile {
  itemName: string;
  relativePath: string;
  localPath: string;
  registryContent: string;
}

function buildCssChunkDriftFiles(
  itemName: string,
  cwd: string,
  config: ResolvedConfig,
): ChunkDriftFile[] {
  const manifest = ctx.config.getManifestItems(cwd) as InstalledComponents | undefined;
  const chunkHashes = manifest?.[itemName]?.cssChunks ?? [];
  if (chunkHashes.length === 0) return [];

  const installedChunks = extractCssChunkContents(cwd, config);
  const parsed = parseInstallName(itemName);
  const expectedChunks = parsed.namespace === "ui"
    ? buildExpectedChunkContentsForItem(parsed.name)
    : new Map<string, string>();

  return chunkHashes.map((hash) => {
    const localContent = installedChunks.get(hash) ?? "";
    const registryContent = expectedChunks.get(hash) ?? "";
    const localPath = chunkScratchPath(itemName, hash);
    writeFileSync(localPath, localContent);
    return {
      itemName,
      relativePath: `styles.css~chunk-${hash}`,
      localPath,
      registryContent,
    };
  });
}

export const diffCommand = createDiffCommand({
  itemPlural: "items",
  requireConfig: ctx.items.requireConfig,
  resolveDefaultNames: ({ cwd }) => {
    return Object.keys(ctx.config.getManifestItems(cwd) ?? {})
      .filter((name) => name.includes("/"));
  },
  validateRequestedNames: validateAnyInstallableName,
  resolveFilesForName: ({ name, cwd, config }) => {
    const parsed = parseInstallName(name);
    const item = getNamespacedItem(name);
    const itemName = `${parsed.namespace}/${parsed.name}`;
    const fileEntries = item.files.map((file) => {
      const relativePath = ctx.registry.relativePath(file);
      const installBase = getInstallBaseForFilePath(file.path);
      const installDir = getInstallDirForBase(installBase, config);
      const localPath = resolveInstallPath(cwd, installDir, relativePath);
      const manifestPath = `${installDir}/${relativePath}`.replace(/\\/g, "/");

      return {
        itemName,
        relativePath,
        localPath,
        registryContent: prepareFileContentForIntegration(
          file,
          item,
          config,
          resolveIntegrationMode(cwd, itemName, manifestPath),
        ),
      };
    });

    return [...fileEntries, ...buildCssChunkDriftFiles(itemName, cwd, config)];
  },
  noInstalledMessage: "No installed Diffgazer items found.",
  upToDateMessage: "All Diffgazer items are up to date with registry.",
});
