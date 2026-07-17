import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DOCS_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const CACHE_VERSION = 1;
const BROTLI_QUALITY = 6;
const SOURCE_ARCHIVE_PATH = /^[a-z0-9-]+\/(?:components|hooks)\/[a-z0-9-]+\.source\.json$/;
const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);

function collectSourceArchives(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return collectSourceArchives(path);
    if (entry.isFile() && entry.name.endsWith(".source.json")) return [path];
    if (entry.name.endsWith(".source.json")) {
      throw new Error(`Source archive must be a regular file: ${path}`);
    }
    return [];
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readCache(cachePath) {
  if (!existsSync(cachePath)) return {};
  try {
    const cache = JSON.parse(readFileSync(cachePath, "utf8"));
    if (cache.version !== CACHE_VERSION || !cache.files || typeof cache.files !== "object") {
      return {};
    }
    return cache.files;
  } catch {
    return {};
  }
}

function sidecarMatches(path, metadata) {
  if (!metadata || !existsSync(path) || statSync(path).size !== metadata.size) return false;
  return sha256(readFileSync(path)) === metadata.sha256;
}

function sidecarMetadata(path) {
  const content = readFileSync(path);
  return { size: content.length, sha256: sha256(content) };
}

function writeAtomically(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, content);
  renameSync(temporaryPath, path);
}

async function runBounded(items, concurrency, worker) {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

export async function precompressSourceData(options = {}) {
  const sourceRoot = resolve(options.sourceRoot ?? resolve(DOCS_ROOT, "public/source-data"));
  const cachePath = resolve(
    options.cachePath ?? resolve(DOCS_ROOT, ".cache/source-data-compression.json"),
  );
  const concurrency = options.concurrency ?? 2;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`Compression concurrency must be a positive integer: ${concurrency}`);
  }

  const archives = collectSourceArchives(sourceRoot).sort();
  if (archives.length === 0) {
    throw new Error(`No source archives found in ${sourceRoot}`);
  }

  const previousCache = readCache(cachePath);
  const nextCacheEntries = new Map();
  let createdSidecars = 0;
  let cachedFiles = 0;

  await runBounded(archives, concurrency, async (archivePath) => {
    const archiveName = relative(sourceRoot, archivePath).split(sep).join("/");
    if (!SOURCE_ARCHIVE_PATH.test(archiveName)) {
      throw new Error(`Unsafe source archive path: ${archiveName}`);
    }

    const source = readFileSync(archivePath);
    const sourceSha256 = sha256(source);
    const previous = previousCache[archiveName];
    const cacheMatches = previous?.sourceSha256 === sourceSha256;
    const gzipPath = `${archivePath}.gz`;
    const brotliPath = `${archivePath}.br`;
    const gzipCurrent = cacheMatches && sidecarMatches(gzipPath, previous.gzip);
    const brotliCurrent = cacheMatches && sidecarMatches(brotliPath, previous.brotli);

    if (!gzipCurrent) {
      writeAtomically(gzipPath, await gzipAsync(source));
      createdSidecars += 1;
    }
    if (!brotliCurrent) {
      writeAtomically(
        brotliPath,
        await brotliCompressAsync(source, {
          params: {
            [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
            [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
            [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
          },
        }),
      );
      createdSidecars += 1;
    }
    if (gzipCurrent && brotliCurrent) cachedFiles += 1;

    nextCacheEntries.set(archiveName, {
      sourceSha256,
      gzip: sidecarMetadata(gzipPath),
      brotli: sidecarMetadata(brotliPath),
    });
  });

  const nextCache = Object.fromEntries(
    [...nextCacheEntries.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
  writeAtomically(
    cachePath,
    `${JSON.stringify({ version: CACHE_VERSION, files: nextCache }, null, 2)}\n`,
  );
  return { archives: archives.length, createdSidecars, cachedFiles };
}

if (process.argv[1] === SCRIPT_PATH) {
  const result = await precompressSourceData();
  console.log(
    `[docs-source] ${result.archives} archives, ${result.createdSidecars} sidecars written, ${result.cachedFiles} cache hits`,
  );
}
