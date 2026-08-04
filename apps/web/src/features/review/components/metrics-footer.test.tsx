import type { ReviewProgressMetrics } from "@diffgazer/core/schemas/presentation";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { ReviewClockProvider } from "../hooks/use-clock";
import { ReviewMetricsFooter } from "./metrics-footer";

function makeMetrics(overrides: Partial<ReviewProgressMetrics> = {}): ReviewProgressMetrics {
  return { filesProcessed: 3, filesTotal: 0, issuesFound: 0, ...overrides };
}

/** The elapsed metric reads the screen clock, so the footer needs one. */
function renderFooter(ui: ReactElement) {
  return render(<ReviewClockProvider running>{ui}</ReviewClockProvider>);
}

describe("ReviewMetricsFooter prompt coverage", () => {
  it("shows the unknown-total placeholder while the stream has not reported a total", () => {
    renderFooter(<ReviewMetricsFooter metrics={makeMetrics({ filesTotal: 0 })} />);

    // Never the completion-implying "3/3" before a real total arrives.
    expect(screen.getByText("3/...")).toBeInTheDocument();
    expect(screen.queryByText("3/3")).not.toBeInTheDocument();
    expect(screen.getByText("Files in Prompt")).toBeInTheDocument();
  });
});

describe("ReviewMetricsFooter elapsed time", () => {
  it("renders the elapsed time off the screen clock", () => {
    const startTime = new Date(Date.now() - 3_600_000);

    renderFooter(<ReviewMetricsFooter metrics={makeMetrics()} startTime={startTime} />);

    expect(screen.getByText("60:00")).toBeInTheDocument();
  });
});
