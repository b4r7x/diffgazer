import { Box } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { CodeSnippet } from "./code-snippet";

afterEach(() => {
  cleanup();
});

function renderSnippet(lineNumbers?: readonly (number | null)[]) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <CodeSnippet filePath="src/example.ts" lineNumbers={lineNumbers} code={"alpha();\nbeta();"} />
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

  test("renders the gutter number published for each row", () => {
    const { lastFrame } = renderSnippet([42, 43]);
    const frame = lastFrame() ?? "";

    expect(frame).toMatch(/\b42\s+alpha\(\);/);
    expect(frame).toMatch(/\b43\s+beta\(\);/);
  });

  test("keeps non-contiguous rows on their own numbers instead of counting from the start", () => {
    const { lastFrame } = renderSnippet([42, 908]);
    const frame = lastFrame() ?? "";

    expect(frame).toMatch(/\b42\s+alpha\(\);/);
    expect(frame).toMatch(/\b908\s+beta\(\);/);
    expect(frame).not.toMatch(/\b43\s+beta\(\);/);
  });

  test("prints a blank gutter cell for a row that stands in for skipped lines", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <CodeSnippet
          filePath="src/example.ts"
          lineNumbers={[42, null, 908]}
          code={"alpha();\n... [evidence gap] ...\nbeta();"}
        />
      </CliThemeProvider>,
    );
    const gapRow = (lastFrame() ?? "").split("\n").find((row) => row.includes("evidence gap"));

    expect(gapRow).toMatch(/ {5}\.\.\. \[evidence gap\]/);
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
            lineNumbers={[42]}
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
