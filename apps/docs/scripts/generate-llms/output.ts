import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { getPreRenderPages, type PreRenderPage, resolveOrigin } from "../generate-sitemap.ts";
import { DOCS_ROOT } from "./artifacts.ts";
import { buildLlmsTxt, type PageMarkdown, pageMarkdownFromSource } from "./markdown.ts";

export const LLMS_MANIFEST_FILE = ".llms-markdown-manifest.json";

const llmsManifestSchema = z
  .object({
    version: z.literal(1),
    markdown: z.array(z.string()),
  })
  .strict();

function validateOwnedMarkdownPath(path: string): string {
  const segments = path.split("/");
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    isAbsolute(path) ||
    path.includes("\\") ||
    !path.endsWith(".md") ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..") ||
    posix.normalize(path) !== path
  ) {
    throw new Error(`Invalid llms markdown manifest path: ${path}`);
  }
  return path;
}

function markdownRelativePath(routePath: string): string {
  if (!routePath.startsWith("/")) {
    throw new Error(`Invalid documentation route path: ${routePath}`);
  }
  return validateOwnedMarkdownPath(`${routePath.slice(1)}.md`);
}

function markdownOutputPath(outDir: string, path: string): string {
  return join(outDir, markdownRelativePath(path));
}

function readOwnedMarkdownPaths(outDir: string): string[] {
  const manifestPath = join(outDir, LLMS_MANIFEST_FILE);
  if (!existsSync(manifestPath)) return [];
  const parsed = llmsManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf-8")));
  return [...new Set(parsed.markdown.map(validateOwnedMarkdownPath))].sort();
}

function assertOwnedPathsStayWithinOutput(outDir: string, paths: string[]): void {
  const outputPath = resolve(outDir);
  const outputRoot = existsSync(outputPath) ? realpathSync(outputPath) : outputPath;
  for (const path of paths) {
    let current = outputPath;
    for (const segment of path.split("/").slice(0, -1)) {
      current = join(current, segment);
      if (!existsSync(current)) break;
      const canonical = realpathSync(current);
      const relativePath = relative(outputRoot, canonical);
      if (
        relativePath === ".." ||
        relativePath.startsWith(`..${sep}`) ||
        isAbsolute(relativePath)
      ) {
        throw new Error(`Llms markdown path escapes the output directory: ${path}`);
      }
    }
  }
}

function atomicWriteFile(target: string, content: string | Uint8Array): void {
  mkdirSync(dirname(target), { recursive: true });
  const tempPath = `${target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tempPath, content, { flag: "wx" });
    renameSync(tempPath, target);
  } finally {
    rmSync(tempPath, { force: true });
  }
}

function isFileSystemError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function pruneEmptyOwnedDirectories(outDir: string, paths: string[]): void {
  const root = resolve(outDir);
  const directories = [...new Set(paths.map((path) => dirname(join(root, path))))].sort(
    (a, b) => b.length - a.length,
  );
  for (const directory of directories) {
    let current = directory;
    let relativeDirectory = relative(root, current);
    while (
      relativeDirectory.length > 0 &&
      relativeDirectory !== ".." &&
      !relativeDirectory.startsWith(`..${sep}`) &&
      !isAbsolute(relativeDirectory)
    ) {
      try {
        rmdirSync(current);
      } catch (error) {
        if (isFileSystemError(error, "ENOENT")) {
          current = dirname(current);
          relativeDirectory = relative(root, current);
          continue;
        }
        if (isFileSystemError(error, "ENOTDIR") || isFileSystemError(error, "ENOTEMPTY")) break;
        throw error;
      }
      current = dirname(current);
      relativeDirectory = relative(root, current);
    }
  }
}

interface FileSnapshot {
  path: string;
  content: Buffer | null;
}

function snapshotFiles(paths: string[]): FileSnapshot[] {
  return [...new Set(paths)].map((path) => ({
    path,
    content: existsSync(path) ? readFileSync(path) : null,
  }));
}

function restoreFiles(snapshots: FileSnapshot[], outDir: string, ownedPaths: string[]): void {
  for (const snapshot of snapshots.toReversed()) {
    if (snapshot.content === null) {
      if (existsSync(snapshot.path)) rmSync(snapshot.path, { force: true });
    } else {
      atomicWriteFile(snapshot.path, snapshot.content);
    }
  }
  pruneEmptyOwnedDirectories(outDir, ownedPaths);
}

export function writeLlmsFiles(
  outDir = resolve(DOCS_ROOT, ".output/public"),
  options: { origin?: string; pages?: PreRenderPage[] } = {},
): { count: number; llmsTarget: string; llmsFullTarget: string; markdownTargets: string[] } {
  const origin = options.origin ?? resolveOrigin();
  const pages = (options.pages ?? getPreRenderPages())
    .map(pageMarkdownFromSource)
    .filter((page): page is PageMarkdown => page !== null)
    .sort((a, b) => a.path.localeCompare(b.path));
  const markdownFiles = pages.map((page) => ({
    relativePath: markdownRelativePath(page.path),
    target: markdownOutputPath(outDir, page.path),
    content: page.markdown,
  }));
  const nextOwnedPaths = markdownFiles.map((file) => file.relativePath);
  if (new Set(nextOwnedPaths).size !== nextOwnedPaths.length) {
    throw new Error("Duplicate llms markdown output path");
  }
  const previousOwnedPaths = readOwnedMarkdownPaths(outDir);
  assertOwnedPathsStayWithinOutput(outDir, [...previousOwnedPaths, ...nextOwnedPaths]);
  const nextOwnedSet = new Set(nextOwnedPaths);
  const staleOwnedPaths = previousOwnedPaths.filter((path) => !nextOwnedSet.has(path));
  const llmsTarget = join(outDir, "llms.txt");
  const llmsFullTarget = join(outDir, "llms-full.txt");
  const manifestTarget = join(outDir, LLMS_MANIFEST_FILE);
  const llmsContent = buildLlmsTxt(pages, origin);
  const llmsFullContent = `${pages.map((page) => page.markdown.trim()).join("\n\n---\n\n")}\n`;
  const manifestContent = `${JSON.stringify(
    { version: 1, markdown: [...nextOwnedPaths].sort() },
    null,
    2,
  )}\n`;
  const staleTargets = staleOwnedPaths.map((path) => join(outDir, path));
  const snapshots = snapshotFiles([
    ...markdownFiles.map((file) => file.target),
    ...staleTargets,
    llmsTarget,
    llmsFullTarget,
    manifestTarget,
  ]);

  try {
    for (const file of markdownFiles) {
      atomicWriteFile(file.target, file.content);
    }
    atomicWriteFile(llmsTarget, llmsContent);
    atomicWriteFile(llmsFullTarget, llmsFullContent);
    for (const staleTarget of staleTargets) {
      rmSync(staleTarget, { force: true });
    }
    pruneEmptyOwnedDirectories(outDir, staleOwnedPaths);
    atomicWriteFile(manifestTarget, manifestContent);
  } catch (error) {
    restoreFiles(snapshots, outDir, nextOwnedPaths);
    throw error;
  }

  return {
    count: pages.length,
    llmsTarget,
    llmsFullTarget,
    markdownTargets: markdownFiles.map((file) => file.target),
  };
}
