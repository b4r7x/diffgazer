import type { ReviewProgressMetrics } from "@diffgazer/core/schemas/presentation";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewMetricsFooter } from "./metrics-footer";

function makeMetrics(overrides: Partial<ReviewProgressMetrics> = {}): ReviewProgressMetrics {
  return { filesProcessed: 3, filesTotal: 0, issuesFound: 0, ...overrides };
}

describe("ReviewMetricsFooter prompt coverage", () => {
  it("shows the unknown-total placeholder while the stream has not reported a total", () => {
    render(<ReviewMetricsFooter metrics={makeMetrics({ filesTotal: 0 })} isRunning={false} />);

    // Never the completion-implying "3/3" before a real total arrives (F-156).
    expect(screen.getByText("3/...")).toBeInTheDocument();
    expect(screen.queryByText("3/3")).not.toBeInTheDocument();
  });

  it("shows completed/total once a real files total arrives", () => {
    render(<ReviewMetricsFooter metrics={makeMetrics({ filesTotal: 12 })} isRunning={false} />);

    expect(screen.getByText("3/12")).toBeInTheDocument();
    expect(screen.getByText("Files in Prompt")).toBeInTheDocument();
  });
});

describe("ReviewMetricsFooter elapsed time", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { elapsed: 3_600_000, expected: "60:00" },
    { elapsed: 7_261_000, expected: "121:01" },
  ])("preserves total elapsed minutes at $elapsed ms", ({ elapsed, expected }) => {
    const startTime = new Date(Date.now() - elapsed);

    render(<ReviewMetricsFooter metrics={makeMetrics()} startTime={startTime} isRunning />);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
