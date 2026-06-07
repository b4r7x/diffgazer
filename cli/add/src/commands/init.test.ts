import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInitWorkflow } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { buildInitPlannedPaths, KNOWN_LOCKFILES } from "./init.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-init-rollback-"));
  // Plant a `src/` dir so `detectProject` reports `sourceDir === "src"` and
  // plannedPaths target the standard `src/components/ui`, `src/hooks`, etc.
  // Matches what `dgadd init` does in real shadcn-style projects.
  mkdirSync(join(root, "src"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("dgadd init plannedPaths", () => {
  test("includes package.json and every known lockfile so installer side effects can be rolled back", () => {
    const paths = buildInitPlannedPaths(root, { componentsDir: "src/components/ui" });

    expect(paths, "package.json must be planned for install-step rollback").toContain(
      "package.json",
    );
    for (const lockfile of KNOWN_LOCKFILES) {
      expect(
        paths,
        `lockfile ${lockfile} must be planned so a fresh-create on install is undone on rollback`,
      ).toContain(lockfile);
    }
  });

  test("includes the resolved source-tree directories and seed files", () => {
    const paths = buildInitPlannedPaths(root, { componentsDir: "src/components/ui" });

    expect(paths).toContain("src/components/ui/");
    expect(paths).toContain("src/hooks/");
    expect(paths).toContain("src/lib/utils.ts");
    expect(paths).toContain("src/styles/theme.css");
    expect(paths).toContain("src/styles/styles.css");
  });
});

describe("dgadd init rollback after install side effects", () => {
  test("restores package.json and removes a freshly-created lockfile when writeConfig fails after install", async () => {
    const originalPackageJson = `${JSON.stringify({ name: "fixture", type: "module" }, null, 2)}\n`;
    writeFileSync(join(root, "package.json"), originalPackageJson);

    await expect(
      runInitWorkflow({
        cwd: root,
        configFileName: "diffgazer.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: (cwd) => buildInitPlannedPaths(cwd, { componentsDir: "src/components/ui" }),
        createFiles: () => [],
        // Simulate `pnpm install` mutating package.json AND creating a fresh
        // lockfile. dgadd init declares both in plannedPaths so a later
        // writeConfig failure must restore the file content and remove the
        // freshly-created lockfile.
        afterFiles: async (cwd) => {
          const mutated = `${JSON.stringify(
            { name: "fixture", type: "module", dependencies: { clsx: "^2.0.0" } },
            null,
            2,
          )}\n`;
          writeFileSync(join(cwd, "package.json"), mutated);
          writeFileSync(join(cwd, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
        },
        writeConfig: () => {
          throw new Error("simulated writeConfig failure");
        },
        nextSteps: [],
      }),
    ).rejects.toThrow(/simulated writeConfig failure/);

    expect(
      readFileSync(join(root, "package.json"), "utf-8"),
      "package.json must be restored to its pre-init bytes",
    ).toBe(originalPackageJson);
    expect(
      existsSync(join(root, "pnpm-lock.yaml")),
      "freshly-created lockfile must be removed on rollback",
    ).toBe(false);
    expect(
      existsSync(join(root, "diffgazer.json")),
      "config file must not be left behind when writeConfig throws before completion",
    ).toBe(false);
  });

  test("restores a pre-existing lockfile content when writeConfig fails after install", async () => {
    const originalPackageJson = `${JSON.stringify({ name: "fixture" }, null, 2)}\n`;
    const originalLockfile = "lockfileVersion: '9.0'\n# original\n";
    writeFileSync(join(root, "package.json"), originalPackageJson);
    writeFileSync(join(root, "pnpm-lock.yaml"), originalLockfile);

    await expect(
      runInitWorkflow({
        cwd: root,
        configFileName: "diffgazer.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: (cwd) => buildInitPlannedPaths(cwd, { componentsDir: "src/components/ui" }),
        createFiles: () => [],
        afterFiles: async (cwd) => {
          writeFileSync(
            join(cwd, "package.json"),
            JSON.stringify({ name: "fixture", dependencies: {} }),
          );
          writeFileSync(join(cwd, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n# mutated\n");
        },
        writeConfig: () => {
          throw new Error("boom");
        },
        nextSteps: [],
      }),
    ).rejects.toThrow(/boom/);

    expect(readFileSync(join(root, "package.json"), "utf-8")).toBe(originalPackageJson);
    expect(readFileSync(join(root, "pnpm-lock.yaml"), "utf-8")).toBe(originalLockfile);
  });
});
