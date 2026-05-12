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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

type RegistryContentTransform = (content: string) => string;
type RegistrySourceContentTransform = (ctx: { itemName: string; filePath: string; content: string }) => string;

async function loadRegistryContentTransform(modulePath: string, exportName: string): Promise<RegistryContentTransform> {
  const loaded = await import(pathToFileURL(modulePath).href) as Record<string, unknown>;
  const transform = loaded[exportName];
  if (typeof transform !== "function") {
    throw new Error(`Missing registry transform export: ${exportName}`);
  }
  return transform as RegistryContentTransform;
}

async function loadRegistrySourceContentTransformFactory(
  modulePath: string,
  factoryExport: string,
  rootDir: string,
): Promise<RegistrySourceContentTransform> {
  const loaded = await import(pathToFileURL(modulePath).href) as Record<string, unknown>;
  const factory = loaded[factoryExport];
  if (typeof factory !== "function") {
    throw new Error(`Missing registry transform factory export: ${factoryExport}`);
  }
  return factory(rootDir) as RegistrySourceContentTransform;
}

describe("resolveLocalShadcnBin", () => {
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

  it("finds shadcn binary in node_modules/.bin/", () => {
    const binDir = join(tempDir, "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    const binPath = join(binDir, "shadcn");
    writeFileSync(binPath, "#!/bin/sh\n");
    chmodSync(binPath, 0o755);

    expect(resolveLocalShadcnBin(tempDir)).toBe(binPath);
  });

  it("finds shadcn binary one level up (../node_modules/.bin/)", () => {
    const projectDir = join(tempDir, "packages", "lib");
    mkdirSync(projectDir, { recursive: true });

    const binDir = join(tempDir, "packages", "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    const binPath = join(binDir, "shadcn");
    writeFileSync(binPath, "#!/bin/sh\n");
    chmodSync(binPath, 0o755);

    expect(resolveLocalShadcnBin(projectDir)).toBe(resolve(binPath));
  });

  it("finds shadcn binary two levels up (../../node_modules/.bin/)", () => {
    const projectDir = join(tempDir, "a", "b", "c");
    mkdirSync(projectDir, { recursive: true });

    const binDir = join(tempDir, "a", "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    const binPath = join(binDir, "shadcn");
    writeFileSync(binPath, "#!/bin/sh\n");
    chmodSync(binPath, 0o755);

    expect(resolveLocalShadcnBin(projectDir)).toBe(resolve(binPath));
  });
});

describe("runShadcnRegistryBuild", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-shadcn-run-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws when shadcn binary is not found", () => {
    expect(() =>
      runShadcnRegistryBuild({ rootDir: tempDir }),
    ).toThrow("Local shadcn CLI binary not found");
  });
});

describe("committed public registries", () => {
  const registries = [
    {
      name: "ui",
      rootDir: resolve(repoRoot, "libs/ui"),
      fixCommand: "pnpm --filter @diffgazer/ui build:shadcn",
      transformModule: resolve(repoRoot, "libs/ui/scripts/transform-public-registry-keys-imports.ts"),
      transformExport: "transformUiPublicRegistryKeysImportContent",
    },
    {
      name: "keys",
      rootDir: resolve(repoRoot, "libs/keys"),
      fixCommand: "pnpm --dir libs/keys build:shadcn",
      transformModule: resolve(repoRoot, "libs/keys/scripts/transform-public-registry-imports.ts"),
      transformExport: "createKeysSourceContentTransform",
      useFactory: true,
    },
  ] as const;

  it.each(registries)("keeps $name public/r fresh against the source registry", async (registry) => {
    let transformSourceContent: RegistrySourceContentTransform;

    if ("useFactory" in registry && registry.useFactory) {
      transformSourceContent = await loadRegistrySourceContentTransformFactory(
        registry.transformModule,
        registry.transformExport,
        registry.rootDir,
      );
    } else {
      const transformContent = await loadRegistryContentTransform(
        registry.transformModule,
        registry.transformExport,
      );
      transformSourceContent = ({ content }) => transformContent(content);
    }

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: registry.rootDir,
        fixCommand: registry.fixCommand,
        transformSourceContent,
      }),
    ).not.toThrow();
  });
});

