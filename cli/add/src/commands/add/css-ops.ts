import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { ctx } from "../../context.js";
import type { ResolvedConfig } from "../../context.js";
import type { FileOp } from "@diffgazer/registry/cli";
import { resolveProjectPath, toPosixPath } from "../../utils/paths.js";

// Sentinel markers wrap each registry-emitted CSS chunk so re-runs detect
// installed chunks structurally rather than via substring inclusion.
//
// Substring matching breaks under whitespace edits, comment insertion, or
// reordering performed by the user or by formatter tools (Prettier, Stylelint).
// Hashing the chunk content (not the marker block) keeps the fingerprint
// stable when the user edits *around* the markers but never matches when the
// chunk content itself has drifted, in which case we re-append.
const MARKER_PREFIX = "/* dgadd:css ";
const MARKER_SUFFIX = " */";
const END_MARKER_PREFIX = "/* dgadd:css-end ";
const CHUNK_HASH_RE = /\/\* dgadd:css ([a-f0-9]{16}) \*\//g;
const HASH_LENGTH = 16;

function chunkHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, HASH_LENGTH);
}

function startMarker(hash: string): string {
  return `${MARKER_PREFIX}${hash}${MARKER_SUFFIX}`;
}

function endMarker(hash: string): string {
  return `${END_MARKER_PREFIX}${hash}${MARKER_SUFFIX}`;
}

function existingChunkHashes(existing: string): Set<string> {
  const hashes = new Set<string>();
  for (const match of existing.matchAll(CHUNK_HASH_RE)) {
    const hash = match[1];
    if (hash && existing.includes(endMarker(hash))) {
      hashes.add(hash);
    }
  }
  return hashes;
}

function wrapChunk(content: string): string {
  const hash = chunkHash(content);
  return `${startMarker(hash)}\n${content}\n${endMarker(hash)}`;
}

interface ItemCssChunk {
  itemName: string;
  hash: string;
  content: string;
}

function collectComponentCssChunks(resolved: string[]): ItemCssChunk[] {
  const seen = new Set<string>();
  const chunks: ItemCssChunk[] = [];

  for (const name of resolved) {
    const item = ctx.items.getOrThrow(name);
    if (item.type === "registry:theme") continue;
    for (const file of item.files) {
      if (!file.path.endsWith(".css") || seen.has(file.path)) continue;
      const content = file.content.trimEnd();
      if (!content) continue;

      seen.add(file.path);
      chunks.push({ itemName: `ui/${name}`, hash: chunkHash(content), content });
    }
  }

  return chunks;
}

function appendCssChunks(existing: string, wrappedChunks: string[]): string {
  const prefix = existing.length === 0
    ? ""
    : existing.endsWith("\n")
      ? "\n"
      : "\n\n";
  return `${existing}${prefix}${wrappedChunks.join("\n\n")}\n`;
}

export interface ComponentCssPlan {
  fileOp: FileOp | null;
  chunksByItem: Map<string, string[]>;
}

export function planComponentCss(
  resolved: string[],
  cwd: string,
  config: ResolvedConfig,
): ComponentCssPlan {
  const chunksByItem = new Map<string, string[]>();
  if (!config.tailwind?.css) return { fileOp: null, chunksByItem };

  const chunks = collectComponentCssChunks(resolved);
  if (chunks.length === 0) return { fileOp: null, chunksByItem };

  for (const chunk of chunks) {
    const existing = chunksByItem.get(chunk.itemName) ?? [];
    if (!existing.includes(chunk.hash)) existing.push(chunk.hash);
    chunksByItem.set(chunk.itemName, existing);
  }

  const cssPath = toPosixPath(config.tailwind.css);
  const targetPath = resolveProjectPath(cwd, cssPath);
  const existing = existsSync(targetPath) ? readFileSync(targetPath, "utf-8") : "";
  const installed = existingChunkHashes(existing);
  const missing = chunks.filter((chunk) => !installed.has(chunk.hash));
  if (missing.length === 0) return { fileOp: null, chunksByItem };

  return {
    fileOp: {
      targetPath,
      content: appendCssChunks(existing, missing.map((c) => wrapChunk(c.content))),
      relativePath: basename(cssPath),
      installDir: toPosixPath(dirname(cssPath)),
      overwrite: true,
    },
    chunksByItem,
  };
}

interface CssChunkSlice {
  hash: string;
  start: number;
  end: number;
}

