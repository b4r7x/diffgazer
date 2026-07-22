import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installDepsWithSpinner,
  PACKAGE_MANAGER_LOCKFILES,
  restorePackageManagerFiles,
} from "../package-manager.js";

vi.mock("../package-manager.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../package-manager.js")>();
  return {
    ...actual,
    installDepsWithSpinner: vi.fn(),
    restorePackageManagerFiles: vi.fn(actual.restorePackageManagerFiles),
  };
});

import { applyInstallPlan } from "./apply-install-plan.js";

const ORIGINAL_PACKAGE_JSON = `${JSON.stringify(
  {
    packageManager: "pnpm@10.0.0",
    dependencies: { existing: "^1.0.0" },
  },
  null,
  2,
)}\n`;

function seedPackageManagerFiles(tempDir: string): void {
  writeFileSync(join(tempDir, "package.json"), ORIGINAL_PACKAGE_JSON);
  for (const lockfile of PACKAGE_MANAGER_LOCKFILES.slice(0, 2)) {
    writeFileSync(join(tempDir, lockfile), `original ${lockfile}\n`);
  }
}

function mutatePackageManagerFiles(tempDir: string): void {
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"added":"1.0.0"}}\n');
  for (const lockfile of PACKAGE_MANAGER_LOCKFILES) {
    writeFileSync(join(tempDir, lockfile), `mutated ${lockfile}\n`);
  }
}

function expectPackageManagerFilesRestored(tempDir: string): void {
  expect(readFileSync(join(tempDir, "package.json"), "utf-8")).toBe(ORIGINAL_PACKAGE_JSON);
  for (const [index, lockfile] of PACKAGE_MANAGER_LOCKFILES.entries()) {
    const path = join(tempDir, lockfile);
    if (index < 2) {
      expect(readFileSync(path, "utf-8")).toBe(`original ${lockfile}\n`);
    } else {
      expect(existsSync(path)).toBe(false);
    }
  }
}

describe("applyInstallPlan", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-apply-plan-"));
    vi.mocked(installDepsWithSpinner).mockReset();
    vi.mocked(restorePackageManagerFiles).mockClear();
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

  it("restores package-manager files when installation mutates them before failing", async () => {
    seedPackageManagerFiles(tempDir);
    vi.mocked(installDepsWithSpinner).mockImplementation(async (_pm, _deps, cwd) => {
      mutatePackageManagerFiles(cwd);
      return false;
    });
    const targetPath = join(tempDir, "component.tsx");

    await expect(
      applyInstallPlan({
        cwd: tempDir,
        yes: true,
        dryRun: false,
        overwrite: false,
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
        missingDeps: ["added@1.0.0"],
      }),
    ).rejects.toThrow("Dependency installation failed.");

    expect(existsSync(targetPath)).toBe(false);
    expectPackageManagerFilesRestored(tempDir);
  });

  it("restores package-manager files when finalization fails after installation", async () => {
    seedPackageManagerFiles(tempDir);
    vi.mocked(installDepsWithSpinner).mockImplementation(async (_pm, _deps, cwd) => {
      mutatePackageManagerFiles(cwd);
      return true;
    });
    const targetPath = join(tempDir, "component.tsx");

    await expect(
      applyInstallPlan({
        cwd: tempDir,
        yes: true,
        dryRun: false,
        overwrite: false,
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
        missingDeps: ["added@1.0.0"],
        onApplied: () => {
          throw new Error("manifest write failed");
        },
      }),
    ).rejects.toThrow("manifest write failed");

    expect(existsSync(targetPath)).toBe(false);
    expectPackageManagerFilesRestored(tempDir);
  });

  it("throws an AggregateError with the primary and restore failures when package-manager rollback fails", async () => {
    seedPackageManagerFiles(tempDir);
    vi.mocked(installDepsWithSpinner).mockImplementation(async (_pm, _deps, cwd) => {
      mutatePackageManagerFiles(cwd);
      return true;
    });
    const restoreFailure = new Error("disk full");
    vi.mocked(restorePackageManagerFiles).mockImplementationOnce(() => {
      throw restoreFailure;
    });
    const targetPath = join(tempDir, "component.tsx");

    await expect(
      applyInstallPlan({
        cwd: tempDir,
        yes: true,
        dryRun: false,
        overwrite: false,
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
        missingDeps: ["added@1.0.0"],
        onApplied: () => {
          throw new Error("manifest write failed");
        },
      }),
    ).rejects.toMatchObject({
      message: "Install-plan failed and package-manager rollback was incomplete.",
      errors: [expect.objectContaining({ message: "manifest write failed" }), restoreFailure],
    });

    expect(existsSync(targetPath)).toBe(false);
  });

  it("keeps written files and installer mutations when manifest finalization succeeds", async () => {
    seedPackageManagerFiles(tempDir);
    vi.mocked(installDepsWithSpinner).mockImplementation(async (_pm, _deps, cwd) => {
      mutatePackageManagerFiles(cwd);
      return true;
    });
    const targetPath = join(tempDir, "component.tsx");

    await applyInstallPlan({
      cwd: tempDir,
      yes: true,
      dryRun: false,
      overwrite: false,
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
      missingDeps: ["added@1.0.0"],
      onApplied: () => {
        writeFileSync(join(tempDir, "manifest.json"), "{}\n");
      },
    });

    expect(readFileSync(targetPath, "utf-8")).toBe("export const ok = true;\n");
    expect(existsSync(join(tempDir, "manifest.json"))).toBe(true);
    expect(readFileSync(join(tempDir, "package.json"), "utf-8")).toBe(
      '{"dependencies":{"added":"1.0.0"}}\n',
    );
    for (const lockfile of PACKAGE_MANAGER_LOCKFILES) {
      expect(readFileSync(join(tempDir, lockfile), "utf-8")).toBe(`mutated ${lockfile}\n`);
    }
  });
});
