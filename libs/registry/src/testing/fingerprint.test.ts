import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeInputsFingerprint } from "../fingerprint.js";

describe("computeInputsFingerprint", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-fp-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("produces deterministic output for same inputs", () => {
    writeFileSync(join(tempDir, "a.txt"), "hello");
    writeFileSync(join(tempDir, "b.txt"), "world");

    const fp1 = computeInputsFingerprint(tempDir, ["a.txt", "b.txt"]);
    const fp2 = computeInputsFingerprint(tempDir, ["a.txt", "b.txt"]);

    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64); // SHA-256 hex
  });

  it("changes when file content changes", () => {
    writeFileSync(join(tempDir, "a.txt"), "hello");
    const fp1 = computeInputsFingerprint(tempDir, ["a.txt"]);

    writeFileSync(join(tempDir, "a.txt"), "changed");
    const fp2 = computeInputsFingerprint(tempDir, ["a.txt"]);

    expect(fp1).not.toBe(fp2);
  });

  it("includes files from directories recursively", () => {
    mkdirSync(join(tempDir, "sub"), { recursive: true });
    writeFileSync(join(tempDir, "sub", "nested.txt"), "nested");
    const fp = computeInputsFingerprint(tempDir, ["sub"]);

    expect(fp).toHaveLength(64);
  });

  it("is order-dependent for inputs array", () => {
    writeFileSync(join(tempDir, "a.txt"), "aaa");
    writeFileSync(join(tempDir, "b.txt"), "bbb");

    const fp1 = computeInputsFingerprint(tempDir, ["a.txt", "b.txt"]);
    const fp2 = computeInputsFingerprint(tempDir, ["b.txt", "a.txt"]);

    expect(fp1).not.toBe(fp2);
  });

  it("skips missing inputs gracefully", () => {
    writeFileSync(join(tempDir, "a.txt"), "exists");

    const fp = computeInputsFingerprint(tempDir, ["a.txt", "nonexistent.txt"]);
    expect(fp).toHaveLength(64);
  });
});
