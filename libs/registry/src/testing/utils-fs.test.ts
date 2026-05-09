import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureWithinDir } from "../cli/fs.js";

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

    expect(() => ensureWithinDir(join(base, "components/button.tsx"), base)).toThrow(/symlink|realpath/);
  });
});
