import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { computeInputsFingerprint, computeStrictArtifactFingerprint } from "./fingerprint.js";

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "registry-fingerprint-"));
  tempRoots.push(root);
  return root;
}

function writeText(root: string, relPath: string, content: string): void {
  const filePath = join(root, relPath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function expectedInputsFingerprint(entries: Array<[relPath: string, content: string]>): string {
  const hash = createHash("sha256");
  for (const [relPath, content] of entries) {
    hash.update(relPath);
    hash.update("\n");
    hash.update(content);
    hash.update("\n");
  }
  return hash.digest("hex");
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("computeInputsFingerprint", () => {
  it("hashes directory entries by POSIX root-relative path", () => {
    const root = createTempRoot();
    writeText(root, "input/nested/file.txt", "hello");

    expect(computeInputsFingerprint(root, ["input"])).toBe(
      expectedInputsFingerprint([["input/nested/file.txt", "hello"]]),
    );
  });

  it("normalizes direct file inputs through node-relative paths", () => {
    const root = createTempRoot();
    writeText(root, "input/file.txt", "hello");

    expect(computeInputsFingerprint(root, ["./input/file.txt"])).toBe(
      expectedInputsFingerprint([["input/file.txt", "hello"]]),
    );
  });
});

describe("computeStrictArtifactFingerprint", () => {
  it("collects missing inputs and normalizes the registry origin", () => {
    const root = createTempRoot();
    mkdirSync(join(root, "empty"), { recursive: true });

    const withSlash = computeStrictArtifactFingerprint(
      root,
      ["missing", "empty"],
      "https://r.b4r7.dev/",
    );
    const withoutSlash = computeStrictArtifactFingerprint(
      root,
      ["missing", "empty"],
      "https://r.b4r7.dev",
    );

    expect(withSlash.missing).toEqual(["missing", "empty/*"]);
    expect(withSlash.fingerprint).toBe(withoutSlash.fingerprint);
  });

  it("produces the same fingerprint regardless of file creation order", () => {
    const first = createTempRoot();
    const second = createTempRoot();
    const files = ["input/a.txt", "input/Z.txt", "input/nested/B.txt"];

    for (const relPath of files) {
      writeText(first, relPath, `${relPath}\n`);
    }
    for (const relPath of files.toReversed()) {
      writeText(second, relPath, `${relPath}\n`);
    }

    const firstFingerprint = computeStrictArtifactFingerprint(
      first,
      ["input"],
      "https://r.b4r7.dev",
    ).fingerprint;
    const secondFingerprint = computeStrictArtifactFingerprint(
      second,
      ["input"],
      "https://r.b4r7.dev",
    ).fingerprint;

    expect(secondFingerprint).toBe(firstFingerprint);
  });
});
