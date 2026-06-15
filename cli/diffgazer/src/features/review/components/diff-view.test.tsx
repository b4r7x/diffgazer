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
});
