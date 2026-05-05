import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizeOrigin,
  rewriteOriginsInDir,
} from "../origin.js";

const TEST_ORIGIN = "https://diffgazer.com";

describe("normalizeOrigin", () => {
  it("uses default when raw is undefined", () => {
    expect(normalizeOrigin(undefined, { defaultOrigin: "https://custom.dev" })).toBe("https://custom.dev");
  });

  it("strips trailing slashes", () => {
    expect(normalizeOrigin("https://example.com///", { defaultOrigin: TEST_ORIGIN })).toBe("https://example.com");
  });

  it("throws for non-http(s) origins", () => {
    expect(() => normalizeOrigin("ftp://nope.com", { defaultOrigin: TEST_ORIGIN })).toThrow();
  });
});

describe("rewriteOriginsInDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-origin-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rewrites origins in JSON files", () => {
    const data = { url: `${TEST_ORIGIN}/r/test` };
    writeFileSync(join(tempDir, "test.json"), JSON.stringify(data, null, 2) + "\n");

    const result = rewriteOriginsInDir(tempDir, {
      fromOrigin: TEST_ORIGIN,
      toOrigin: "https://local.dev",
    });

    expect(result.changed).toBe(1);
    const content = JSON.parse(readFileSync(join(tempDir, "test.json"), "utf-8"));
    expect(content.url).toBe("https://local.dev/r/test");
  });

  it("does not modify files without matching origin", () => {
    const data = { url: "https://other.com/api" };
    writeFileSync(join(tempDir, "other.json"), JSON.stringify(data, null, 2) + "\n");

    const result = rewriteOriginsInDir(tempDir, {
      fromOrigin: TEST_ORIGIN,
      toOrigin: "https://local.dev",
    });

    expect(result.changed).toBe(0);
  });

  it("handles nested directories", () => {
    mkdirSync(join(tempDir, "sub"), { recursive: true });
    writeFileSync(
      join(tempDir, "sub", "nested.json"),
      JSON.stringify({ x: `${TEST_ORIGIN}/x` }, null, 2) + "\n",
    );

    const result = rewriteOriginsInDir(tempDir, {
      fromOrigin: TEST_ORIGIN,
      toOrigin: "https://new.dev",
    });

    expect(result.changed).toBe(1);
  });

  it("handles nested objects and arrays recursively", () => {
    const data = {
      url: `${TEST_ORIGIN}/test`,
      nested: { deep: `${TEST_ORIGIN}/deep` },
      list: [`${TEST_ORIGIN}/a`, `${TEST_ORIGIN}/b`],
    };
    writeFileSync(join(tempDir, "complex.json"), JSON.stringify(data, null, 2) + "\n");

    const result = rewriteOriginsInDir(tempDir, {
      fromOrigin: TEST_ORIGIN,
      toOrigin: "https://new.com",
    });

    expect(result.changed).toBe(1);
    const content = JSON.parse(readFileSync(join(tempDir, "complex.json"), "utf-8"));
    expect(content.url).toBe("https://new.com/test");
    expect(content.nested.deep).toBe("https://new.com/deep");
    expect(content.list).toEqual(["https://new.com/a", "https://new.com/b"]);
  });

  it("passes through non-string/non-object values unchanged", () => {
    const data = { count: 42, active: true, empty: null, url: `${TEST_ORIGIN}/x` };
    writeFileSync(join(tempDir, "mixed.json"), JSON.stringify(data, null, 2) + "\n");

    rewriteOriginsInDir(tempDir, {
      fromOrigin: TEST_ORIGIN,
      toOrigin: "https://x.com",
    });

    const content = JSON.parse(readFileSync(join(tempDir, "mixed.json"), "utf-8"));
    expect(content.count).toBe(42);
    expect(content.active).toBe(true);
    expect(content.empty).toBe(null);
    expect(content.url).toBe("https://x.com/x");
  });
});
