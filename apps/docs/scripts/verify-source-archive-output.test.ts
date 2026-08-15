import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findSourceArchiveChunks,
  verifySourceArchiveOutput,
} from "./verify-source-archive-output.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createBuildOutput() {
  const outputRoot = mkdtempSync(join(tmpdir(), "diffgazer-source-output-"));
  temporaryDirectories.push(outputRoot);
  mkdirSync(join(outputRoot, "public/assets"), { recursive: true });
  mkdirSync(join(outputRoot, "server"), { recursive: true });
  return outputRoot;
}

describe("verify-source-archive-output", () => {
  it("accepts a build without source archives in JavaScript chunks", () => {
    const outputRoot = createBuildOutput();
    writeFileSync(join(outputRoot, "public/assets/app.js"), "app");
    writeFileSync(join(outputRoot, "server/index.mjs"), "server");

    expect(findSourceArchiveChunks(outputRoot)).toEqual([]);
    expect(() => verifySourceArchiveOutput(outputRoot)).not.toThrow();
  });

  it("reports source archives nested in either chunk directory", () => {
    const outputRoot = createBuildOutput();
    const nestedDirectory = join(outputRoot, "public/assets/chunks");
    mkdirSync(nestedDirectory);
    writeFileSync(join(nestedDirectory, "select.source-abc123.js"), "source");
    writeFileSync(join(outputRoot, "server/select.source-def456.mjs"), "source");

    expect(findSourceArchiveChunks(outputRoot)).toEqual([
      "public/assets/chunks/select.source-abc123.js",
      "server/select.source-def456.mjs",
    ]);
    expect(() => verifySourceArchiveOutput(outputRoot)).toThrow(
      "Source archives were emitted as JavaScript chunks",
    );
  });

  it("reports a missing build output directory with build guidance", () => {
    const outputRoot = mkdtempSync(join(tmpdir(), "diffgazer-source-output-"));
    temporaryDirectories.push(outputRoot);

    expect(() => verifySourceArchiveOutput(outputRoot)).toThrow(
      "Missing docs build output directory: public/assets. Run pnpm build first.",
    );
  });
});
