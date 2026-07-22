import { beforeAll, describe, expect, it } from "vitest";
import {
  createDocsHighlighter,
  type DocsHighlighter,
  getSourceHighlightLanguage,
  highlightCode,
  highlightSourceFile,
} from "./highlight.js";

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
  it.each([
    ["styles/theme.css", "css"],
    ["hooks/use-theme.ts", "typescript"],
    ["components/theme.tsx", "tsx"],
  ] as const)("selects the %s source grammar as %s", (path, language) => {
    expect(getSourceHighlightLanguage(path)).toBe(language);
  });

  it("preserves registry style source bytes while highlighting with the CSS grammar", () => {
    const raw = '.panel::before {\n  content: "<ready>&";\n}\n';
    const source = highlightSourceFile(highlighter, "styles/panel.css", raw, TEST_THEME_NAME);

    expect(source.raw).toBe(raw);
    expect(source.highlighted).toHaveLength(4);
    expect(
      source.highlighted.flatMap((line) => line.content.map((token) => token.text)).join(""),
    ).toContain(".panel::before");
  });

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
