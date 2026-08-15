import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { listFilesByExtension, listRepoFiles } from "./files.mjs";

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

test("repo file listing includes untracked files and honors git excludes", () => {
  const root = makeTempRoot();

  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  writeText(root, ".gitignore", "ignored.txt\n");
  writeText(root, "visible.txt", "visible\n");
  writeText(root, "nested/file.ts", "nested\n");
  writeText(root, "ignored.txt", "ignored\n");

  assert.deepEqual(listRepoFiles(root).sort(), [".gitignore", "nested/file.ts", "visible.txt"]);
});

test("repo file listing omits tracked files deleted from the worktree", () => {
  const root = makeTempRoot();

  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  writeText(root, "kept.ts", "kept\n");
  writeText(root, "removed.ts", "removed\n");
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "seed"], {
    cwd: root,
    stdio: "ignore",
  });
  rmSync(join(root, "removed.ts"));

  assert.deepEqual(listRepoFiles(root), ["kept.ts"]);
});

test("extension listing walks nested directories and keeps gitignored output", () => {
  const root = makeTempRoot();

  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  writeText(root, ".gitignore", "docs/generated/\n");
  writeText(root, "docs/content/index.mdx", "content\n");
  writeText(root, "docs/content/nested/deep.mdx", "deep\n");
  writeText(root, "docs/content/notes.txt", "not mdx\n");
  writeText(root, "docs/generated/bundle.mdx", "generated\n");

  assert.deepEqual(
    listFilesByExtension(join(root, "docs"), ".mdx")
      .map((path) => path.slice(root.length + 1))
      .sort(),
    ["docs/content/index.mdx", "docs/content/nested/deep.mdx", "docs/generated/bundle.mdx"],
  );
});

// Git C-quotes these pathnames in its newline-delimited display form, so a
// listing built on that form drops them and every scanner reading it (secret
// scan, provider transport guard, invariants, testing conventions) skips their
// content.
test("repo file listing keeps pathnames git C-quotes in its display form", () => {
  const root = makeTempRoot();
  const quotedNames = ["café.ts", 'quote".ts', "back\\slash.ts", "tab\tname.ts"];

  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  for (const name of quotedNames) {
    writeText(root, name, "content\n");
  }

  assert.deepEqual(listRepoFiles(root).sort(), [...quotedNames].sort());
});
