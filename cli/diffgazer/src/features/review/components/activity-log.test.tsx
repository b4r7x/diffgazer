import type { LogEntryData } from "@diffgazer/core/schemas/presentation";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ActivityLog } from "./activity-log";

afterEach(() => {
  cleanup();
});

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
// OSC-52 clipboard write sequence Ink would otherwise pass through to the terminal.
const OSC52 = `${ESC}]52;c;ZXZpbA==${BEL}`;

describe("ActivityLog (TUI) terminal-escape sanitization", () => {
  test("strips OSC/ESC bytes from an escape-bearing entry message before render", () => {
    const entries: LogEntryData[] = [
      {
        id: "log-1",
        timestamp: "2024-01-01T00:00:00Z",
        tag: "system",
        tagType: "system",
        message: `safe${OSC52}message`,
      },
    ];

    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ActivityLog entries={entries} />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("safemessage");
    expect(frame).not.toContain(ESC);
    expect(frame).not.toContain("52;c;");
  });
});
