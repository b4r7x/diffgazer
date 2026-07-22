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

describe("ownership boundaries", () => {
  test("remove of remaining co-owner deletes shared files when other co-owner was manually purged from manifest", () => {
    runDgadd([
      "add",
      "keys/focus-trap",
      "keys/focus-restore",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const before = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(before.installedComponents?.["keys/focus-trap"]).toBeTruthy();
    expect(before.installedComponents?.["keys/focus-restore"]).toBeTruthy();

    delete before.installedComponents["keys/focus-restore"];
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(before, null, 2));

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/hooks/use-focus-trap.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(false);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["keys/focus-trap"]).toBeUndefined();
    expect(updated.installedComponents?.["keys/focus-restore"]).toBeUndefined();
  });

  test("add --overwrite replaces a locally-modified owned file and updates the ownership hash", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    const originalContent = readFileSync(buttonIndex, "utf-8");
    const configPath = join(root, "diffgazer.json");
    const initialConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    const ownedFile = initialConfig.installedComponents["ui/button"].files.find(
      (file: { path: string }) => file.path === "src/components/ui/button/index.ts",
    );
    expect(ownedFile?.hash, "initial install should hash the index file").toBeTruthy();

    const sentinelHash = "sha256-sentinel-hash-not-a-real-digest";
    ownedFile.hash = sentinelHash;
    writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));

    writeFileSync(buttonIndex, "// user edits\n");

    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install", "--overwrite"]);

    const reinstalledContent = readFileSync(buttonIndex, "utf-8");
    expect(reinstalledContent, "bytes should be restored to the registry content").toBe(
      originalContent,
    );

    const updatedConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    const updatedHash = updatedConfig.installedComponents["ui/button"].files.find(
      (file: { path: string }) => file.path === "src/components/ui/button/index.ts",
    )?.hash;
    expect(updatedHash, "reinstall must recompute the hash from the reinstalled content").toBe(
      computeIntegrity(reinstalledContent),
    );
    expect(updatedHash, "the recomputed hash must not be the stale sentinel").not.toBe(
      sentinelHash,
    );
  });

  test("hidden optional logo-figlet install writes figlet helpers", () => {
    runDgadd(["add", "ui/logo-figlet", "--cwd", root, "--yes", "--skip-install"]);

    expect(existsSync(join(root, "src/components/ui/logo/figlet.ts"))).toBe(true);
    expect(existsSync(join(root, "src/components/ui/logo/figlet-text.ts"))).toBe(true);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.installedComponents?.["ui/logo-figlet"]).toBeTruthy();
  });

  test("hidden optional code-block-highlight install writes lowlight helper", () => {
    runDgadd(["add", "ui/code-block-highlight", "--cwd", root, "--yes", "--skip-install"]);

    expect(existsSync(join(root, "src/components/ui/code-block/code-block-highlight.tsx"))).toBe(
      true,
    );

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.installedComponents?.["ui/code-block-highlight"]).toBeTruthy();
  });
});
