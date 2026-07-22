import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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

describe("add command", () => {
  test("add records only files it wrote and remove keeps modified owned files", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const ownedFiles = config.installedComponents["ui/button"].files;
    expect(ownedFiles.length).toBeGreaterThan(0);
    expect(ownedFiles.every((file: { hash?: string }) => file.hash?.startsWith("sha256-"))).toBe(
      true,
    );

    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    const buttonSource = join(root, "src/components/ui/button/button.tsx");
    writeFileSync(buttonIndex, "// user edits\n");

    runDgadd(["remove", "ui/button", "--cwd", root, "--yes"]);

    expect(readFileSync(buttonIndex, "utf-8")).toBe("// user edits\n");
    expect(existsSync(buttonSource)).toBe(true);
  });

  test("hidden keys utilities cannot be installed directly", () => {
    expect(() =>
      runDgadd(["add", "keys/focusable", "--cwd", root, "--yes", "--skip-install"]),
    ).toThrow(/not found/);
  });

  test("hidden internal ui items cannot be installed directly", () => {
    expect(() => runDgadd(["add", "ui/portal", "--cwd", root, "--yes", "--skip-install"])).toThrow(
      /not found in public registry/,
    );
    expect(existsSync(join(root, "src/components/ui/shared/portal.tsx"))).toBe(false);
  });

  test("add --all installs hidden internals only as transitive dependencies", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');

    runDgadd(["add", "--all", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const installed = config.installedComponents as Record<string, { installedAs: string }>;
    expect(installed["ui/portal"]?.installedAs).toBe("transitive");
    expect(installed["ui/dialog-shell"]?.installedAs).toBe("transitive");
    expect(installed["ui/dialog"]?.installedAs).toBe("explicit");
  });

  test("no-overwrite re-add preserves ownership of a locally modified owned file", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const readDialogFiles = (): string[] => {
      const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
      return (config.installedComponents["ui/dialog"].files as Array<{ path: string }>).map(
        (file) => file.path,
      );
    };
    const before = readDialogFiles();
    expect(before).toContain("src/components/ui/dialog/index.ts");

    const modified = join(root, "src/components/ui/dialog/index.ts");
    writeFileSync(modified, `${readFileSync(modified, "utf-8")}\n// user drift\n`);

    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const after = readDialogFiles();
    expect(new Set(after)).toEqual(new Set(before));
    expect(after).toContain("src/components/ui/dialog/index.ts");
    expect(readFileSync(modified, "utf-8")).toContain("// user drift");
  });

  test("shorthand item install works after a global --silent option", () => {
    runDgadd(["--silent", "ui/button", "--cwd", root, "--yes", "--skip-install"], {
      silent: false,
    });
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);
  });

  test("shorthand item install works after a global -s option", () => {
    runDgadd(["-s", "keys/navigation", "--cwd", root, "--yes", "--skip-install"], {
      silent: false,
    });
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(true);
  });

  test("bare names without namespace prefix are rejected", () => {
    expect(() => runDgadd(["add", "button", "--cwd", root, "--yes", "--skip-install"])).toThrow(
      /not found|Invalid item name|Use a namespaced name/,
    );
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(false);
  });

  test("add does not adopt skipped pre-existing files into the ownership manifest", () => {
    const preExisting = [
      "src/components/ui/button/index.ts",
      "src/components/ui/button/button.tsx",
      "src/components/ui/spinner/index.ts",
      "src/components/ui/spinner/spinner.tsx",
      "src/components/ui/spinner/use-animation.ts",
      "src/components/ui/spinner/spinner-snake-grid.tsx",
      "src/lib/utils.ts",
    ];
    for (const relativePath of preExisting) {
      const absolutePath = join(root, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "// user file\n");
    }

    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.installedComponents).toBeUndefined();
  });

  test("keys add records ownership and remove deletes matching owned files without force", () => {
    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const ownedFiles = config.installedComponents["keys/navigation"].files;
    expect(
      ownedFiles.some((file: { path: string }) => file.path === "src/hooks/use-navigation.ts"),
    ).toBe(true);
    expect(
      ownedFiles.some(
        (file: { path: string }) => file.path === "src/hooks/utils/navigation-dispatch.ts",
      ),
    ).toBe(true);
    expect(ownedFiles.every((file: { path: string }) => !file.path.includes("\\"))).toBe(true);
    expect(readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8")).not.toMatch(
      /from "\.\.\/core\/navigation-dispatch\.js"/,
    );

    runDgadd(["remove", "keys/navigation", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(false);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["keys/navigation"]).toBeUndefined();
  });

  test("keys add preserves explicit ownership for hooks that overlap transitive files", () => {
    runDgadd([
      "add",
      "keys/focus-trap",
      "keys/focus-restore",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.installedComponents?.["keys/focus-trap"]).toBeTruthy();
    expect(config.installedComponents?.["keys/focus-restore"]).toBeTruthy();

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["keys/focus-trap"]).toBeUndefined();
    expect(updated.installedComponents?.["keys/focus-restore"]).toBeTruthy();
    expect(existsSync(join(root, "src/hooks/use-focus-trap.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(false);
  });

  test("sequential keys add adopts shared trusted files into the second item's manifest", () => {
    runDgadd(["add", "keys/focus-trap", "--cwd", root, "--yes", "--skip-install"]);
    runDgadd(["add", "keys/focus-restore", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.installedComponents?.["keys/focus-trap"]).toBeTruthy();
    expect(config.installedComponents?.["keys/focus-restore"]).toBeTruthy();

    const restoreFiles: Array<{ path: string }> =
      config.installedComponents["keys/focus-restore"].files ?? [];
    expect(
      restoreFiles.some((file) => file.path === "src/hooks/use-focus-restore.ts"),
      "second add should adopt shared use-focus-restore.ts via manifest",
    ).toBe(true);
    expect(
      restoreFiles.some((file) => file.path === "src/hooks/utils/focus-restore.ts"),
      "second add should adopt shared utils/focus-restore.ts via manifest",
    ).toBe(true);

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/hooks/use-focus-trap.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(true);

    const finalConfig = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(finalConfig.installedComponents?.["keys/focus-restore"]).toBeTruthy();
  });

  test("keys add does not adopt arbitrary pre-existing files into the new item's manifest", () => {
    const navigationHook = join(root, "src/hooks/use-navigation.ts");
    mkdirSync(dirname(navigationHook), { recursive: true });
    writeFileSync(navigationHook, "// user-authored impostor\n");

    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const navigationRecord = config.installedComponents?.["keys/navigation"];
    const navigationFiles: Array<{ path: string }> = navigationRecord?.files ?? [];
    expect(
      navigationFiles.some((file) => file.path === "src/hooks/use-navigation.ts"),
      "pre-existing user file with mismatched content must not be adopted",
    ).toBe(false);

    expect(readFileSync(navigationHook, "utf-8")).toBe("// user-authored impostor\n");
  });

  test("invalid fs path config fails before writing outside the project", () => {
    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    config.hooksFsPath = "../outside";
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));

    expect(() =>
      runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]),
    ).toThrow(/escapes|Project paths/);
    expect(existsSync(resolve(root, "..", "outside", "use-navigation.ts"))).toBe(false);
  });

  test("windows-style config paths are normalized in ownership records", () => {
    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    config.hooksFsPath = "src\\hooks";
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));

    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const ownedFiles = updated.installedComponents["keys/navigation"].files;
    expect(
      ownedFiles.some((file: { path: string }) => file.path === "src/hooks/use-navigation.ts"),
    ).toBe(true);
    expect(ownedFiles.every((file: { path: string }) => !file.path.includes("\\"))).toBe(true);
  });
});
