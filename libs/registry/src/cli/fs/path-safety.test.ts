import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureWithinAnyDir, ensureWithinDir } from "./path-safety.js";

describe("ensureWithinDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-containment-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects symlink escapes through existing parent directories", () => {
    const base = join(tempDir, "project");
    const outside = join(tempDir, "outside");
    mkdirSync(base, { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(base, "components"));

    expect(() => ensureWithinDir(join(base, "components/button.tsx"), base)).toThrow(
      /symlink|realpath/,
    );
  });

  it("accepts a path inside one of several allowed directories", () => {
    const components = join(tempDir, "components");
    const hooks = join(tempDir, "hooks");
    mkdirSync(components, { recursive: true });
    mkdirSync(hooks, { recursive: true });
    const target = join(components, "button.tsx");

    expect(() => ensureWithinAnyDir(target, [hooks, components])).not.toThrow();
  });

  it("rejects a path outside every allowed directory", () => {
    const components = join(tempDir, "components");
    const hooks = join(tempDir, "hooks");
    const outside = join(tempDir, "outside");
    mkdirSync(components, { recursive: true });
    mkdirSync(hooks, { recursive: true });
    mkdirSync(outside, { recursive: true });

    expect(() => ensureWithinAnyDir(join(outside, "button.tsx"), [components, hooks])).toThrow(
      /escapes all allowed directories/,
    );
  });

  it("rejects symlink escapes for ensureWithinAnyDir", () => {
    const components = join(tempDir, "components");
    const hooks = join(tempDir, "hooks");
    const outside = join(tempDir, "outside");
    mkdirSync(components, { recursive: true });
    mkdirSync(hooks, { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(components, "ui"));

    expect(() =>
      ensureWithinAnyDir(join(components, "ui/button.tsx"), [components, hooks]),
    ).toThrow(/symlink|realpath|escapes all allowed directories/);
  });
});
