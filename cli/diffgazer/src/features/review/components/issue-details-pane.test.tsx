import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { IssueDetailsPane } from "./issue-details-pane";

afterEach(() => {
  cleanup();
});

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
// OSC-52 clipboard write: ESC ] 52 ; c ; <base64> BEL. Ink passes OSC through to
// the raw terminal, so the sanitizer must neutralize it before render.
const OSC52 = `${ESC}]52;c;ZXZpbA==${BEL}`;

function renderPane(issue: ReviewIssue, activeTab: IssueTab = "details") {
  return render(
    <CliThemeProvider initialTheme="dark">
      <IssueDetailsPane
        issue={issue}
        activeTab={activeTab}
        onTabChange={vi.fn()}
        completedSteps={new Set()}
        onToggleStep={vi.fn()}
      />
    </CliThemeProvider>,
  );
}

describe("IssueDetailsPane (TUI) terminal-escape sanitization", () => {
  test("strips OSC/ESC bytes from an escape-bearing rationale before render", () => {
    const issue = makeIssue({
      file: "src/app.ts",
      line_start: 1,
      line_end: 5,
      rationale: `before${OSC52}after`,
      recommendation: "recommendation text",
      symptom: "symptom text",
      title: "Sample issue",
      whyItMatters: "why it matters text",
    });
    const { lastFrame } = renderPane(issue, "explain");
    const frame = lastFrame() ?? "";

    expect(frame).toContain("beforeafter");
    // The whole OSC sequence (ESC … BEL) is gone: no ESC byte, no payload remnant.
    expect(frame).not.toContain(ESC);
    expect(frame).not.toContain("52;c;");
  });
});

describe("IssueDetailsPane (TUI) trace tab gating", () => {
  test("renders no Trace trigger when the issue has no trace", () => {
    const { lastFrame } = renderPane(makeIssue());
    const frame = lastFrame() ?? "";

    expect(frame).toContain("Details");
    expect(frame).toContain("Explain");
    expect(frame).not.toContain("Trace");
  });

  test("renders the Trace tab and content when the issue has trace steps", () => {
    const issue = makeIssue({
      trace: [
        {
          step: 1,
          tool: "inspectScope",
          inputSummary: "scanned scope",
          outputSummary: "found symbol",
          timestamp: "2024-01-01T00:00:00Z",
        },
      ],
    });
    const { lastFrame } = renderPane(issue, "trace");
    const frame = lastFrame() ?? "";

    expect(frame).toContain("Trace");
    // SectionHeader renders its label uppercased.
    expect(frame).toContain("AGENT TRACE");
    expect(frame).toContain("inspectScope");
  });
});
