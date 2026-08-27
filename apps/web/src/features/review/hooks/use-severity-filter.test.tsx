import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSeverityFilter } from "./use-severity-filter";

const issues: ReviewIssue[] = [
  makeIssue({ id: "h1", severity: "high" }),
  makeIssue({ id: "m1", severity: "medium" }),
  makeIssue({ id: "l1", severity: "low" }),
  makeIssue({ id: "h2", severity: "high" }),
];

describe("useSeverityFilter", () => {
  it("starts with an empty filter set showing all issues", () => {
    const { result } = renderHook(() => useSeverityFilter({ issues }));

    expect(result.current.severityFilter.size).toBe(0);
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
    expect(result.current.severityFilter.size).toBe(1);
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
    expect(result.current.severityFilter.size).toBe(0);
    expect(result.current.isFilterActive).toBe(false);
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
