import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCopyBundle } from "./copy-bundle.js";

const tempRoots: string[] = [];

function createBareTempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function createTempRoot(): string {
  const root = createBareTempRoot("rk-copy-bundle-generic-");
  mkdirSync(join(root, "registry"), { recursive: true });
  mkdirSync(join(root, "src/hooks"), { recursive: true });
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function writeRegistry(root: string, items: unknown[]): void {
  writeFileSync(join(root, "registry/registry.json"), JSON.stringify({ items }));
}

function writeHookFile(root: string, name: string, content: string): void {
  writeFileSync(join(root, `src/hooks/${name}`), content);
}

describe("buildCopyBundle", () => {
  it("filters by item type, excludes hidden, applies path mapping, and generates integrity", () => {
    const root = createTempRoot();
    writeHookFile(root, "use-alpha.ts", "export const useAlpha = () => null\n");
    writeHookFile(root, "use-hidden.ts", "export const useHidden = () => null\n");
    writeRegistry(root, [
      {
        name: "alpha",
        type: "registry:hook",
        files: [{ path: "src/hooks/use-alpha.ts" }],
      },
      {
        name: "button",
        type: "registry:ui",
        files: [{ path: "src/hooks/use-alpha.ts" }],
      },
      {
        name: "hidden",
        type: "registry:hook",
        meta: { hidden: true },
        files: [{ path: "src/hooks/use-hidden.ts" }],
      },
    ]);

    const outputPath = join(root, "bundle.json");
    const result = buildCopyBundle({
      sourceRoot: root,
      outputPath,
      itemType: "registry:hook",
      pathMapping: { from: "src/hooks/", to: "hooks/" },
    });

    expect(result.itemCount).toBe(1);
    const output = JSON.parse(readFileSync(outputPath, "utf-8")) as {
      items: Array<{ name: string; files: Array<{ path: string }> }>;
    };
    expect(output.items).toHaveLength(1);
    expect(output.items[0]?.name).toBe("alpha");

    expect(output.items[0]?.files[0]?.path).toBe("hooks/use-alpha.ts");

    expect(result.integrity).toMatch(/^sha256-[a-f0-9]{64}$/);
  });

  it("writes output file with correct JSON structure", () => {
    const root = createTempRoot();
    writeHookFile(root, "use-focus.ts", "export const useFocus = () => null\n");
    writeRegistry(root, [
      {
        name: "focus",
        type: "registry:hook",
        title: "Focus",
        description: "Focus hook",
        files: [{ path: "src/hooks/use-focus.ts" }],
      },
    ]);

    const outputPath = join(root, "bundle.json");
    buildCopyBundle({
      sourceRoot: root,
      outputPath,
      itemType: "registry:hook",
      pathMapping: { from: "src/hooks/", to: "hooks/" },
    });

    const output = JSON.parse(readFileSync(outputPath, "utf-8")) as {
      items: Array<{
        name: string;
        title: string;
        description: string;
        files: Array<{ path: string; content: string }>;
      }>;
      integrity: string;
    };

    expect(output).toHaveProperty("items");
    expect(output).toHaveProperty("integrity");
    expect(output.items[0]?.name).toBe("focus");
    expect(output.items[0]?.title).toBe("Focus");
    expect(output.items[0]?.description).toBe("Focus hook");
    expect(output.items[0]?.files[0]?.path).toBe("hooks/use-focus.ts");
    expect(output.items[0]?.files[0]?.content).toContain("useFocus");
  });

  it("can include hidden items for installer-only bundles", () => {
    const root = createTempRoot();
    writeHookFile(root, "focusable.ts", "export const focusable = true\n");
    writeRegistry(root, [
      {
        name: "focusable",
        type: "registry:hook",
        meta: { hidden: true },
        files: [{ path: "src/hooks/focusable.ts" }],
      },
    ]);

    const outputPath = join(root, "bundle.json");
    const result = buildCopyBundle({
      sourceRoot: root,
      outputPath,
      itemType: "registry:hook",
      includeHidden: true,
    });

    const output = JSON.parse(readFileSync(outputPath, "utf-8")) as {
      items: Array<{ name: string; meta?: Record<string, unknown> }>;
    };
    expect(result.itemCount).toBe(1);
    expect(output.items[0]?.name).toBe("focusable");
    expect(output.items[0]?.meta?.hidden).toBe(true);
  });

  it("can transform file content before writing the bundle", () => {
    const root = createTempRoot();
    writeHookFile(root, "use-focus.ts", "import '../internal/shared.js'\n");
    writeRegistry(root, [
      {
        name: "focus",
        type: "registry:hook",
        files: [{ path: "src/hooks/use-focus.ts" }],
      },
    ]);

    const outputPath = join(root, "bundle.json");
    buildCopyBundle({
      sourceRoot: root,
      outputPath,
      itemType: "registry:hook",
      transformContent: (content) => content.replace("../internal/", "./internal/"),
    });

    const output = JSON.parse(readFileSync(outputPath, "utf-8")) as {
      items: Array<{ files: Array<{ content: string }> }>;
    };
    expect(output.items[0]?.files[0]?.content).toBe("import './internal/shared.js'\n");
  });

  it.each([
    {
      label: "registry manifest",
      setup: () => createBareTempRoot("rk-no-registry-"),
      expectedMessage: "Registry file not found",
    },
    {
      label: "referenced source file",
      setup: () => {
        const root = createTempRoot();
        writeRegistry(root, [
          {
            name: "missing",
            type: "registry:hook",
            files: [{ path: "src/hooks/use-missing.ts" }],
          },
        ]);
        return root;
      },
      expectedMessage: "Source file not found",
    },
  ])("throws when $label is missing", ({ setup, expectedMessage }) => {
    const root = setup();
    expect(() =>
      buildCopyBundle({
        sourceRoot: root,
        outputPath: join(root, "bundle.json"),
        itemType: "registry:hook",
      }),
    ).toThrow(expectedMessage);
  });

  it.each([
    {
      label: "parent-escaping path",
      filePath: "../escape.ts",
      expectedMessage: "must not contain '..' segments",
    },
    {
      label: "absolute Unix path",
      filePath: "/etc/passwd",
      expectedMessage: "must be relative",
    },
    {
      label: "absolute Windows path",
      filePath: "C:\\windows\\system32",
      expectedMessage: "must be relative",
    },
  ])("rejects $label before reading source files", ({ filePath, expectedMessage }) => {
    const root = createTempRoot();
    writeRegistry(root, [
      {
        name: "unsafe",
        type: "registry:hook",
        files: [{ path: filePath }],
      },
    ]);

    expect(() =>
      buildCopyBundle({
        sourceRoot: root,
        outputPath: join(root, "bundle.json"),
        itemType: "registry:hook",
      }),
    ).toThrow(expectedMessage);
  });

  it("items are sorted by name", () => {
    const root = createTempRoot();
    writeHookFile(root, "use-zebra.ts", "export const useZebra = () => null\n");
    writeHookFile(root, "use-alpha.ts", "export const useAlpha = () => null\n");
    writeHookFile(root, "use-mid.ts", "export const useMid = () => null\n");
    writeRegistry(root, [
      {
        name: "zebra",
        type: "registry:hook",
        files: [{ path: "src/hooks/use-zebra.ts" }],
      },
      {
        name: "alpha",
        type: "registry:hook",
        files: [{ path: "src/hooks/use-alpha.ts" }],
      },
      {
        name: "mid",
        type: "registry:hook",
        files: [{ path: "src/hooks/use-mid.ts" }],
      },
    ]);

    const outputPath = join(root, "bundle.json");
    buildCopyBundle({
      sourceRoot: root,
      outputPath,
      itemType: "registry:hook",
    });

    const output = JSON.parse(readFileSync(outputPath, "utf-8")) as {
      items: Array<{ name: string }>;
    };
    expect(output.items.map((i) => i.name)).toEqual(["alpha", "mid", "zebra"]);
  });
});
