import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("remove command", () => {
  test("remove --force deletes modified owned files and clears ownership", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    writeFileSync(buttonIndex, "// user edits\n");

    const output = runDgadd(["remove", "ui/button", "--cwd", root, "--yes", "--force"], {
      silent: false,
    });

    expect(output).toMatch(/Removed \d+ file\(s\) \([^)]*ui\/button[^)]*\)/);
    expect(existsSync(buttonIndex)).toBe(false);
    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.installedComponents?.["ui/button"]).toBeUndefined();
  });

  test("remove --force cleans stale manifest entries when owned files are already missing", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const buttonDir = join(root, "src/components/ui/button");
    rmSync(buttonDir, { recursive: true, force: true });
    expect(existsSync(buttonDir)).toBe(false);

    const before = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(before.installedComponents?.["ui/button"]).toBeTruthy();

    runDgadd(["remove", "ui/button", "--cwd", root, "--yes", "--force"]);

    const after = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(after.installedComponents?.["ui/button"]).toBeUndefined();
  });

  test("remove --dry-run previews owned files without changing files or manifest", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    const before = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));

    const output = runDgadd(["remove", "ui/button", "--cwd", root, "--dry-run", "--yes"], {
      silent: false,
    });

    expect(output).toMatch(/Files to remove:/);
    expect(output).toMatch(/src\/components\/ui\/button\/index\.ts/);
    expect(output).toMatch(/\(dry run - no changes made\)/);
    expect(existsSync(buttonIndex)).toBe(true);

    const after = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(after.installedComponents).toEqual(before.installedComponents);
  });

  test("bare names are rejected for remove command too", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    expect(() => runDgadd(["remove", "button", "--cwd", root, "--yes"])).toThrow(
      /not found|Invalid item name|Use a namespaced name/,
    );
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);
  });

  test("remove does not delete matching files without ownership metadata", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const buttonIndex = join(root, "src/components/ui/button/index.ts");

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    delete config.installedComponents;
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));

    runDgadd(["remove", "ui/button", "--cwd", root, "--yes"]);

    expect(existsSync(buttonIndex)).toBe(true);
  });

  test("keys remove deletes transitive copied hook files owned by the key item", () => {
    runDgadd(["add", "keys/focus-trap", "--cwd", root, "--yes", "--skip-install"]);

    expect(existsSync(join(root, "src/hooks/use-focus-trap.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(true);

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/hooks/use-focus-trap.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(false);
  });

  test("package-mode remove reports orphaned @diffgazer/keys", () => {
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

    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    pkg.dependencies = { ...(pkg.dependencies ?? {}), "@diffgazer/keys": "^0.2.0" };
    writeFileSync(join(root, "package.json"), JSON.stringify(pkg, null, 2));

    const output = runDgadd(["remove", "ui/select", "--cwd", root, "--yes"], { silent: false });

    expect(output).toMatch(/unused packages:.*@diffgazer\/keys/);
  });

  test("stale cleanup reports orphaned npm dependencies", () => {
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

    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    pkg.dependencies = {
      ...(pkg.dependencies ?? {}),
      "@diffgazer/keys": "^0.2.0",
      clsx: "^2.0.0",
    };
    writeFileSync(join(root, "package.json"), JSON.stringify(pkg, null, 2));

    rmSync(join(root, "src"), { recursive: true, force: true });

    const output = runDgadd(["remove", "ui/select", "--cwd", root, "--yes", "--force"], {
      silent: false,
    });

    expect(output).toMatch(/stale manifest entry/);
    expect(output).toMatch(/unused packages:.*@diffgazer\/keys/);
  });

  test("copy-mode remove does not suggest removing @diffgazer/keys when it was never installed", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const output = runDgadd(["remove", "ui/button", "--cwd", root, "--yes"], { silent: false });

    expect(output).not.toMatch(/@diffgazer\/keys/);
  });

  test("remove blocks copied keys hooks still required by retained copy-mode UI", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    const output = runDgadd(["remove", "keys/navigation", "--cwd", root, "--yes"], {
      silent: false,
    });

    expect(output).toMatch(/Keeping keys\/navigation/);
    expect(output).toMatch(/ui\/select/);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(true);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["ui/select"]).toBeTruthy();
    expect(updated.installedComponents?.["keys/navigation"]).toBeTruthy();
  });

  test("mixed remove deletes copied keys hooks when their copy-mode UI dependent is removed too", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    runDgadd(["remove", "ui/select", "keys/navigation", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/components/ui/select/select.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(false);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["ui/select"]).toBeUndefined();
    expect(updated.installedComponents?.["keys/navigation"]).toBeUndefined();
  });

  test("mixed remove updates manifest and output only for actually removed items", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    const navigationHook = join(root, "src/hooks/use-navigation.ts");
    writeFileSync(navigationHook, `${readFileSync(navigationHook, "utf-8")}\n// user edit\n`);

    const output = runDgadd(["remove", "ui/select", "keys/navigation", "--cwd", root, "--yes"], {
      silent: false,
    });

    expect(output).toMatch(/Removed \d+ file\(s\) \([^)]*ui\/select[^)]*\)/);
    expect(output).not.toMatch(/Removed \d+ file\(s\) \([^)]*keys\/navigation[^)]*\)/);
    expect(existsSync(join(root, "src/components/ui/select/select.tsx"))).toBe(false);
    expect(existsSync(navigationHook)).toBe(true);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["ui/select"]).toBeUndefined();
    expect(updated.installedComponents?.["keys/navigation"]).toBeTruthy();
  });

  test("remove of a transitive blocks when a retained item still depends on it", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const buttonSource = join(root, "src/components/ui/button/button.tsx");
    expect(existsSync(buttonSource)).toBe(true);

    const output = runDgadd(["remove", "ui/button", "--cwd", root, "--yes"], { silent: false });

    expect(output).toMatch(/Keeping ui\/button; still required by: ui\/dialog/);
    expect(existsSync(buttonSource)).toBe(true);

    const manifest = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(manifest.installedComponents?.["ui/button"]).toBeTruthy();
    expect(manifest.installedComponents?.["ui/dialog"]).toBeTruthy();
  });

  test("remove of the explicit item cascades orphan transitives", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const beforeManifest = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(beforeManifest.installedComponents?.["ui/portal"]).toBeTruthy();
    expect(beforeManifest.installedComponents?.["ui/button"]).toBeTruthy();
    expect(beforeManifest.installedComponents?.["ui/button"]?.installedAs).toBe("transitive");
    expect(beforeManifest.installedComponents?.["ui/dialog"]?.installedAs).toBe("explicit");

    runDgadd(["remove", "ui/dialog", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/components/ui/dialog/dialog.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/components/ui/shared/portal.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(false);

    const manifest = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(manifest.installedComponents ?? {}).toEqual({});
  });

  test("explicit installs are preserved as orphans when their dependent is removed", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const manifestBeforeRemove = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(manifestBeforeRemove.installedComponents?.["ui/button"]?.installedAs).toBe("explicit");

    runDgadd(["remove", "ui/dialog", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/components/ui/dialog/dialog.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);

    const manifest = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(manifest.installedComponents?.["ui/button"]).toBeTruthy();
    expect(manifest.installedComponents?.["ui/dialog"]).toBeUndefined();
  });
});
