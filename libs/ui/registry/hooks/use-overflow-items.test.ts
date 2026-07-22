import { act, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireValue } from "../testing/assertions";
import { computeVisibleCount, useOverflowItems } from "./use-overflow-items";

let resizeCallbacks: (() => void)[] = [];
let retainedResizeCallbacks: (() => void)[] = [];
let resizeObservations: { target: Element; cb: () => void }[] = [];
let mutationCallbacks: (() => void)[] = [];
let animationCallbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  resizeCallbacks = [];
  retainedResizeCallbacks = [];
  resizeObservations = [];
  mutationCallbacks = [];
  animationCallbacks = [];

  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private cb: () => void) {}
      observe(target: Element) {
        if (!resizeCallbacks.includes(this.cb)) resizeCallbacks.push(this.cb);
        if (!retainedResizeCallbacks.includes(this.cb)) retainedResizeCallbacks.push(this.cb);
        resizeObservations.push({ target, cb: this.cb });
      }
      unobserve() {}
      disconnect() {
        resizeCallbacks = resizeCallbacks.filter((callback) => callback !== this.cb);
        resizeObservations = resizeObservations.filter((observation) => observation.cb !== this.cb);
      }
    },
  );
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(private cb: () => void) {}
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

function mockOffsetWidth(el: HTMLElement, width: number) {
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
}

function flushScheduledChecks() {
  const callbacks = animationCallbacks;
  animationCallbacks = [];
  for (const cb of callbacks) cb(0);
}

function triggerResizeFor(target: Element) {
  const callbacks = new Set(
    resizeObservations
      .filter((observation) => observation.target === target)
      .map((observation) => observation.cb),
  );
  for (const cb of callbacks) cb();
}

function TestOverflowItems({
  widths,
  containerWidth,
  indicatorWidth,
  show = true,
  containerKey = "container",
}: {
  widths: number[];
  containerWidth: number;
  indicatorWidth: number;
  show?: boolean;
  containerKey?: string;
}) {
  const { ref, visibleCount, overflowCount } = useOverflowItems({ itemCount: widths.length });

  return React.createElement(
    React.Fragment,
    null,
    show
      ? React.createElement(
          "div",
          { key: containerKey, ref, role: "list", "aria-label": "items", style: { gap: "10px" } },
          widths.map((width, index) =>
            React.createElement(
              "span",
              { key: index, role: "listitem", "data-width": width },
              `Item ${index}`,
            ),
          ),
          React.createElement(
            "span",
            { "aria-label": "overflow indicator", "data-width": indicatorWidth },
            "More",
          ),
        )
      : null,
    React.createElement(
      "output",
      { "aria-label": "counts" },
      `${visibleCount}/${overflowCount}/${containerWidth}`,
    ),
  );
}

function TestOverflowItemsWithListener({ listener }: { listener: (count: number) => void }) {
  const { ref, visibleCount } = useOverflowItems({
    itemCount: 3,
    onVisibleCountChange: listener,
  });

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      { ref, role: "list", "aria-label": "items", style: { gap: "10px" } },
      React.createElement("span", { role: "listitem", "data-width": 50 }, "Item 0"),
      React.createElement("span", { role: "listitem", "data-width": 50 }, "Item 1"),
      React.createElement("span", { role: "listitem", "data-width": 50 }, "Item 2"),
      React.createElement("span", { "aria-label": "overflow indicator", "data-width": 30 }, "More"),
    ),
    React.createElement("output", { "aria-label": "visible count" }, visibleCount),
  );
}

function setRenderedWidths(containerWidth: number) {
  mockOffsetWidth(screen.getByRole("list", { name: "items" }), containerWidth);
  for (const el of screen.getAllByRole("listitem")) {
    mockOffsetWidth(el, Number(el.getAttribute("data-width")));
  }
  const indicator = screen.getByLabelText("overflow indicator");
  mockOffsetWidth(indicator, Number(indicator.getAttribute("data-width")));
}

describe("computeVisibleCount", () => {
  it.each([
    {
      scenario: "all items fit",
      widths: [50, 50, 50],
      containerWidth: 200,
      gap: 10,
      indicatorWidth: 30,
      expected: 3,
    },
    {
      scenario: "partial fit reserves space for indicator",
      widths: [50, 50, 50],
      containerWidth: 150,
      gap: 10,
      indicatorWidth: 30,
      expected: 2,
    },
    {
      scenario: "always shows at least one item even if it overflows",
      widths: [200],
      containerWidth: 100,
      gap: 0,
      indicatorWidth: 30,
      expected: 1,
    },
    {
      scenario: "returns 0 for zero items",
      widths: [],
      containerWidth: 500,
      gap: 10,
      indicatorWidth: 30,
      expected: 0,
    },
    {
      scenario: "accounts for gap between items",
      widths: [40, 40, 40],
      containerWidth: 130,
      gap: 10,
      indicatorWidth: 20,
      expected: 2,
    },
    {
      scenario: "sanitizes invalid dimensions",
      widths: [50, Number.NaN],
      containerWidth: Number.NaN,
      gap: -10,
      indicatorWidth: Number.POSITIVE_INFINITY,
      expected: 1,
    },
  ])("$scenario", ({ widths, containerWidth, gap, indicatorWidth, expected }) => {
    expect(computeVisibleCount(widths, containerWidth, gap, indicatorWidth)).toBe(expected);
  });
});

