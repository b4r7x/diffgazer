import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildCopyBundle } from "../copy-bundle.js";

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "rk-copy-bundle-generic-"));
  mkdirSync(join(root, "registry"), { recursive: true });
  mkdirSync(join(root, "src/hooks"), { recursive: true });
  return root;
}

function writeRegistry(root: string, items: unknown[]): void {
  writeFileSync(
    join(root, "registry/registry.json"),
    JSON.stringify({ items }),
  );
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

    // Filters by type and excludes hidden
    expect(result.itemCount).toBe(1);
    const output = JSON.parse(readFileSync(outputPath, "utf-8")) as {
      items: Array<{ name: string; files: Array<{ path: string }> }>;
    };
    expect(output.items).toHaveLength(1);
    expect(output.items[0]?.name).toBe("alpha");

    // Path mapping applied
    expect(output.items[0]?.files[0]?.path).toBe("hooks/use-alpha.ts");

    // SHA-256 integrity hash
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
      items: Array<{ name: string; title: string; description: string; files: Array<{ path: string; content: string }> }>;
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

  it("throws if registry file not found", () => {
    const root = mkdtempSync(join(tmpdir(), "rk-no-registry-"));
    const outputPath = join(root, "bundle.json");

    expect(() =>
      buildCopyBundle({
        sourceRoot: root,
        outputPath,
        itemType: "registry:hook",
      }),
    ).toThrow("Registry file not found");
  });

  it("throws if source file not found", () => {
    const root = createTempRoot();
    writeRegistry(root, [
      {
        name: "missing",
        type: "registry:hook",
        files: [{ path: "src/hooks/use-missing.ts" }],
      },
    ]);

    const outputPath = join(root, "bundle.json");

    expect(() =>
      buildCopyBundle({
        sourceRoot: root,
        outputPath,
        itemType: "registry:hook",
      }),
    ).toThrow("Source file not found");
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
