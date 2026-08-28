import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PACKAGE_MANAGER_LOCKFILES } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { initCommand } from "./command.js";
import { buildInitPlannedPaths } from "./plan.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-init-"));
  // src/ so detectProject reports sourceDir === "src" and plannedPaths target src/*.
  mkdirSync(join(root, "src"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("dgadd init plannedPaths", () => {
  test("labels --reset-manifest as a recovery-only ownership-orphaning operation", () => {
    let help = "";
    initCommand.configureOutput({
      writeOut: (chunk) => {
        help += chunk;
      },
    });
    initCommand.outputHelp();

    expect(help).toContain("--reset-manifest");
    expect(help).toContain("Recovery only");
    expect(help).toContain("ownership ledger");
    expect(help).toMatch(/orphaning previously[\s\S]*installed files/);
  });

  test("includes package.json and every known lockfile so installer side effects can be rolled back", () => {
    const paths = buildInitPlannedPaths(root, { componentsDir: "src/components/ui" });

    expect(paths, "package.json must be planned for install-step rollback").toContain(
      "package.json",
    );
    for (const lockfile of PACKAGE_MANAGER_LOCKFILES) {
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
