import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { ManifestItem } from "../../context.js";
import { expandRemoval } from "./dependencies.js";

const INSTALLED_AT = "2026-01-01T00:00:00.000Z";

function explicit(overrides: Partial<ManifestItem> = {}): ManifestItem {
  return { installedAt: INSTALLED_AT, installedAs: "explicit", ...overrides };
}

function transitive(overrides: Partial<ManifestItem> = {}): ManifestItem {
  return { installedAt: INSTALLED_AT, installedAs: "transitive", ...overrides };
}

describe("expandRemoval", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "dgadd-expand-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeManifest(installedComponents: Record<string, ManifestItem>): void {
    writeFileSync(
      join(root, "diffgazer.json"),
      `${JSON.stringify({ installedComponents }, null, 2)}\n`,
    );
  }

  // ui/button pulls in ui/spinner as a registry dependency; ui/toast pulls in the
  // same spinner, which is what makes the retained-dependent cases meaningful.
  test("cascades out a transitive whose only dependent is also being removed", () => {
    writeManifest({ "ui/button": explicit(), "ui/spinner": transitive() });

    const plan = expandRemoval(root, ["ui/button"]);

    expect(plan.toRemove).toEqual(["ui/button", "ui/spinner"]);
    expect(plan.blocked).toEqual([]);
  });

  test("keeps a transitive that a retained item still depends on", () => {
    writeManifest({
      "ui/button": explicit(),
      "ui/toast": explicit(),
      "ui/spinner": transitive(),
    });

    const plan = expandRemoval(root, ["ui/button"]);

    expect(plan.toRemove).toEqual(["ui/button"]);
    expect(plan.blocked).toEqual([]);
  });

  test("blocks an explicitly requested item that a retained item still depends on", () => {
    writeManifest({ "ui/button": explicit(), "ui/spinner": explicit() });

    const plan = expandRemoval(root, ["ui/spinner"]);

    expect(plan.toRemove).not.toContain("ui/spinner");
    expect(plan.blocked).toEqual([{ name: "ui/spinner", dependents: ["ui/button"] }]);
  });

  test("treats a keys hook as a dependency of its copy-mode owner", () => {
    writeManifest({
      "ui/dialog-shell": explicit({ integrationMode: "copy" }),
      "keys/focus-trap": transitive({ integrationMode: "copy" }),
    });

    const plan = expandRemoval(root, ["keys/focus-trap"]);

    expect(plan.toRemove).not.toContain("keys/focus-trap");
    expect(plan.blocked).toEqual([{ name: "keys/focus-trap", dependents: ["ui/dialog-shell"] }]);
  });

  test("does not treat a keys hook as a dependency of a package-mode owner", () => {
    writeManifest({
      "ui/dialog-shell": explicit({ integrationMode: "@diffgazer/keys" }),
      "keys/focus-trap": transitive({ integrationMode: "copy" }),
    });

    const plan = expandRemoval(root, ["keys/focus-trap"]);

    expect(plan.toRemove).toEqual(["keys/focus-trap"]);
    expect(plan.blocked).toEqual([]);
  });

  // Recovery path: with the ownership ledger gone (`init --reset-manifest`, hand
  // edits) the requested names must still be eligible so file resolution can
  // reconstruct their paths from the registry.
  test("returns the requested names when the manifest is absent", () => {
    writeFileSync(join(root, "diffgazer.json"), `${JSON.stringify({}, null, 2)}\n`);

    const plan = expandRemoval(root, ["ui/button", "keys/focus-trap"]);

    expect(plan.toRemove).toEqual(["ui/button", "keys/focus-trap"]);
    expect(plan.blocked).toEqual([]);
  });
});
