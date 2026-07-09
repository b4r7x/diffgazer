import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { HistoryInsightsPane } from "./insights-pane";

afterEach(() => {
  cleanup();
});

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
// OSC title-set sequence (ESC ] 0 ; ... BEL) embedded in a persisted issue title.
const MALICIOUS_TITLE = `${ESC}]0;HACK${BEL}Safe title`;

describe("HistoryInsightsPane (TUI)", () => {
  test("strips terminal escape sequences from persisted issue titles", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <HistoryInsightsPane
          runId="run-1"
          severityCounts={null}
          issues={[makeIssue({ id: "issue-1", title: MALICIOUS_TITLE })]}
        />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Safe title");
    expect(frame).not.toContain("HACK");
  });

  test("strips terminal escape sequences from the persisted run id", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <HistoryInsightsPane runId={`${ESC}]0;HACK${BEL}#a1b2`} severityCounts={null} issues={[]} />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("RUN #A1B2");
    expect(frame).not.toContain("HACK");
  });
});
