import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDir, toPosixPath } from "./fs.js";

describe("resetDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-resetdir-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("recreates the directory empty", () => {
    const target = join(tempDir, "out");
    mkdirSync(target);
    mkdirSync(join(target, "stale"));

    resetDir(target);

    expect(existsSync(target)).toBe(true);
    expect(existsSync(join(target, "stale"))).toBe(false);
  });

  // The catch path only fires when rmSync succeeds but mkdirSync fails. A read-only
  // parent satisfies that: removing a non-existent child is a no-op under force, but
  // creating it raises EACCES. Skipped as root, where write permission bypasses EACCES.
  const itUnlessRoot = process.getuid?.() === 0 ? it.skip : it;
  itUnlessRoot("throws a clear error when it cannot recreate the directory", () => {
    const parent = join(tempDir, "readonly");
    mkdirSync(parent);
    const target = join(parent, "child");
    chmodSync(parent, 0o500);

    try {
      expect(() => resetDir(target)).toThrow(/recreate/i);
      expect(existsSync(target)).toBe(false);
    } finally {
      chmodSync(parent, 0o700);
    }
  });
});

describe("toPosixPath", () => {
  it("normalizes platform separators to POSIX separators", () => {
    expect(toPosixPath("input\\nested/file.txt")).toBe("input/nested/file.txt");
  });
});
