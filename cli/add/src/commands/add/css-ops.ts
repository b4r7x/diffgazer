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

function chunkHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function startMarker(hash: string): string {
  return `${MARKER_PREFIX}${hash}${MARKER_SUFFIX}`;
}

function endMarker(hash: string): string {
  return `${END_MARKER_PREFIX}${hash}${MARKER_SUFFIX}`;
}

function existingChunkHashes(existing: string): Set<string> {
  const hashes = new Set<string>();
  const startPattern = /\/\* dgadd:css ([a-f0-9]{16}) \*\//g;
  for (const match of existing.matchAll(startPattern)) {
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

function appendCssChunks(existing: string, wrappedChunks: string[]): string {
  const prefix = existing.length === 0
    ? ""
    : existing.endsWith("\n")
      ? "\n"
      : "\n\n";
  return `${existing}${prefix}${wrappedChunks.join("\n\n")}\n`;
}

export function buildComponentCssFileOps(
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
  const installed = existingChunkHashes(existing);
  const missing = chunks.filter((chunk) => !installed.has(chunkHash(chunk)));
  if (missing.length === 0) return [];

  return [{
    targetPath,
    content: appendCssChunks(existing, missing.map(wrapChunk)),
    relativePath: basename(cssPath),
    installDir: toPosixPath(dirname(cssPath)),
    overwrite: true,
  }];
}
