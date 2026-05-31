import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveLocalShadcnBin, runShadcnRegistryBuild } from "../shadcn/runner.js";
import { validatePublicRegistryFresh } from "../shadcn/validate.js";
import type { RegistryFile, RegistryItem } from "../registry-types.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const FIX_CMD = "pnpm build:registry";

type RegistryContentTransform = (content: string) => string;
type RegistrySourceContentTransform = (ctx: { itemName: string; filePath: string; content: string }) => string;
type RegistrySourceItemTransform = NonNullable<Parameters<typeof validatePublicRegistryFresh>[0]["transformSourceItem"]>;
type RegistryItemFixture = { name: string } & Partial<Omit<RegistryItem, "name">>;
type PublicRegistryFileFixture = RegistryFile & { content: string };

async function loadExport<T>(modulePath: string, exportName: string): Promise<T> {
  const loaded = await import(pathToFileURL(modulePath).href) as Record<string, unknown>;
  const value = loaded[exportName];
  if (typeof value !== "function") {
    throw new Error(`Missing export: ${exportName}`);
  }
  return value as T;
}

function makeContentTransform(transform: RegistryContentTransform): RegistrySourceContentTransform {
  return ({ content }) => transform(content);
}

function makeItemTransform(transform: (item: RegistryItem) => RegistryItem): RegistrySourceItemTransform {
  return ({ item }) => transform(item);
}

function writeShadcnBin(tempDir: string, segments: string[]): string {
  const binDir = join(tempDir, ...segments, "node_modules", ".bin");
  mkdirSync(binDir, { recursive: true });
  const binPath = join(binDir, "shadcn");
  writeFileSync(binPath, "#!/bin/sh\n");
  chmodSync(binPath, 0o755);
  return binPath;
}

function setupRegistry(
  tempDir: string,
  sourceItems: RegistryItemFixture[],
  publicItems?: RegistryItemFixture[],
  publicItemFiles?: Record<string, PublicRegistryFileFixture[]>,
): void {
  const normalizedSource = sourceItems.map((item) => ({ type: "registry:ui", files: [], ...item }));
  const normalizedPublic = publicItems?.map((item) => ({ type: "registry:ui", files: [], ...item }));

  const sourceDir = join(tempDir, "registry");
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(
    join(sourceDir, "registry.json"),
    JSON.stringify({ items: normalizedSource }, null, 2),
  );

  for (const item of normalizedSource) {
    for (const file of item.files ?? []) {
      const filePath = join(tempDir, file.path);
      mkdirSync(join(filePath, ".."), { recursive: true });
      writeFileSync(filePath, `// ${item.name} - ${file.path}\n`);
    }
  }

  const publicDir = join(tempDir, "public", "r");
  mkdirSync(publicDir, { recursive: true });
  const pubItems = normalizedPublic ?? normalizedSource;
  writeFileSync(
    join(publicDir, "registry.json"),
    JSON.stringify({ items: pubItems }, null, 2),
  );

  for (const item of pubItems) {
    const files = publicItemFiles?.[item.name] ??
      (normalizedSource.find((s) => s.name === item.name)?.files ?? []).map(
        (f) => ({
          path: f.path,
          content: `// ${item.name} - ${f.path}\n`,
          type: f.type,
          target: f.target,
        }),
      );
    writeFileSync(
      join(publicDir, `${item.name}.json`),
      JSON.stringify({ ...item, files }, null, 2),
    );
  }
}

function expectValidationThrows(tempDir: string, message: string | RegExp): void {
  expect(() =>
    validatePublicRegistryFresh({ rootDir: tempDir, fixCommand: FIX_CMD }),
  ).toThrow(message);
}

function writePublicButtonJson(tempDir: string, overrides: Record<string, unknown>): void {
  const existing = JSON.parse(readFileSync(join(tempDir, "public", "r", "button.json"), "utf-8")) as Record<string, unknown>;
  writeFileSync(
    join(tempDir, "public", "r", "button.json"),
    JSON.stringify({ ...existing, ...overrides }, null, 2),
  );
}

describe("shadcn binary lifecycle", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-shadcn-bin-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns undefined when no shadcn binary exists", () => {
    expect(resolveLocalShadcnBin(tempDir)).toBeUndefined();
  });

  it.each([
    { label: "node_modules/.bin/ at startDir", from: [], projectFrom: [] },
    { label: "../node_modules/.bin/ one level up", from: ["packages"], projectFrom: ["packages", "lib"] },
    { label: "../../node_modules/.bin/ two levels up", from: ["a"], projectFrom: ["a", "b", "c"] },
  ])("resolves shadcn binary in $label", ({ from, projectFrom }) => {
    const projectDir = projectFrom.length === 0 ? tempDir : join(tempDir, ...projectFrom);
    if (projectFrom.length > 0) {
      mkdirSync(projectDir, { recursive: true });
    }
    const binPath = writeShadcnBin(tempDir, from);

    const resolved = resolveLocalShadcnBin(projectDir);
    expect(resolved).toBe(from.length === 0 ? binPath : resolve(binPath));
  });

  it("throws when runShadcnRegistryBuild cannot find the shadcn binary", () => {
    expect(() =>
      runShadcnRegistryBuild({ rootDir: tempDir }),
    ).toThrow("Local shadcn CLI binary not found");
  });
});