describe("validatePublicRegistryFresh", () => {
  let tempDir: string;
  const FIX_CMD = "pnpm build:registry";

  function setupRegistry(
    sourceItems: Array<{
      name: string;
      type?: string;
      title?: string;
      description?: string;
      meta?: Record<string, unknown>;
      dependencies?: string[];
      registryDependencies?: string[];
      files?: Array<{ path: string; target?: string; type?: string }>;
    }>,
    publicItems?: Array<{
      name: string;
      type?: string;
      title?: string;
      description?: string;
      meta?: Record<string, unknown>;
      dependencies?: string[];
      registryDependencies?: string[];
    }>,
    publicItemFiles?: Record<string, Array<{ path: string; content: string; target?: string; type?: string }>>,
  ): void {
    sourceItems = sourceItems.map((item) => ({ type: "registry:ui", files: [], ...item }));
    if (publicItems) {
      publicItems = publicItems.map((item) => ({ type: "registry:ui", files: [], ...item }));
    }

    const sourceDir = join(tempDir, "registry");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, "registry.json"),
      JSON.stringify({ items: sourceItems }, null, 2),
    );

    for (const item of sourceItems) {
      for (const file of item.files ?? []) {
        const filePath = join(tempDir, file.path);
        mkdirSync(join(filePath, ".."), { recursive: true });
        writeFileSync(filePath, `// ${item.name} - ${file.path}\n`);
      }
    }

    const publicDir = join(tempDir, "public", "r");
    mkdirSync(publicDir, { recursive: true });
    const pubItems = publicItems ?? sourceItems;
    writeFileSync(
      join(publicDir, "registry.json"),
      JSON.stringify({ items: pubItems }, null, 2),
    );

    for (const item of pubItems) {
      const files = publicItemFiles?.[item.name] ??
        (sourceItems.find((s) => s.name === item.name)?.files ?? []).map(
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

  function writePublicButtonJson(overrides: Record<string, unknown>): void {
    const existing = JSON.parse(readFileSync(join(tempDir, "public", "r", "button.json"), "utf-8")) as Record<string, unknown>;
    writeFileSync(
      join(tempDir, "public", "r", "button.json"),
      JSON.stringify({ ...existing, ...overrides }, null, 2),
    );
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-shadcn-validate-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws when item counts differ", () => {
    setupRegistry(
      [
        { name: "button", files: [] },
        { name: "card", files: [] },
      ],
      [{ name: "button" }],
    );

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).toThrow("item count does not match");
  });

  it("throws when a source item is missing from public registry", () => {
    setupRegistry(
      [
        { name: "button", files: [] },
        { name: "card", files: [] },
      ],
      [
        { name: "button" },
        { name: "input" },
      ],
    );

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).toThrow('missing item "card"');
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
  ])("throws when public registry $label is stale", ({ source, publicItem, expected }) => {
    setupRegistry([{ name: "button", files: [], ...source }], [{ name: "button", ...publicItem }]);

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).toThrow(expected);
  });

  it("throws when file content is stale", () => {
    setupRegistry(
      [
        {
          name: "button",
          files: [{ path: "registry/ui/button.tsx" }],
        },
      ],
      undefined,
      {
        button: [
          { path: "registry/ui/button.tsx", content: "stale content\n" },
        ],
      },
    );

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).toThrow("content is stale");
  });

  it("validates file content through a configured source transform", () => {
    setupRegistry(
      [
        {
          name: "button",
          files: [{ path: "registry/ui/button.tsx" }],
        },
      ],
      undefined,
      {
        button: [
          { path: "registry/ui/button.tsx", content: "transformed content\n" },
        ],
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

  it("throws when public item JSON file is missing a file entry", () => {
    setupRegistry(
      [
        {
          name: "button",
          files: [{ path: "registry/ui/button.tsx" }],
        },
      ],
      undefined,
      {
        button: [],
      },
    );

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).toThrow("item JSON files mismatch");
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
  ])("throws when public file $label metadata is stale", ({ sourceFile, publicFile, expected }) => {
    setupRegistry(
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

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).toThrow(expected);
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
  ])("throws when public item JSON $label is stale", ({ overrides, expected }) => {
    setupRegistry([
      {
        name: "button",
        title: "Button",
        description: "Current description",
        dependencies: ["react"],
        registryDependencies: ["card"],
        meta: { category: "forms" },
        files: [{ path: "registry/ui/button.tsx" }],
      },
    ]);

    writePublicButtonJson(overrides);

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).toThrow(expected);
  });

  it("throws when public item JSON contains an extra file entry", () => {
    setupRegistry(
      [
        {
          name: "button",
          files: [{ path: "registry/ui/button.tsx" }],
        },
      ],
      undefined,
      {
        button: [
          { path: "registry/ui/button.tsx", content: "// button - registry/ui/button.tsx\n" },
          { path: "registry/ui/extra.tsx", content: "// stale extra\n" },
        ],
      },
    );

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).toThrow("item JSON files mismatch");
  });

  it("validates multiple items successfully", () => {
    setupRegistry([
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
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).not.toThrow();
  });
});