describe("useOverflowItems", () => {
  it("initially reports all items visible with no overflow", () => {
    const { result } = renderHook(() => useOverflowItems({ itemCount: 5 }));
    expect(result.current.visibleCount).toBe(5);
    expect(result.current.overflowCount).toBe(0);
  });

  it("clamps visible and overflow counts when itemCount shrinks", () => {
    const { result, rerender } = renderHook(({ itemCount }) => useOverflowItems({ itemCount }), {
      initialProps: { itemCount: 5 },
    });

    rerender({ itemCount: 2 });

    expect(result.current.visibleCount).toBe(2);
    expect(result.current.overflowCount).toBe(0);
  });

  it("updates when the overflow indicator width changes", () => {
    const { rerender } = render(
      React.createElement(TestOverflowItems, {
        widths: [50, 50, 50],
        containerWidth: 150,
        indicatorWidth: 30,
      }),
    );
    setRenderedWidths(150);

    act(() => {
      for (const cb of resizeCallbacks) cb();
      flushScheduledChecks();
    });
    expect(screen.getByLabelText("counts")).toHaveTextContent("2/1/150");

    rerender(
      React.createElement(TestOverflowItems, {
        widths: [50, 50, 50],
        containerWidth: 150,
        indicatorWidth: 80,
      }),
    );
    const indicator = screen.getByLabelText("overflow indicator");
    mockOffsetWidth(indicator, 80);

    act(() => {
      triggerResizeFor(indicator);
      flushScheduledChecks();
    });

    expect(screen.getByLabelText("counts")).toHaveTextContent("1/2/150");
  });

  it("recomputes visible count when items are removed from the DOM", () => {
    const { rerender } = render(
      React.createElement(TestOverflowItems, {
        widths: [40, 40, 40],
        containerWidth: 140,
        indicatorWidth: 20,
      }),
    );
    setRenderedWidths(140);

    act(() => {
      for (const cb of resizeCallbacks) cb();
      flushScheduledChecks();
    });
    expect(screen.getByLabelText("counts")).toHaveTextContent("3/0/140");

    rerender(
      React.createElement(TestOverflowItems, {
        widths: [40],
        containerWidth: 140,
        indicatorWidth: 20,
      }),
    );
    setRenderedWidths(140);

    act(() => {
      for (const cb of mutationCallbacks) cb();
      flushScheduledChecks();
    });

    expect(screen.getByLabelText("counts")).toHaveTextContent("1/0/140");
  });

  it("notifies the latest visible-count listener after rerender", () => {
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const { rerender } = render(
      React.createElement(TestOverflowItemsWithListener, { listener: firstListener }),
    );

    setRenderedWidths(150);
    rerender(React.createElement(TestOverflowItemsWithListener, { listener: secondListener }));
    setRenderedWidths(150);

    act(() => {
      for (const cb of resizeCallbacks) cb();
      flushScheduledChecks();
    });

    expect(screen.getByLabelText("visible count")).toHaveTextContent("2");
    expect(secondListener).toHaveBeenCalledWith(2);
    expect(firstListener).not.toHaveBeenCalledWith(2);
  });

  it("measures a late container and recovers across resize and replacement", () => {
    const { rerender } = render(
      React.createElement(TestOverflowItems, {
        widths: [50, 50, 50],
        containerWidth: 150,
        indicatorWidth: 30,
        show: false,
      }),
    );

    expect(screen.getByLabelText("counts")).toHaveTextContent("3/0/150");
    expect(resizeCallbacks).toHaveLength(0);

    rerender(
      React.createElement(TestOverflowItems, {
        widths: [50, 50, 50],
        containerWidth: 150,
        indicatorWidth: 30,
      }),
    );
    setRenderedWidths(150);
    act(() => {
      for (const callback of resizeCallbacks) callback();
      flushScheduledChecks();
    });
    expect(screen.getByLabelText("counts")).toHaveTextContent("2/1/150");

    setRenderedWidths(220);
    act(() => {
      for (const callback of resizeCallbacks) callback();
      flushScheduledChecks();
    });
    expect(screen.getByLabelText("counts")).toHaveTextContent("3/0/150");
    const firstResizeCallback = retainedResizeCallbacks[0];
    expect(firstResizeCallback).toBeDefined();
    act(() => firstResizeCallback?.());
    expect(animationCallbacks).toHaveLength(1);

    rerender(
      React.createElement(TestOverflowItems, {
        widths: [50, 50, 50],
        containerWidth: 100,
        indicatorWidth: 30,
        containerKey: "replacement",
      }),
    );
    setRenderedWidths(100);
    act(flushScheduledChecks);
    expect(screen.getByLabelText("counts")).toHaveTextContent("1/2/100");

    act(() => firstResizeCallback?.());
    expect(animationCallbacks).toHaveLength(0);
    expect(screen.getByLabelText("counts")).toHaveTextContent("1/2/100");

    const replacementResizeCallback = resizeCallbacks[0];
    expect(replacementResizeCallback).toBeDefined();
    act(() => {
      replacementResizeCallback?.();
      flushScheduledChecks();
    });
    expect(screen.getByLabelText("counts")).toHaveTextContent("1/2/100");

    rerender(
      React.createElement(TestOverflowItems, {
        widths: [50, 50, 50],
        containerWidth: 100,
        indicatorWidth: 30,
        show: false,
      }),
    );
    expect(screen.getByLabelText("counts")).toHaveTextContent("3/0/100");
    expect(resizeCallbacks).toHaveLength(0);
    expect(mutationCallbacks).toHaveLength(0);

    act(() => replacementResizeCallback?.());
    expect(animationCallbacks).toHaveLength(0);
    expect(screen.getByLabelText("counts")).toHaveTextContent("3/0/100");
  });

  it("recalculates using the iframe's own window for style/observers/rAF, and disconnects them on unmount", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const frameDocument = requireValue(iframe.contentDocument, "iframe document");
    const frameWindow = requireValue(iframe.contentWindow, "iframe window");

    const frameResizeCallbacks: (() => void)[] = [];
    const frameAnimationCallbacks: FrameRequestCallback[] = [];
    const resizeDisconnect = vi.fn();
    const mutationDisconnect = vi.fn();

    class FrameResizeObserver {
      constructor(private cb: () => void) {}
      observe() {
        frameResizeCallbacks.push(this.cb);
      }
      unobserve() {}
      disconnect = resizeDisconnect;
    }
    class FrameMutationObserver {
      observe() {}
      disconnect = mutationDisconnect;
      takeRecords() {
        return [];
      }
    }

    Object.defineProperty(frameWindow, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: FrameResizeObserver,
    });
    Object.defineProperty(frameWindow, "MutationObserver", {
      configurable: true,
      writable: true,
      value: FrameMutationObserver,
    });
    Object.defineProperty(frameWindow, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: (cb: FrameRequestCallback) => {
        frameAnimationCallbacks.push(cb);
        return frameAnimationCallbacks.length;
      },
    });
    Object.defineProperty(frameWindow, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    const realGetComputedStyle = frameWindow.getComputedStyle.bind(frameWindow);
    Object.defineProperty(frameWindow, "getComputedStyle", {
      configurable: true,
      writable: true,
      value: vi.fn((el: Element, pseudoElt?: string | null) => {
        const style = realGetComputedStyle(el, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            if (prop === "gap") return "10px";
            const value = Reflect.get(target, prop, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      }),
    });

    const rendered = render(
      React.createElement(TestOverflowItems, {
        widths: [50, 50, 50],
        containerWidth: 150,
        indicatorWidth: 30,
      }),
      { container: frameDocument.body, baseElement: frameDocument.body },
    );

    mockOffsetWidth(rendered.getByRole("list", { name: "items" }), 150);
    for (const el of rendered.getAllByRole("listitem")) {
      mockOffsetWidth(el, Number(el.getAttribute("data-width")));
    }
    mockOffsetWidth(rendered.getByLabelText("overflow indicator"), 30);

    act(() => {
      for (const cb of frameResizeCallbacks) cb();
      const callbacks = frameAnimationCallbacks.splice(0);
      for (const cb of callbacks) cb(0);
    });

    expect(rendered.getByLabelText("counts")).toHaveTextContent("2/1/150");
    // The top window's own observer/rAF fakes were never engaged.
    expect(resizeCallbacks).toHaveLength(0);
    expect(animationCallbacks).toHaveLength(0);

    rendered.unmount();
    expect(resizeDisconnect).toHaveBeenCalled();
    expect(mutationDisconnect).toHaveBeenCalled();

    iframe.remove();
  });
});
