import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { readFixtureConfig, runDgadd, writeFixtureConfig } from "./test-helpers.js";

let root: string;

function listNames(args: string[]): string[] {
  const items: unknown = JSON.parse(runDgadd(args));
  if (!Array.isArray(items)) throw new Error("Expected list JSON to be an array.");

  return items.map((item) => {
    if (typeof item !== "object" || item === null || !("name" in item)) {
      throw new Error("Expected every list item to have a name.");
    }
    if (typeof item.name !== "string")
      throw new Error("Expected every list item name to be a string.");
    return item.name;
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-cli-"));
  writeFixtureConfig(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("list command", () => {
  test("list json --installed is empty for a configured project with no installed items", () => {
    expect(listNames(["list", "--cwd", root, "--json", "--installed"])).toEqual([]);
  });

  test("list json hides internal items and omits bare aliases by default", () => {
    const names = listNames(["list", "--cwd", root, "--json"]);

    expect(names).toContain("ui/button");
    expect(names).not.toContain("button");
    expect(names).not.toContain("ui/theme");
    expect(names).not.toContain("theme");
    expect(names).not.toContain("ui/portal");
    expect(names).not.toContain("ui/dialog-shell");
    expect(names).not.toContain("keys/focusable");
    expect(names.length).toBe(new Set(names).size);
  });

  test("list json --all includes hidden internal items once", () => {
    const names = listNames(["list", "--cwd", root, "--json", "--all"]);

    expect(names.filter((name) => name === "ui/portal").length).toBe(1);
    expect(names.filter((name) => name === "ui/dialog-shell").length).toBe(1);
    expect(names.filter((name) => name === "keys/focusable").length).toBe(1);
    expect(names.length).toBe(new Set(names).size);
  });

  test("list json --installed filters public items and --all adds installed hidden dependencies", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const publicNames = listNames(["list", "--cwd", root, "--json", "--installed"]);
    const allNames = listNames(["list", "--cwd", root, "--json", "--installed", "--all"]);

    expect(publicNames).toContain("ui/dialog");
    expect(publicNames).not.toContain("ui/portal");
    expect(publicNames).not.toContain("ui/avatar");
    expect(allNames).toContain("ui/dialog");
    expect(allNames).toContain("ui/portal");
    expect(allNames).not.toContain("ui/avatar");
  });
});

describe("diff command", () => {
  // A traversing chunk value is rejected by the manifest hash schema, before diff
  // resolves any chunk path. Asserting the schema's own message keeps this guard
  // bound to that defense: a bare toThrow() also passes when the CLI dies for an
  // unrelated reason, which is exactly how a deleted defense would look.
  test("rejects a traversing persisted CSS chunk without touching the outside sentinel", () => {
    const sentinelName = `dgadd-diff-sentinel-${process.pid}-${Date.now()}`;
    const sentinelPath = join(tmpdir(), `${sentinelName}.css`);
    writeFileSync(sentinelPath, "outside sentinel\n");
    const configPath = join(root, "diffgazer.json");
    const config = readFixtureConfig(root);
    config.installedItems = {
      "ui/dialog": {
        installedAt: "2026-07-15T00:00:00.000Z",
        cssChunks: [`x/../../${sentinelName}`],
      },
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    try {
      expect(() => runDgadd(["diff", "--cwd", root], { silent: false })).toThrow(
        /cssChunks\.0: CSS chunk hashes must be sixteen lowercase hexadecimal characters/,
      );
      expect(readFileSync(sentinelPath, "utf-8")).toBe("outside sentinel\n");
    } finally {
      rmSync(sentinelPath, { force: true });
    }
  });

  test("default scope detects drift in hidden transitives", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const portalSource = join(root, "src/components/ui/shared/portal.tsx");
    writeFileSync(portalSource, `${readFileSync(portalSource, "utf-8")}\n// user drift\n`);

    const output = runDgadd(["diff", "--cwd", root], { silent: false });
    expect(output).toMatch(/ui\/portal/);
    expect(output).toMatch(/user drift/);
    expect(output).toMatch(/Summary:.*changed/);
  });

  test("accepts hidden transitive names as explicit arguments", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const portalSource = join(root, "src/components/ui/shared/portal.tsx");
    writeFileSync(portalSource, `${readFileSync(portalSource, "utf-8")}\n// user drift\n`);

    const output = runDgadd(["diff", "ui/portal", "--cwd", root], { silent: false });
    expect(output).toMatch(/user drift/);
  });
});
