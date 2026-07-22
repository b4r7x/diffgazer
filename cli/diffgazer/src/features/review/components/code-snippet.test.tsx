import { Box } from "ink";
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

  test("sanitizes OSC/ESC bytes from filePath and code without dropping surrounding text", () => {
    const ESC = String.fromCharCode(0x1b);
    const BEL = String.fromCharCode(0x07);
    const OSC52 = `${ESC}]52;c;ZXZpbA==${BEL}`;
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <CodeSnippet filePath={`before${OSC52}after.ts`} code={`safe${OSC52}line`} />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("beforeafter.ts");
    expect(frame).toContain("safeline");
    expect(frame).not.toContain(ESC);
    expect(frame).not.toContain("52;c;");
  });

  test("truncates a long code line to one row without dropping its gutter", async () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <Box width={80}>
          <CodeSnippet
            filePath="src/example.ts"
            startLine={42}
            code={`const value = "${"x".repeat(200)}";`}
          />
        </Box>
      </CliThemeProvider>,
    );
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    const codeRows = (lastFrame() ?? "").split("\n").filter((row) => row.includes("const value"));

    expect(codeRows).toHaveLength(1);
    expect(codeRows[0]).toMatch(/42\s+const value/);
    expect(codeRows[0]?.length).toBeLessThanOrEqual(80);
  });
});
