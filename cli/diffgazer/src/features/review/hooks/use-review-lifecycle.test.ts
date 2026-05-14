import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { getDisplayPhase } from "./use-review-lifecycle.js";

describe("getDisplayPhase", () => {
  test("returns 'summary' when the start request failed", () => {
    const result = getDisplayPhase({
      hasStartFailed: true,
      hasStarted: false,
      isCompleting: false,
      phase: "streaming",
    });
    assert.equal(result, "summary");
  });

  test("returns 'loading' before the lifecycle has started", () => {
    const result = getDisplayPhase({
      hasStartFailed: false,
      hasStarted: false,
      isCompleting: false,
      phase: "streaming",
    });
    assert.equal(result, "loading");
  });

  test("returns 'completing' while the lifecycle is completing", () => {
    const result = getDisplayPhase({
      hasStartFailed: false,
      hasStarted: true,
      isCompleting: true,
      phase: "streaming",
    });
    assert.equal(result, "completing");
  });

  test("falls through to the explicit phase when nothing else matches", () => {
    assert.equal(
      getDisplayPhase({
        hasStartFailed: false,
        hasStarted: true,
        isCompleting: false,
        phase: "streaming",
      }),
      "streaming",
    );
    assert.equal(
      getDisplayPhase({
        hasStartFailed: false,
        hasStarted: true,
        isCompleting: false,
        phase: "results",
      }),
      "results",
    );
  });

  test("start failure takes precedence over an unstarted lifecycle", () => {
    const result = getDisplayPhase({
      hasStartFailed: true,
      hasStarted: false,
      isCompleting: true,
      phase: "streaming",
    });
    assert.equal(result, "summary");
  });
});
