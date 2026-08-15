import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCli } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx } from "../context.js";
import { addCommand } from "./add/command.js";
import { removeCommand } from "./remove/command.js";
import { writeProjectFixture } from "./testing/project-fixture.js";

let root: string;

function createProgram() {
  return createCli({
    name: "dgadd-legacy-manifest-test",
    displayName: "DIFFGAZER LEGACY MANIFEST TEST",
    description: "pre-rename ownership ledger test",
    version: "0.0.0",
    commands: [addCommand, removeCommand],
  });
}

interface LegacyConfigFile {
  installedItems?: Record<string, unknown>;
  installedComponents?: Record<string, unknown>;
}

function readConfigFile(): LegacyConfigFile {
  return JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8")) as LegacyConfigFile;
}

/** Rewrite the ledger under the key the pre-rename dgadd wrote it to. */
function rewriteLedgerUnderLegacyKey(): void {
  const { installedItems, ...rest } = readConfigFile();
  writeFileSync(
    join(root, "diffgazer.json"),
    `${JSON.stringify({ ...rest, installedComponents: installedItems }, null, 2)}\n`,
  );
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-legacy-manifest-"));
  writeProjectFixture(root, { packageJson: { name: "fixture", type: "module" }, stylesCss: "" });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("a diffgazer.json written before the ownership ledger was renamed", () => {
  test("still owns installed hooks, so remove deletes them", async () => {
    const program = createProgram();
    await program.parseAsync(["add", "keys/focus-trap", "--cwd", root, "--yes", "--skip-install"], {
      from: "user",
    });
    const hookFiles = ctx.config.getManifestItems(root)?.["keys/focus-trap"]?.files ?? [];
    expect(hookFiles.length).toBeGreaterThan(0);

    rewriteLedgerUnderLegacyKey();

    vi.spyOn(console, "log").mockImplementation(() => {});
    await program.parseAsync(["remove", "keys/focus-trap", "--cwd", root, "--yes"], {
      from: "user",
    });

    for (const file of hookFiles) {
      expect(existsSync(join(root, file.path))).toBe(false);
    }
    expect(ctx.config.getManifestItems(root)?.["keys/focus-trap"]).toBeUndefined();
  });

  test("persists the recovered ledger under the current key on the next write", async () => {
    const program = createProgram();
    await program.parseAsync(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"], {
      from: "user",
    });

    rewriteLedgerUnderLegacyKey();

    await program.parseAsync(["add", "ui/badge", "--cwd", root, "--yes", "--skip-install"], {
      from: "user",
    });

    const config = readConfigFile();
    expect(Object.keys(config.installedItems ?? {})).toEqual(
      expect.arrayContaining(["ui/button", "ui/badge"]),
    );
    expect(config.installedComponents).toBeUndefined();
  });
});
