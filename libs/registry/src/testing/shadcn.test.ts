import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveLocalShadcnBin, runShadcnRegistryBuild } from "../shadcn/runner.js";
import { validatePublicRegistryFresh } from "../shadcn/validate.js";

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

describe("validatePublicRegistryFresh", () => {
  let tempDir: string;
  const FIX_CMD = "pnpm build:registry";

  function setupRegistry(
    sourceItems: Array<{
      name: string;
      type?: string;
      dependencies?: string[];
      registryDependencies?: string[];
      files?: Array<{ path: string }>;
    }>,
    publicItems?: Array<{
      name: string;
      type?: string;
      dependencies?: string[];
      registryDependencies?: string[];
    }>,
    publicItemFiles?: Record<string, Array<{ path: string; content: string }>>,
  ): void {
    // Ensure all items have required fields for schema validation
    sourceItems = sourceItems.map((item) => ({ type: "registry:ui", files: [], ...item }));
    if (publicItems) {
      publicItems = publicItems.map((item) => ({ type: "registry:ui", files: [], ...item }));
    }
    // Source registry
    const sourceDir = join(tempDir, "registry");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, "registry.json"),
      JSON.stringify({ items: sourceItems }, null, 2),
    );

    // Create source files on disk
    for (const item of sourceItems) {
      for (const file of item.files ?? []) {
        const filePath = join(tempDir, file.path);
        mkdirSync(join(filePath, ".."), { recursive: true });
        writeFileSync(filePath, `// ${item.name} - ${file.path}\n`);
      }
    }

    // Public registry
    const publicDir = join(tempDir, "public", "r");
    mkdirSync(publicDir, { recursive: true });
    const pubItems = publicItems ?? sourceItems;
    writeFileSync(
      join(publicDir, "registry.json"),
      JSON.stringify({ items: pubItems }, null, 2),
    );

    // Public item JSON files
    for (const item of pubItems) {
      const files = publicItemFiles?.[item.name] ??
        (sourceItems.find((s) => s.name === item.name)?.files ?? []).map(
          (f) => ({
            path: f.path,
            content: `// ${item.name} - ${f.path}\n`,
          }),
        );
      writeFileSync(
        join(publicDir, `${item.name}.json`),
        JSON.stringify({ files }, null, 2),
      );
    }
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
        { name: "input" }, // wrong name, same count
      ],
    );

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).toThrow('missing item "card"');
  });

  it("throws when dependencies mismatch", () => {
    setupRegistry(
      [
        {
          name: "button",
          dependencies: ["react", "clsx"],
          files: [],
        },
      ],
      [
        {
          name: "button",
          dependencies: ["react"], // missing clsx
        },
      ],
    );

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).toThrow("dependencies mismatch");
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
        button: [], // no files in public item JSON
      },
    );

    expect(() =>
      validatePublicRegistryFresh({
        rootDir: tempDir,
        fixCommand: FIX_CMD,
      }),
    ).toThrow('missing for "button"');
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
