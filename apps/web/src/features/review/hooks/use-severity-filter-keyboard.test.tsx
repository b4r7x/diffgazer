import { SEVERITY_ORDER } from "@diffgazer/core/schemas/presentation";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { findNavigationItemByValue, KeyboardProvider, useScope } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import {
  RESET_FILTER_VALUE,
  type SeverityFilter,
  SeverityFilterGroup,
} from "../components/severity-filter-group";
import { useReviewSeverityFilterKeyboard } from "./use-severity-filter-keyboard";

const REVIEW_SCOPE = "review-test";
const COUNTS: Record<ReviewSeverity, number> = {
  blocker: 1,
  high: 1,
  medium: 1,
  low: 1,
  nit: 1,
};

function toggleSeverity(filter: SeverityFilter, severity: ReviewSeverity): SeverityFilter {
  const next = new Set(filter);
  if (next.has(severity)) next.delete(severity);
  else next.add(severity);
  return next;
}

function Harness() {
  const [activeFilter, setActiveFilter] = useState<SeverityFilter>(new Set(["high"]));
  const [focusedIndex, setFocusedIndex] = useState<number>(SEVERITY_ORDER.length);
  const rowRef = useRef<HTMLDivElement>(null);
  const resetIndex = SEVERITY_ORDER.length;
  const lastFilterIndex = SEVERITY_ORDER.length - 1;

  useScope(REVIEW_SCOPE);

  const focusTargetValueForIndex = (index: number): string =>
    index === resetIndex ? RESET_FILTER_VALUE : (SEVERITY_ORDER[index] ?? SEVERITY_ORDER[0]);

  useReviewSeverityFilterKeyboard({
    scope: REVIEW_SCOPE,
    enabled: true,
    isFilterActive: activeFilter.size > 0,
    focusedFilterIndex: focusedIndex,
    lastFilterIndex,
    resetIndex,
    setFocusedFilterIndex: setFocusedIndex,
    focusChip: (index) =>
      findNavigationItemByValue(rowRef.current, {
        type: "button",
        value: focusTargetValueForIndex(index),
        ownerSelector: null,
      }),
    toggleSeverityFilter: () => {
      const severity = SEVERITY_ORDER[focusedIndex];
      if (severity) setActiveFilter((filter) => toggleSeverity(filter, severity));
    },
    resetSeverityFilter: () => setActiveFilter(new Set()),
    enterList: () => undefined,
    enterDetails: () => undefined,
  });

  return (
    <SeverityFilterGroup
      ref={rowRef}
      counts={COUNTS}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
      onReset={() => setActiveFilter(new Set())}
      isFocused
      focusedIndex={focusedIndex}
      onFocusedIndexChange={setFocusedIndex}
    />
  );
}

function renderHarness() {
  return render(
    <KeyboardProvider>
      <Harness />
    </KeyboardProvider>,
  );
}

describe("useReviewSeverityFilterKeyboard", () => {
  it("returns DOM focus to the last severity chip after keyboard reset", async () => {
    const user = userEvent.setup();
    renderHarness();

    screen.getByRole("button", { name: /high severity/i }).focus();
    await user.keyboard("r");

    const lastSeverityChip = screen.getByRole("button", { name: /nit severity/i });
    await waitFor(() => expect(lastSeverityChip).toHaveFocus());
    expect(
      screen.queryByRole("button", { name: /reset severity filter/i }),
    ).not.toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /low severity/i })).toHaveFocus(),
    );
  });

  it("moves left from Reset to the last severity so Enter toggles the chip", async () => {
    const user = userEvent.setup();
    renderHarness();

    screen.getByRole("button", { name: /reset severity filter/i }).focus();
    await user.keyboard("{ArrowLeft}");

    const high = screen.getByRole("button", { name: /high severity/i });
    const nit = screen.getByRole("button", { name: /nit severity/i });
    await waitFor(() => expect(nit).toHaveFocus());

    await user.keyboard("{Enter}");

    expect(high).toHaveAttribute("aria-pressed", "true");
    expect(nit).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /reset severity filter/i })).toBeInTheDocument();
  });
});
