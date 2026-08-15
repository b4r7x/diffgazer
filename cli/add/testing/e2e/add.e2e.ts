import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  manifestItem,
  readFixtureConfig,
  runDgadd,
  spawnDgadd,
  writeFixtureConfig,
} from "./test-helpers.js";

let root: string;

function snapshotFixtureTree(directory: string): Map<string, Buffer | null> {
  const snapshot = new Map<string, Buffer | null>();

  const visit = (current: string): void => {
    const entries = readdirSync(current, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      const absolutePath = join(current, entry.name);
      const fixturePath = relative(directory, absolutePath);
      if (entry.isDirectory()) {
        snapshot.set(`${fixturePath}/`, null);
        visit(absolutePath);
      } else {
        snapshot.set(fixturePath, readFileSync(absolutePath));
      }
    }
  };

  visit(directory);
  return snapshot;
}

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

    const config = readFixtureConfig(root);
    const ownedFiles = manifestItem(config, "ui/button").files ?? [];
    expect(ownedFiles.length).toBeGreaterThan(0);
    expect(ownedFiles.every((file) => file.hash?.startsWith("sha256-"))).toBe(true);
    const installedItemsBefore = config.installedItems;

    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    const buttonSource = join(root, "src/components/ui/button/button.tsx");
    writeFileSync(buttonIndex, "// user edits\n");

    const removal = spawnDgadd(["remove", "ui/button", "--cwd", root, "--yes"]);
    expect(removal.status).toBe(1);
    expect(`${removal.stdout}${removal.stderr}`).toContain("Not removed: ui/button");

    expect(readFileSync(buttonIndex, "utf-8")).toBe("// user edits\n");
    expect(existsSync(buttonSource)).toBe(true);
    expect(existsSync(join(root, "src/lib/utils.ts"))).toBe(true);
    expect(existsSync(join(root, "src/components/ui/spinner/spinner.tsx"))).toBe(true);

    const configAfter = readFixtureConfig(root);
    expect(configAfter.installedItems).toEqual(installedItemsBefore);
    expect(configAfter.installedItems?.["ui/button"]).toBeTruthy();
    expect(configAfter.installedItems?.["ui/spinner"]).toBeTruthy();
    expect(configAfter.installedItems?.["ui/utils"]).toBeTruthy();
  });

  test("legacy modified owners preserve live dependencies and CSS on failed removal", () => {
    const stylesPath = join(root, "src/styles/styles.css");
    const themeBasePath = join(root, "src/styles/theme-base.css");
    const themePath = join(root, "src/styles/theme.css");
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(stylesPath, '@import "./theme.css";\n');
    writeFileSync(themeBasePath, "/* user theme base */\n");
    writeFileSync(themePath, "/* user theme */\n");
    const themeBaseBefore = readFileSync(themeBasePath);
    const themeBefore = readFileSync(themePath);

    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const configPath = join(root, "diffgazer.json");
    const before = JSON.parse(readFileSync(configPath, "utf-8")) as {
      installedItems: Record<string, unknown>;
    };
    const button = before.installedItems["ui/button"] as Record<string, unknown>;
    delete button.requires;
    const stylesBefore = readFileSync(stylesPath);
    writeFileSync(configPath, `${JSON.stringify(before, null, 2)}\n`);

    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    writeFileSync(buttonIndex, "// user edits\n");

    const removal = spawnDgadd(["remove", "ui/button", "--cwd", root, "--yes"]);
    expect(removal.status).toBe(1);
    expect(`${removal.stdout}${removal.stderr}`).toContain("Not removed: ui/button");

    const after = JSON.parse(readFileSync(configPath, "utf-8")) as {
      installedItems: Record<string, unknown>;
    };
    expect(after.installedItems).toEqual(before.installedItems);
    expect(readFileSync(stylesPath)).toEqual(stylesBefore);

    for (const name of ["ui/button", "ui/spinner", "ui/utils"]) {
      const record = after.installedItems[name] as {
        files?: Array<{ path: string }>;
        cssChunks?: string[];
      };
      expect(record).toBeDefined();
      for (const file of record.files ?? []) {
        expect(existsSync(join(root, file.path))).toBe(true);
      }
      for (const hash of record.cssChunks ?? []) {
        expect(readFileSync(stylesPath, "utf-8")).toContain(`/* dgadd:css ${hash} */`);
      }
    }
    expect(after.installedItems["ui/spinner"]).toMatchObject({
      requires: expect.arrayContaining(["ui/theme"]),
    });
    expect(readFileSync(themeBasePath)).toEqual(themeBaseBefore);
    expect(readFileSync(themePath)).toEqual(themeBefore);
  });

  test("persists and refreshes empty dependency edges for current hook installs", () => {
    runDgadd(["add", "ui/controllable-state", "--cwd", root, "--yes", "--skip-install"]);

    const configPath = join(root, "diffgazer.json");
    const first = readFixtureConfig(root);
    expect(manifestItem(first, "ui/controllable-state").requires).toEqual([]);

    const stale = JSON.parse(readFileSync(configPath, "utf-8")) as {
      installedItems: Record<string, { requires?: string[] }>;
    };
    const staleControllableState = stale.installedItems["ui/controllable-state"];
    if (!staleControllableState) throw new Error("Expected controllable-state manifest item");
    staleControllableState.requires = ["ui/button"];
    writeFileSync(configPath, `${JSON.stringify(stale, null, 2)}\n`);

    runDgadd(["add", "ui/controllable-state", "--cwd", root, "--yes", "--skip-install"]);

    expect(manifestItem(readFixtureConfig(root), "ui/controllable-state").requires).toEqual([]);
  });

  test("legacy retained owners still block their live dependencies in a mixed manifest", () => {
    runDgadd(["add", "ui/controllable-state", "--cwd", root, "--yes", "--skip-install"]);
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const configPath = join(root, "diffgazer.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
      installedItems: Record<string, { requires?: string[] }>;
    };
    const controllableState = config.installedItems["ui/controllable-state"];
    const button = config.installedItems["ui/button"];
    if (!controllableState || !button) throw new Error("Expected mixed manifest items");
    expect(controllableState.requires).toEqual([]);
    delete button.requires;
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const removal = spawnDgadd(["remove", "ui/spinner", "--cwd", root, "--yes"]);
    expect(removal.status).toBe(1);
    expect(`${removal.stdout}${removal.stderr}`).toContain("Not removed: ui/spinner");

    const after = readFixtureConfig(root);
    expect(after.installedItems).toEqual(config.installedItems);
    for (const name of ["ui/controllable-state", "ui/button", "ui/spinner", "ui/utils"]) {
      const record = manifestItem(after, name);
      expect(record.files?.every((file) => existsSync(join(root, file.path)))).toBe(true);
    }
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

    const config = readFixtureConfig(root);
    const installed = config.installedItems ?? {};
    expect(installed["ui/portal"]?.installedAs).toBe("transitive");
    expect(installed["ui/dialog-shell"]?.installedAs).toBe("transitive");
    expect(installed["ui/dialog"]?.installedAs).toBe("explicit");
  });

  test("no-overwrite re-add preserves ownership of a locally modified owned file", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const readDialogFiles = (): string[] => {
      const config = readFixtureConfig(root);
      const files = manifestItem(config, "ui/dialog").files ?? [];
      return files.map((file) => file.path);
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
    // ui/kbd and its only transitive dep ship no registry:style, so a skipped
    // install must leave the manifest completely empty — a CSS-bearing item
    // would still record its appended chunk.
    const preExisting = [
      "src/components/ui/kbd/index.ts",
      "src/components/ui/kbd/kbd.tsx",
      "src/components/ui/kbd/kbd-group.tsx",
      "src/lib/utils.ts",
    ];
    for (const relativePath of preExisting) {
      const absolutePath = join(root, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "// user file\n");
    }

    runDgadd(["add", "ui/kbd", "--cwd", root, "--yes", "--skip-install"]);

    const config = readFixtureConfig(root);
    expect(config.installedItems).toBeUndefined();
  });

  test("keys add records ownership and remove deletes matching owned files without force", () => {
    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const config = readFixtureConfig(root);
    const ownedFiles = manifestItem(config, "keys/navigation").files ?? [];
    expect(ownedFiles.some((file) => file.path === "src/hooks/use-navigation.ts")).toBe(true);
    expect(ownedFiles.some((file) => file.path === "src/hooks/utils/navigation-dispatch.ts")).toBe(
      true,
    );
    expect(ownedFiles.every((file) => !file.path.includes("\\"))).toBe(true);
    expect(readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8")).not.toMatch(
      /from "\.\.\/core\/navigation-dispatch\.js"/,
    );

    runDgadd(["remove", "keys/navigation", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(false);

    const updated = readFixtureConfig(root);
    expect(updated.installedItems?.["keys/navigation"]).toBeUndefined();
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

    const config = readFixtureConfig(root);
    expect(config.installedItems?.["keys/focus-trap"]).toBeTruthy();
    expect(config.installedItems?.["keys/focus-restore"]).toBeTruthy();

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    const updated = readFixtureConfig(root);
    expect(updated.installedItems?.["keys/focus-trap"]).toBeUndefined();
    expect(updated.installedItems?.["keys/focus-restore"]).toBeTruthy();
    expect(existsSync(join(root, "src/hooks/use-focus-trap.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(false);
  });

  test("sequential keys add adopts shared trusted files into the second item's manifest", () => {
    runDgadd(["add", "keys/focus-trap", "--cwd", root, "--yes", "--skip-install"]);
    runDgadd(["add", "keys/focus-restore", "--cwd", root, "--yes", "--skip-install"]);

    const config = readFixtureConfig(root);
    expect(config.installedItems?.["keys/focus-trap"]).toBeTruthy();
    expect(config.installedItems?.["keys/focus-restore"]).toBeTruthy();

    const restoreFiles = manifestItem(config, "keys/focus-restore").files ?? [];
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

    const finalConfig = readFixtureConfig(root);
    expect(finalConfig.installedItems?.["keys/focus-restore"]).toBeTruthy();
  });

  test("keys add does not adopt arbitrary pre-existing files into the new item's manifest", () => {
    const navigationHook = join(root, "src/hooks/use-navigation.ts");
    mkdirSync(dirname(navigationHook), { recursive: true });
    writeFileSync(navigationHook, "// user-authored impostor\n");

    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const config = readFixtureConfig(root);
    const navigationRecord = config.installedItems?.["keys/navigation"];
    const navigationFiles = navigationRecord?.files ?? [];
    expect(
      navigationFiles.some((file) => file.path === "src/hooks/use-navigation.ts"),
      "pre-existing user file with mismatched content must not be adopted",
    ).toBe(false);

    expect(readFileSync(navigationHook, "utf-8")).toBe("// user-authored impostor\n");
  });

  test("invalid fs path config fails before writing outside the project", () => {
    const config = readFixtureConfig(root);
    config.hooksFsPath = "../outside";
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));

    expect(() =>
      runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]),
    ).toThrow(/escapes|Project paths/);
    expect(existsSync(resolve(root, "..", "outside", "use-navigation.ts"))).toBe(false);
  });

  test("rejects a symlinked mutation-lock directory without creating an external lock", () => {
    const outside = mkdtempSync(join(tmpdir(), "dgadd-lock-outside-"));
    symlinkSync(outside, join(root, ".diffgazer"), "dir");

    try {
      expect(() =>
        runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]),
      ).toThrow(/symlink component/);
      expect(existsSync(join(outside, "mutation.lock"))).toBe(false);
      expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("windows-style config paths are normalized in ownership records", () => {
    const config = readFixtureConfig(root);
    config.hooksFsPath = "src\\hooks";
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));

    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const updated = readFixtureConfig(root);
    const ownedFiles = manifestItem(updated, "keys/navigation").files ?? [];
    expect(ownedFiles.some((file) => file.path === "src/hooks/use-navigation.ts")).toBe(true);
    expect(ownedFiles.every((file) => !file.path.includes("\\"))).toBe(true);
  });

  test("add and remove preserve unknown config keys the published schema accepts", () => {
    const configPath = join(root, "diffgazer.json");
    const authored = JSON.parse(readFileSync(configPath, "utf-8"));
    writeFileSync(
      configPath,
      JSON.stringify({ ...authored, customExtension: { keep: "me" } }, null, 2),
    );

    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    expect(JSON.parse(readFileSync(configPath, "utf-8")).customExtension).toEqual({ keep: "me" });

    runDgadd(["remove", "ui/button", "--cwd", root, "--yes"]);
    expect(JSON.parse(readFileSync(configPath, "utf-8")).customExtension).toEqual({ keep: "me" });
  });

  test("add --dry-run leaves the complete fixture tree byte-identical", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
    writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    const before = snapshotFixtureTree(root);

    const output = runDgadd(["add", "ui/input", "--cwd", root, "--dry-run", "--yes"], {
      silent: false,
    });

    expect(output).toMatch(/\(dry run - no changes made\)/);
    expect(output).toContain("src/components/ui/input/input.tsx");
    expect(snapshotFixtureTree(root)).toEqual(before);
  });
});
