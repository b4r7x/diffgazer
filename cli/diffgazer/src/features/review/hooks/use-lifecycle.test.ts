import { describe, expect, test } from "vitest";
import { getDisplayPhase } from "./use-lifecycle";

describe("getDisplayPhase", () => {
  test("returns 'summary' when the start request failed", () => {
    const result = getDisplayPhase({
      hasStartFailed: true,
      hasStarted: false,
      isCompleting: false,
      phase: "streaming",
    });
    expect(result).toBe("summary");
  });

  test("returns 'loading' before the lifecycle has started", () => {
    const result = getDisplayPhase({
      hasStartFailed: false,
      hasStarted: false,
      isCompleting: false,
      phase: "streaming",
    });
    expect(result).toBe("loading");
  });

  test("returns 'completing' while the lifecycle is completing", () => {
    const result = getDisplayPhase({
      hasStartFailed: false,
      hasStarted: true,
      isCompleting: true,
      phase: "streaming",
    });
    expect(result).toBe("completing");
  });

  test("falls through to the explicit phase when nothing else matches", () => {
    expect(
      getDisplayPhase({
        hasStartFailed: false,
        hasStarted: true,
        isCompleting: false,
        phase: "streaming",
      }),
    ).toBe("streaming");
    expect(
      getDisplayPhase({
        hasStartFailed: false,
        hasStarted: true,
        isCompleting: false,
        phase: "results",
      }),
    ).toBe("results");
  });

  test("start failure takes precedence over an unstarted lifecycle", () => {
    const result = getDisplayPhase({
      hasStartFailed: true,
      hasStarted: false,
      isCompleting: true,
      phase: "streaming",
    });
    expect(result).toBe("summary");
  });
});
