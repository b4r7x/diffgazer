import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readJson, writeJson } from "../utils/json.js";

describe("readJson", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-json-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reads and parses a JSON file", () => {
    const filePath = join(tempDir, "data.json");
    writeJson(filePath, { name: "test", count: 42 });

    const result = readJson(filePath);
    expect(result).toEqual({ name: "test", count: 42 });
  });

  it("throws on non-existent file", () => {
    expect(() => readJson(join(tempDir, "missing.json"))).toThrow();
  });
});

describe("writeJson", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-json-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes pretty-printed JSON with trailing newline", () => {
    const filePath = join(tempDir, "out.json");
    writeJson(filePath, { key: "value" });

    const raw = readFileSync(filePath, "utf-8");
    expect(raw).toBe('{\n  "key": "value"\n}\n');
  });

  it("overwrites existing file", () => {
    const filePath = join(tempDir, "out.json");
    writeJson(filePath, { first: true });
    writeJson(filePath, { second: true });

    const result = readJson(filePath);
    expect(result).toEqual({ second: true });
  });
});
