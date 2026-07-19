import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import { type ReviewIssue, SavedReviewSchema } from "@diffgazer/core/schemas/review";
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
const ARROW_DOWN = "\u001b[B";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function renderPane(
  issue: ReviewIssue,
  activeTab: IssueTab = "details",
  options: { isActive?: boolean; scrollHeight?: number } = {},
) {
  return render(paneElement(issue, activeTab, options));
}

function paneElement(
  issue: ReviewIssue,
  activeTab: IssueTab = "details",
  options: { isActive?: boolean; scrollHeight?: number } = {},
) {
  return (
    <CliThemeProvider initialTheme="dark">
      <IssueDetailsPane
        issue={issue}
        activeTab={activeTab}
        isActive={options.isActive}
        scrollHeight={options.scrollHeight}
        onTabChange={vi.fn()}
        completedSteps={new Set()}
        onToggleStep={vi.fn()}
      />
    </CliThemeProvider>
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

describe("IssueDetailsPane (TUI) evidence presentation", () => {
  test("renders shared metadata and complete fix steps after a saved review round trip", () => {
    const saved = SavedReviewSchema.parse(
      JSON.parse(
        JSON.stringify({
          metadata: {
            id: "11111111-1111-4111-8111-111111111111",
            projectPath: "/repo",
            createdAt: "2026-07-14T08:00:00.000Z",
            mode: "unstaged",
            branch: "main",
            profile: null,
            lenses: [],
            issueCount: 1,
            blockerCount: 0,
            highCount: 1,
            mediumCount: 0,
            lowCount: 0,
            nitCount: 0,
            fileCount: 2,
          },
          result: {
            issues: [
              makeIssue({
                category: "security",
                confidence: 0.876,
                file: "src/auth.ts",
                line_start: 14,
                line_end: 18,
                fixPlan: [
                  {
                    step: 4,
                    action: "Validate redirect",
                    risk: "high",
                    files: ["src/auth.ts", "src/auth.test.ts"],
                  },
                ],
              }),
            ],
          },
          gitContext: {
            branch: "main",
            commit: "abc123",
            fileCount: 2,
            additions: 5,
            deletions: 1,
          },
        }),
      ),
    );
    const issue = saved.result.issues[0];
    if (!issue) throw new Error("Expected saved issue fixture");

    const frame = renderPane(issue, "details", { scrollHeight: 30 }).lastFrame() ?? "";

    expect(frame).toContain("src/auth.ts:14-18");
    expect(frame).toContain("security");
    expect(frame).toContain("confidence: 88%");
    expect(frame).toContain("4. Validate redirect");
    expect(frame).toContain("high");
    expect(frame).toContain("files: src/auth.ts, src/auth.test.ts");
  });

  test("renders all evidence variants and keeps an external source as sanitized text", () => {
    const issue = makeIssue({
      evidence: [
        {
          type: "code",
          title: "Unsafe parser",
          sourceId: "source:parser",
          file: "src/parser.ts",
          range: { start: 7, end: 7 },
          excerpt: "const value = JSON.parse(input);",
        },
        {
          type: "doc",
          title: "Parser contract",
          sourceId: "docs/reference/parser",
          excerpt: "Invalid input must return a typed failure.",
        },
        {
          type: "trace",
          title: "Failure reproduction",
          sourceId: "trace:parse-invalid-input",
          excerpt: "Malformed JSON throws before the error boundary runs.",
        },
        {
          type: "external",
          title: "JSON parsing guidance",
          sourceId: `javascript:${OSC52}alert('not-a-link')`,
          excerpt: "Treat parser failures as expected input errors.",
        },
      ],
    });

    const frame = renderPane(issue, "details", { scrollHeight: 30 }).lastFrame() ?? "";

    expect(frame).toContain("src/parser.ts");
    expect(frame).toMatch(/7.const value = JSON\.parse/);
    expect(frame).toContain("const value = JSON.parse(input);");
    expect(frame).toContain("Documentation: Parser contract");
    expect(frame).toContain("docs/reference/parser");
    expect(frame).toContain("Invalid input must return a typed failure.");
    expect(frame).toContain("Trace evidence: Failure reproduction");
    expect(frame).toContain("trace:parse-invalid-input");
    expect(frame).toContain("Malformed JSON throws before the error boundary runs.");
    expect(frame).toContain("External reference: JSON parsing guidance");
    expect(frame).toContain("javascript:alert('not-a-link')");
    expect(frame).toContain("Treat parser failures as expected input errors.");
    expect(frame).not.toContain(ESC);
  });

  test("keeps duplicate evidence rows through a rerender without React key warnings", () => {
    const duplicateCode = {
      type: "code" as const,
      title: "Duplicate code evidence",
      sourceId: "source:duplicate-code",
      file: "src/duplicate.ts",
      range: { start: 4, end: 4 },
      excerpt: "duplicateCall();",
    };
    const duplicateReference = {
      type: "doc" as const,
      title: "Duplicate reference evidence",
      sourceId: "docs/duplicate",
      excerpt: "Duplicate documentation excerpt.",
    };
    const issue = makeIssue({
      evidence: [duplicateCode, duplicateCode, duplicateReference, duplicateReference],
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const view = renderPane(issue, "details", { scrollHeight: 30 });
      let frame = view.lastFrame() ?? "";

      expect(frame.split("duplicateCall();")).toHaveLength(3);
      expect(frame.split("Duplicate documentation excerpt.")).toHaveLength(3);

      view.rerender(
        paneElement(makeIssue({ evidence: issue.evidence }), "details", { scrollHeight: 30 }),
      );
      frame = view.lastFrame() ?? "";

      expect(frame.split("duplicateCall();")).toHaveLength(3);
      expect(frame.split("Duplicate documentation excerpt.")).toHaveLength(3);
      expect(consoleError.mock.calls.flat().map(String).join(" ")).not.toMatch(
        /same key|unique ["']key["']/i,
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  test("removes one duplicate Tests to Add row on rerender without React key warnings", () => {
    const duplicateTest = "Add the provider activation regression";
    const issue = makeIssue({ testsToAdd: [duplicateTest, duplicateTest] });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const view = renderPane(issue, "details", { scrollHeight: 30 });
      expect((view.lastFrame() ?? "").split(duplicateTest)).toHaveLength(3);

      view.rerender(
        paneElement({ ...issue, testsToAdd: [duplicateTest] }, "details", {
          scrollHeight: 30,
        }),
      );

      expect((view.lastFrame() ?? "").split(duplicateTest)).toHaveLength(2);
      expect(consoleError.mock.calls.flat().map(String).join(" ")).not.toMatch(
        /same key|unique ["']key["']/i,
      );
    } finally {
      consoleError.mockRestore();
    }
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
    expect(frame).toContain("in: scanned scope");
    expect(frame).toContain("out: found symbol");
  });
});

describe("IssueDetailsPane (TUI) body scroll", () => {
  test("Down on the focused body sub-zone scrolls the Details tab past its visible height", async () => {
    const issue = makeIssue({ symptom: "Symptom marker text" });
    const { stdin, lastFrame } = renderPane(issue, "details", { isActive: true, scrollHeight: 3 });
    await flush();

    let frame = lastFrame() ?? "";
    expect(frame).not.toContain("Symptom marker text");
    expect(frame).toContain("\u25BC");

    for (let step = 0; step < 4; step += 1) {
      stdin.write(ARROW_DOWN);
      await flush();
    }

    frame = lastFrame() ?? "";
    expect(frame).toContain("Symptom marker text");
  });
});
