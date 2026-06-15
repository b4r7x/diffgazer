import { act, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type OverflowDirection, useOverflowDetection } from "./use-overflow-detection";

let resizeCallbacks: (() => void)[] = [];
let mutationCallbacks: (() => void)[] = [];
let animationCallbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  resizeCallbacks = [];
  mutationCallbacks = [];
  animationCallbacks = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private cb: () => void;
      constructor(cb: () => void) {
        this.cb = cb;
      }
      observe() {
        resizeCallbacks.push(this.cb);
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "MutationObserver",
    class {
      private cb: () => void;
      constructor(cb: () => void) {
        this.cb = cb;
      }
      observe() {
        mutationCallbacks.push(this.cb);
      }
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    animationCallbacks.push(cb);
    return animationCallbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function TestComponent({
  direction,
  onResult,
}: {
  direction?: OverflowDirection;
  onResult: (v: boolean) => void;
}) {
  const { ref, isOverflowing } = useOverflowDetection<HTMLDivElement>(direction);
  React.useEffect(() => {
    onResult(isOverflowing);
  });
  return React.createElement("div", { ref, "data-testid": "target" });
}

function mockDimensions(
  el: HTMLElement,
  dims: { scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number },
) {
  Object.defineProperty(el, "scrollWidth", { value: dims.scrollWidth, configurable: true });
  Object.defineProperty(el, "clientWidth", { value: dims.clientWidth, configurable: true });
  Object.defineProperty(el, "scrollHeight", { value: dims.scrollHeight, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: dims.clientHeight, configurable: true });
}

function flushScheduledChecks() {
  const callbacks = animationCallbacks;
  animationCallbacks = [];
  for (const cb of callbacks) cb(0);
}

describe("useOverflowDetection", () => {
  it("reports no overflow before observers fire", () => {
    let lastResult = true;
    render(
      React.createElement(TestComponent, {
        direction: "horizontal",
        onResult: (v: boolean) => {
          lastResult = v;
        },
      }),
    );

    expect(lastResult).toBe(false);
  });

  it.each<{
    scenario: string;
    direction: OverflowDirection;
    dims: { scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number };
    expected: boolean;
  }>([
    {
      scenario: "detects horizontal overflow when direction='horizontal'",
      direction: "horizontal",
      dims: { scrollWidth: 500, clientWidth: 300, scrollHeight: 100, clientHeight: 100 },
      expected: true,
    },
    {
      scenario: "detects vertical overflow when direction='vertical'",
      direction: "vertical",
      dims: { scrollWidth: 100, clientWidth: 100, scrollHeight: 500, clientHeight: 300 },
      expected: true,
    },
    {
      scenario: "ignores horizontal overflow when direction='vertical'",
      direction: "vertical",
      dims: { scrollWidth: 500, clientWidth: 300, scrollHeight: 100, clientHeight: 100 },
      expected: false,
    },
    {
      scenario: "detects horizontal overflow when direction='both'",
      direction: "both",
      dims: { scrollWidth: 500, clientWidth: 300, scrollHeight: 100, clientHeight: 100 },
      expected: true,
    },
    {
      scenario: "detects vertical overflow when direction='both'",
      direction: "both",
      dims: { scrollWidth: 100, clientWidth: 100, scrollHeight: 500, clientHeight: 300 },
      expected: true,
    },
  ])("$scenario", ({ direction, dims, expected }) => {
    let lastResult = !expected;
    const { getByTestId } = render(
      React.createElement(TestComponent, {
        direction,
        onResult: (v: boolean) => {
          lastResult = v;
        },
      }),
    );

    // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
    const el = getByTestId("target");
    mockDimensions(el, dims);

    act(() => {
      for (const cb of resizeCallbacks) cb();
      flushScheduledChecks();
    });

    expect(lastResult).toBe(expected);
  });

  it("updates when text content changes", () => {
    let lastResult = false;
    const { getByTestId, rerender } = render(
      React.createElement(TestComponent, {
        direction: "horizontal",
        onResult: (v: boolean) => {
          lastResult = v;
        },
      }),
    );

    // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
    const el = getByTestId("target");
    mockDimensions(el, {
      scrollWidth: 100,
      clientWidth: 100,
      scrollHeight: 100,
      clientHeight: 100,
    });

    act(() => {
      for (const cb of resizeCallbacks) cb();
      flushScheduledChecks();
    });
    expect(lastResult).toBe(false);

    rerender(
      React.createElement(TestComponent, {
        direction: "horizontal",
        onResult: (v: boolean) => {
          lastResult = v;
        },
      }),
    );
    mockDimensions(el, {
      scrollWidth: 200,
      clientWidth: 100,
      scrollHeight: 100,
      clientHeight: 100,
    });

    act(() => {
      for (const cb of mutationCallbacks) cb();
      flushScheduledChecks();
    });

    expect(lastResult).toBe(true);
  });
});
