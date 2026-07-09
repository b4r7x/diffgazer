import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireValue } from "../testing/assertions.js";
import { findExamples, generateDemoIndex } from "./examples.js";
import { createDocsHighlighter, type DocsHighlighter, highlightCode } from "./highlight.js";
import {
  generateEnrichedHookData,
  generateHooksSource,
  type HookRegistryItem,
} from "./hooks-source.js";
import { kebabToCamelCase, toDocExportName, toYamlString } from "./naming.js";
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

describe("highlightCode", () => {
  it("returns CodeBlockLine[] with number and content", () => {
    const lines = highlightCode(highlighter, "const x = 1;", "typescript", TEST_THEME_NAME);
    expect(lines.length).toBeGreaterThan(0);
    const allText = lines.flatMap((l) => l.content.map((t) => t.text)).join("");
    expect(allText).toContain("const");
  });

  it("starts line numbering at 1", () => {
    const lines = highlightCode(highlighter, "a\nb\nc", "typescript", TEST_THEME_NAME);
    expect(lines[0]?.number).toBe(1);
    expect(lines[1]?.number).toBe(2);
    expect(lines[2]?.number).toBe(3);
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
    expect(entry.examples).toContain("basic");
    expect(entry.examples).toContain("advanced");
    expect(entry.examples).toEqual(["advanced", "basic"]);
    expect(entry.exampleSource.advanced?.raw).toContain("Advanced");
    expect(entry.exampleSource.advanced?.highlighted.length).toBeGreaterThan(0);
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

    const entry = requireValue(result["use-beta"], "generated hook entry use-beta");
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

describe("findExamples", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-examples-"));
    mkdirSync(join(tempDir, "dialog"), { recursive: true });
    writeFileSync(join(tempDir, "dialog/basic.tsx"), "export default function Basic() {}\n");
    writeFileSync(join(tempDir, "dialog/dialog-form.tsx"), "export default function Form() {}\n");
    writeFileSync(
      join(tempDir, "dialog/dialog-form.test.tsx"),
      "import { render } from '@testing-library/react';\n",
    );
    writeFileSync(
      join(tempDir, "dialog/dialog-form.spec.tsx"),
      "import { render } from '@testing-library/react';\n",
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("excludes .test.tsx and .spec.tsx from discovered examples", () => {
    const examples = findExamples(tempDir, "dialog");
    expect(examples).toEqual(["basic", "dialog-form"]);
    expect(examples).not.toContain("dialog-form.test");
    expect(examples).not.toContain("dialog-form.spec");
  });

  it("returns an empty list for a missing item directory", () => {
    expect(findExamples(tempDir, "missing")).toEqual([]);
  });
});

describe("generateDemoIndex", () => {
  it("emits lazy imports for discovered examples", () => {
    const content = generateDemoIndex({
      items: [{ name: "dialog" }],
      examplesDir: "/examples",
      importPathPrefix: "@/examples",
      findExamplesFn: () => ["basic"],
    });

    expect(content).toContain('"basic": lazy(() => import("@/examples/dialog/basic"))');
  });

  it("throws when a discovered example resolves to a test/spec key", () => {
    expect(() =>
      generateDemoIndex({
        items: [{ name: "dialog" }],
        examplesDir: "/examples",
        importPathPrefix: "@/examples",
        findExamplesFn: () => ["dialog-form.test"],
      }),
    ).toThrow(/test\/spec example "dialog-form\.test"/);
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
