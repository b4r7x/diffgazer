import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { resolveConfig } from "./context.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-context-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("resolveConfig", () => {
  test.each([
    "/outside/styles.css",
    "C:\\outside\\styles.css",
    "\\outside\\styles.css",
    "\\\\server\\share\\styles.css",
  ])("rejects absolute tailwind css path %s before creating files", (css) => {
    expect(() => resolveConfig({ tailwind: { css } }, root)).toThrow(
      /Project paths must be relative/,
    );
    expect(readdirSync(root)).toEqual([]);
  });
});
