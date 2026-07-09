import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import type { FileOp } from "@diffgazer/registry/cli";
import { REGISTRY_ITEM_TYPE } from "@diffgazer/registry/schemas";
import type { ResolvedConfig } from "../context.js";
import { ctx } from "../context.js";
import { resolveProjectPath, toPosixPath } from "./paths.js";

// Sentinel markers wrap each chunk so re-runs detect installed chunks
// structurally, not by substring (which breaks under whitespace/comment/reorder
// edits from users or formatters). The hash is over the chunk content, not the
// marker block, so it stays stable when the user edits around the markers.
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
    if (item.type === REGISTRY_ITEM_TYPE.theme) continue;
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
  let prefix = "\n\n";
  if (existing.length === 0) {
    prefix = "";
  } else if (existing.endsWith("\n")) {
    prefix = "\n";
  }
  return `${existing}${prefix}${wrappedChunks.join("\n\n")}\n`;
}

export interface ComponentCssPlan {
  fileOp: FileOp | null;
  chunksByItem: Map<string, string[]>;
}

// A present chunk whose on-disk body drifted from its marker hash; rewritten to
// registry content only under --overwrite.
interface DriftedChunkRepair {
  content: string;
  slice: CssChunkSlice;
}

function collectDriftedChunkRepairs(
  chunks: ItemCssChunk[],
  installed: Set<string>,
  slices: CssChunkSlice[],
  existing: string,
): DriftedChunkRepair[] {
  const slicesByHash = new Map(slices.map((slice) => [slice.hash, slice]));
  const repairs: DriftedChunkRepair[] = [];
  for (const chunk of chunks) {
    if (!installed.has(chunk.hash)) continue;
    const slice = slicesByHash.get(chunk.hash);
    if (!slice || isChunkPristine(existing, slice)) continue;
    repairs.push({ content: chunk.content, slice });
  }
  return repairs;
}

