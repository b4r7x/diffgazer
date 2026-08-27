import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupRegistry } from "../testing/shadcn-registry-fixture.js";
import { validatePublicRegistryFresh } from "./validate.js";

const FIX_CMD = "pnpm build:registry";

function expectValidationThrows(tempDir: string, message: string | RegExp): void {
  expect(() => validatePublicRegistryFresh({ rootDir: tempDir, fixCommand: FIX_CMD })).toThrow(
    message,
  );
}

function writePublicButtonJson(tempDir: string, overrides: Record<string, unknown>): void {
  const existing = JSON.parse(
    readFileSync(join(tempDir, "public", "r", "button.json"), "utf-8"),
  ) as Record<string, unknown>;
  writeFileSync(
    join(tempDir, "public", "r", "button.json"),
    JSON.stringify({ ...existing, ...overrides }, null, 2),
  );
}

describe("validatePublicRegistryFresh", () => {
  let tempDir: string;
  let escapeSentinel: string | null;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-shadcn-validate-"));
    escapeSentinel = null;
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    if (escapeSentinel) {
      const fixtureEscaped = existsSync(escapeSentinel);
      rmSync(escapeSentinel, { force: true });
      expect(fixtureEscaped).toBe(false);
    }
  });

  it.each([
    {
      label: "item count mismatch",
      sourceItems: [
        { name: "button", files: [] },
        { name: "card", files: [] },
      ],
      publicItems: [{ name: "button" }],
      expected: "item count does not match",
    },
    {
      label: "missing source item in public registry",
      sourceItems: [
        { name: "button", files: [] },
        { name: "card", files: [] },
      ],
      publicItems: [{ name: "button" }, { name: "input" }],
      expected: 'missing item "card"',
    },
  ])("rejects $label", ({ sourceItems, publicItems, expected }) => {
    setupRegistry(tempDir, sourceItems, publicItems);
    expectValidationThrows(tempDir, expected);
  });

  it.each([
    {
      label: "dependencies",
      source: { dependencies: ["react", "clsx"] },
      publicItem: { dependencies: ["react"] },
      expected: "dependencies mismatch",
    },
    {
      label: "title",
      source: { title: "Button" },
      publicItem: { title: "Old button" },
      expected: "title mismatch",
    },
    {
      label: "description",
      source: { description: "Current description" },
      publicItem: { description: "Old description" },
      expected: "description mismatch",
    },
    {
      label: "meta",
      source: { meta: { category: "forms" } },
      publicItem: { meta: { category: "stale" } },
      expected: "meta mismatch",
    },
    {
      label: "registryDependencies",
      source: { registryDependencies: ["compose-refs"] },
      publicItem: { registryDependencies: [] },
      expected: "registryDependencies mismatch",
    },
    {
      label: "devDependencies",
      source: { devDependencies: ["vitest"] },
      publicItem: { devDependencies: [] },
      expected: "devDependencies mismatch",
    },
    {
      label: "cssVars",
      source: { cssVars: { light: { primary: "oklch(0.4 0.1 120)" } } },
      publicItem: { cssVars: { light: { primary: "stale" } } },
      expected: "cssVars mismatch",
    },
    {
      label: "css",
      source: { css: ".button { color: red; }" },
      publicItem: { css: ".button { color: blue; }" },
      expected: "css mismatch",
    },
    {
      label: "envVars",
      source: { envVars: ["DIFFGAZER_TOKEN"] },
      publicItem: { envVars: [] },
      expected: "envVars mismatch",
    },
    {
      label: "docs",
      source: { docs: "Use the current docs." },
      publicItem: { docs: "Stale docs." },
      expected: "docs mismatch",
    },
    {
      label: "categories",
      source: { categories: ["forms"] },
      publicItem: { categories: [] },
      expected: "categories mismatch",
    },
    {
      label: "author",
      source: { author: "Diffgazer" },
      publicItem: { author: "Someone else" },
      expected: "author mismatch",
    },
  ])("rejects stale public registry $label", ({ source, publicItem, expected }) => {
    setupRegistry(
      tempDir,
      [{ name: "button", files: [], ...source }],
      [{ name: "button", ...publicItem }],
    );
    expectValidationThrows(tempDir, expected);
  });

  it.each([
    {
      label: "file content drift",
      files: [{ path: "registry/ui/button.tsx", content: "stale content\n" }],
      expected: "content is stale",
    },
    {
      label: "missing public file entry",
      files: [],
      expected: "item JSON files mismatch",
    },
    {
      label: "extra public file entry",
      files: [
        { path: "registry/ui/button.tsx", content: "// button - registry/ui/button.tsx\n" },
        { path: "registry/ui/extra.tsx", content: "// stale extra\n" },
      ],
      expected: "item JSON files mismatch",
    },
  ])("rejects $label", ({ files, expected }) => {
    setupRegistry(
      tempDir,
      [{ name: "button", files: [{ path: "registry/ui/button.tsx" }] }],
      undefined,
      { button: files },
    );
    expectValidationThrows(tempDir, expected);
  });

  it.each([
    {
      label: "target",
      sourceFile: { target: "~/styles/dialog.css" },
      publicFile: { target: "~/styles/stale-dialog.css" },
      expected: "target is stale",
    },
    {
      label: "type",
      sourceFile: { type: "registry:style" },
      publicFile: { type: "registry:ui" },
      expected: "type is stale",
    },
  ])("rejects stale public file $label metadata", ({ sourceFile, publicFile, expected }) => {
    setupRegistry(
      tempDir,
      [
        {
          name: "dialog-shell",
          files: [{ path: "registry/ui/shared/dialog.css", ...sourceFile }],
        },
      ],
      undefined,
      {
        "dialog-shell": [
          {
            path: "registry/ui/shared/dialog.css",
            content: "// dialog-shell - registry/ui/shared/dialog.css\n",
            ...publicFile,
          },
        ],
      },
    );
    expectValidationThrows(tempDir, expected);
  });

  it.each([
    {
      label: "dependencies",
      overrides: { dependencies: [] },
      expected: "item JSON dependencies mismatch",
    },
    {
      label: "registryDependencies",
      overrides: { registryDependencies: [] },
      expected: "item JSON registryDependencies mismatch",
    },
    {
      label: "description",
      overrides: { description: "Stale description" },
      expected: "item JSON description mismatch",
    },
    {
      label: "meta",
      overrides: { meta: { category: "stale" } },
      expected: "item JSON meta mismatch",
    },
    {
      label: "devDependencies",
      overrides: { devDependencies: [] },
      expected: "item JSON devDependencies mismatch",
    },
    {
      label: "cssVars",
      overrides: { cssVars: { light: { primary: "stale" } } },
      expected: "item JSON cssVars mismatch",
    },
    {
      label: "css",
      overrides: { css: ".button { color: blue; }" },
      expected: "item JSON css mismatch",
    },
    { label: "envVars", overrides: { envVars: [] }, expected: "item JSON envVars mismatch" },
    { label: "docs", overrides: { docs: "Stale docs." }, expected: "item JSON docs mismatch" },
    {
      label: "categories",
      overrides: { categories: [] },
      expected: "item JSON categories mismatch",
    },
    {
      label: "author",
      overrides: { author: "Someone else" },
      expected: "item JSON author mismatch",
    },
  ])("rejects stale public item JSON $label", ({ overrides, expected }) => {
    setupRegistry(tempDir, [
      {
        name: "button",
        title: "Button",
        description: "Current description",
        dependencies: ["react"],
        registryDependencies: ["card"],
        devDependencies: ["vitest"],
        cssVars: { light: { primary: "oklch(0.4 0.1 120)" } },
        css: ".button { color: red; }",
        envVars: ["DIFFGAZER_TOKEN"],
        docs: "Use the current docs.",
        categories: ["forms"],
        author: "Diffgazer",
        meta: { category: "forms" },
        files: [{ path: "registry/ui/button.tsx" }],
      },
    ]);
    writePublicButtonJson(tempDir, overrides);
    expectValidationThrows(tempDir, expected);
  });

  it("accepts file content that matches after the configured source transform", () => {
    setupRegistry(
      tempDir,
      [{ name: "button", files: [{ path: "registry/ui/button.tsx" }] }],
      undefined,
      {
        button: [{ path: "registry/ui/button.tsx", content: "transformed content\n" }],
      },
    );

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
        transformSourceContent: () => "transformed content\n",
      }),
    ).not.toThrow();
  });

  it("accepts file metadata that matches after the configured source item transform", () => {
    setupRegistry(
      tempDir,
      [
        {
          name: "button",
          files: [
            {
              path: "registry/ui/button.tsx",
              target: "~/components/source-button.tsx",
              type: "registry:ui",
            },
          ],
        },
      ],
      undefined,
      {
        button: [
          {
            path: "registry/ui/button.tsx",
            content: "// button - registry/ui/button.tsx\n",
            target: "~/components/button.tsx",
            type: "registry:file",
          },
        ],
      },
    );

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
        transformSourceItem: ({ item }) => ({
          ...item,
          files: item.files.map((file) => ({
            ...file,
            target: "~/components/button.tsx",
            type: "registry:file",
          })),
        }),
      }),
    ).not.toThrow();
  });

  it.each([
    { label: "absolute source file path", path: "/etc/passwd" },
    { label: "windows absolute source file path", path: "C:\\windows\\system32" },
  ])("rejects an $label in the public registry validation path", ({ path }) => {
    setupRegistry(tempDir, [{ name: "button", files: [{ path }] }], undefined, {
      button: [{ path, content: "// button\n" }],
    });
    expectValidationThrows(tempDir, /Unsafe registry file path/);
  });

  it("rejects a parent-escaping source path without materializing it outside the fixture", () => {
    const path = `../${basename(tempDir)}-escape.tsx`;
    escapeSentinel = resolve(tempDir, path);

    setupRegistry(tempDir, [{ name: "button", files: [{ path }] }], undefined, {
      button: [{ path, content: "// button\n" }],
    });

    expectValidationThrows(tempDir, /Unsafe registry file path/);
    expect(existsSync(escapeSentinel)).toBe(false);
  });

  it("rejects an unsafe file path that only appears in the public registry artifact", () => {
    setupRegistry(
      tempDir,
      [{ name: "button", files: [{ path: "registry/ui/button.tsx" }] }],
      undefined,
      { button: [{ path: "../escape.tsx", content: "// button - registry/ui/button.tsx\n" }] },
    );
    expectValidationThrows(tempDir, /Unsafe registry file path/);
  });

  it.each([
    { label: "parent-escaping", target: "../../escape.ts" },
    { label: "absolute", target: "/etc/passwd" },
  ])("rejects a safe file path with an $label target", ({ target }) => {
    setupRegistry(
      tempDir,
      [
        {
          name: "button",
          files: [{ path: "registry/ui/button.tsx", target: "~/components/button.tsx" }],
        },
      ],
      undefined,
      {
        button: [
          {
            path: "registry/ui/button.tsx",
            content: "// button - registry/ui/button.tsx\n",
            target,
          },
        ],
      },
    );
    expectValidationThrows(tempDir, /Unsafe registry file path/);
  });

  it("rejects an unsafe file path injected only into the public registry index", () => {
    setupRegistry(
      tempDir,
      [{ name: "button", files: [{ path: "registry/ui/button.tsx" }] }],
      [{ name: "button", files: [{ path: "../escape.tsx" }] }],
    );
    expectValidationThrows(tempDir, /Unsafe registry file path/);
  });

  it("rejects an unsafe target injected only into the public registry index", () => {
    setupRegistry(
      tempDir,
      [
        {
          name: "button",
          files: [{ path: "registry/ui/button.tsx", target: "~/components/button.tsx" }],
        },
      ],
      [{ name: "button", files: [{ path: "registry/ui/button.tsx", target: "/etc/passwd" }] }],
    );
    expectValidationThrows(tempDir, /Unsafe registry file path/);
  });

  it("rejects a public registry index whose file paths diverge from source", () => {
    setupRegistry(
      tempDir,
      [{ name: "button", files: [{ path: "registry/ui/button.tsx" }] }],
      [{ name: "button", files: [{ path: "registry/ui/other.tsx" }] }],
    );
    expectValidationThrows(tempDir, /index files mismatch/);
  });

  it("accepts a registry with multiple items whose source and public artifacts match", () => {
    setupRegistry(tempDir, [
      {
        name: "button",
        dependencies: ["react"],
        files: [{ path: "registry/ui/button.tsx" }],
      },
      {
        name: "card",
        dependencies: ["react"],
        registryDependencies: ["button"],
        files: [{ path: "registry/ui/card.tsx" }],
      },
    ]);

    expect(() =>
      validatePublicRegistryFresh({ rootDir: tempDir, fixCommand: FIX_CMD }),
    ).not.toThrow();
  });
});
