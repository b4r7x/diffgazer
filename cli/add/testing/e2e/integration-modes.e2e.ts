import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeIntegrity } from "@diffgazer/registry";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getDefaultKeysVersionSpec } from "../../src/context.js";
import { manifestItem, readFixtureConfig, runDgadd, writeFixtureConfig } from "./test-helpers.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-cli-"));
  writeFixtureConfig(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("integration modes", () => {
  test("copied keys transitive files import each other without a bundler-hostile .js suffix", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    const navigation = readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8");

    expect(navigation).not.toMatch(/from "\.\/utils\/navigation-dispatch\.js"/);
    expect(navigation).toMatch(/from "\.\/utils\/navigation-dispatch"/);
    expect(navigation).toMatch(/from "\.\/utils\/navigation-items"/);
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

    const beforeMigration = readFixtureConfig(root);
    expect(beforeMigration.installedItems?.["ui/select"]?.integrationMode).toBe("copy");
    expect(beforeMigration.installedItems?.["ui/accordion"]?.integrationMode).toBe("copy");
    expect(beforeMigration.installedItems?.["keys/navigation"]?.installedAs).toBe("transitive");

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

    const afterMigration = readFixtureConfig(root);
    const navigation = afterMigration.installedItems?.["keys/navigation"];
    const navigationFiles = navigation?.files ?? [];
    const accordionSource = readFileSync(
      join(root, "src/components/ui/accordion/accordion.tsx"),
      "utf-8",
    );

    expect(afterMigration.installedItems?.["ui/select"]?.integrationMode).toBe("@diffgazer/keys");
    expect(afterMigration.installedItems?.["ui/accordion"]?.integrationMode).toBe("copy");
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

    const config = readFixtureConfig(root);
    const focusTrapFiles = config.installedItems?.["keys/focus-trap"]?.files ?? [];

    expect(config.installedItems?.["keys/navigation"]).toBeUndefined();
    expect(config.installedItems?.["keys/focus-trap"]?.installedAs).toBe("explicit");
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
    const config = readFixtureConfig(root);
    const selectFiles = manifestItem(config, "ui/select").files ?? [];

    expect(selectSource).toMatch(/from "@diffgazer\/keys"/);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/navigation-items.ts"))).toBe(false);
    expect(manifestItem(config, "ui/select").integrationMode).toBe("@diffgazer/keys");
    expect(config.installedItems?.["keys/navigation"]).toBeUndefined();
    expect(selectFiles.every((file) => file.integrationMode === "@diffgazer/keys")).toBe(true);
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
    const beforeOwnership = manifestItem(readFixtureConfig(root), "keys/navigation");

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
    expect(manifestItem(readFixtureConfig(root), "keys/navigation")).toEqual(beforeOwnership);
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
    const manifest = readFixtureConfig(root);
    const navigationFiles = manifestItem(manifest, "keys/navigation").files ?? [];
    const escapedFile = navigationFiles[0];
    if (!escapedFile) throw new Error("expected keys/navigation owned file");
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
    const config = readFixtureConfig(root);
    const selectItem = manifestItem(config, "ui/select");
    const selectFiles = selectItem.files ?? [];
    const navigation = config.installedItems?.["keys/navigation"];

    expect(selectSource).not.toMatch(/from "@diffgazer\/keys"/);
    expect(selectSource).toMatch(/from "@\/hooks\//);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(true);
    expect(selectItem.integrationMode).toBe("copy");
    expect(selectFiles.every((file) => file.integrationMode === "copy")).toBe(true);
    expect(navigation?.installedAs).toBe("transitive");
    expect(navigation?.files?.every((file) => file.integrationMode === "copy")).toBe(true);
  });

  const copyIntegrationCases = [
    {
      item: "ui/select",
      hookFiles: [
        "src/hooks/use-navigation.ts",
        "src/hooks/utils/navigation-dispatch.ts",
        "src/hooks/utils/navigation-items.ts",
      ],
      importer: "src/components/ui/select/use-content-navigation.ts",
      expectedImport: /@\/hooks\/use-navigation/,
      alsoKeysFree: ["src/components/ui/select/select-content.tsx"],
    },
    {
      item: "ui/accordion",
      hookFiles: ["src/hooks/utils/navigation-items.ts", "src/hooks/utils/focusable.ts"],
      importer: "src/components/ui/accordion/accordion.tsx",
      expectedImport: /@\/hooks\/utils\/navigation-items/,
      alsoKeysFree: [],
    },
    {
      item: "ui/popover",
      hookFiles: ["src/hooks/utils/focusable.ts"],
      importer: "src/components/ui/popover/use-auto-focus.ts",
      expectedImport: /@\/hooks\/utils\/focusable/,
      alsoKeysFree: [],
    },
    {
      item: "ui/command-palette",
      hookFiles: ["src/hooks/use-focus-restore.ts", "src/hooks/utils/focus-restore.ts"],
      importer: "src/components/ui/command-palette/command-palette-content.tsx",
      expectedImport: /@\/hooks\/use-focus-restore/,
      alsoKeysFree: [],
    },
    {
      item: "ui/radio",
      hookFiles: [
        "src/hooks/use-navigation.ts",
        "src/hooks/utils/navigation-dispatch.ts",
        "src/hooks/utils/navigation-items.ts",
      ],
      importer: "src/components/ui/radio/use-radio-group-navigation.ts",
      expectedImport: /@\/hooks\/use-navigation/,
      alsoKeysFree: ["src/components/ui/radio/radio-group.tsx"],
    },
  ];

  test.each(
    copyIntegrationCases,
  )("copy integration installs $item keys dependencies and rewrites its imports to them", ({
    item,
    hookFiles,
    importer,
    expectedImport,
    alsoKeysFree,
  }) => {
    runDgadd(["add", item, "--integration", "copy", "--cwd", root, "--yes", "--skip-install"]);

    for (const hookFile of hookFiles) {
      expect(existsSync(join(root, hookFile))).toBe(true);
    }
    for (const source of [...alsoKeysFree, importer]) {
      expect(readFileSync(join(root, source), "utf-8")).not.toMatch(/@diffgazer\/keys/);
    }
    expect(readFileSync(join(root, importer), "utf-8")).toMatch(expectedImport);
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

    const config = readFixtureConfig(root);
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);
    expect(manifestItem(config, "ui/button").integrationMode).toBe("none");
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

  test("--keys-version flows from the CLI into the dependency request and the manifest", () => {
    const output = runDgadd(
      [
        "add",
        "ui/select",
        "--integration",
        "keys",
        "--keys-version",
        "^9.9.9",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
      ],
      { silent: false },
    );

    expect(output).toContain("@diffgazer/keys@^9.9.9");
    expect(manifestItem(readFixtureConfig(root), "ui/select").keysVersion).toBe("^9.9.9");
  });

  test("without --keys-version the manifest records the bundled default range", () => {
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

    expect(manifestItem(readFixtureConfig(root), "ui/select").keysVersion).toBe(
      getDefaultKeysVersionSpec(),
    );
  });

  test("explicit keys/* stay recorded as copies when ui/* resolves to package mode", () => {
    runDgadd([
      "add",
      "keys/scroll-lock",
      "ui/select",
      "--integration",
      "keys",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    expect(existsSync(join(root, "src/hooks/use-scroll-lock.ts"))).toBe(true);

    const config = readFixtureConfig(root);
    const scrollLock = manifestItem(config, "keys/scroll-lock");
    expect(scrollLock.integrationMode).toBe("copy");
    expect(scrollLock.keysVersion).toBeUndefined();
    expect(scrollLock.files?.every((file) => file.integrationMode === "copy")).toBe(true);
    expect(manifestItem(config, "ui/select").integrationMode).toBe("@diffgazer/keys");
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