describe("validatePublicRegistryFresh", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-shadcn-validate-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it.each([
    {
      label: "ui",
      rootDir: resolve(repoRoot, "libs/ui"),
      fixCommand: "pnpm --filter @diffgazer/ui build:shadcn",
      transformModule: resolve(repoRoot, "libs/ui/scripts/transform-public-registry-keys-imports.ts"),
      transformExport: "transformUiPublicRegistryKeysImportContent",
      transformItemExport: "transformUiPublicRegistryItem" as string | undefined,
      useFactory: false,
    },
    {
      label: "keys",
      rootDir: resolve(repoRoot, "libs/keys"),
      fixCommand: "pnpm --dir libs/keys build:shadcn",
      transformModule: resolve(repoRoot, "libs/keys/scripts/transform-public-registry-imports.ts"),
      transformExport: "createKeysSourceContentTransform",
      transformItemExport: undefined,
      useFactory: true,
    },
  ])("keeps committed $label public/r in sync with the source registry", async (registry) => {
    const transformSourceContent: RegistrySourceContentTransform = registry.useFactory
      ? (await loadExport<(rootDir: string) => RegistrySourceContentTransform>(
          registry.transformModule,
          registry.transformExport,
        ))(registry.rootDir)
      : makeContentTransform(
          await loadExport<RegistryContentTransform>(registry.transformModule, registry.transformExport),
        );

    const transformSourceItem = registry.transformItemExport
      ? makeItemTransform(
          await loadExport<(item: RegistryItem) => RegistryItem>(
            registry.transformModule,
            registry.transformItemExport,
          ),
        )
      : undefined;

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: registry.rootDir,
        fixCommand: registry.fixCommand,
        transformSourceItem,
        transformSourceContent,
      }),
    ).not.toThrow();
  });

  it.each([
    {
      label: "item count mismatch",
      sourceItems: [{ name: "button", files: [] }, { name: "card", files: [] }],
      publicItems: [{ name: "button" }],
      expected: "item count does not match",
    },
    {
      label: "missing source item in public registry",
      sourceItems: [{ name: "button", files: [] }, { name: "card", files: [] }],
      publicItems: [{ name: "button" }, { name: "input" }],
      expected: 'missing item "card"',
    },
  ])("rejects $label", ({ sourceItems, publicItems, expected }) => {
    setupRegistry(tempDir, sourceItems, publicItems);
    expectValidationThrows(tempDir, expected);
  });

  it.each([
    { label: "dependencies", source: { dependencies: ["react", "clsx"] }, publicItem: { dependencies: ["react"] }, expected: "dependencies mismatch" },
    { label: "title", source: { title: "Button" }, publicItem: { title: "Old button" }, expected: "title mismatch" },
    { label: "description", source: { description: "Current description" }, publicItem: { description: "Old description" }, expected: "description mismatch" },
    { label: "meta", source: { meta: { category: "forms" } }, publicItem: { meta: { category: "stale" } }, expected: "meta mismatch" },
    { label: "registryDependencies", source: { registryDependencies: ["compose-refs"] }, publicItem: { registryDependencies: [] }, expected: "registryDependencies mismatch" },
    { label: "devDependencies", source: { devDependencies: ["vitest"] }, publicItem: { devDependencies: [] }, expected: "devDependencies mismatch" },
    { label: "cssVars", source: { cssVars: { light: { primary: "oklch(0.4 0.1 120)" } } }, publicItem: { cssVars: { light: { primary: "stale" } } }, expected: "cssVars mismatch" },
    { label: "css", source: { css: ".button { color: red; }" }, publicItem: { css: ".button { color: blue; }" }, expected: "css mismatch" },
    { label: "envVars", source: { envVars: ["DIFFGAZER_TOKEN"] }, publicItem: { envVars: [] }, expected: "envVars mismatch" },
    { label: "docs", source: { docs: "Use the current docs." }, publicItem: { docs: "Stale docs." }, expected: "docs mismatch" },
    { label: "categories", source: { categories: ["forms"] }, publicItem: { categories: [] }, expected: "categories mismatch" },
    { label: "author", source: { author: "Diffgazer" }, publicItem: { author: "Someone else" }, expected: "author mismatch" },
  ])("rejects stale public registry $label", ({ source, publicItem, expected }) => {
    setupRegistry(tempDir, [{ name: "button", files: [], ...source }], [{ name: "button", ...publicItem }]);
    expectValidationThrows(tempDir, expected);
  });

  it.each([
    {
      label: "file content drift",
      files: [
        { path: "registry/ui/button.tsx", content: "stale content\n" },
      ],
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
    { label: "dependencies", overrides: { dependencies: [] }, expected: "item JSON dependencies mismatch" },
    { label: "registryDependencies", overrides: { registryDependencies: [] }, expected: "item JSON registryDependencies mismatch" },
    { label: "description", overrides: { description: "Stale description" }, expected: "item JSON description mismatch" },
    { label: "meta", overrides: { meta: { category: "stale" } }, expected: "item JSON meta mismatch" },
    { label: "devDependencies", overrides: { devDependencies: [] }, expected: "item JSON devDependencies mismatch" },
    { label: "cssVars", overrides: { cssVars: { light: { primary: "stale" } } }, expected: "item JSON cssVars mismatch" },
    { label: "css", overrides: { css: ".button { color: blue; }" }, expected: "item JSON css mismatch" },
    { label: "envVars", overrides: { envVars: [] }, expected: "item JSON envVars mismatch" },
    { label: "docs", overrides: { docs: "Stale docs." }, expected: "item JSON docs mismatch" },
    { label: "categories", overrides: { categories: [] }, expected: "item JSON categories mismatch" },
    { label: "author", overrides: { author: "Someone else" }, expected: "item JSON author mismatch" },
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
    { label: "parent-escaping source file path", path: "../escape.tsx" },
    { label: "windows absolute source file path", path: "C:\\windows\\system32" },
  ])("rejects an $label in the public registry validation path", ({ path }) => {
    setupRegistry(
      tempDir,
      [{ name: "button", files: [{ path }] }],
      undefined,
      { button: [{ path, content: "// button\n" }] },
    );
    expectValidationThrows(tempDir, /Unsafe registry file path/);
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