function findChunkSlices(content: string): CssChunkSlice[] {
  const slices: CssChunkSlice[] = [];
  for (const match of content.matchAll(CHUNK_HASH_RE)) {
    const hash = match[1];
    const start = match.index;
    if (!hash || start === undefined) continue;
    const end = content.indexOf(endMarker(hash), start);
    if (end === -1) continue;
    slices.push({ hash, start, end: end + endMarker(hash).length });
  }
  return slices;
}

function trimSurroundingBlanks(content: string, start: number, end: number): { start: number; end: number } {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedEnd < content.length && content[trimmedEnd] === "\n") trimmedEnd++;
  while (trimmedStart > 0 && content[trimmedStart - 1] === "\n") trimmedStart--;
  return { start: trimmedStart, end: trimmedEnd };
}

export interface CssRemovalResult {
  fileOp: FileOp | null;
  removedHashes: string[];
}

export function removeCssChunks(
  hashesToRemove: Set<string>,
  cwd: string,
  config: ResolvedConfig,
): CssRemovalResult {
  if (!config.tailwind?.css || hashesToRemove.size === 0) {
    return { fileOp: null, removedHashes: [] };
  }

  const cssPath = toPosixPath(config.tailwind.css);
  const targetPath = resolveProjectPath(cwd, cssPath);
  if (!existsSync(targetPath)) return { fileOp: null, removedHashes: [] };

  const content = readFileSync(targetPath, "utf-8");
  const slices = findChunkSlices(content).filter((slice) => hashesToRemove.has(slice.hash));
  if (slices.length === 0) return { fileOp: null, removedHashes: [] };

  slices.sort((a, b) => b.start - a.start);
  let updated = content;
  for (const slice of slices) {
    const { start, end } = trimSurroundingBlanks(updated, slice.start, slice.end);
    updated = `${updated.slice(0, start)}${updated.slice(end)}`;
    if (start > 0 && start < updated.length) updated = `${updated.slice(0, start)}\n${updated.slice(start)}`;
  }

  return {
    fileOp: {
      targetPath,
      content: updated,
      relativePath: basename(cssPath),
      installDir: toPosixPath(dirname(cssPath)),
      overwrite: true,
    },
    removedHashes: slices.map((s) => s.hash),
  };
}

export function readInstalledCssChunkHashes(cwd: string, config: ResolvedConfig): Set<string> {
  if (!config.tailwind?.css) return new Set();
  const targetPath = resolveProjectPath(cwd, toPosixPath(config.tailwind.css));
  if (!existsSync(targetPath)) return new Set();
  return existingChunkHashes(readFileSync(targetPath, "utf-8"));
}

// Returns a hash -> chunk content map for every dgadd-managed chunk currently
// in the project's styles.css. The content is the body between the start and
// end markers, stripped of the single bracketing newlines that wrapChunk
// inserts, so it matches what chunkHash was computed on at install time.
export function extractCssChunkContents(cwd: string, config: ResolvedConfig): Map<string, string> {
  const contents = new Map<string, string>();
  if (!config.tailwind?.css) return contents;
  const targetPath = resolveProjectPath(cwd, toPosixPath(config.tailwind.css));
  if (!existsSync(targetPath)) return contents;

  const file = readFileSync(targetPath, "utf-8");
  for (const slice of findChunkSlices(file)) {
    const bodyStart = slice.start + startMarker(slice.hash).length;
    const bodyEnd = slice.end - endMarker(slice.hash).length;
    let body = file.slice(bodyStart, bodyEnd);
    if (body.startsWith("\n")) body = body.slice(1);
    if (body.endsWith("\n")) body = body.slice(0, -1);
    contents.set(slice.hash, body);
  }
  return contents;
}

// For a given registry item, returns its expected chunk hash -> trimmed CSS
// content map. Mirrors collectComponentCssChunks' per-file computation so the
// hashes match what add records in the manifest.
export function buildExpectedChunkContentsForItem(itemName: string): Map<string, string> {
  const expected = new Map<string, string>();
  const item = ctx.items.getOrThrow(itemName);
  if (item.type === "registry:theme") return expected;
  for (const file of item.files) {
    if (!file.path.endsWith(".css")) continue;
    const content = file.content.trimEnd();
    if (!content) continue;
    expected.set(chunkHash(content), content);
  }
  return expected;
}
