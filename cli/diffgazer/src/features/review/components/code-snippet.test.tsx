import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { CodeSnippet } from "./code-snippet";

afterEach(() => {
  cleanup();
});

function renderSnippet(startLine?: number) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <CodeSnippet filePath="src/example.ts" startLine={startLine} code={"alpha();\nbeta();"} />
    </CliThemeProvider>,
  );
}

describe("CodeSnippet (TUI)", () => {
  test("omits gutter numbers when evidence has no range", () => {
    const { lastFrame } = renderSnippet();
    const frame = lastFrame() ?? "";

    expect(frame).toContain("alpha();");
    expect(frame).toContain("beta();");
    expect(frame).not.toMatch(/\b1\s+alpha\(\);/);
  });

  test("renders gutter numbers when a start line is provided", () => {
    const { lastFrame } = renderSnippet(42);
    const frame = lastFrame() ?? "";

    expect(frame).toMatch(/\b42\s+alpha\(\);/);
    expect(frame).toMatch(/\b43\s+beta\(\);/);
  });
});
