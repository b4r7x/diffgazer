import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { precompressSourceData } from "./precompress-source-data.mjs";

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "dg-source-compression-"));
  const sourceRoot = join(root, "public/source-data");
  const archivePath = join(sourceRoot, "ui/components/button.source.json");
  const cachePath = join(root, ".cache/source-data-compression.json");
  const source = Buffer.from('{"source":{"@ui/button.tsx":{"raw":"button","highlighted":[]}}}\n');
  tempRoots.push(root);
  mkdirSync(dirname(archivePath), { recursive: true });
  writeFileSync(archivePath, source);
  return { archivePath, cachePath, source, sourceRoot };
}

describe("precompressSourceData", () => {
  it("creates deterministic gzip and brotli siblings and reuses complete cache entries", async () => {
    const fixture = makeFixture();

    await expect(precompressSourceData(fixture)).resolves.toEqual({
      archives: 1,
      createdSidecars: 2,
      cachedFiles: 0,
    });
    const gzip = readFileSync(`${fixture.archivePath}.gz`);
    const brotli = readFileSync(`${fixture.archivePath}.br`);
    expect(gunzipSync(gzip)).toEqual(fixture.source);
    expect(brotliDecompressSync(brotli)).toEqual(fixture.source);

    await expect(precompressSourceData(fixture)).resolves.toEqual({
      archives: 1,
      createdSidecars: 0,
      cachedFiles: 1,
    });
    expect(readFileSync(`${fixture.archivePath}.gz`)).toEqual(gzip);
    expect(readFileSync(`${fixture.archivePath}.br`)).toEqual(brotli);
  });

  it("repairs a partial sidecar set and invalidates both encodings when source changes", async () => {
    const fixture = makeFixture();
    await precompressSourceData(fixture);
    const originalGzip = readFileSync(`${fixture.archivePath}.gz`);
    const originalBrotli = readFileSync(`${fixture.archivePath}.br`);

    rmSync(`${fixture.archivePath}.br`);
    await expect(precompressSourceData(fixture)).resolves.toEqual({
      archives: 1,
      createdSidecars: 1,
      cachedFiles: 0,
    });
    expect(readFileSync(`${fixture.archivePath}.gz`)).toEqual(originalGzip);
    expect(readFileSync(`${fixture.archivePath}.br`)).toEqual(originalBrotli);

    rmSync(`${fixture.archivePath}.gz`);
    await expect(precompressSourceData(fixture)).resolves.toEqual({
      archives: 1,
      createdSidecars: 1,
      cachedFiles: 0,
    });
    expect(readFileSync(`${fixture.archivePath}.gz`)).toEqual(originalGzip);
    expect(readFileSync(`${fixture.archivePath}.br`)).toEqual(originalBrotli);

    const updatedSource = Buffer.from(
      '{"source":{"@ui/button.tsx":{"raw":"updated button","highlighted":[]}}}\n',
    );
    writeFileSync(fixture.archivePath, updatedSource);
    await expect(precompressSourceData(fixture)).resolves.toEqual({
      archives: 1,
      createdSidecars: 2,
      cachedFiles: 0,
    });
    expect(gunzipSync(readFileSync(`${fixture.archivePath}.gz`))).toEqual(updatedSource);
    expect(brotliDecompressSync(readFileSync(`${fixture.archivePath}.br`))).toEqual(updatedSource);
  });
});
