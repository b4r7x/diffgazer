import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kebabToCamelCase, toDocExportName, toYamlString } from "../docs-data/utils.js";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createDocsHighlighter,
  highlightCode,
  type DocsHighlighter,
} from "../docs-data/highlight.js";
import {
  generateHooksSource,
  generateEnrichedHookData,
  type HookRegistryItem,
} from "../docs-data/hooks-source.js";
import type { HookDoc, CodeBlockLine } from "../docs-data/types.js";

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

describe("highlightCode", () => {
  it("returns CodeBlockLine[] with number and content", () => {
    const lines = highlightCode(highlighter, "const x = 1;", "typescript", TEST_THEME_NAME);
    expect(lines.length).toBeGreaterThan(0);
    const allText = lines.flatMap((l) => l.content.map((t) => t.text)).join("");
    expect(allText).toContain("const");
  });

  it("starts line numbering at 1", () => {
    const lines = highlightCode(highlighter, "a\nb\nc", "typescript", TEST_THEME_NAME);
    expect(lines[0]!.number).toBe(1);
    expect(lines[1]!.number).toBe(2);
    expect(lines[2]!.number).toBe(3);
  });

  it("preserves special characters in token text", () => {
    const lines = highlightCode(
      highlighter,
      'const a = "<div>&amp;</div>";',
      "typescript",
      TEST_THEME_NAME,
    );
    const allText = lines.flatMap((l) => l.content.map((t) => t.text)).join("");
    expect(allText).toContain("<div>");
    expect(allText).toContain("&amp;");
    expect(allText).toContain("</div>");
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
    const entry = result["alpha"]!;
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

    expect(result["alpha"]!.title).toBe("alpha");
    expect(result["alpha"]!.description).toBe("");
  });

  it("warns and skips when file is missing", () => {
    const items: HookRegistryItem[] = [
      { name: "missing", files: [{ path: "src/hooks/use-missing.ts" }] },
    ];

    const result = generateHooksSource({
      items,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
    });

    expect(result).not.toHaveProperty("missing");
  });
});

describe("generateEnrichedHookData", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-enriched-"));
    mkdirSync(join(tempDir, "src/hooks"), { recursive: true });
    writeFileSync(
      join(tempDir, "src/hooks/use-beta.ts"),
      'export function useBeta() { return "beta"; }\n',
    );

    // Example files
    mkdirSync(join(tempDir, "examples/use-beta"), { recursive: true });
    writeFileSync(
      join(tempDir, "examples/use-beta/basic.tsx"),
      'import { useBeta } from "./use-beta";\nexport default function Demo() { useBeta(); return null; }\n',
    );
  });

  afterAll(() => {
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
    const entry = result["use-beta"]!;

    // Basic source data
    expect(entry.name).toBe("use-beta");
    expect(entry.title).toBe("Beta Hook");
    expect(entry.source.raw).toContain("useBeta");
    expect(entry.source.highlighted.length).toBeGreaterThan(0);

    // Docs
    expect(entry.docs).toEqual(hookDoc);
    expect(entry.description).toBe("Rich beta description");
    expect(entry.parameters).toEqual(hookDoc.parameters);
    expect(entry.returns).toEqual(hookDoc.returns);

    // Examples
    expect(entry.examples).toContain("basic");
    expect(entry.exampleSource).toHaveProperty("basic");
    expect(entry.exampleSource["basic"]!.raw).toContain("useBeta");
    expect(entry.exampleSource["basic"]!.highlighted.length).toBeGreaterThan(0);
  });

  it("handles null HookDoc gracefully", async () => {
    const result = await generateEnrichedHookData({
      items: baseItems,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
      loadHookDoc: async () => null,
    });

    const entry = result["use-beta"]!;
    expect(entry.docs).toBeNull();
    expect(entry.description).toBe("Beta description");
    expect(entry.usageSnippet).toBeUndefined();
    expect(entry.usageSnippetHighlighted).toBeUndefined();
    expect(entry.examples).toEqual([]);
    expect(entry.exampleSource).toEqual({});
  });

  it("highlights inline usage.code when provided", async () => {
    const hookDoc: HookDoc = {
      usage: { code: 'const val = useBeta();', lang: "typescript" },
    };

    const result = await generateEnrichedHookData({
      items: baseItems,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
      loadHookDoc: async () => hookDoc,
    });

    const entry = result["use-beta"]!;
    expect(entry.usageSnippet).toBe("const val = useBeta();");
    expect(entry.usageSnippetHighlighted).toBeDefined();
    expect(Array.isArray(entry.usageSnippetHighlighted)).toBe(true);
    expect(entry.usageSnippetHighlighted!.length).toBeGreaterThan(0);
  });

  it("collects and highlights example files from examplesDir", async () => {
    // Add a second example file
    writeFileSync(
      join(tempDir, "examples/use-beta/advanced.tsx"),
      'export default function Advanced() { return <div>advanced</div>; }\n',
    );

    const result = await generateEnrichedHookData({
      items: baseItems,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
      loadHookDoc: async () => null,
      examplesDir: join(tempDir, "examples"),
    });

    const entry = result["use-beta"]!;
    expect(entry.examples).toContain("basic");
    expect(entry.examples).toContain("advanced");
    expect(entry.examples).toEqual(["advanced", "basic"]); // sorted
    expect(entry.exampleSource["advanced"]!.raw).toContain("Advanced");
    expect(entry.exampleSource["advanced"]!.highlighted.length).toBeGreaterThan(0);
  });

  it("resolves usage.example from examplesDir file", async () => {
    const hookDoc: HookDoc = {
      usage: { example: "basic" },
    };

    const result = await generateEnrichedHookData({
      items: baseItems,
      rootDir: tempDir,
      highlighter,
      themeName: TEST_THEME_NAME,
      loadHookDoc: async () => hookDoc,
      examplesDir: join(tempDir, "examples"),
    });

    const entry = result["use-beta"]!;
    expect(entry.usageSnippet).toBeDefined();
    expect(entry.usageSnippet).toContain("useBeta");
    expect(entry.usageSnippetHighlighted).toBeDefined();
  });

  it("skips missing hook files with warning", async () => {
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

describe("kebabToCamelCase", () => {
  it("converts kebab-case to camelCase", () => {
    expect(kebabToCamelCase("use-active-heading")).toBe("useActiveHeading");
  });

  it("returns single-word strings unchanged", () => {
    expect(kebabToCamelCase("button")).toBe("button");
  });
});

describe("toDocExportName", () => {
  it("appends Doc suffix to camelCase name", () => {
    expect(toDocExportName("use-scroll-lock")).toBe("useScrollLockDoc");
  });
});

describe("toYamlString", () => {
  it("returns JSON-encoded string with double quotes", () => {
    expect(toYamlString("hello world")).toBe('"hello world"');
  });

  it("escapes special characters", () => {
    expect(toYamlString('say "hi"')).toBe('"say \\"hi\\""');
  });
});
