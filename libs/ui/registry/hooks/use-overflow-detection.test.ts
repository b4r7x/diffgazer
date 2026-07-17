import { act, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type OverflowDirection, useOverflowDetection } from "./use-overflow-detection";

let resizeCallbacks: (() => void)[] = [];
let retainedResizeCallbacks: (() => void)[] = [];
let mutationCallbacks: (() => void)[] = [];
let animationCallbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  resizeCallbacks = [];
  retainedResizeCallbacks = [];
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
        if (!resizeCallbacks.includes(this.cb)) resizeCallbacks.push(this.cb);
        if (!retainedResizeCallbacks.includes(this.cb)) retainedResizeCallbacks.push(this.cb);
      }
      unobserve() {}
      disconnect() {
        resizeCallbacks = resizeCallbacks.filter((callback) => callback !== this.cb);
      }
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
        if (!mutationCallbacks.includes(this.cb)) mutationCallbacks.push(this.cb);
      }
      disconnect() {
        mutationCallbacks = mutationCallbacks.filter((callback) => callback !== this.cb);
      }
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
  show = true,
  nodeKey = "target",
}: {
  direction?: OverflowDirection;
  onResult: (v: boolean) => void;
  show?: boolean;
  nodeKey?: string;
}) {
  const { ref, isOverflowing } = useOverflowDetection<HTMLDivElement>(direction);
  React.useEffect(() => {
    onResult(isOverflowing);
  });
  return show ? React.createElement("div", { key: nodeKey, ref, "data-testid": "target" }) : null;
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

  it("subscribes after a late mount and recovers across resize and node replacement", () => {
    let lastResult = false;
    const onResult = (value: boolean) => {
      lastResult = value;
    };
    const { getByTestId, queryByTestId, rerender } = render(
      React.createElement(TestComponent, {
        direction: "horizontal",
        onResult,
        show: false,
      }),
    );

    expect(queryByTestId("target")).toBeNull();
    expect(resizeCallbacks).toHaveLength(0);

    rerender(React.createElement(TestComponent, { direction: "horizontal", onResult }));
    const first = getByTestId("target");
    mockDimensions(first, {
      scrollWidth: 100,
      clientWidth: 100,
      scrollHeight: 20,
      clientHeight: 20,
    });
    act(() => {
      for (const callback of resizeCallbacks) callback();
      flushScheduledChecks();
    });
    expect(lastResult).toBe(false);

    mockDimensions(first, {
      scrollWidth: 180,
      clientWidth: 100,
      scrollHeight: 20,
      clientHeight: 20,
    });
    act(() => {
      for (const callback of resizeCallbacks) callback();
      flushScheduledChecks();
    });
    expect(lastResult).toBe(true);
    const firstResizeCallback = retainedResizeCallbacks[0];
    expect(firstResizeCallback).toBeDefined();
    mockDimensions(first, {
      scrollWidth: 180,
      clientWidth: 100,
      scrollHeight: 20,
      clientHeight: 20,
    });
    act(() => firstResizeCallback?.());
    expect(animationCallbacks).toHaveLength(1);

    rerender(
      React.createElement(TestComponent, {
        direction: "horizontal",
        onResult,
        nodeKey: "replacement",
      }),
    );
    const replacement = getByTestId("target");
    expect(replacement).not.toBe(first);
    mockDimensions(replacement, {
      scrollWidth: 80,
      clientWidth: 100,
      scrollHeight: 20,
      clientHeight: 20,
    });
    act(flushScheduledChecks);
    expect(lastResult).toBe(false);
    expect(animationCallbacks).toHaveLength(0);

    act(() => firstResizeCallback?.());
    expect(animationCallbacks).toHaveLength(0);
    expect(lastResult).toBe(false);

    const replacementResizeCallback = resizeCallbacks[0];
    expect(replacementResizeCallback).toBeDefined();
    mockDimensions(replacement, {
      scrollWidth: 180,
      clientWidth: 100,
      scrollHeight: 20,
      clientHeight: 20,
    });
    act(() => {
      replacementResizeCallback?.();
      flushScheduledChecks();
    });
    expect(lastResult).toBe(true);

    rerender(
      React.createElement(TestComponent, {
        direction: "horizontal",
        onResult,
        show: false,
      }),
    );
    expect(resizeCallbacks).toHaveLength(0);
    expect(mutationCallbacks).toHaveLength(0);
    expect(lastResult).toBe(false);

    act(() => replacementResizeCallback?.());
    expect(animationCallbacks).toHaveLength(0);
    expect(lastResult).toBe(false);
  });
});
