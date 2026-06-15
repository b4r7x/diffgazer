import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, test } from "node:test";
import { collectFiles } from "./files.mjs";
import { computeStrictArtifactFingerprint } from "./validation.mjs";

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function makeTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "dg-files-"));
  tempRoots.push(root);
  return root;
}

function writeText(root, relPath, content) {
  const path = join(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeFixture(root, order) {
  for (const relPath of order) {
    writeText(root, relPath, `${relPath}\n`);
  }
}

function relativeFiles(root) {
  return collectFiles(join(root, "input")).map((path) => relative(root, path));
}

test("file collection and artifact fingerprints use deterministic code-unit order", () => {
  const first = makeTempRoot();
  const second = makeTempRoot();
  const files = ["input/a.txt", "input/Z.txt", "input/nested/B.txt"];

  writeFixture(first, files);
  writeFixture(second, files.toReversed());

  assert.deepEqual(relativeFiles(first), ["input/Z.txt", "input/a.txt", "input/nested/B.txt"]);
  assert.deepEqual(relativeFiles(second), relativeFiles(first));

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

  assert.equal(secondFingerprint, firstFingerprint);
});
