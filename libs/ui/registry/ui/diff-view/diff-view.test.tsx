import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";
import type { ParsedDiff } from "@/lib/diff";
import { axe } from "../../../testing/axe";
import { computeDiff, DiffView } from "./index";

const ONE_HUNK: ParsedDiff = {
  oldPath: "src/app.ts",
  newPath: "src/app.ts",
  hunks: [
    {
      oldStart: 1,
      oldCount: 3,
      newStart: 1,
      newCount: 4,
      heading: "function main",
      changes: [
        { type: "context", content: "import { run } from './run'", oldLine: 1, newLine: 1 },
        { type: "remove", content: "const x = 1", oldLine: 2, newLine: null },
        { type: "add", content: "const x = 2", oldLine: null, newLine: 2 },
        { type: "add", content: "const y = 3", oldLine: null, newLine: 3 },
        { type: "context", content: "run()", oldLine: 3, newLine: 4 },
      ],
    },
  ],
};

const THREE_HUNKS: ParsedDiff = {
  oldPath: "a.ts",
  newPath: "b.ts",
  hunks: [
    {
      oldStart: 1,
      oldCount: 1,
      newStart: 1,
      newCount: 1,
      heading: "hunk one",
      changes: [
        { type: "remove", content: "alpha", oldLine: 1, newLine: null },
        { type: "add", content: "beta", oldLine: null, newLine: 1 },
      ],
    },
    {
      oldStart: 10,
      oldCount: 1,
      newStart: 10,
      newCount: 2,
      heading: "hunk two",
      changes: [
        { type: "context", content: "unchanged", oldLine: 10, newLine: 10 },
        { type: "add", content: "added", oldLine: null, newLine: 11 },
      ],
    },
    {
      oldStart: 20,
      oldCount: 1,
      newStart: 21,
      newCount: 1,
      heading: "hunk three",
      changes: [
        { type: "remove", content: "gamma", oldLine: 20, newLine: null },
        { type: "add", content: "delta", oldLine: null, newLine: 21 },
      ],
    },
  ],
};

const NO_CHANGES: ParsedDiff = {
  oldPath: null,
  newPath: null,
  hunks: [],
};

const PATHLESS_HUNK: ParsedDiff = {
  oldPath: null,
  newPath: null,
  hunks: [
    {
      oldStart: 1,
      oldCount: 1,
      newStart: 1,
      newCount: 1,
      heading: "",
      changes: [
        { type: "remove", content: "alpha", oldLine: 1, newLine: null },
        { type: "add", content: "beta", oldLine: null, newLine: 1 },
      ],
    },
  ],
};

// DiffView's public anatomy contract is the `data-slot=...` / `.diff-num` /
// `[aria-live=...]` selectors documented in component-docs and the CSS rewrite
// rules. These helpers target that contract; tests below should use them
// instead of inline querySelector calls so the contract lives in one place.

/** Live region for hunk-navigation announcements (`aria-live="polite"`). */
function getLiveRegion() {
  const el = document.querySelector("[aria-live='polite']");
  if (!el) throw new Error("expected aria-live='polite' region");
  return el;
}

/** Root figure element (`data-slot="diff-view"`). */
function getFigure(container: HTMLElement) {
  return container.querySelector('[data-slot="diff-view"]');
}

/** First rows container (`data-slot="diff-view-rows"`). */
function getRows(container: HTMLElement) {
  return container.querySelector('[data-slot="diff-view-rows"]');
}

/** Caption slot (`data-slot="diff-view-caption"`). */
function getCaption(container: HTMLElement) {
  return container.querySelector('[data-slot="diff-view-caption"]');
}

/** Status-bar slot (`data-slot="diff-view-statusbar"`). */
function getStatusBar(container: HTMLElement) {
  return container.querySelector('[data-slot="diff-view-statusbar"]');
}

