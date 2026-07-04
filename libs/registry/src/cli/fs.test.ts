import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureWithinDir } from "./fs.js";

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
});
