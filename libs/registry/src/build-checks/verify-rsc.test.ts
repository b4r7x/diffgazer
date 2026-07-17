import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertRscClientDirectives,
  assertSourceRscClientDirectives,
  getUiPublicClientOutputMap,
} from "./verify-rsc.js";

const USE_CLIENT = '"use client";\n';

describe("UI public client output map", () => {
  const clientOutputs = [
    ["./components/button", "components/button"],
    ["./components/code-block/highlight", "components/code-block/highlight"],
    ["./components/command-palette/highlight", "components/command-palette/highlight"],
  ] as const;
  const registryItems = [
    { name: "button", type: "registry:ui", meta: { client: true } },
    { name: "badge", type: "registry:ui", meta: { client: false } },
    { name: "internal", type: "registry:ui", meta: { client: true, hidden: true } },
  ];
  let root: string;

  function writeJson(relPath: string, value: unknown): void {
    const full = join(root, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`);
  }

  function writeOutput(output: string, body = `${USE_CLIENT}export const value = 1;\n`): void {
    const full = join(root, "dist", `${output}.js`);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }

  function writeCompleteFixture(): void {
    writeJson("registry/registry.json", { items: registryItems });
    writeJson("package.json", {
      exports: Object.fromEntries(
        clientOutputs.map(([publicSubpath, output]) => [
          publicSubpath,
          { import: `./dist/${output}.js` },
        ]),
      ),
    });
    for (const [, output] of clientOutputs) writeOutput(output);
  }

  function verify(): void {
    assertRscClientDirectives({
      rootDir: root,
      registryPath: join(root, "registry/registry.json"),
    });
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ui-rsc-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("derives registry clients and both non-registry highlight subpaths from one map", () => {
    expect([...getUiPublicClientOutputMap(registryItems)]).toEqual(clientOutputs);
  });

  it("accepts every emitted public client subpath used by a Next server-component fixture", () => {
    writeCompleteFixture();

    expect(verify).not.toThrow();
  });

  it.each(
    clientOutputs,
  )("rejects %s when its emitted file loses the directive", (_path, output) => {
    writeCompleteFixture();
    writeOutput(output, "export const value = 1;\n");

    expect(verify).toThrow(new RegExp(`${output.replaceAll("/", "\\/")}\\.js`));
  });

  it("rejects a missing public client output instead of silently skipping it", () => {
    writeCompleteFixture();
    rmSync(join(root, "dist/components/code-block/highlight.js"));

    expect(verify).toThrow(/code-block\/highlight\.js \(missing public client output\)/);
  });

  it("rejects a client output that is not reachable through the package exports map", () => {
    writeCompleteFixture();
    writeJson("package.json", {
      exports: Object.fromEntries(
        clientOutputs
          .filter(([publicSubpath]) => publicSubpath !== "./components/command-palette/highlight")
          .map(([publicSubpath, output]) => [publicSubpath, { import: `./dist/${output}.js` }]),
      ),
    });

    expect(verify).toThrow(/command-palette\/highlight.*missing package export/);
  });
});

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
