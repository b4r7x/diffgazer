import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { resolveConfig } from "../context.js";
import { normalizeManifestPath } from "./paths.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-paths-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("project path boundaries", () => {
  test("accepts in-project names beginning with two dots", () => {
    const directory = "..components";
    const absoluteFile = join(root, directory, "button.tsx");

    expect(resolveConfig({ componentsFsPath: directory }, root).componentsFsPath).toBe(directory);
    expect(normalizeManifestPath(root, absoluteFile)).toBe(`${directory}/button.tsx`);
  });

  test("rejects parent traversal", () => {
    const outsideFile = join(root, "..", "escape", "button.tsx");

    expect(() => resolveConfig({ componentsFsPath: "../escape" }, root)).toThrow(
      /Path traversal detected/,
    );
    expect(() => normalizeManifestPath(root, outsideFile)).toThrow(/Path traversal detected/);
  });
});
