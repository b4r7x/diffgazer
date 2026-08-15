import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertRscClientDirectives,
  assertSourceRscClientDirectives,
  getPublicClientOutputMap,
  hasUseClientDirective,
} from "./verify-rsc.js";

const USE_CLIENT = '"use client";\n';
const CUSTOM_DIRECTIVE_WITH_ESCAPED_CRLF = [
  '"custom ',
  "\\",
  "\r\n",
  'directive";\n"use client";\n',
].join("");

describe("hasUseClientDirective", () => {
  it.each([
    ["a leading BOM", `﻿${USE_CLIENT}`],
    ["a leading line comment", `// license\r${USE_CLIENT}`],
    ["a leading block comment", `/* license */\n${USE_CLIENT}`],
    ["a leading hashbang", `#!/usr/bin/env node\n${USE_CLIENT}`],
    ["a single-quoted directive", `'use client';\n`],
    ["a directive followed by a comment and semicolon", '"use client" /* note */;\n'],
    ["a preceding directive prologue", '"use strict"; "use client";\n'],
    ["a preceding semicolonless directive prologue", '"use strict"\n"use client"\n'],
    [
      "a custom directive with an escaped CRLF before use client",
      CUSTOM_DIRECTIVE_WITH_ESCAPED_CRLF,
    ],
    ["a raw U+2028 in a prior directive", '"custom directive";\n"use client";\n'],
    ["a raw U+2029 in a prior directive", '"custom directive";\n"use client";\n'],
    ["an ASI boundary before prefix increment", '"use client"\n++counter;\n'],
    ["an ASI boundary before prefix decrement", '"use client"\n--counter;\n'],
    ["an ASI boundary before a unary negation", '"use client"\n!ready();\n'],
    ["a Unicode identifier after a keyword-shaped prefix", '"use client"\ninstanceofÉ;\n'],
    [
      "an escaped Unicode identifier after a keyword-shaped prefix",
      String.raw`"use client"
instanceof\u0061;
`,
    ],
  ])("accepts %s", (_label, source) => {
    expect(hasUseClientDirective(source)).toBe(true);
  });

  it.each([
    ["a member expression", '"use client".toString();\n'],
    ["a member expression after a line break", '"use client"\n.toString();\n'],
    ["an in expression after a line break", '"use client"\nin obj;\n'],
    ["an instanceof expression after a line break", '"use client"\ninstanceof String;\n'],
    ["a plus expression after a line break", '"use client"\n+counter;\n'],
    ["a minus expression after a line break", '"use client"\n-counter;\n'],
    ["a strict inequality after a line break", '"use client"\n!== other;\n'],
    ["a hashbang after a leading blank line", '\n#!/usr/bin/env node\n"use client";\n'],
    ["a hashbang after a leading comment", '// license\n#!/usr/bin/env node\n"use client";\n'],
    ["a call expression after a line break", '"use client"\n(callable)();\n'],
    ["a call expression", '"use client"();\n'],
    ["a longer string literal", '"use client extra";\n'],
    [
      "a non-directive expression before the client directive",
      '"use strict"\ncount++;\n"use client";\n',
    ],
    ["a Unicode identifier that is the instanceof keyword", '"use client"\ninstanceof;\n'],
    [
      "a Unicode escape that is not an identifier part",
      String.raw`"use client"
instanceof\u0020 value;
`,
    ],
    ["a raw CR in a directive", '"custom\rdirective";\n"use client";\n'],
    ["a raw LF in a directive", '"custom\ndirective";\n"use client";\n'],
    ["an unterminated trailing comment", '"use client" /*'],
  ])("rejects %s", (_label, source) => {
    expect(hasUseClientDirective(source)).toBe(false);
  });

  it("does not mutate or retain state from an adversarial source", () => {
    const sources = [
      '"use strict"\n"use client" /* comment */;\n',
      CUSTOM_DIRECTIVE_WITH_ESCAPED_CRLF,
      '"custom directive";\n"use client";\n',
      '"custom directive";\n"use client";\n',
    ];

    for (const source of sources) {
      const copy = `${source}`;
      expect(hasUseClientDirective(source)).toBe(true);
      expect(source).toBe(copy);
      expect(hasUseClientDirective(source)).toBe(true);
    }
  });
});

describe("public client output map", () => {
  const extraClientOutputs = {
    "./components/code-block/highlight": "components/code-block/highlight",
    "./components/command-palette/highlight": "components/command-palette/highlight",
  };
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
      extraClientOutputs,
    });
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ui-rsc-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("derives registry clients and the caller's non-registry subpaths from one map", () => {
    expect([...getPublicClientOutputMap(registryItems, extraClientOutputs)]).toEqual(clientOutputs);
  });

  it("derives only registry clients when the caller declares no extra subpaths", () => {
    expect([...getPublicClientOutputMap(registryItems)]).toEqual([
      ["./components/button", "components/button"],
    ]);
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

  const DIRECTIVE_PROLOGUE_CASES = [
    ["a leading BOM", (body: string) => `﻿${USE_CLIENT}${body}`],
    ["leading whitespace", (body: string) => `  \n\t${USE_CLIENT}${body}`],
    ["a leading line comment", (body: string) => `// license\n${USE_CLIENT}${body}`],
    ["a leading block comment", (body: string) => `/* license */\n${USE_CLIENT}${body}`],
    ["a single-quoted directive", (body: string) => `'use client';\n${body}`],
  ] as const;

  it.each(
    DIRECTIVE_PROLOGUE_CASES,
  )("detects the directive past %s in both source and dist", (_label, wrap) => {
    const body = "export const a = 1;\n";
    writeSrc("index.ts", wrap(body));
    writeDist("index.js", wrap(body));

    expect(run()).toBe(1);
  });
});
