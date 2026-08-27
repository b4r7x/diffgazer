import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";
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

// DiffView's public anatomy contract is the `data-slot=...` /
// `[aria-live=...]` selectors documented in component-docs and the CSS rewrite
// rules. These helpers target that contract.

/** Live region for hunk-navigation announcements (`aria-live="polite"`). */
function getLiveRegion() {
  const el = document.querySelector("[aria-live='polite']");
  if (!el) throw new Error("expected aria-live='polite' region");
  return el;
}

function getFigure(container: HTMLElement) {
  return container.querySelector('[data-slot="diff-view"]');
}

function getCaption(container: HTMLElement) {
  return container.querySelector('[data-slot="diff-view-caption"]');
}

function getStatusBar(container: HTMLElement) {
  return container.querySelector('[data-slot="diff-view-statusbar"]');
}

function getCorners(container: HTMLElement) {
  return container.querySelector('[data-slot="diff-view-corners"]');
}

function getScrollV(container: HTMLElement) {
  return container.querySelector('[data-slot="diff-view-scroll-v"]');
}

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

  it("exposes each navigation container as a named region so its aria-label is valid", () => {
    const { unmount } = render(<DiffView diff={ONE_HUNK} />);
    const unified = screen.getByRole("region", { name: /unified diff/i });
    expect(unified).toHaveAttribute("aria-keyshortcuts", "j k Home End Escape");
    unmount();

    render(<DiffView diff={ONE_HUNK} mode="split" />);
    expect(screen.getByRole("region", { name: /split diff/i })).toHaveAttribute(
      "aria-keyshortcuts",
      "j k Home End Escape",
    );
  });

  it("overrides the inner region label in unified and split modes", () => {
    const { unmount } = render(<DiffView diff={ONE_HUNK} regionLabel="Cambios unificados" />);
    expect(screen.getByRole("region", { name: "Cambios unificados" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /unified diff/i })).not.toBeInTheDocument();
    unmount();

    render(<DiffView diff={ONE_HUNK} mode="split" regionLabel="Cambios divididos" />);
    expect(screen.getByRole("region", { name: "Cambios divididos" })).toBeInTheDocument();
  });

  it("overrides the split side group labels", () => {
    render(<DiffView diff={ONE_HUNK} mode="split" oldSideLabel="Antes" newSideLabel="Después" />);
    expect(screen.getByRole("group", { name: "Antes" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Después" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Old" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "New" })).not.toBeInTheDocument();
  });

  it("overrides the empty-state status text", () => {
    render(<DiffView diff={NO_CHANGES} emptyLabel="Sin cambios" />);
    expect(screen.getByRole("status")).toHaveTextContent("Sin cambios");
  });

  it("merges consumer rest props and lets aria-label override the default", () => {
    render(
      <>
        <span id="diff-help">Use j/k to navigate</span>
        <DiffView
          diff={PATHLESS_HUNK}
          aria-label="Pull request diff"
          aria-describedby="diff-help"
          id="pr-diff"
        />
      </>,
    );

    const figure = screen.getByRole("figure", { name: "Pull request diff" });
    expect(figure).toHaveAttribute("id", "pr-diff");
    expect(figure).toHaveAttribute("aria-describedby", "diff-help");
    // The lib's own anatomy attribute is preserved alongside consumer props.
    expect(figure).toHaveAttribute("data-slot", "diff-view");
    expect(figure).toHaveAttribute("aria-roledescription", "diff");
  });

  it("uses an explicit aria-label for a path-bearing diff without hiding its caption", async () => {
    const { container } = render(<DiffView diff={ONE_HUNK} aria-label="Pull request changes" />);

    const figure = screen.getByRole("figure", { name: "Pull request changes" });
    expect(figure).toHaveAttribute("aria-label", "Pull request changes");
    expect(figure).not.toHaveAttribute("aria-labelledby");
    expect(getCaption(container)).toHaveTextContent("src/app.ts");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("forwards both external names while aria-labelledby names a path-bearing diff", async () => {
    const { container } = render(
      <>
        <span id="reviewed-diff-name">Reviewed changes</span>
        <DiffView
          diff={ONE_HUNK}
          aria-label="Pull request changes"
          aria-labelledby="reviewed-diff-name"
        />
      </>,
    );

    const figure = screen.getByRole("figure", { name: "Reviewed changes" });
    expect(figure).toHaveAttribute("aria-labelledby", "reviewed-diff-name");
    expect(figure).toHaveAttribute("aria-label", "Pull request changes");
    expect(getCaption(container)).toHaveTextContent("src/app.ts");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("forwards refs to the diff figure and uses `label` as the accessible name when no figcaption renders", () => {
    // A diff without paths suppresses the figcaption, so the `label` prop becomes
    // the figure's aria-label (the accessible-name contract under test).
    const ref = createRef<HTMLElement>();
    render(<DiffView ref={ref} diff={PATHLESS_HUNK} label="Changes" />);

    expect(ref.current).toBe(screen.getByRole("figure", { name: "Changes" }));
  });

  it("shows rename path with arrow when oldPath differs from newPath", () => {
    render(<DiffView diff={THREE_HUNKS} />);
    expect(screen.getByText("a.ts → b.ts")).toBeInTheDocument();
  });

  it("renders a clean filename caption for timestamped unified-diff headers", () => {
    const patch = [
      "--- a/src/app.ts\t2026-07-15 09:30:00.000000000 +0200",
      "+++ b/src/app.ts\t2026-07-15 09:31:00.000000000 +0200",
      "@@ -1 +1 @@",
      "-before",
      "+after",
    ].join("\n");

    render(<DiffView patch={patch} />);

    expect(
      screen.getByText("src/app.ts", { selector: '[data-slot="diff-view-caption-path"]' }),
    ).toHaveTextContent(/^src\/app\.ts$/);
  });

  it("shows 'No changes' when diff has no hunks", () => {
    render(<DiffView diff={NO_CHANGES} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("No changes");
    expect(status).not.toHaveClass("sr-only");
  });

  it("retains the empty status owner while a nonempty diff becomes empty", () => {
    const { container, rerender } = render(<DiffView diff={ONE_HUNK} />);
    const status = screen.getByRole("status");
    const observer = new MutationObserver(() => {});
    observer.observe(status, { childList: true, characterData: true, subtree: true });

    expect(status).toHaveClass("sr-only");
    expect(status).toBeEmptyDOMElement();

    rerender(<DiffView diff={NO_CHANGES} />);
    const mutations = observer.takeRecords();
    observer.disconnect();

    expect(container.querySelector('[data-slot="diff-view-empty"]')).toBe(status);
    expect(status).not.toHaveClass("sr-only");
    expect(status).toHaveTextContent("No changes");
    expect(mutations.some((mutation) => mutation.target === status)).toBe(true);
  });

  it("dresses the empty band in the same hatched material as an unmatched pane", () => {
    const { container, rerender } = render(<DiffView diff={NO_CHANGES} />);
    const status = screen.getByRole("status");

    expect(status).toHaveAttribute("data-empty", "true");
    expect(container.querySelector('[data-slot="diff-view-empty-label"]')).toHaveTextContent(
      "No changes",
    );

    rerender(<DiffView diff={ONE_HUNK} />);
    expect(screen.getByRole("status")).not.toHaveAttribute("data-empty");
  });

  it("renders EOF newline-only changes instead of the empty state", () => {
    render(<DiffView before={"alpha\n"} after="alpha" />);

    expect(screen.queryByText("No changes")).not.toBeInTheDocument();
    expect(screen.getByText("\\ No newline at end of file")).toBeInTheDocument();
  });

  it("renders hunk headers with correct format", () => {
    render(<DiffView diff={ONE_HUNK} />);
    expect(screen.getByText("@@ -1,3 +1,4 @@ function main")).toBeInTheDocument();
  });

  it.each([
    { before: "", after: "created\n", header: "@@ -0,0 +1,1 @@" },
    { before: "deleted\n", after: "", header: "@@ -1,1 +0,0 @@" },
  ])("renders a zero-based absent side in creation and deletion headers", ({
    before,
    after,
    header,
  }) => {
    render(<DiffView before={before} after={after} />);
    expect(screen.getByText(header)).toBeInTheDocument();
  });

  it("renders added and removed line content (word-diff may split text)", () => {
    render(<DiffView diff={ONE_HUNK} disableWordDiff />);
    expect(screen.getByText("const x = 2")).toBeInTheDocument();
    expect(screen.getByText("const x = 1")).toBeInTheDocument();
  });

  it("announces added/removed lines with default sr-only prefixes", () => {
    render(<DiffView diff={ONE_HUNK} disableWordDiff />);
    expect(screen.getAllByText("Added:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Removed:").length).toBeGreaterThan(0);
  });

  it("overrides the added/removed line sr-only prefixes", () => {
    render(
      <DiffView
        diff={ONE_HUNK}
        disableWordDiff
        addedLineLabel="Dodano: "
        removedLineLabel="Usunięto: "
      />,
    );
    expect(screen.getAllByText("Dodano:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Usunięto:").length).toBeGreaterThan(0);
    expect(screen.queryByText("Added:")).not.toBeInTheDocument();
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

  it("jumps to the last and first hunk with End and Home", async () => {
    const user = userEvent.setup();
    render(<DiffView diff={THREE_HUNKS} />);

    const container = screen.getByLabelText("Unified diff");
    await user.click(container);

    // Home/End are bound to hunk navigation, not native container scrolling —
    // aria-keyshortcuts and the component docs advertise them for that reason.
    await user.keyboard("{End}");
    expect(getLiveRegion()).toHaveTextContent("Hunk 3 of 3");

    await user.keyboard("{Home}");
    expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3: hunk one");
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

  it("consumes Escape only when an active hunk was cleared, so a window scope does not double-fire", async () => {
    const user = userEvent.setup();
    const scopeEscape = vi.fn();
    // A @diffgazer/keys-style window listener that skips already-handled events.
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") scopeEscape();
    };
    window.addEventListener("keydown", onWindowKeyDown);

    try {
      render(<DiffView diff={THREE_HUNKS} />);
      const container = screen.getByLabelText("Unified diff");
      await user.click(container);

      await user.keyboard("j");
      expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3");

      // Clearing the active hunk consumes the keypress: the window scope stays quiet.
      await user.keyboard("{Escape}");
      expect(getLiveRegion()).toHaveTextContent("");
      expect(scopeEscape).not.toHaveBeenCalled();

      // A bare Escape with no active hunk reaches the window scope.
      await user.keyboard("{Escape}");
      expect(scopeEscape).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("keydown", onWindowKeyDown);
    }
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
    expect(addedHunk.oldStart).toBe(0);
    expect(addedHunk.newCount).toBe(1);
    expect(addedHunk.changes).toEqual([
      { type: "add", content: "alpha", oldLine: null, newLine: 1 },
    ]);

    const removed = computeDiff("alpha\n", "");
    const [removedHunk] = removed.hunks;
    if (!removedHunk) throw new Error("expected removed hunk");
    expect(removedHunk.oldCount).toBe(1);
    expect(removedHunk.newCount).toBe(0);
    expect(removedHunk.newStart).toBe(0);
    expect(removedHunk.changes).toEqual([
      { type: "remove", content: "alpha", oldLine: 1, newLine: null },
    ]);
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
    it.each([
      "unified",
      "split",
    ] as const)("toggles the data-line-numbers contract and gutter numbers across every rows container in %s mode", (mode) => {
      const { container, rerender } = render(<DiffView diff={ONE_HUNK} mode={mode} />);

      const rowsWithNumbers = container.querySelectorAll('[data-slot="diff-view-rows"]');
      expect(rowsWithNumbers.length).toBeGreaterThan(0);
      for (const rows of rowsWithNumbers) {
        expect(rows).toHaveAttribute("data-line-numbers", "true");
      }
      expect(screen.getAllByText("2", { selector: ".diff-num" }).length).toBeGreaterThan(0);
      expect(screen.getAllByText("4", { selector: ".diff-num" }).length).toBeGreaterThan(0);

      rerender(<DiffView diff={ONE_HUNK} mode={mode} showLineNumbers={false} />);

      const rowsWithoutNumbers = container.querySelectorAll('[data-slot="diff-view-rows"]');
      expect(rowsWithoutNumbers.length).toBe(rowsWithNumbers.length);
      for (const rows of rowsWithoutNumbers) {
        expect(rows).toHaveAttribute("data-line-numbers", "false");
      }
      expect(container.querySelectorAll(".diff-num")).toHaveLength(0);
    });

    it('keeps the gutter off under variant="bare", where a gutter is chrome', () => {
      const { container, rerender } = render(
        <DiffView diff={ONE_HUNK} variant="bare" label="Bare diff" />,
      );
      expect(container.querySelector('[data-slot="diff-view-rows"]')).toHaveAttribute(
        "data-line-numbers",
        "false",
      );

      rerender(<DiffView diff={ONE_HUNK} variant="bare" label="Bare diff" showLineNumbers />);
      expect(container.querySelector('[data-slot="diff-view-rows"]')).toHaveAttribute(
        "data-line-numbers",
        "true",
      );
    });
  });

  describe("maxHeight", () => {
    it("wraps rows in the V-scroll slot and passes the value via the --diff-view-max-h CSS var", () => {
      const { container } = render(<DiffView diff={ONE_HUNK} maxHeight="120px" />);
      const figure = getFigure(container) as HTMLElement | null;
      const scrollWrap = getScrollV(container);

      expect(scrollWrap).not.toBeNull();
      expect(figure).toHaveAttribute("data-max-h", "true");
      expect(figure?.style.getPropertyValue("--diff-view-max-h")).toBe("120px");
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

  describe("caption stat", () => {
    const getStat = (container: HTMLElement) =>
      container.querySelector('[data-slot="diff-view-stat"]');

    it("reads the counts out of the parsed hunks by default", () => {
      const { container } = render(<DiffView diff={ONE_HUNK} />);
      const stat = getStat(container);

      expect(stat).not.toBeNull();
      expect(stat).toHaveTextContent("+2");
      expect(stat).toHaveTextContent("−1");
    });

    it("pluralizes the counts into the figure's accessible name", () => {
      render(<DiffView diff={ONE_HUNK} />);
      expect(screen.getByRole("figure")).toHaveAccessibleName(/2 additions, 1 deletion/);
    });

    it("renders nothing when stat is off", () => {
      const { container } = render(<DiffView diff={ONE_HUNK} stat={false} />);
      expect(getStat(container)).toBeNull();
      expect(container.querySelector('[data-slot="diff-view-caption-path"]')).toHaveTextContent(
        "src/app.ts",
      );
    });

    it("renders nothing for a context-only diff rather than +0 −0", () => {
      const contextOnly: ParsedDiff = {
        oldPath: "src/app.ts",
        newPath: "src/app.ts",
        hunks: [
          {
            oldStart: 1,
            oldCount: 1,
            newStart: 1,
            newCount: 1,
            heading: "",
            changes: [{ type: "context", content: "run()", oldLine: 1, newLine: 1 }],
          },
        ],
      };
      const { container } = render(<DiffView diff={contextOnly} />);
      expect(getStat(container)).toBeNull();
    });

    it('goes with the suppressed caption under variant="bare"', () => {
      const { container } = render(
        <DiffView diff={ONE_HUNK} variant="bare" label="Bare changes" />,
      );
      expect(container.querySelector("figcaption")).toBeNull();
      expect(getStat(container)).toBeNull();
    });
  });

  describe("wrap", () => {
    it("surfaces the tri-state wrap contract on the figure", () => {
      const { container, rerender } = render(<DiffView diff={ONE_HUNK} />);
      // Absent by design: CSS owns the responsive default.
      expect(getFigure(container)).not.toHaveAttribute("data-wrap");

      rerender(<DiffView diff={ONE_HUNK} wrap />);
      expect(getFigure(container)).toHaveAttribute("data-wrap", "on");

      rerender(<DiffView diff={ONE_HUNK} wrap={false} />);
      expect(getFigure(container)).toHaveAttribute("data-wrap", "off");
    });

    it("leaves the rendered line text untouched so copy still yields the source", () => {
      const { container, rerender } = render(<DiffView diff={ONE_HUNK} wrap={false} />);
      const read = () =>
        [...container.querySelectorAll(".diff-code")].map((cell) => cell.textContent);
      const unwrapped = read();

      rerender(<DiffView diff={ONE_HUNK} wrap />);
      expect(read()).toEqual(unwrapped);
    });

    it("keeps hunk navigation and the highlight working while wrapped", async () => {
      const user = userEvent.setup();
      const { container } = render(<DiffView diff={THREE_HUNKS} wrap />);

      const rows = screen.getByRole("region", { name: "Unified diff" });
      rows.focus();
      await user.keyboard("j");

      expect(container.querySelectorAll("[data-hunk][data-highlighted]")).toHaveLength(1);
    });
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
