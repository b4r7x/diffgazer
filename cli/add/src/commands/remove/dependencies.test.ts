import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ManifestItem } from "../../context.js";
import { ctx } from "../../context.js";
import * as keysCopyBundle from "../../utils/keys-copy-bundle.js";
import { expandRemoval, loadManifest } from "./dependencies.js";

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

  function writeManifest(installedItems: Record<string, ManifestItem>): void {
    writeFileSync(join(root, "diffgazer.json"), `${JSON.stringify({ installedItems }, null, 2)}\n`);
  }

  // ui/button pulls in ui/spinner as a registry dependency; ui/toast pulls in the
  // same spinner, which is what makes the retained-dependent cases meaningful.
  test("does not cascade unrelated orphan transitives for an uninstalled requested item", () => {
    writeManifest({
      "ui/button": explicit({ requires: ["ui/spinner"] }),
      "ui/spinner": transitive(),
      "ui/utils": transitive(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/callout"]);

    expect(plan.toRemove).toEqual(["ui/callout"]);
    expect(plan.blocked).toEqual([]);
  });

  test("does not cascade orphan transitives when only unrelated manifest entries remain", () => {
    writeManifest({
      "ui/spinner": transitive(),
      "ui/utils": transitive(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/callout"]);

    expect(plan.toRemove).toEqual(["ui/callout"]);
    expect(plan.blocked).toEqual([]);
  });

  test("cascades out a transitive whose only dependent is also being removed", () => {
    writeManifest({
      "ui/button": explicit({ requires: ["ui/spinner"] }),
      "ui/spinner": transitive(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/button"]);

    expect(plan.toRemove).toEqual(["ui/button", "ui/spinner"]);
    expect(plan.blocked).toEqual([]);
  });

  test("keeps a transitive that a retained item still depends on", () => {
    writeManifest({
      "ui/button": explicit(),
      "ui/toast": explicit(),
      "ui/spinner": transitive(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/button"]);

    expect(plan.toRemove).toEqual(["ui/button"]);
    expect(plan.blocked).toEqual([]);
  });

  test("blocks an explicitly requested item that a retained item still depends on", () => {
    writeManifest({ "ui/button": explicit(), "ui/spinner": explicit() });

    const plan = expandRemoval(loadManifest(root), ["ui/spinner"]);

    expect(plan.toRemove).not.toContain("ui/spinner");
    expect(plan.blocked).toEqual([{ name: "ui/spinner", dependents: ["ui/button"] }]);
  });

  test("treats a keys hook as a dependency of its copy-mode owner", () => {
    writeManifest({
      "ui/dialog-shell": explicit({ integrationMode: "copy" }),
      "keys/focus-trap": transitive({ integrationMode: "copy" }),
    });

    const plan = expandRemoval(loadManifest(root), ["keys/focus-trap"]);

    expect(plan.toRemove).not.toContain("keys/focus-trap");
    expect(plan.blocked).toEqual([{ name: "keys/focus-trap", dependents: ["ui/dialog-shell"] }]);
  });

  test("does not treat a keys hook as a dependency of a package-mode owner", () => {
    writeManifest({
      "ui/dialog-shell": explicit({ integrationMode: "@diffgazer/keys" }),
      "keys/focus-trap": transitive({ integrationMode: "copy" }),
    });

    const plan = expandRemoval(loadManifest(root), ["keys/focus-trap"]);

    expect(plan.toRemove).toEqual(["keys/focus-trap"]);
    expect(plan.blocked).toEqual([]);
  });

  test("does not cascade a transitive when a retained owner still lists it in persisted requires", () => {
    writeManifest({
      "ui/button": explicit({ requires: ["ui/spinner"] }),
      "ui/spinner": transitive(),
      "ui/toast": explicit(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/toast"]);

    expect(plan.toRemove).toEqual(["ui/toast"]);
    expect(plan.toRemove).not.toContain("ui/spinner");
    expect(plan.blocked).toEqual([]);
  });

  test("does not cascade a keys hook when a copy-mode owner still lists it in persisted requires", () => {
    writeManifest({
      "ui/dialog-shell": explicit({
        integrationMode: "copy",
        requires: ["keys/focus-trap"],
      }),
      "keys/focus-trap": transitive({ integrationMode: "copy" }),
      "ui/button": explicit(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/button"]);

    expect(plan.toRemove).toEqual(["ui/button"]);
    expect(plan.toRemove).not.toContain("keys/focus-trap");
    expect(plan.blocked).toEqual([]);
  });

  test("does not registry-cascade orphans when the manifest has no persisted requires", () => {
    writeManifest({ "ui/button": explicit(), "ui/spinner": transitive() });

    const plan = expandRemoval(loadManifest(root), ["ui/button"]);

    expect(plan.toRemove).toEqual(["ui/button"]);
    expect(plan.blocked).toEqual([]);
  });

  test("does not cascade a transitive when a legacy retained owner lacks persisted requires", () => {
    writeManifest({
      "ui/button": explicit(),
      "ui/toast": explicit({ requires: ["ui/theme"] }),
      "ui/spinner": transitive(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/toast"]);

    expect(plan.toRemove).toEqual(["ui/toast"]);
    expect(plan.toRemove).not.toContain("ui/spinner");
    expect(plan.blocked).toEqual([]);
  });

  test("cascades a transitive using persisted requires when every retained owner has edges", () => {
    writeManifest({
      "ui/button": explicit({ requires: ["ui/spinner"] }),
      "ui/toast": explicit({ requires: ["ui/theme"] }),
      "ui/spinner": transitive(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/button"]);

    expect(plan.toRemove).toEqual(["ui/button", "ui/spinner"]);
    expect(plan.blocked).toEqual([]);
  });

  test("blocks removal when persisted requires an edge absent from the live registry", () => {
    const resolveDeps = vi.spyOn(ctx.registry, "resolveDeps");
    resolveDeps.mockReturnValue(["button"]);

    writeManifest({
      "ui/button": explicit({ requires: ["ui/card"] }),
      "ui/card": explicit(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/card"]);

    expect(plan.toRemove).not.toContain("ui/card");
    expect(plan.blocked).toEqual([{ name: "ui/card", dependents: ["ui/button"] }]);

    resolveDeps.mockRestore();
  });

  test("cascades a keys hook using persisted requires when its owner is removed", () => {
    writeManifest({
      "ui/dialog-shell": explicit({
        integrationMode: "copy",
        requires: ["keys/focus-trap"],
      }),
      "keys/focus-trap": transitive({ integrationMode: "copy" }),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/dialog-shell"]);

    expect(plan.toRemove).toEqual(["ui/dialog-shell", "keys/focus-trap"]);
    expect(plan.blocked).toEqual([]);
  });

  test("blocks keys hook removal when persisted requires lists it but the live registry no longer does", () => {
    const resolveKeysHooks = vi.spyOn(keysCopyBundle, "resolveKeysHooksFromRegistry");
    resolveKeysHooks.mockReturnValue([]);

    writeManifest({
      "ui/dialog-shell": explicit({
        integrationMode: "copy",
        requires: ["keys/focus-trap"],
      }),
      "keys/focus-trap": explicit({ integrationMode: "copy" }),
    });

    const plan = expandRemoval(loadManifest(root), ["keys/focus-trap"]);

    expect(plan.toRemove).not.toContain("keys/focus-trap");
    expect(plan.blocked).toEqual([{ name: "keys/focus-trap", dependents: ["ui/dialog-shell"] }]);

    resolveKeysHooks.mockRestore();
  });

  test("blocks removal using persisted requires when the live registry no longer declares the edge", () => {
    writeManifest({
      "ui/button": explicit({ requires: ["ui/spinner"] }),
      "ui/spinner": explicit(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/spinner"]);

    expect(plan.toRemove).not.toContain("ui/spinner");
    expect(plan.blocked).toEqual([{ name: "ui/spinner", dependents: ["ui/button"] }]);
  });

  test("does not block an explicitly empty persisted edge after registry drift", () => {
    const resolveDeps = vi.spyOn(ctx.registry, "resolveDeps");
    resolveDeps.mockReturnValue(["button", "spinner"]);

    writeManifest({
      "ui/button": explicit({ requires: [] }),
      "ui/spinner": explicit(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/spinner"]);

    expect(plan.toRemove).toEqual(["ui/spinner"]);
    expect(plan.blocked).toEqual([]);
    resolveDeps.mockRestore();
  });

  test("cascades a legitimate transitive despite an unrelated legacy owner", () => {
    const resolveDeps = vi.spyOn(ctx.registry, "resolveDeps");
    resolveDeps.mockReturnValue(["toast"]);

    writeManifest({
      "ui/button": explicit({ requires: ["ui/spinner"] }),
      "ui/spinner": transitive(),
      "ui/toast": explicit(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/button"]);

    expect(plan.toRemove).toEqual(["ui/button", "ui/spinner"]);
    expect(plan.blocked).toEqual([]);
    resolveDeps.mockRestore();
  });

  // Recovery path: with the ownership ledger gone (`init --reset-manifest`, hand
  // edits) the requested names must still be eligible so file resolution can
  // reconstruct their paths from the registry.
  test("returns the requested names when the manifest is absent", () => {
    writeFileSync(join(root, "diffgazer.json"), `${JSON.stringify({}, null, 2)}\n`);

    const plan = expandRemoval(loadManifest(root), ["ui/button", "keys/focus-trap"]);

    expect(plan.toRemove).toEqual(["ui/button", "keys/focus-trap"]);
    expect(plan.blocked).toEqual([]);
  });

  test("includes absent requested names even when unrelated manifest entries remain", () => {
    writeManifest({
      "ui/toast": explicit(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/button"]);

    expect(plan.toRemove).toEqual(["ui/button"]);
    expect(plan.blocked).toEqual([]);
  });

  test("retracts cascaded dependencies when the requested owner is blocked", () => {
    writeManifest({
      "ui/overflow": explicit({ requires: ["ui/tooltip", "ui/popover"] }),
      "ui/tooltip": transitive({ requires: ["ui/popover"] }),
      "ui/popover": explicit({ requires: ["keys/focusable"] }),
      "keys/focusable": transitive(),
    });

    const plan = expandRemoval(loadManifest(root), ["ui/popover"]);

    expect(plan.toRemove).toEqual([]);
    expect(plan.blocked).toEqual([
      { name: "ui/popover", dependents: ["ui/overflow", "ui/tooltip"] },
    ]);
  });

  test("fixes blocked owner and dependency diagnostics to a request-order-independent point", () => {
    writeManifest({
      "ui/overflow": explicit({ requires: ["ui/tooltip", "ui/popover"] }),
      "ui/tooltip": transitive({ requires: ["ui/popover"] }),
      "ui/popover": explicit({ requires: ["keys/focusable"] }),
      "keys/focusable": transitive(),
    });

    const leafFirst = expandRemoval(loadManifest(root), ["keys/focusable", "ui/popover"]);
    const ownerFirst = expandRemoval(loadManifest(root), ["ui/popover", "keys/focusable"]);

    expect(leafFirst.toRemove).toEqual(ownerFirst.toRemove);
    expect(leafFirst.blocked).toEqual(ownerFirst.blocked);
    expect(leafFirst.toRemove).toEqual([]);
    expect(leafFirst.blocked).toEqual([
      { name: "ui/popover", dependents: ["ui/overflow", "ui/tooltip"] },
      { name: "keys/focusable", dependents: ["ui/popover"] },
    ]);
  });
});
