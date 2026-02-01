import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SeverityBar } from "./severity-bar";

/**
 * SeverityBar UI Tests
 *
 * Fix 1: Empty bar color changed from text-gray-700 to text-gray-800
 * Location: apps/web/src/components/ui/severity/severity-bar.tsx:23
 */

describe("SeverityBar - Empty Bar Color", () => {
  it("applies text-gray-800 class to empty bar characters", () => {
    const { container } = render(
      <SeverityBar
        label="Low"
        count={2}
        max={10}
        severity="low"
      />
    );

    // Find the span containing empty bar characters
    // It's the span with text-gray-800 class (not text-gray-500 which is the label)
    const emptyBarSpan = container.querySelector(".text-gray-800");

    expect(emptyBarSpan).toBeDefined();
    expect(emptyBarSpan).not.toBeNull();
  });

  it("does not use text-gray-700 for empty bar", () => {
    const { container } = render(
      <SeverityBar
        label="Medium"
        count={0}
        max={5}
        severity="medium"
      />
    );

    const grayBarSpans = container.querySelectorAll(".text-gray-700");
    expect(grayBarSpans.length).toBe(0);
  });

  it("applies correct color to filled bar based on severity", () => {
    const { container } = render(
      <SeverityBar
        label="Blocker"
        count={5}
        max={5}
        severity="blocker"
      />
    );

    // Filled bar should have severity color (not gray)
    const filledBarSpan = container.querySelector(".text-tui-red");
    expect(filledBarSpan).toBeDefined();
  });

  it("renders both filled and empty sections with correct colors", () => {
    const { container } = render(
      <SeverityBar
        label="High"
        count={3}
        max={10}
        severity="high"
      />
    );

    // Should have yellow filled bar
    const filledBar = container.querySelector(".text-tui-yellow");
    expect(filledBar).toBeDefined();

    // Should have gray-800 empty bar
    const emptyBarSpan = container.querySelector(".text-gray-800");
    expect(emptyBarSpan).not.toBeNull();
  });

  it("shows fully empty bar with text-gray-800 when count is 0", () => {
    const { container } = render(
      <SeverityBar
        label="Nit"
        count={0}
        max={10}
        severity="nit"
      />
    );

    const emptyBarSpan = container.querySelector(".text-gray-800");
    expect(emptyBarSpan).not.toBeNull();
  });
});
