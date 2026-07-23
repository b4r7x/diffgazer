import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeIntegrity } from "@diffgazer/registry";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { runDgadd, writeFixtureConfig } from "./test-helpers.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-cli-"));
  writeFixtureConfig(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("integration modes", () => {
  test("copy integration installs keys transitive files with bundler-safe relative imports", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/navigation-items.ts"))).toBe(true);
    expect(readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8")).not.toMatch(
      /from "\.\/utils\/navigation-dispatch\.js"/,
    );
    expect(readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8")).toMatch(
      /from "\.\/utils\/navigation-dispatch"/,
    );
    expect(readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8")).toMatch(
      /from "\.\/utils\/navigation-items"/,
    );
  });

  test("migrating one copy-mode component retains hooks shared by another", () => {
    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);
    runDgadd([
      "add",
      "ui/accordion",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const beforeMigration = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(beforeMigration.installedComponents["ui/select"].integrationMode).toBe("copy");
    expect(beforeMigration.installedComponents["ui/accordion"].integrationMode).toBe("copy");
    expect(beforeMigration.installedComponents["keys/navigation"]?.installedAs).toBe("transitive");

    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "keys",
      "--overwrite",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const afterMigration = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const navigation = afterMigration.installedComponents["keys/navigation"];
    const navigationFiles = navigation?.files ?? [];
    const accordionSource = readFileSync(
      join(root, "src/components/ui/accordion/accordion.tsx"),
      "utf-8",
    );

    expect(afterMigration.installedComponents["ui/select"].integrationMode).toBe("@diffgazer/keys");
    expect(afterMigration.installedComponents["ui/accordion"].integrationMode).toBe("copy");
    expect(accordionSource).toMatch(/@\/hooks\/utils\/navigation-items/);
    expect(navigation?.installedAs).toBe("transitive");
    expect(navigationFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "src/hooks/use-navigation.ts", integrationMode: "copy" }),
        expect.objectContaining({
          path: "src/hooks/utils/navigation-dispatch.ts",
          integrationMode: "copy",
        }),
        expect.objectContaining({
          path: "src/hooks/utils/navigation-items.ts",
          integrationMode: "copy",
        }),
      ]),
    );
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/navigation-items.ts"))).toBe(true);
  });

  test("copy to keys retains files shared with an explicit keys hook", () => {
    runDgadd(["add", "keys/focus-trap", "--cwd", root, "--yes", "--skip-install"]);
    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "keys",
      "--overwrite",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const focusTrapFiles = config.installedComponents["keys/focus-trap"]?.files ?? [];

    expect(config.installedComponents["keys/navigation"]).toBeUndefined();
    expect(config.installedComponents["keys/focus-trap"]?.installedAs).toBe("explicit");
    expect(focusTrapFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "src/hooks/utils/focusable.ts" }),
        expect.objectContaining({ path: "src/hooks/utils/element-guards.ts" }),
      ]),
    );
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/element-guards.ts"))).toBe(true);
  });

  test("copy to keys fails before side effects without --overwrite", () => {
    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const selectSource = join(root, "src/components/ui/select/select-content.tsx");
    const beforeSource = readFileSync(selectSource, "utf-8");
    const beforeManifest = readFileSync(join(root, "diffgazer.json"), "utf-8");

    expect(() =>
      runDgadd([
        "add",
        "ui/select",
        "--integration",
        "keys",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
      ]),
    ).toThrow(/--overwrite/);

    expect(readFileSync(selectSource, "utf-8")).toBe(beforeSource);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(true);
    expect(readFileSync(join(root, "diffgazer.json"), "utf-8")).toBe(beforeManifest);
  });

  test("copy to keys overwrites component files and removes unshared copied-hook ownership", () => {
    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "keys",
      "--overwrite",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const selectSource = readFileSync(
      join(root, "src/components/ui/select/use-content-navigation.ts"),
      "utf-8",
    );
    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const selectFiles = config.installedComponents["ui/select"].files;

    expect(selectSource).toMatch(/from "@diffgazer\/keys"/);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/navigation-items.ts"))).toBe(false);
    expect(config.installedComponents["ui/select"].integrationMode).toBe("@diffgazer/keys");
    expect(config.installedComponents["keys/navigation"]).toBeUndefined();
    expect(
      selectFiles.every(
        (file: { integrationMode?: string }) => file.integrationMode === "@diffgazer/keys",
      ),
    ).toBe(true);
  });

  test("copy to keys rejects a locally modified unshared hook before side effects", () => {
    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const selectSourcePath = join(root, "src/components/ui/select/select-content.tsx");
    const hookPath = join(root, "src/hooks/use-navigation.ts");
    const manifestPath = join(root, "diffgazer.json");
    const modifiedHook = `${readFileSync(hookPath, "utf-8")}\n// local change\n`;
    writeFileSync(hookPath, modifiedHook);

    const beforeSource = readFileSync(selectSourcePath, "utf-8");
    const beforeManifest = readFileSync(manifestPath, "utf-8");
    const beforeOwnership = JSON.parse(beforeManifest).installedComponents["keys/navigation"];

    expect(() =>
      runDgadd([
        "add",
        "ui/select",
        "--integration",
        "keys",
        "--overwrite",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
      ]),
    ).toThrow(/copied hook has local changes/);

    const afterManifest = readFileSync(manifestPath, "utf-8");
    expect(readFileSync(selectSourcePath, "utf-8")).toBe(beforeSource);
    expect(readFileSync(hookPath, "utf-8")).toBe(modifiedHook);
    expect(afterManifest).toBe(beforeManifest);
    expect(JSON.parse(afterManifest).installedComponents["keys/navigation"]).toEqual(
      beforeOwnership,
    );
  });

  test("copy to keys rejects hook paths that escape the configured hooks directory", () => {
    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const selectSourcePath = join(root, "src/components/ui/select/select-content.tsx");
    const hookPath = join(root, "src/hooks/use-navigation.ts");
    const manifestPath = join(root, "diffgazer.json");
    const packagePath = join(root, "package.json");
    const packageSource = readFileSync(packagePath, "utf-8");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const escapedFile = manifest.installedComponents["keys/navigation"].files[0];
    escapedFile.path = "src/hooks/../package.json";
    escapedFile.hash = computeIntegrity(packageSource);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const beforeSource = readFileSync(selectSourcePath, "utf-8");
    const beforeHook = readFileSync(hookPath, "utf-8");
    const beforeManifest = readFileSync(manifestPath, "utf-8");

    expect(() =>
      runDgadd([
        "add",
        "ui/select",
        "--integration",
        "keys",
        "--overwrite",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
      ]),
    ).toThrow(/Path traversal detected/);

    expect(readFileSync(selectSourcePath, "utf-8")).toBe(beforeSource);
    expect(readFileSync(hookPath, "utf-8")).toBe(beforeHook);
    expect(readFileSync(packagePath, "utf-8")).toBe(packageSource);
    expect(readFileSync(manifestPath, "utf-8")).toBe(beforeManifest);
  });

  test("keys to copy fails before side effects without --overwrite", () => {
    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "keys",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const selectSource = join(root, "src/components/ui/select/select-content.tsx");
    const beforeSource = readFileSync(selectSource, "utf-8");
    const beforeManifest = readFileSync(join(root, "diffgazer.json"), "utf-8");

    expect(() =>
      runDgadd([
        "add",
        "ui/select",
        "--integration",
        "copy",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
      ]),
    ).toThrow(/--overwrite/);

    expect(readFileSync(selectSource, "utf-8")).toBe(beforeSource);
    expect(readFileSync(join(root, "diffgazer.json"), "utf-8")).toBe(beforeManifest);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(false);
  });

  test("keys to copy overwrites component files and records copied-hook ownership", () => {
    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "keys",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "copy",
      "--overwrite",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const selectSource = readFileSync(
      join(root, "src/components/ui/select/select-content.tsx"),
      "utf-8",
    );
    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const selectFiles = config.installedComponents["ui/select"].files;
    const navigation = config.installedComponents["keys/navigation"];

    expect(selectSource).not.toMatch(/from "@diffgazer\/keys"/);
    expect(selectSource).toMatch(/from "@\/hooks\//);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(true);
    expect(config.installedComponents["ui/select"].integrationMode).toBe("copy");
    expect(
      selectFiles.every((file: { integrationMode?: string }) => file.integrationMode === "copy"),
    ).toBe(true);
    expect(navigation?.installedAs).toBe("transitive");
    expect(
      navigation?.files?.every(
        (file: { integrationMode?: string }) => file.integrationMode === "copy",
      ),
    ).toBe(true);
  });

  test("copy integration rewrites package-root keys imports to copied sources", () => {
    runDgadd([
      "add",
      "ui/accordion",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    expect(existsSync(join(root, "src/hooks/utils/navigation-items.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(true);

    const content = readFileSync(join(root, "src/components/ui/accordion/accordion.tsx"), "utf-8");
    expect(content).not.toMatch(/@diffgazer\/keys/);
    expect(content).toMatch(/@\/hooks\/utils\/navigation-items/);
  });

  test("copy integration installs focusable utilities for popover-backed UI", () => {
    runDgadd([
      "add",
      "ui/popover",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(true);

    const content = readFileSync(
      join(root, "src/components/ui/popover/use-auto-focus.ts"),
      "utf-8",
    );
    expect(content).not.toMatch(/@diffgazer\/keys/);
    expect(content).toMatch(/@\/hooks\/utils\/focusable/);
  });

  test("copy integration installs focus restore for dialog-backed UI", () => {
    runDgadd([
      "add",
      "ui/command-palette",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(true);

    const content = readFileSync(
      join(root, "src/components/ui/command-palette/command-palette-content.tsx"),
      "utf-8",
    );
    expect(content).not.toMatch(/@diffgazer\/keys/);
    expect(content).toMatch(/@\/hooks\/use-focus-restore/);
  });

  test("copy integration installs navigation for radio-backed UI", () => {
    runDgadd([
      "add",
      "ui/radio",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/navigation-items.ts"))).toBe(true);

    const groupSource = readFileSync(
      join(root, "src/components/ui/radio/radio-group.tsx"),
      "utf-8",
    );
    expect(groupSource).not.toMatch(/@diffgazer\/keys/);
    const navigationSource = readFileSync(
      join(root, "src/components/ui/radio/use-radio-group-navigation.ts"),
      "utf-8",
    );
    expect(navigationSource).not.toMatch(/@diffgazer\/keys/);
    expect(navigationSource).toMatch(/@\/hooks\/use-navigation/);
  });

  test("none integration is rejected when selected components require keys hooks", () => {
    expect(() =>
      runDgadd([
        "add",
        "ui/select",
        "--integration",
        "none",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
      ]),
    ).toThrow(/require keyboard hooks|Components reference keyboard hooks/);
    expect(existsSync(join(root, "src/components/ui/select/select.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(false);
  });

  test("none integration installs components that do not require keys hooks", () => {
    runDgadd([
      "add",
      "ui/button",
      "--integration",
      "none",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);
    expect(config.installedComponents["ui/button"].integrationMode).toBe("none");
  });

  test("keys package integration diff is up to date immediately after add", () => {
    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "keys",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const selectContentSource = join(root, "src/components/ui/select/use-content-navigation.ts");
    expect(readFileSync(selectContentSource, "utf-8")).toMatch(/from "@diffgazer\/keys"/);

    const output = runDgadd(["diff", "ui/select", "--cwd", root], { silent: false });
    expect(output).toMatch(/All Diffgazer items are up to date with registry\./);
  });

  test("keys package integration diff reports modified installed files", () => {
    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "keys",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const selectContentSource = join(root, "src/components/ui/select/select-content.tsx");
    writeFileSync(
      selectContentSource,
      `${readFileSync(selectContentSource, "utf-8")}\n// user edit\n`,
    );

    const output = runDgadd(["diff", "ui/select", "--cwd", root], { silent: false });
    expect(output).toMatch(/Summary: \d+ changed/);
    expect(output).toMatch(/user edit/);
  });
});