export function planComponentCss(
  resolved: string[],
  cwd: string,
  config: ResolvedConfig,
  overwrite = false,
): ComponentCssPlan {
  const chunksByItem = new Map<string, string[]>();
  const chunks = collectComponentCssChunks(resolved);
  if (chunks.length === 0) return { fileOp: null, chunksByItem };

  if (!config.tailwind?.css) {
    const itemList = [...new Set(chunks.map((chunk) => chunk.itemName))].join(", ");
    throw new Error(
      `Cannot install CSS for ${itemList} because components.json has no tailwind.css path. Run dgadd init or add tailwind.css to components.json before installing CSS-bearing items.`,
    );
  }

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
  const repairs = overwrite
    ? collectDriftedChunkRepairs(chunks, installed, findChunkSlices(existing), existing)
    : [];
  if (missing.length === 0 && repairs.length === 0) return { fileOp: null, chunksByItem };

  let updated = existing;
  for (const { content, slice } of [...repairs].sort((a, b) => b.slice.start - a.slice.start)) {
    updated = `${updated.slice(0, slice.start)}${wrapChunk(content)}${updated.slice(slice.end)}`;
  }
  if (missing.length > 0) {
    updated = appendCssChunks(
      updated,
      missing.map((c) => wrapChunk(c.content)),
    );
  }

  return {
    fileOp: {
      targetPath,
      content: updated,
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

// Body between the markers, stripped of the bracketing newlines wrapChunk
// inserts, so it matches what chunkHash was computed on at install time.
function extractChunkBody(content: string, slice: CssChunkSlice): string {
  const bodyStart = slice.start + startMarker(slice.hash).length;
  const bodyEnd = slice.end - endMarker(slice.hash).length;
  let body = content.slice(bodyStart, bodyEnd);
  if (body.startsWith("\n")) body = body.slice(1);
  if (body.endsWith("\n")) body = body.slice(0, -1);
  return body;
}

// Pristine when the current body still hashes to the value in its marker; a
// drifted body means an edit inside the region that removal would discard.
function isChunkPristine(content: string, slice: CssChunkSlice): boolean {
  return chunkHash(extractChunkBody(content, slice)) === slice.hash;
}

function trimSurroundingBlanks(
  content: string,
  start: number,
  end: number,
): { start: number; end: number } {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedEnd < content.length && content[trimmedEnd] === "\n") trimmedEnd++;
  while (trimmedStart > 0 && content[trimmedStart - 1] === "\n") trimmedStart--;
  return { start: trimmedStart, end: trimmedEnd };
}

export interface CssRemovalResult {
  fileOp: FileOp | null;
  removedHashes: string[];
  // Requested chunks whose body drifted; preserved (never in `fileOp`) unless
  // `force`, so an edit inside a managed chunk is not silently deleted.
  modifiedHashes: string[];
}

export function removeCssChunks(
  hashesToRemove: Set<string>,
  cwd: string,
  config: ResolvedConfig,
  force = false,
): CssRemovalResult {
  if (!config.tailwind?.css || hashesToRemove.size === 0) {
    return { fileOp: null, removedHashes: [], modifiedHashes: [] };
  }

  const cssPath = toPosixPath(config.tailwind.css);
  const targetPath = resolveProjectPath(cwd, cssPath);
  if (!existsSync(targetPath)) return { fileOp: null, removedHashes: [], modifiedHashes: [] };

  const content = readFileSync(targetPath, "utf-8");
  const candidates = findChunkSlices(content).filter((slice) => hashesToRemove.has(slice.hash));

  const slices: CssChunkSlice[] = [];
  const modifiedHashes: string[] = [];
  for (const slice of candidates) {
    if (force || isChunkPristine(content, slice)) {
      slices.push(slice);
    } else {
      modifiedHashes.push(slice.hash);
    }
  }
  if (slices.length === 0) return { fileOp: null, removedHashes: [], modifiedHashes };

  slices.sort((a, b) => b.start - a.start);
  let updated = content;
  for (const slice of slices) {
    const { start, end } = trimSurroundingBlanks(updated, slice.start, slice.end);
    updated = `${updated.slice(0, start)}${updated.slice(end)}`;
    if (start > 0 && start < updated.length)
      updated = `${updated.slice(0, start)}\n${updated.slice(start)}`;
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
    modifiedHashes,
  };
}

export function readInstalledCssChunkHashes(cwd: string, config: ResolvedConfig): Set<string> {
  if (!config.tailwind?.css) return new Set();
  const targetPath = resolveProjectPath(cwd, toPosixPath(config.tailwind.css));
  if (!existsSync(targetPath)) return new Set();
  return existingChunkHashes(readFileSync(targetPath, "utf-8"));
}

// hash -> marker-body content for every dgadd-managed chunk in styles.css.
export function extractCssChunkContents(cwd: string, config: ResolvedConfig): Map<string, string> {
  const contents = new Map<string, string>();
  if (!config.tailwind?.css) return contents;
  const targetPath = resolveProjectPath(cwd, toPosixPath(config.tailwind.css));
  if (!existsSync(targetPath)) return contents;

  const file = readFileSync(targetPath, "utf-8");
  for (const slice of findChunkSlices(file)) {
    contents.set(slice.hash, extractChunkBody(file, slice));
  }
  return contents;
}

// Expected chunk hash -> trimmed CSS map for an item. Mirrors
// collectComponentCssChunks so the hashes match what add records in the manifest.
export function buildExpectedChunkContentsForItem(itemName: string): Map<string, string> {
  const expected = new Map<string, string>();
  const item = ctx.items.getOrThrow(itemName);
  if (item.type === REGISTRY_ITEM_TYPE.theme) return expected;
  for (const file of item.files) {
    if (!file.path.endsWith(".css")) continue;
    const content = file.content.trimEnd();
    if (!content) continue;
    expected.set(chunkHash(content), content);
  }
  return expected;
}
