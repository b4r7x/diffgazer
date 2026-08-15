import type { UISeverityFilter } from "@diffgazer/core/schemas/presentation";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import stripAnsi from "strip-ansi";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { frameBackgrounds } from "../../../testing/frame-colors";
import { selectionHue } from "../../../theme/chrome";
import { darkPalette } from "../../../theme/palettes";
import { CliThemeProvider } from "../../../theme/provider";
import { IssueListPane } from "./issue-list-pane";

// The highlight is a row fill, so the frame has to keep its colour codes: Ink
// reads colour support from the environment when it first imports chalk, which
// happens above this file's own imports.
const restoreForceColor = vi.hoisted(() => {
  const previous = process.env.FORCE_COLOR;
  process.env.FORCE_COLOR = "3";
  return () => {
    if (previous === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = previous;
  };
});

afterAll(restoreForceColor);

afterEach(() => {
  cleanup();
});

const ESC = String.fromCharCode(0x1b);
const ARROW_UP = `${ESC}[A`;
const ARROW_DOWN = `${ESC}[B`;

const ISSUES = [
  makeIssue({ id: "issue-1", title: "First issue" }),
  makeIssue({ id: "issue-2", title: "Second issue" }),
  makeIssue({ id: "issue-3", title: "Third issue" }),
];
const TITLES = ISSUES.map((issue) => issue.title);

/** The issue titles rendered on a filled — that is, highlighted — row. */
function highlightedTitles(frame: string | undefined): string[] {
  const fill = selectionHue(darkPalette);
  return (frame ?? "").split("\n").flatMap((line) => {
    if (!frameBackgrounds(line).includes(fill)) return [];
    return TITLES.filter((title) => stripAnsi(line).includes(title));
  });
}

function Harness({
  initialSelectedId,
  onHighlightChange,
}: {
  initialSelectedId: string;
  onHighlightChange?: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [severityFilter, setSeverityFilter] = useState<UISeverityFilter>(() => new Set());
  return (
    <CliThemeProvider initialTheme="dark">
      <IssueListPane
        issues={ISSUES}
        allIssues={ISSUES}
        selectedId={selectedId}
        onHighlightChange={(id) => {
          setSelectedId(id);
          onHighlightChange?.(id);
        }}
        isActive
        contentWidth={60}
        severityFilter={severityFilter}
        onSeverityFilterChange={setSeverityFilter}
      />
    </CliThemeProvider>
  );
}

describe("IssueListPane cursor", () => {
  test("highlights the row the parent already selected", async () => {
    const { lastFrame } = render(<Harness initialSelectedId="issue-2" />);
    await flush();

    expect(highlightedTitles(lastFrame())).toEqual(["Second issue"]);
  });

  test("j moves the highlight to the next issue and reports its id", async () => {
    const onHighlightChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Harness initialSelectedId="issue-2" onHighlightChange={onHighlightChange} />,
    );
    await flush();

    stdin.write("j");
    await flush();

    expect(onHighlightChange).toHaveBeenLastCalledWith("issue-3");
    expect(highlightedTitles(lastFrame())).toEqual(["Third issue"]);
  });

  test("k moves the highlight back and hands the top row to the filter zone", async () => {
    const onHighlightChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Harness initialSelectedId="issue-2" onHighlightChange={onHighlightChange} />,
    );
    await flush();

    stdin.write("k");
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("issue-1");
    expect(highlightedTitles(lastFrame())).toEqual(["First issue"]);

    stdin.write("k");
    await flush();
    expect(onHighlightChange).toHaveBeenCalledTimes(1);
    expect(highlightedTitles(lastFrame())).toEqual([]);
  });

  test("j returns from the filter zone to the issue list, like the down arrow", async () => {
    const { stdin, lastFrame } = render(<Harness initialSelectedId="issue-1" />);
    await flush();

    stdin.write("k");
    await flush();
    expect(highlightedTitles(lastFrame())).toEqual([]);

    stdin.write("j");
    await flush();
    expect(highlightedTitles(lastFrame())).toEqual(["First issue"]);
  });

  test("arrows move the highlight like j/k and hold it on the last issue", async () => {
    const { stdin, lastFrame } = render(<Harness initialSelectedId="issue-2" />);
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(highlightedTitles(lastFrame())).toEqual(["Third issue"]);

    stdin.write(ARROW_DOWN);
    await flush();
    expect(highlightedTitles(lastFrame())).toEqual(["Third issue"]);

    stdin.write(ARROW_UP);
    await flush();
    expect(highlightedTitles(lastFrame())).toEqual(["Second issue"]);
  });
});
