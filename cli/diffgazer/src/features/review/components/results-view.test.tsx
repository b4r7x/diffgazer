import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/presentation";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ReviewResultsView } from "./results-view";

const ARROW_DOWN = "\u001b[B";

const ARROW_UP = "\u001b[A";

const ARROW_RIGHT = "\u001b[C";

const terminalDimensions = { columns: 100, rows: 24 };
const MEDIUM_LIST_WIDTH = 35;

beforeEach(() => {
  terminalDimensions.columns = 100;
  terminalDimensions.rows = 24;
});

afterEach(() => {
  cleanup();
});

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({
    ...terminalDimensions,
    tier: "medium",
    isNarrow: false,
    isMedium: true,
    isWide: false,
  }),
}));

vi.mock("../../../components/layout/global", () => ({
  useContentZone: () => ({
    columns: terminalDimensions.columns,
    rows: terminalDimensions.rows,
    contentColumns: terminalDimensions.columns,
    contentRows: terminalDimensions.rows - 4,
  }),
}));

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function FooterProbe() {
  const { shortcuts } = useFooterData();
  return <Text>{shortcuts.map(({ key, label }) => `${key} ${label}`).join(", ")}</Text>;
}

function resultsElement(issues: Parameters<typeof ReviewResultsView>[0]["issues"]) {
  return (
    <FooterProvider initialShortcuts={[]}>
      <CliThemeProvider initialTheme="dark">
        <ReviewResultsView reviewId="review-1" issues={issues} />
        <FooterProbe />
      </CliThemeProvider>
    </FooterProvider>
  );
}

function renderResults() {
  return render(
    <FooterProvider initialShortcuts={[]}>
      <CliThemeProvider initialTheme="dark">
        <ReviewResultsView
          reviewId="review-1"
          issues={[
            makeIssue({
              id: "issue-1",
              title: "Leaky state update",
              symptom: "Details symptom text",
              rationale: "Explain rationale text",
              recommendation: "Explain recommendation text",
              fixPlan: [
                { step: 1, action: "First fix step" },
                { step: 1, action: "Second fix step" },
                { step: 2, action: "Third fix step" },
              ],
            }),
          ]}
        />
      </CliThemeProvider>
    </FooterProvider>,
  );
}

