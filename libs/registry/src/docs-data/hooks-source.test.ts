import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrySchema } from "../registry-types.js";
import { requireValue } from "../testing/assertions.js";
import { buildHooksData } from "./build-hooks.js";
import { DOCS_CODE_THEME_NAME } from "./code-theme.js";
import { createDocsHighlighter, type DocsHighlighter } from "./highlight.js";
import {
  generateEnrichedHookData,
  generateHooksSource,
  type HookRegistryItem,
} from "./hooks-source.js";
import type { HookDoc } from "./types.js";

const TEST_THEME_NAME = "test-theme";
const TEST_THEME = {
  name: TEST_THEME_NAME,
  type: "dark" as const,
  colors: {
    "editor.foreground": "#ffffff",
    "editor.background": "#000000",
  },
  tokenColors: [
    { scope: ["keyword"], settings: { foreground: "#ff0000" } },
    { scope: ["string"], settings: { foreground: "#00ff00" } },
  ],
};

let highlighter: DocsHighlighter;

beforeAll(async () => {
  highlighter = await createDocsHighlighter({
    theme: TEST_THEME,
    themeName: TEST_THEME_NAME,
  });
});

describe("generateHooksSource", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-hooks-src-"));
    mkdirSync(join(tempDir, "src/hooks"), { recursive: true });
    writeFileSync(
      join(tempDir, "src/hooks/use-alpha.ts"),
      'export function useAlpha() { return "alpha"; }\n',
    );
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns a Record keyed by hook name with correct shape", () => {
    const items: HookRegistryItem[] = [
      {
        name: "alpha",
        title: "Alpha Hook",
        description: "A test hook",
        files: [{ path: "src/hooks/use-alpha.ts" }],
      },
    ];

    const result = generateHooksSource({
      items,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
    });

    expect(result).toHaveProperty("alpha");
    const entry = requireValue(result.alpha, "generated hook entry alpha");
    expect(entry.name).toBe("alpha");
    expect(entry.title).toBe("Alpha Hook");
    expect(entry.description).toBe("A test hook");
    expect(entry.source.raw).toContain("useAlpha");
    expect(Array.isArray(entry.source.highlighted)).toBe(true);
    expect(entry.source.highlighted.length).toBeGreaterThan(0);
  });

  it("uses name as title fallback and empty string as description fallback", () => {
    const items: HookRegistryItem[] = [
      { name: "alpha", files: [{ path: "src/hooks/use-alpha.ts" }] },
    ];

    const result = generateHooksSource({
      items,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
    });

    expect(result.alpha?.title).toBe("alpha");
    expect(result.alpha?.description).toBe("");
  });

  it("warns and skips when file is missing", () => {
    const items: HookRegistryItem[] = [
      { name: "absent", files: [{ path: "src/hooks/use-missing.ts" }] },
    ];
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = generateHooksSource({
      items,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
    });

    expect(result).not.toHaveProperty("absent");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("absent");
    expect(warnSpy.mock.calls[0]?.[0]).toContain(resolve(tempDir, "src/hooks/use-missing.ts"));

    warnSpy.mockRestore();
  });
});

