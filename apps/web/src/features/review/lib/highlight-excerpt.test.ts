import type { CodeBlockToken } from "@diffgazer/ui/components/code-block";
import { describe, expect, it } from "vitest";
import { highlightExcerpt } from "./highlight-excerpt";

function textOf(line: string | CodeBlockToken[]): string {
  return typeof line === "string" ? line : line.map((token) => token.text).join("");
}

function classOf(line: string | CodeBlockToken[] | undefined, text: string) {
  return Array.isArray(line) ? line.find((token) => token.text === text)?.className : undefined;
}

describe("highlightExcerpt", () => {
  it("keeps every excerpt line readable character for character", () => {
    const excerpt = "const parsed = parse(input);\n  validate(parsed);\nreturn parsed;";

    expect(highlightExcerpt(excerpt, "src/parser.ts").map(textOf)).toEqual(excerpt.split("\n"));
  });

  it("marks keywords, strings, and comments with the shipped code block token classes", () => {
    const [line] = highlightExcerpt('const label = "ok"; // note', "src/parser.ts");

    expect(classOf(line, "const")).toBe("code-keyword");
    expect(classOf(line, "ok")).toBe("code-string");
    expect(classOf(line, "// note")).toBe("code-comment");
  });

  it("colors a language outside the JavaScript family", () => {
    const [line] = highlightExcerpt("def parse(value):  # entry", "src/parser.py");

    expect(classOf(line, "def")).toBe("code-keyword");
    expect(classOf(line, "# entry")).toBe("code-comment");
  });

  it("leaves an excerpt plain when no grammar claims the file extension", () => {
    const excerpt = "release notes: shipped";

    expect(highlightExcerpt(excerpt, "docs/notes.txt")).toEqual([excerpt]);
  });

  it("leaves an excerpt plain when the file has no extension", () => {
    const excerpt = "Copyright (c) 2026";

    expect(highlightExcerpt(excerpt, "LICENSE")).toEqual([excerpt]);
  });

  it("keeps one line per source line through multi-line comments and templates", () => {
    const excerpt = "/* first\nsecond */\nconst tpl = `one\ntwo`;\nthird();";

    const lines = highlightExcerpt(excerpt, "src/parser.ts");

    expect(lines.map(textOf)).toEqual(excerpt.split("\n"));
    expect(classOf(lines[1], "second */")).toBe("code-comment");
  });

  it("keeps one line per source line for CRLF excerpts", () => {
    const excerpt = "const a = 1;\r\nconst b = 2;";

    const lines = highlightExcerpt(excerpt, "src/parser.ts");

    expect(lines.map(textOf)).toEqual(["const a = 1;", "const b = 2;"]);
    expect(classOf(lines[0], ";")).toBeUndefined();
    expect(highlightExcerpt(excerpt, "docs/notes.txt")).toEqual(["const a = 1;", "const b = 2;"]);
  });

  it("leaves an oversized excerpt plain rather than tokenizing it", () => {
    const excerpt = `const blob = ${"a".repeat(11_000)};`;

    expect(highlightExcerpt(excerpt, "src/parser.ts")).toEqual([excerpt]);
  });

  it("leaves an excerpt with an oversized line plain rather than tokenizing it", () => {
    const excerpt = `const a = 1;\nconst blob = ${"a".repeat(2_500)};`;

    expect(highlightExcerpt(excerpt, "src/parser.ts")).toEqual(excerpt.split("\n"));
  });

  it("colors extensions that alias a claimed grammar", () => {
    const [line] = highlightExcerpt('const label = "ok";', "src/parser.mjs");

    expect(classOf(line, "const")).toBe("code-keyword");
    expect(classOf(line, "ok")).toBe("code-string");
  });

  it("colors an extensionless file whose name names a grammar", () => {
    const [line] = highlightExcerpt("FROM node:22 # base", "Dockerfile");

    expect(classOf(line, "# base")).toBe("code-comment");
  });
});
