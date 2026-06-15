import type { ReviewProgressMetrics } from "@diffgazer/core/schemas/presentation";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewMetricsFooter } from "./metrics-footer";

function makeMetrics(overrides: Partial<ReviewProgressMetrics> = {}): ReviewProgressMetrics {
  return { filesProcessed: 3, filesTotal: 0, issuesFound: 0, ...overrides };
}

describe("ReviewMetricsFooter files processed", () => {
  it("shows the unknown-total placeholder while the stream has not reported a total", () => {
    render(<ReviewMetricsFooter metrics={makeMetrics({ filesTotal: 0 })} isRunning={false} />);

    const value = screen.getByText("Files Processed").nextElementSibling;
    // Never the completion-implying "3/3" before a real total arrives (F-156).
    expect(value).toHaveTextContent("3/...");
    expect(value).not.toHaveTextContent("3/3");
  });

  it("shows completed/total once a real files total arrives", () => {
    render(<ReviewMetricsFooter metrics={makeMetrics({ filesTotal: 12 })} isRunning={false} />);

    expect(screen.getByText("Files Processed").nextElementSibling).toHaveTextContent("3/12");
  });
});
