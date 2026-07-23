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

describe("list command", () => {
  test("list json hides internal items and omits bare aliases by default", () => {
    const items = JSON.parse(runDgadd(["list", "--cwd", root, "--json"])) as Array<{
      name: string;
    }>;
    const names = items.map((item) => item.name);

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
    const items = JSON.parse(runDgadd(["list", "--cwd", root, "--json", "--all"])) as Array<{
      name: string;
    }>;
    const names = items.map((item) => item.name);

    expect(names.filter((name) => name === "ui/portal").length).toBe(1);
    expect(names.filter((name) => name === "ui/dialog-shell").length).toBe(1);
    expect(names.filter((name) => name === "keys/focusable").length).toBe(1);
    expect(names.length).toBe(new Set(names).size);
  });
});

describe("diff command", () => {
  test("rejects a traversing persisted CSS chunk without touching the outside sentinel", () => {
    const sentinelName = `dgadd-diff-sentinel-${process.pid}-${Date.now()}`;
    const sentinelPath = join(tmpdir(), `${sentinelName}.css`);
    writeFileSync(sentinelPath, "outside sentinel\n");
    const configPath = join(root, "diffgazer.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    config.installedComponents = {
      "ui/dialog": {
        installedAt: "2026-07-15T00:00:00.000Z",
        cssChunks: [`x/../../${sentinelName}`],
      },
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    try {
      expect(() => runDgadd(["diff", "--cwd", root], { silent: false })).toThrow();
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