describe("generateEnrichedHookData", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-enriched-"));
    mkdirSync(join(tempDir, "src/hooks"), { recursive: true });
    writeFileSync(
      join(tempDir, "src/hooks/use-beta.ts"),
      'export function useBeta() { return "beta"; }\n',
    );

    mkdirSync(join(tempDir, "examples/use-beta"), { recursive: true });
    writeFileSync(
      join(tempDir, "examples/use-beta/basic.tsx"),
      'import { useBeta } from "./use-beta";\nexport default function Demo() { useBeta(); return null; }\n',
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const baseItems: HookRegistryItem[] = [
    {
      name: "use-beta",
      title: "Beta Hook",
      description: "Beta description",
      files: [{ path: "src/hooks/use-beta.ts" }],
    },
  ];

  it("returns enriched data with docs, examples, and source", async () => {
    const hookDoc: HookDoc = {
      description: "Rich beta description",
      parameters: [
        { name: "options", type: "BetaOptions", required: false, description: "Config" },
      ],
      returns: { type: "string", description: "The beta value" },
    };

    const result = await generateEnrichedHookData({
      items: baseItems,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
      loadHookDoc: async () => hookDoc,
      examplesDir: join(tempDir, "examples"),
    });

    expect(result).toHaveProperty("use-beta");
    const entry = requireValue(result["use-beta"], "generated hook entry use-beta");

    expect(entry.name).toBe("use-beta");
    expect(entry.title).toBe("Beta Hook");
    expect(entry.source.raw).toContain("useBeta");
    expect(entry.source.highlighted.length).toBeGreaterThan(0);

    expect(entry.docs).toEqual(hookDoc);
    expect(entry.description).toBe("Rich beta description");
    expect(entry.parameters).toEqual(hookDoc.parameters);
    expect(entry.returns).toEqual(hookDoc.returns);

    expect(entry.examples).toContain("basic");
    expect(entry.exampleSource).toHaveProperty("basic");
    expect(entry.exampleSource.basic?.raw).toContain("useBeta");
    expect(entry.exampleSource.basic?.highlighted.length).toBeGreaterThan(0);
  });

  it("emits every public consumer file for use-navigation in page and source artifacts", async () => {
    const keysRoot = resolve(import.meta.dirname, "../../../keys");
    const registry = RegistrySchema.parse(
      JSON.parse(readFileSync(resolve(keysRoot, "registry/registry.json"), "utf-8")),
    );
    const outputDir = resolve(tempDir, "generated");
    const expectedPaths = [
      "src/hooks/use-navigation.ts",
      "src/hooks/utils/navigation-core.ts",
      "src/hooks/utils/navigation-dispatch.ts",
      "src/hooks/utils/navigation-items.ts",
      "src/hooks/utils/navigation-directions.ts",
      "src/hooks/utils/focusable.ts",
      "src/hooks/utils/element-guards.ts",
    ];
    const artifactHighlighter = await createDocsHighlighter({
      theme: { ...TEST_THEME, name: DOCS_CODE_THEME_NAME },
      themeName: DOCS_CODE_THEME_NAME,
    });

    const result = await buildHooksData({
      registry,
      rootDir: keysRoot,
      examplesDir: resolve(tempDir, "missing-examples"),
      outputDir,
      highlighter: artifactHighlighter,
      hooksConfig: {
        contentDir: resolve(tempDir, "content"),
        filter: (item) => item.name === "navigation",
        mapItem: (item) => ({
          name: "use-navigation",
          registryName: item.name,
          title: "useNavigation",
          description: item.description,
          files: item.files,
        }),
        loadHookDoc: async () => null,
      },
    });

    const page = JSON.parse(
      readFileSync(resolve(outputDir, "hooks/use-navigation.json"), "utf-8"),
    ) as { files: string[] };
    const archive = JSON.parse(
      readFileSync(resolve(outputDir, "hooks/use-navigation.source.json"), "utf-8"),
    ) as {
      source: { raw: string };
      files: Array<{ path: string; raw: string }>;
    };

    expect(result.errors).toEqual([]);
    expect(page.files).toEqual(expectedPaths);
    expect(archive.files.map((file) => file.path)).toEqual(expectedPaths);
    expect(archive.files.every((file) => file.raw.length > 0)).toBe(true);
    expect(archive.source.raw).toBe(archive.files[0]?.raw);
  }, 30_000);

  it("falls back when HookDoc is null", async () => {
    const result = await generateEnrichedHookData({
      items: baseItems,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
      loadHookDoc: async () => null,
    });

    const entry = requireValue(result["use-beta"], "generated hook entry use-beta");
    expect(entry.docs).toBeNull();
    expect(entry.description).toBe("Beta description");
    expect(entry.usageSnippet).toBeUndefined();
    expect(entry.usageSnippetHighlighted).toBeUndefined();
    expect(entry.examples).toEqual([]);
    expect(entry.exampleSource).toEqual({});
  });

  it("highlights inline usage.code when provided", async () => {
    const hookDoc: HookDoc = {
      usage: { code: "const val = useBeta();", lang: "typescript" },
    };

    const result = await generateEnrichedHookData({
      items: baseItems,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
      loadHookDoc: async () => hookDoc,
    });

    const entry = requireValue(result["use-beta"], "generated hook entry use-beta");
    expect(entry.usageSnippet).toBe("const val = useBeta();");
    expect(entry.usageSnippetHighlighted).toBeDefined();
    expect(Array.isArray(entry.usageSnippetHighlighted)).toBe(true);
    expect(entry.usageSnippetHighlighted?.length).toBeGreaterThan(0);
  });

  it("collects and highlights example files from examplesDir", async () => {
    writeFileSync(
      join(tempDir, "examples/use-beta/advanced.tsx"),
      "export default function Advanced() { return <div>advanced</div>; }\n",
    );

    const result = await generateEnrichedHookData({
      items: baseItems,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
      loadHookDoc: async () => null,
      examplesDir: join(tempDir, "examples"),
    });

    const entry = requireValue(result["use-beta"], "generated hook entry use-beta");
    expect(entry.examples).toEqual(["advanced", "basic"]);
    expect(entry.exampleSource.advanced?.raw).toContain("Advanced");
    expect(entry.exampleSource.advanced?.highlighted.length).toBeGreaterThan(0);
  });

  it("resolves usage.example from examplesDir file", async () => {
    writeFileSync(
      join(tempDir, "examples/use-beta/detailed.tsx"),
      'import { useBeta } from "./use-beta";\nexport default function Demo() { useBeta(); return "detailed-marker"; }\n',
    );
    const hookDoc: HookDoc = {
      usage: { example: "detailed" },
    };

    const result = await generateEnrichedHookData({
      items: baseItems,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
      loadHookDoc: async () => hookDoc,
      examplesDir: join(tempDir, "examples"),
    });

    const entry = requireValue(result["use-beta"], "generated hook entry use-beta");
    expect(entry.usageSnippet).toContain("detailed-marker");
    expect(entry.usageSnippet).not.toContain("return null");
    expect(entry.usageSnippetHighlighted).toBeDefined();
  });

  it("skips missing hook files", async () => {
    const missingItems: HookRegistryItem[] = [
      { name: "missing", files: [{ path: "src/hooks/use-missing.ts" }] },
    ];

    const result = await generateEnrichedHookData({
      items: missingItems,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
      loadHookDoc: async () => null,
    });

    expect(result).not.toHaveProperty("missing");
  });
});
