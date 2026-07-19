import { Box } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { DiffView } from "./diff-view";

afterEach(() => {
  cleanup();
});

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
// OSC-52 clipboard write sequence Ink would otherwise pass through to the terminal.
const OSC52 = `${ESC}]52;c;ZXZpbA==${BEL}`;

describe("DiffView (TUI) terminal-escape sanitization", () => {
  test("strips OSC/ESC bytes from an escape-bearing patch before render", () => {
    const patch = ["--- a/src/app.ts", "+++ b/src/app.ts", `+const x = "${OSC52}";`].join("\n");

    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <DiffView patch={patch} />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("const x =");
    expect(frame).not.toContain(ESC);
    expect(frame).not.toContain("52;c;");
  });

  test("truncates a 200-column diff line to one row with its marker intact", async () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <Box width={80}>
          <DiffView patch={`+${"x".repeat(200)}`} />
        </Box>
      </CliThemeProvider>,
    );
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    const diffRows = (lastFrame() ?? "").split("\n").filter((row) => row.includes("+xxx"));

    expect(diffRows).toHaveLength(1);
    expect(diffRows[0]).toMatch(/^│\+x+/);
    expect(diffRows[0]?.length).toBeLessThanOrEqual(80);
  });
});
