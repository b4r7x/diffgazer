import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertSourceRscClientDirectives } from "../cli/verify-rsc.js";

const USE_CLIENT = '"use client";\n';

describe("assertSourceRscClientDirectives", () => {
  let root: string;
  let srcDir: string;
  let distDir: string;

  function writeSrc(relPath: string, body: string): void {
    const full = join(srcDir, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }

  function writeDist(relPath: string, body: string): void {
    const full = join(distDir, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }

  function run(): number {
    return assertSourceRscClientDirectives({
      srcDir,
      distDir,
      packageLabel: "keys",
      skipDirs: ["testing", "cli"],
    });
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "rk-rsc-"));
    srcDir = join(root, "src");
    distDir = join(root, "dist");
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(distDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("counts every client source file whose dist output kept the directive", () => {
    writeSrc("index.ts", `${USE_CLIENT}export const a = 1;\n`);
    writeSrc("hooks/use-key.ts", `${USE_CLIENT}export const b = 2;\n`);
    writeSrc("dom/focusable.ts", "export const c = 3;\n");

    writeDist("index.js", `${USE_CLIENT}export const a = 1;\n`);
    writeDist("hooks/use-key.js", `${USE_CLIENT}export const b = 2;\n`);
    writeDist("dom/focusable.js", "export const c = 3;\n");

    expect(run()).toBe(2);
  });

  it("maps .tsx sources to their .js dist output", () => {
    writeSrc("providers/keyboard.tsx", `${USE_CLIENT}export const p = 1;\n`);
    writeDist("providers/keyboard.js", `${USE_CLIENT}export const p = 1;\n`);

    expect(run()).toBe(1);
  });

  it("throws naming the dist file when the directive is stripped from dist", () => {
    writeSrc("index.ts", `${USE_CLIENT}export const a = 1;\n`);
    writeDist("index.js", "export const a = 1;\n");

    expect(run).toThrow(/index\.js/);
  });

  it("throws on a missing dist output instead of skipping silently", () => {
    writeSrc("hooks/use-key.ts", `${USE_CLIENT}export const b = 2;\n`);

    expect(run).toThrow(/use-key\.js \(missing dist output\)/);
  });

  it("ignores test files and skipped directories", () => {
    writeSrc("index.test.ts", `${USE_CLIENT}export const t = 1;\n`);
    writeSrc("testing/test-utils.tsx", `${USE_CLIENT}export const u = 1;\n`);
    writeSrc("cli/program.ts", `${USE_CLIENT}export const v = 1;\n`);

    expect(run()).toBe(0);
  });

  it("detects a directive placed below a leading license comment", () => {
    writeSrc("index.ts", `/* license */\n${USE_CLIENT}export const a = 1;\n`);
    writeDist("index.js", `/* license */\n${USE_CLIENT}export const a = 1;\n`);

    expect(run()).toBe(1);
  });
});
