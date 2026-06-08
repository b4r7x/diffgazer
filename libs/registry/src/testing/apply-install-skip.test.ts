import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../cli/terminal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../cli/terminal.js")>();
  return {
    ...actual,
    heading: vi.fn(),
    info: vi.fn(),
    newline: vi.fn(),
    success: vi.fn(),
    promptConfirm: vi.fn().mockResolvedValue(true),
  };
});

import { info } from "../cli/terminal.js";
import { applyInstallPlan } from "../cli/workflows/apply-install-plan.js";

describe("applyInstallPlan skip-install recovery", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-apply-skip-"));
    vi.mocked(info).mockClear();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("surfaces skipped dependency specs so a later non-skip run can recover them", async () => {
    await applyInstallPlan({
      cwd: tempDir,
      yes: true,
      dryRun: false,
      overwrite: false,
      skipInstall: true,
      confirmMessage: "proceed?",
      headingMessage: "Applying...",
      fileOps: [],
      missingDeps: ["clsx@^2.0.0", "class-variance-authority@^0.7.0"],
    });

    expect(info).toHaveBeenCalledWith(expect.stringContaining("--skip-install"));
    expect(info).toHaveBeenCalledWith("  clsx@^2.0.0");
    expect(info).toHaveBeenCalledWith("  class-variance-authority@^0.7.0");
  });
});