/** Viewfinder corners slot (`data-slot="diff-view-corners"`). */
function getCorners(container: HTMLElement) {
  return container.querySelector('[data-slot="diff-view-corners"]');
}

/** Vertical-scroll wrapper (`data-slot="diff-view-scroll-v"`). */
function getScrollV(container: HTMLElement) {
  return container.querySelector('[data-slot="diff-view-scroll-v"]');
}

/** All line-number cells (`.diff-num`). */
function getLineNumbers(container: HTMLElement) {
  return container.querySelectorAll(".diff-num");
}

/** Diff markers (`+`/`−`) for rows of a given state. */
function getMarkers(container: HTMLElement, state: "added" | "removed") {
  return container.querySelectorAll(`[data-row][data-state="${state}"] .diff-marker`);
}

function LayoutTextProbe({ onText }: { onText: (text: string) => void }) {
  useLayoutEffect(() => {
    onText(getLiveRegion().textContent ?? "");
  });

  return null;
}

describe("DiffView", () => {
  it("renders unified mode by default and split mode when specified", () => {
    const { unmount } = render(<DiffView diff={ONE_HUNK} />);
    expect(screen.getByLabelText("Unified diff")).toBeInTheDocument();
    expect(screen.queryByLabelText("Split diff")).not.toBeInTheDocument();
    unmount();

    render(<DiffView diff={ONE_HUNK} mode="split" />);
    expect(screen.getByLabelText("Split diff")).toBeInTheDocument();
    expect(screen.queryByLabelText("Unified diff")).not.toBeInTheDocument();
  });

  it("forwards refs to the diff figure and uses `label` as the accessible name when no figcaption renders", () => {
    // A diff without paths suppresses the figcaption, so the `label` prop becomes
    // the figure's aria-label (the accessible-name contract under test).
    const ref = createRef<HTMLElement>();
    render(<DiffView ref={ref} diff={PATHLESS_HUNK} label="Changes" />);

    expect(ref.current).toBe(screen.getByRole("figure", { name: "Changes" }));
  });

  it("shows file header with path", () => {
    render(<DiffView diff={ONE_HUNK} />);
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
  });

  it("shows rename path with arrow when oldPath differs from newPath", () => {
    render(<DiffView diff={THREE_HUNKS} />);
    expect(screen.getByText("a.ts → b.ts")).toBeInTheDocument();
  });

  it("shows 'No changes' when diff has no hunks", () => {
    render(<DiffView diff={NO_CHANGES} />);
    expect(screen.getByRole("status")).toHaveTextContent("No changes");
  });

  it("renders hunk headers with correct format", () => {
    render(<DiffView diff={ONE_HUNK} />);
    expect(screen.getByText("@@ -1,3 +1,4 @@ function main")).toBeInTheDocument();
  });

  it("renders added and removed line content (word-diff may split text)", () => {
    render(<DiffView diff={ONE_HUNK} disableWordDiff />);
    expect(screen.getByText("const x = 2")).toBeInTheDocument();
    expect(screen.getByText("const x = 1")).toBeInTheDocument();
  });

  it("navigates hunks forward with j key", async () => {
    const user = userEvent.setup();
    render(<DiffView diff={THREE_HUNKS} />);

    const container = screen.getByLabelText("Unified diff");
    await user.click(container);

    await user.keyboard("j");
    expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3: hunk one");
  });

  it("navigates backward with k key", async () => {
    const user = userEvent.setup();
    render(<DiffView diff={THREE_HUNKS} />);

    const container = screen.getByLabelText("Unified diff");
    await user.click(container);

    await user.keyboard("j");
    await user.keyboard("j");
    expect(getLiveRegion()).toHaveTextContent("Hunk 2 of 3: hunk two");

    await user.keyboard("k");
    expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3: hunk one");
  });

  it("does not wrap past last hunk when pressing j (wrap: false)", async () => {
    const user = userEvent.setup();
    render(<DiffView diff={THREE_HUNKS} />);

    const container = screen.getByLabelText("Unified diff");
    await user.click(container);

    await user.keyboard("j");
    await user.keyboard("j");
    await user.keyboard("j");
    expect(getLiveRegion()).toHaveTextContent("Hunk 3 of 3");

    await user.keyboard("j");
    expect(getLiveRegion()).toHaveTextContent("Hunk 3 of 3");
  });

  it("has no a11y violations in unified mode", async () => {
    const { container } = render(<DiffView diff={ONE_HUNK} label="Test diff" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations in split mode", async () => {
    const { container } = render(<DiffView diff={ONE_HUNK} mode="split" label="Split test" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations with no changes", async () => {
    const { container } = render(<DiffView diff={NO_CHANGES} label="Empty diff" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Escape clears active hunk selection", async () => {
    const user = userEvent.setup();
    render(<DiffView diff={THREE_HUNKS} />);

    const container = screen.getByLabelText("Unified diff");
    await user.click(container);

    await user.keyboard("j");
    expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3");

    await user.keyboard("{Escape}");
    expect(getLiveRegion()).toHaveTextContent("");
  });

  it("j/k do nothing when there are no hunks", async () => {
    const user = userEvent.setup();
    render(<DiffView diff={NO_CHANGES} />);

    expect(screen.getByRole("status")).toHaveTextContent("No changes");

    await user.keyboard("j");
    await user.keyboard("k");
    expect(getLiveRegion()).toHaveTextContent("");
  });

  it("does not expose hunk headers as buttons", () => {
    render(<DiffView diff={ONE_HUNK} />);
    expect(screen.queryByRole("button", { name: /Change section/ })).not.toBeInTheDocument();
    expect(screen.getByText("@@ -1,3 +1,4 @@ function main")).toBeInTheDocument();
  });

  it("computes empty file changes without fake blank lines", () => {
    const added = computeDiff("", "alpha\n");
    const [addedHunk] = added.hunks;
    if (!addedHunk) throw new Error("expected added hunk");
    expect(addedHunk.oldCount).toBe(0);
    expect(addedHunk.newCount).toBe(1);
    expect(addedHunk.changes).toEqual([
      { type: "add", content: "alpha", oldLine: null, newLine: 1 },
    ]);

    const removed = computeDiff("alpha\n", "");
    const [removedHunk] = removed.hunks;
    if (!removedHunk) throw new Error("expected removed hunk");
    expect(removedHunk.oldCount).toBe(1);
    expect(removedHunk.newCount).toBe(0);
    expect(removedHunk.changes).toEqual([
      { type: "remove", content: "alpha", oldLine: 1, newLine: null },
    ]);
  });

  it("resets active hunk announcements when content changes with the same hunk count", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DiffView diff={THREE_HUNKS} />);

    await user.click(screen.getByLabelText("Unified diff"));
    await user.keyboard("j");
    expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3");

    rerender(
      <DiffView
        diff={{
          ...THREE_HUNKS,
          hunks: THREE_HUNKS.hunks.map((hunk, index) => ({
            ...hunk,
            heading: `replacement ${index + 1}`,
          })),
        }}
      />,
    );
    expect(getLiveRegion()).toHaveTextContent("");
  });

  it("clears stale active hunk during the same render as a diff identity change", async () => {
    const user = userEvent.setup();
    const layoutTexts: string[] = [];
    const replacementDiff = {
      ...THREE_HUNKS,
      hunks: THREE_HUNKS.hunks.map((hunk, index) => ({
        ...hunk,
        heading: `replacement ${index + 1}`,
      })),
    };
    const { rerender } = render(
      <>
        <DiffView diff={THREE_HUNKS} />
        <LayoutTextProbe onText={(text) => layoutTexts.push(text)} />
      </>,
    );

    await user.click(screen.getByLabelText("Unified diff"));
    await user.keyboard("j");
    expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3");

    layoutTexts.length = 0;
    rerender(
      <>
        <DiffView diff={replacementDiff} />
        <LayoutTextProbe onText={(text) => layoutTexts.push(text)} />
      </>,
    );

    expect(layoutTexts[layoutTexts.length - 1]).toBe("");
    expect(getLiveRegion()).toHaveTextContent("");
  });

  it("falls back for large computed diffs instead of building huge LCS tables", () => {
    const before = Array.from({ length: 600 }, (_, i) => `old ${i}`).join("\n");
    const after = Array.from({ length: 600 }, (_, i) => `new ${i}`).join("\n");

    const parsed = computeDiff(before, after);

    expect(parsed.hunks).toHaveLength(1);
    expect(parsed.hunks[0]?.oldCount).toBe(600);
    expect(parsed.hunks[0]?.newCount).toBe(600);
  });

  it("uses an aggregate word-diff budget and falls back to line-level changes", () => {
    const makeLine = (variant: string, index: number) =>
      Array.from({ length: 18 }, (_, i) => `shared-${i}`)
        .concat(`${variant}-${index}`)
        .join(" ");
    const removes = Array.from({ length: 45 }, (_, i) => ({
      type: "remove" as const,
      content: makeLine("old", i),
      oldLine: i + 1,
      newLine: null,
    }));
    const adds = Array.from({ length: 45 }, (_, i) => ({
      type: "add" as const,
      content: makeLine("new", i),
      oldLine: null,
      newLine: i + 1,
    }));
    render(
      <DiffView
        diff={{
          oldPath: "old.txt",
          newPath: "new.txt",
          hunks: [
            {
              oldStart: 1,
              oldCount: removes.length,
              newStart: 1,
              newCount: adds.length,
              heading: "",
              changes: [...removes, ...adds],
            },
          ],
        }}
      />,
    );

    const lastRemove = removes[removes.length - 1];
    const lastAdd = adds[adds.length - 1];
    if (!lastRemove || !lastAdd) throw new Error("expected non-empty change arrays");
    expect(screen.getByText(lastRemove.content)).toBeInTheDocument();
    expect(screen.getByText(lastAdd.content)).toBeInTheDocument();
  });

  describe("variants", () => {
    const variants = ["hairline", "bare", "dense", "viewfinder", "statusbar"] as const;

    it.each(variants)("surfaces variant=%s as data-variant on the figure", (variant) => {
      const { container } = render(<DiffView diff={ONE_HUNK} variant={variant} />);
      expect(getFigure(container)).toHaveAttribute("data-variant", variant);
    });

    it('does not render a figcaption in variant="bare"', () => {
      const { container } = render(<DiffView diff={ONE_HUNK} variant="bare" />);
      expect(container.querySelector("figcaption")).toBeNull();
      expect(getCaption(container)).toBeNull();
    });

    it('renders consumer-supplied statusBar content in variant="statusbar"', () => {
      render(<DiffView diff={ONE_HUNK} variant="statusbar" statusBar={<span>stats</span>} />);
      expect(screen.getByText("stats")).toBeInTheDocument();
    });

    it("renders no status-bar slot when statusBar is omitted", () => {
      // Protects the "no hard-coded kbd hints" contract — consumer fills the slot
      // or there is no slot.
      const { container } = render(<DiffView diff={ONE_HUNK} variant="statusbar" />);
      expect(getStatusBar(container)).toBeNull();
    });

    it('renders the four viewfinder corners in variant="viewfinder"', () => {
      const { container } = render(<DiffView diff={ONE_HUNK} variant="viewfinder" />);
      const corners = getCorners(container);
      expect(corners).not.toBeNull();
      expect(corners?.querySelectorAll("span").length).toBe(4);
    });
  });

  describe("density", () => {
    it.each([
      "compact",
      "default",
      "comfortable",
    ] as const)("surfaces density=%s as data-density on the figure", (density) => {
      const { container } = render(<DiffView diff={ONE_HUNK} density={density} />);
      expect(getFigure(container)).toHaveAttribute("data-density", density);
    });

    it('defaults density to "compact" when variant="dense" and density is unset', () => {
      const { container } = render(<DiffView diff={ONE_HUNK} variant="dense" />);
      expect(getFigure(container)).toHaveAttribute("data-density", "compact");
    });

    it('lets explicit density override the variant="dense" default', () => {
      const { container } = render(
        <DiffView diff={ONE_HUNK} variant="dense" density="comfortable" />,
      );
      expect(getFigure(container)).toHaveAttribute("data-density", "comfortable");
    });
  });

  it("surfaces palette as data-diff-palette on the figure", () => {
    const { container } = render(<DiffView diff={ONE_HUNK} palette="okabe-ito" />);
    expect(getFigure(container)).toHaveAttribute("data-diff-palette", "okabe-ito");
  });

  describe("line numbers", () => {
    it('omits the number cells and reports data-line-numbers="false" when showLineNumbers is false', () => {
      const { container } = render(<DiffView diff={ONE_HUNK} />);
      expect(getRows(container)).toHaveAttribute("data-line-numbers", "false");
      expect(getLineNumbers(container).length).toBe(0);
    });

    it('renders number cells and reports data-line-numbers="true" when showLineNumbers is true', () => {
      const { container } = render(<DiffView diff={ONE_HUNK} showLineNumbers />);
      expect(getRows(container)).toHaveAttribute("data-line-numbers", "true");
      expect(getLineNumbers(container).length).toBeGreaterThan(0);
    });
  });

  describe("maxHeight", () => {
    it("wraps rows in the V-scroll slot and passes the value via the --dv-max-h CSS var", () => {
      const { container } = render(<DiffView diff={ONE_HUNK} maxHeight="120px" />);
      const figure = getFigure(container) as HTMLElement | null;
      const scrollWrap = getScrollV(container);

      expect(scrollWrap).not.toBeNull();
      expect(figure).toHaveAttribute("data-max-h", "true");
      expect(figure?.style.getPropertyValue("--dv-max-h")).toBe("120px");
      // The rows container lives inside the scroll wrapper.
      expect(scrollWrap?.querySelector('[data-slot="diff-view-rows"]')).not.toBeNull();
    });

    it("does not render the V-scroll slot when maxHeight is omitted", () => {
      const { container } = render(<DiffView diff={ONE_HUNK} />);
      expect(getScrollV(container)).toBeNull();
    });
  });

  it("renders + and U+2212 markers on added and removed rows", () => {
    const { container } = render(<DiffView diff={ONE_HUNK} />);

    const added = getMarkers(container, "added");
    const removed = getMarkers(container, "removed");

    expect(added.length).toBeGreaterThan(0);
    expect(removed.length).toBeGreaterThan(0);
    for (const cell of added) expect(cell.textContent).toBe("+");
    for (const cell of removed) expect(cell.textContent).toBe("−");
  });

  it('has no a11y violations in variant="bare"', async () => {
    const { container } = render(<DiffView diff={ONE_HUNK} variant="bare" label="Bare diff" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations in variant="statusbar" with a consumer slot', async () => {
    const { container } = render(
      <DiffView
        diff={ONE_HUNK}
        variant="statusbar"
        label="Statusbar diff"
        statusBar={<span>+5 −2</span>}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('preserves the `label` aria-label across variant="bare" (figcaption is suppressed)', () => {
    render(<DiffView diff={ONE_HUNK} variant="bare" label="Bare changes" />);
    // Even though ONE_HUNK has paths, bare suppresses the figcaption — so
    // `label` takes over as the figure's aria-label.
    expect(screen.getByRole("figure", { name: "Bare changes" })).toBeInTheDocument();
  });
});
