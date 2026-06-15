import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyInstallPlan } from "./apply-install-plan.js";

describe("applyInstallPlan", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-apply-plan-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rolls back written files when manifest finalization fails after install", async () => {
    const targetPath = join(tempDir, "component.tsx");

    await expect(
      applyInstallPlan({
        cwd: tempDir,
        yes: true,
        dryRun: false,
        overwrite: false,
        skipInstall: true,
        confirmMessage: "proceed?",
        headingMessage: "Applying...",
        fileOps: [
          {
            targetPath,
            content: "export {};\n",
            relativePath: "component.tsx",
            installDir: ".",
          },
        ],
        missingDeps: [],
        onApplied: () => {
          throw new Error("manifest write failed");
        },
      }),
    ).rejects.toThrow("manifest write failed");

    expect(existsSync(targetPath)).toBe(false);
  });

  it("keeps written files when manifest finalization succeeds", async () => {
    const targetPath = join(tempDir, "component.tsx");

    await applyInstallPlan({
      cwd: tempDir,
      yes: true,
      dryRun: false,
      overwrite: false,
      skipInstall: true,
      confirmMessage: "proceed?",
      headingMessage: "Applying...",
      fileOps: [
        {
          targetPath,
          content: "export const ok = true;\n",
          relativePath: "component.tsx",
          installDir: ".",
        },
      ],
      missingDeps: [],
      onApplied: () => {
        writeFileSync(join(tempDir, "manifest.json"), "{}\n");
      },
    });

    expect(readFileSync(targetPath, "utf-8")).toBe("export const ok = true;\n");
    expect(existsSync(join(tempDir, "manifest.json"))).toBe(true);
  });
});