describe("ReviewResultsView (TUI)", () => {
  test("formats a full review id with the shared compact label", () => {
    const { lastFrame } = render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewResultsView reviewId="12345678-1234-4123-8123-123456789abc" issues={[]} />
        </CliThemeProvider>
      </FooterProvider>,
    );

    expect(lastFrame() ?? "").toContain("Review #12345678");
    expect(lastFrame() ?? "").not.toContain("12345678-1234");
  });

  test("renders the shared medium severity label instead of the raw severity value", () => {
    const { lastFrame } = render(
      resultsElement([makeIssue({ id: "medium-issue", severity: "medium" })]),
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("[MED]");
    expect(frame).not.toContain("[medium]");
  });

  test("does not grow the 80x24 results layout for a duplicate disclosure", () => {
    terminalDimensions.columns = 80;
    const withoutNotice = render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewResultsView
            reviewId="review-1"
            issues={[makeIssue({ id: "duplicate-survivor" })]}
          />
        </CliThemeProvider>
      </FooterProvider>,
    ).lastFrame();
    cleanup();
    const { lastFrame } = render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewResultsView
            reviewId="review-1"
            issues={[makeIssue({ id: "duplicate-survivor" })]}
            droppedDuplicates={1}
          />
        </CliThemeProvider>
      </FooterProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("1 duplicate issue collapsed across lenses (2 → 1 issue)");
    expect(frame.split("\n")).toHaveLength((withoutNotice ?? "").split("\n").length);
  });

  test("hides tab shortcuts and ignores numbers until an issue becomes visible", async () => {
    const issue = makeIssue({
      id: "issue-visible",
      symptom: "Visible details",
      rationale: "Visible explanation",
    });
    const view = render(resultsElement([]));
    await flush();

    expect(view.lastFrame() ?? "").not.toContain("Tabs");
    view.stdin.write("2");
    await flush();

    view.rerender(resultsElement([issue]));
    await flush();
    expect(view.lastFrame() ?? "").toContain("Visible details");
    expect(view.lastFrame() ?? "").toContain("1-2 Tabs");

    view.stdin.write("2");
    await flush();
    expect(view.lastFrame() ?? "").toContain("Visible explanation");
  });

  test.each([
    { resetKey: "\r", label: "Enter" },
    { resetKey: " ", label: "Space" },
    { resetKey: "r", label: "r" },
  ])("keeps zero-result Reset actionable with $label after ArrowDown", async ({ resetKey }) => {
    const view = render(
      resultsElement([
        makeIssue({
          id: "nit-only",
          severity: "nit",
          symptom: "Nit issue details",
          rationale: "Nit issue explanation",
        }),
      ]),
    );
    await flush();
    expect(view.lastFrame() ?? "").toContain("1-2 Tabs");

    view.stdin.write(ARROW_UP);
    await flush();
    view.stdin.write(" ");
    await flush();

    const emptyFrame = view.lastFrame() ?? "";
    expect(emptyFrame).toContain("No issues match filter");
    expect(emptyFrame).not.toContain("Tabs");

    for (let index = 0; index < SEVERITY_ORDER.length; index += 1) {
      view.stdin.write(ARROW_RIGHT);
      await flush();
    }

    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(resetKey);
    await flush();
    const restoredFrame = view.lastFrame() ?? "";
    expect(restoredFrame).toContain("Nit issue details");
    expect(restoredFrame).not.toContain("Nit issue explanation");
    expect(restoredFrame).toContain("1-2 Tabs");
  });

  test("number keys switch to the matching available issue tab", async () => {
    const { stdin, lastFrame } = renderResults();

    expect(lastFrame() ?? "").toContain("Details symptom text");

    stdin.write("2");
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Explain rationale text");
    expect(frame).toContain("Explain recommendation text");
    expect(frame).not.toContain("Details symptom text");
  });

  test("snaps selection to the first visible issue when a filter hides the selected issue", async () => {
    const { stdin, lastFrame } = render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewResultsView
            reviewId="review-1"
            issues={[
              makeIssue({ id: "issue-nit", severity: "nit", symptom: "Nit symptom text" }),
              makeIssue({
                id: "issue-blocker",
                severity: "blocker",
                symptom: "Blocker symptom text",
              }),
            ]}
          />
        </CliThemeProvider>
      </FooterProvider>,
    );

    expect(lastFrame() ?? "").toContain("Nit symptom text");

    stdin.write(ARROW_UP);
    await flush();
    stdin.write(" ");
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Blocker symptom text");
    expect(frame).not.toContain("Nit symptom text");
  });

  test("down arrow moves one fix-plan step when the fix plan is focused", async () => {
    const { stdin, lastFrame } = renderResults();

    stdin.write("\t");
    await flush();
    stdin.write("\t");
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(" ");
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("[ ] 1. First fix step");
    expect(frame).toContain("[x] 1. Second fix step");
    expect(frame).toContain("[ ] 2. Third fix step");
  });

  test("resets the details scroll and fix-plan cursor when selection changes", async () => {
    const longFixPlan = Array.from({ length: 24 }, (_, index) => ({
      step: index + 1,
      action: `Issue A step ${index + 1}`,
    }));
    const { stdin, lastFrame } = render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewResultsView
            reviewId="review-reset"
            issues={[
              makeIssue({
                id: "issue-a",
                title: "Long issue A",
                symptom: "Issue A top marker",
                fixPlan: longFixPlan,
              }),
              makeIssue({
                id: "issue-b",
                title: "Short issue B",
                symptom: "Issue B top marker",
                fixPlan: [
                  { step: 1, action: "Issue B first step" },
                  { step: 2, action: "Issue B second step" },
                ],
              }),
            ]}
          />
        </CliThemeProvider>
      </FooterProvider>,
    );

    stdin.write("\t");
    await flush();
    stdin.write("\u001b[F");
    await flush();
    expect(lastFrame() ?? "").not.toContain("Issue A top marker");

    stdin.write("\t");
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();

    stdin.write("\t");
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();

    expect(lastFrame() ?? "").toContain("Issue B top marker");

    stdin.write("\t");
    await flush();
    stdin.write("\t");
    await flush();
    stdin.write("\r");
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("[x] 1. Issue B first step");
    expect(frame).toContain("[ ] 2. Issue B second step");
  });

  test("keeps long issue previews to one row while the window follows selection", async () => {
    terminalDimensions.rows = 16;
    const issues = Array.from({ length: 10 }, (_, index) =>
      makeIssue({
        id: `issue-${index + 1}`,
        file: `packages/review/src/generated/deeply/nested/module-${index + 1}.typescript.ts`,
        title: `ISSUE-${index + 1} Generated review title with enough detail to overflow the results pane`,
      }),
    );
    const { stdin, lastFrame } = render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewResultsView reviewId="review-long" issues={issues} />
        </CliThemeProvider>
      </FooterProvider>,
    );

    const initialPreviewRows = (lastFrame() ?? "")
      .split("\n")
      .map((line) => line.slice(0, MEDIUM_LIST_WIDTH))
      .filter((line) => line.includes("ISSUE-"));
    expect(initialPreviewRows).toHaveLength(2);

    for (let index = 0; index < 9; index += 1) {
      stdin.write(ARROW_DOWN);
      await flush();
    }

    const frame = lastFrame() ?? "";
    const previewRows = frame
      .split("\n")
      .map((line) => line.slice(0, MEDIUM_LIST_WIDTH))
      .filter((line) => line.includes("ISSUE-"));
    expect(previewRows).toHaveLength(2);
    expect(frame).toContain("ISSUE-10");
    expect(frame).not.toContain("ISSUE-1 ");
  });
});
