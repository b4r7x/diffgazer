import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSeverityFilter } from "./use-severity-filter";

const makeIssue = (id: string, severity: ReviewIssue["severity"]): ReviewIssue => ({
  id,
  title: `Issue ${id}`,
  severity,
  category: "correctness",
  file: "src/a.ts",
  line_start: 1,
  line_end: null,
  rationale: "r",
  recommendation: "x",
  suggested_patch: null,
  confidence: 0.9,
  symptom: "s",
  whyItMatters: "w",
  evidence: [],
});

const issues: ReviewIssue[] = [
  makeIssue("h1", "high"),
  makeIssue("m1", "medium"),
  makeIssue("l1", "low"),
  makeIssue("h2", "high"),
];

describe("useSeverityFilter", () => {
  it("starts with an empty filter set showing all issues", () => {
    const { result } = renderHook(() => useSeverityFilter({ issues }));

    expect(result.current.severityFilter.size).toBe(0);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isFilterActive).toBe(false);
    expect(result.current.filteredIssues).toHaveLength(4);
  });

  it("toggles a single severity into the active set", () => {
    const { result } = renderHook(() => useSeverityFilter({ issues }));

    act(() => {
      result.current.setFocusedFilterIndex(1);
    });
    act(() => {
      result.current.toggleSeverityFilter();
    });

    expect(result.current.severityFilter.has("high")).toBe(true);
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isFilterActive).toBe(true);
    expect(result.current.filteredIssues.map((i) => i.id)).toEqual(["h1", "h2"]);
  });

  it("removes a severity when toggled twice", () => {
    const { result } = renderHook(() => useSeverityFilter({ issues }));

    act(() => {
      result.current.setFocusedFilterIndex(1);
    });
    act(() => {
      result.current.toggleSeverityFilter();
    });
    act(() => {
      result.current.toggleSeverityFilter();
    });

    expect(result.current.severityFilter.has("high")).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it("supports multi-severity union filtering", () => {
    const { result } = renderHook(() => useSeverityFilter({ issues }));

    act(() => {
      result.current.setFocusedFilterIndex(1);
    });
    act(() => {
      result.current.toggleSeverityFilter();
    });
    act(() => {
      result.current.setFocusedFilterIndex(2);
    });
    act(() => {
      result.current.toggleSeverityFilter();
    });

    expect(result.current.severityFilter.size).toBe(2);
    expect(result.current.filteredIssues.map((i) => i.id)).toEqual(["h1", "m1", "h2"]);
  });

  it("resets the filter to empty", () => {
    const { result } = renderHook(() => useSeverityFilter({ issues }));

    act(() => {
      result.current.setFocusedFilterIndex(1);
    });
    act(() => {
      result.current.toggleSeverityFilter();
    });
    expect(result.current.isFilterActive).toBe(true);

    act(() => {
      result.current.resetSeverityFilter();
    });

    expect(result.current.severityFilter.size).toBe(0);
    expect(result.current.isFilterActive).toBe(false);
    expect(result.current.filteredIssues).toHaveLength(4);
  });
});
