import { act, render, screen, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";
import { createElement, useLayoutEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computePosition,
  type FloatingAlign,
  type FloatingSide,
  resolveCollisionPosition,
  shift,
  useFloatingPosition,
  wouldOverflow,
} from "./use-floating-position";

function makeDOMRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    toJSON() {},
  };
}

const triggerRect = makeDOMRect(100, 100, 80, 40);
const contentRect = makeDOMRect(0, 0, 120, 50);
const viewport = { width: 800, height: 600 };
const originalInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
const originalInnerHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");

function restoreProperty<T extends object>(
  target: T,
  key: keyof T,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }
  Reflect.deleteProperty(target, key);
}

function setViewport(width = viewport.width, height = viewport.height) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

function formatPosition(position: ReturnType<typeof useFloatingPosition>["position"]) {
  return position ? `${position.side}:${position.x}:${position.y}` : "closed";
}

function FloatingHarness({
  open,
  side = "bottom",
  align = "start",
  avoidCollisions = false,
  getTriggerRect = () => triggerRect,
  getContentRect = () => contentRect,
}: {
  open: boolean;
  side?: FloatingSide;
  align?: FloatingAlign;
  avoidCollisions?: boolean;
  getTriggerRect?: () => DOMRect;
  getContentRect?: () => DOMRect;
}) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const { position, contentRef } = useFloatingPosition({
    triggerRef,
    open,
    side,
    align,
    avoidCollisions,
  });

  return createElement(
    "div",
    null,
    createElement("button", {
      type: "button",
      ref: (node: HTMLButtonElement | null) => {
        triggerRef.current = node;
        if (node) node.getBoundingClientRect = getTriggerRect;
      },
    }),
    createElement(
      "div",
      {
        ref: (node: HTMLDivElement | null) => {
          if (node) node.getBoundingClientRect = getContentRect;
          contentRef(node);
        },
      },
      // Read-back surface for the hook's return value: <output> has an implicit
      // role="status", so assertions query a role rather than a test id.
      createElement(
        "output",
        { "data-anchor-hidden": position?.anchorHidden ? "" : undefined },
        formatPosition(position),
      ),
    ),
  );
}

afterEach(() => {
  restoreProperty(window, "innerWidth", originalInnerWidth);
  restoreProperty(window, "innerHeight", originalInnerHeight);
});

describe("floating position helpers", () => {
  it("computes placement, overflow, shift, and collision fallback", () => {
    expect(computePosition(triggerRect, contentRect, "bottom", "start", 6, 10)).toEqual({
      x: 110,
      y: 146,
    });
    expect(wouldOverflow(700, 100, contentRect, 8, viewport)).toBe(true);
    expect(shift(750, 580, contentRect, 8, viewport)).toEqual({ x: 672, y: 542 });

    const nearBottom = makeDOMRect(100, 540, 80, 40);
    expect(
      resolveCollisionPosition(nearBottom, contentRect, "bottom", "center", 6, 0, 8, viewport),
    ).toMatchObject({
      side: "top",
      x: 80,
      y: 484,
    });
  });
});

describe("useFloatingPosition", () => {
  it("updates position when open changes", async () => {
    setViewport();
    const { rerender } = render(createElement(FloatingHarness, { open: false }));

    expect(screen.getByRole("status")).toHaveTextContent("closed");

    rerender(createElement(FloatingHarness, { open: true }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
    });
  });

  it("measures content attached after opening and keeps resize observation active", async () => {
    setViewport();
    let contentX = 100;
    let resizeCallback: ResizeObserverCallback | null = null;
    const disconnect = vi.fn();
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }
        observe() {}
        disconnect() {
          disconnect();
        }
      },
    });

    function LateContentHarness({ showContent }: { showContent: boolean }) {
      const triggerRef = useRef<HTMLElement | null>(null);
      const { position, contentRef } = useFloatingPosition({
        triggerRef,
        open: true,
        side: "bottom",
        align: "start",
        avoidCollisions: false,
      });

      return createElement(
        "div",
        null,
        createElement("button", {
          type: "button",
          ref: (node: HTMLButtonElement | null) => {
            triggerRef.current = node;
            if (node) node.getBoundingClientRect = () => makeDOMRect(contentX, 100, 80, 40);
          },
        }),
        showContent
          ? createElement(
              "div",
              {
                ref: (node: HTMLDivElement | null) => {
                  if (node) node.getBoundingClientRect = () => contentRect;
                  contentRef(node);
                },
              },
              createElement("output", null, formatPosition(position)),
            )
          : createElement("output", null, formatPosition(position)),
      );
    }

    try {
      const { rerender, unmount } = render(
        createElement(LateContentHarness, { showContent: false }),
      );
      expect(screen.getByRole("status")).toHaveTextContent("closed");

      rerender(createElement(LateContentHarness, { showContent: true }));
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
      });

      contentX = 260;
      act(() => {
        resizeCallback?.([], {} as ResizeObserver);
      });
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:260:146");
      });

      rerender(createElement(LateContentHarness, { showContent: false }));
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("closed");
      });
      expect(disconnect).toHaveBeenCalledTimes(1);

      unmount();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      restoreProperty(globalThis, "ResizeObserver", resizeObserverDescriptor);
    }
  });

  it("replaces open trigger and content attachments and leaves stale observers inert", async () => {
    setViewport();
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const firstTriggerRect = vi.fn(() => makeDOMRect(100, 100, 120, 40));
    const secondTriggerRect = vi.fn(() => makeDOMRect(300, 100, 80, 40));
    const firstContentRect = vi.fn(() => makeDOMRect(0, 0, 120, 50));
    const secondContentRect = vi.fn(() => makeDOMRect(0, 0, 40, 50));
    const observers: Array<{
      callback: ResizeObserverCallback;
      disconnect: ReturnType<typeof vi.fn>;
      observe: ReturnType<typeof vi.fn>;
      observer: ResizeObserver;
    }> = [];
    // The observed node is the measured wrapper, not the <output> the assertions read,
    // so the harness records each attachment as it happens.
    const contentNodes: Array<HTMLDivElement | null> = [];

    class MockResizeObserver implements ResizeObserver {
      readonly disconnect = vi.fn();
      readonly observe = vi.fn();
      readonly unobserve = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        observers.push({
          callback,
          disconnect: this.disconnect,
          observe: this.observe,
          observer: this,
        });
      }
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: MockResizeObserver,
    });

    function ReplacementHarness({ version }: { version: "first" | "second" }) {
      const triggerRef = useRef<HTMLElement | null>(null);
      const { position, contentRef } = useFloatingPosition({
        triggerRef,
        open: true,
        side: "bottom",
        align: "center",
        avoidCollisions: false,
      });
      const getTriggerRect = version === "first" ? firstTriggerRect : secondTriggerRect;
      const getContentRect = version === "first" ? firstContentRect : secondContentRect;

      return createElement(
        "div",
        null,
        createElement("button", {
          key: `trigger-${version}`,
          type: "button",
          ref: (node: HTMLButtonElement | null) => {
            triggerRef.current = node;
            if (node) node.getBoundingClientRect = getTriggerRect;
          },
        }),
        createElement(
          "div",
          {
            key: `content-${version}`,
            ref: (node: HTMLDivElement | null) => {
              if (node) node.getBoundingClientRect = getContentRect;
              contentNodes.push(node);
              contentRef(node);
            },
          },
          createElement("output", null, formatPosition(position)),
        ),
      );
    }

    try {
      const { rerender } = render(createElement(ReplacementHarness, { version: "first" }));
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
      });

      const firstTrigger = screen.getByRole("button");
      const firstNode = contentNodes[0];
      const firstObserver = observers[0];
      expect(firstObserver?.observe).toHaveBeenCalledWith(firstTrigger);
      expect(firstObserver?.observe).toHaveBeenCalledWith(firstNode);
      const firstResizeRegistration = addEventListener.mock.calls.find(
        ([type]) => type === "resize",
      );
      const firstScrollRegistration = addEventListener.mock.calls.find(
        ([type]) => type === "scroll",
      );
      expect(firstResizeRegistration).toBeDefined();
      expect(firstScrollRegistration).toBeDefined();

      rerender(createElement(ReplacementHarness, { version: "second" }));
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:320:146");
      });

      const secondTrigger = screen.getByRole("button");
      const secondNode = contentNodes.at(-1);
      const secondObserver = observers[1];
      expect(firstObserver?.disconnect).toHaveBeenCalledTimes(1);
      expect(removeEventListener).toHaveBeenCalledWith("resize", firstResizeRegistration?.[1]);
      expect(removeEventListener).toHaveBeenCalledWith("scroll", firstScrollRegistration?.[1]);
      expect(secondTrigger).not.toBe(firstTrigger);
      expect(secondObserver?.observe).toHaveBeenCalledWith(secondTrigger);
      expect(secondObserver?.observe).toHaveBeenCalledWith(secondNode);
      expect(secondTriggerRect).toHaveBeenCalled();
      expect(secondContentRect).toHaveBeenCalled();

      const firstTriggerMeasurements = firstTriggerRect.mock.calls.length;
      const firstMeasurements = firstContentRect.mock.calls.length;
      act(() => {
        firstObserver?.callback([], firstObserver.observer);
      });
      await act(async () => {});

      expect(firstTriggerRect).toHaveBeenCalledTimes(firstTriggerMeasurements);
      expect(firstContentRect).toHaveBeenCalledTimes(firstMeasurements);
      expect(screen.getByRole("status")).toHaveTextContent("bottom:320:146");
    } finally {
      addEventListener.mockRestore();
      removeEventListener.mockRestore();
      restoreProperty(globalThis, "ResizeObserver", resizeObserverDescriptor);
    }
  });

  it("reports the collision-resolved side and shifted coordinates", async () => {
    setViewport();
    render(
      createElement(FloatingHarness, {
        open: true,
        side: "bottom",
        align: "center",
        avoidCollisions: true,
        getTriggerRect: () => makeDOMRect(100, 540, 80, 40),
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("top:80:484");
    });
  });

  it("updates on window resize and scroll", async () => {
    setViewport();
    let x = 100;
    render(
      createElement(FloatingHarness, {
        open: true,
        getTriggerRect: () => makeDOMRect(x, 100, 80, 40),
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
    });

    x = 120;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("bottom:120:146");
    });

    x = 140;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("bottom:140:146");
    });
  });

  describe("rAF batching of scroll/resize", () => {
    let rafCallbacks: FrameRequestCallback[] = [];
    let rafCancelCount = 0;
    const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(
      globalThis,
      "requestAnimationFrame",
    );
    const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(
      globalThis,
      "cancelAnimationFrame",
    );

    beforeEach(() => {
      rafCallbacks = [];
      rafCancelCount = 0;
      // Boundary mock: replaces browser rAF/cAF scheduler so the test can assert exact frame coalescing
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      // Boundary mock: replaces browser rAF/cAF scheduler so the test can assert exact frame coalescing
      vi.stubGlobal("cancelAnimationFrame", () => {
        rafCancelCount += 1;
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      restoreProperty(globalThis, "requestAnimationFrame", originalRequestAnimationFrame);
      restoreProperty(globalThis, "cancelAnimationFrame", originalCancelAnimationFrame);
    });

    function flushFrames() {
      const callbacks = rafCallbacks;
      rafCallbacks = [];
      for (const cb of callbacks) cb(0);
    }

    it("coalesces multiple scroll/resize events within a frame into one update", async () => {
      setViewport();
      let triggerX = 100;
      const triggerRectCalls = vi.fn(() => makeDOMRect(triggerX, 100, 80, 40));
      render(
        createElement(FloatingHarness, {
          open: true,
          getTriggerRect: triggerRectCalls,
        }),
      );

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
      });

      const callsAfterMount = triggerRectCalls.mock.calls.length;
      rafCallbacks = [];

      triggerX = 250;
      act(() => {
        for (let i = 0; i < 10; i++) {
          window.dispatchEvent(new Event("scroll"));
        }
        window.dispatchEvent(new Event("resize"));
      });

      // call-count IS the contract: 11 listener invocations within one frame must schedule exactly one rAF
      expect(rafCallbacks.length).toBe(1);
      expect(triggerRectCalls.mock.calls.length).toBe(callsAfterMount);

      act(() => {
        flushFrames();
      });

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:250:146");
      });

      const callsAfterFlush = triggerRectCalls.mock.calls.length;
      expect(callsAfterFlush - callsAfterMount).toBe(1);
    });

    it("schedules a fresh frame after the previous one flushed", async () => {
      setViewport();
      let triggerX = 100;
      render(
        createElement(FloatingHarness, {
          open: true,
          getTriggerRect: () => makeDOMRect(triggerX, 100, 80, 40),
        }),
      );

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
      });

      rafCallbacks = [];

      triggerX = 200;
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      expect(rafCallbacks.length).toBe(1);

      act(() => {
        flushFrames();
      });

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:200:146");
      });

      triggerX = 350;
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      expect(rafCallbacks.length).toBe(1);

      act(() => {
        flushFrames();
      });

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:350:146");
      });
    });

    it("cancels a pending frame on unmount", async () => {
      setViewport();
      const { unmount } = render(createElement(FloatingHarness, { open: true }));

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
      });

      rafCallbacks = [];
      rafCancelCount = 0;

      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      expect(rafCallbacks.length).toBe(1);

      unmount();

      expect(rafCancelCount).toBe(1);
    });
  });

  it("disconnects observers and removes window listeners on cleanup", async () => {
    setViewport();
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
    const disconnect = vi.fn();
    const removeListener = vi.spyOn(window, "removeEventListener");

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {}
        disconnect() {
          disconnect();
        }
      },
    });

    try {
      const { unmount } = render(createElement(FloatingHarness, { open: true }));

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
      });

      unmount();

      expect(disconnect).toHaveBeenCalled();
      expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function));
      expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
    } finally {
      removeListener.mockRestore();
      restoreProperty(globalThis, "ResizeObserver", resizeObserverDescriptor);
    }
  });

  it("derives viewport and listener target from the trigger's ownerDocument", async () => {
    setViewport(1, 1);

    const altDoc = document.implementation.createHTMLDocument("alt");
    const altView = {
      innerWidth: 1280,
      innerHeight: 720,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      },
      cancelAnimationFrame: vi.fn(),
      getComputedStyle: () => ({ overflow: "", overflowX: "", overflowY: "", display: "block" }),
    };
    Object.defineProperty(altDoc, "defaultView", { configurable: true, value: altView });

    const hostAddListener = vi.spyOn(window, "addEventListener");

    const trigger = altDoc.createElement("button");
    const content = altDoc.createElement("div");
    altDoc.body.append(trigger, content);
    trigger.getBoundingClientRect = () => makeDOMRect(100, 100, 80, 40);
    content.getBoundingClientRect = () => makeDOMRect(0, 0, 120, 50);

    function CrossDocHarness() {
      const triggerRef = useRef<HTMLElement | null>(trigger);
      const { position, contentRef } = useFloatingPosition({
        triggerRef,
        open: true,
        side: "bottom",
        align: "center",
        avoidCollisions: true,
        collisionPadding: 0,
      });
      useLayoutEffect(() => {
        contentRef(content);
        return () => {
          contentRef(null);
        };
      }, [contentRef]);
      return createElement("output", null, formatPosition(position));
    }

    try {
      render(createElement(CrossDocHarness));

      await waitFor(() => {
        // Center alignment with alt viewport 1280x720 puts content at trigger.left + width/2 - content.width/2 = 100 + 40 - 60 = 80
        expect(screen.getByRole("status")).toHaveTextContent("bottom:80:146");
      });

      // Listeners attach on the trigger's own view, NOT the host window.
      expect(altView.addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), {
        passive: true,
      });
      expect(altView.addEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
      // Walker must stop at iframe boundary: the host window must not receive any listeners from this hook.
      const hostScrollResize = hostAddListener.mock.calls.filter(
        ([type]) => type === "scroll" || type === "resize",
      );
      expect(hostScrollResize).toEqual([]);
    } finally {
      hostAddListener.mockRestore();
    }
  });

  it("discovers a cross-realm overflow ancestor and observes resize via the trigger's own realm", async () => {
    // A second JSDOM realm has its own HTMLElement/ResizeObserver. Its elements
    // are NOT `instanceof` the host realm's HTMLElement, so the host-realm
    // scroll-ancestor check and the host ResizeObserver both miss them.
    const hostResizeObserverDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "ResizeObserver",
    );
    const hostObserve = vi.fn();
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {
          hostObserve();
        }
        disconnect() {}
      },
    });

    const realm = new JSDOM("<!doctype html><html><body></body></html>", {
      pretendToBeVisual: true,
      url: "https://example.test/",
    });
    const realmWindow = realm.window as unknown as Window & typeof globalThis;
    const crossDoc = realm.window.document;

    const wrapper = crossDoc.createElement("div");
    const trigger = crossDoc.createElement("button");
    const content = crossDoc.createElement("div");
    wrapper.appendChild(trigger);
    crossDoc.body.append(wrapper, content);

    // Guard the premise: the overflow ancestor is not a host HTMLElement instance.
    expect(wrapper instanceof HTMLElement).toBe(false);
    expect(wrapper instanceof realm.window.HTMLElement).toBe(true);

    trigger.getBoundingClientRect = () => makeDOMRect(100, 100, 80, 40);
    content.getBoundingClientRect = () => makeDOMRect(0, 0, 120, 50);

    Object.defineProperty(realmWindow, "innerWidth", { configurable: true, value: 800 });
    Object.defineProperty(realmWindow, "innerHeight", { configurable: true, value: 600 });
    realmWindow.getComputedStyle = ((el: Element) =>
      el === wrapper
        ? ({
            overflow: "",
            overflowX: "",
            overflowY: "auto",
            display: "block",
          } as CSSStyleDeclaration)
        : ({
            overflow: "",
            overflowX: "",
            overflowY: "",
            display: "block",
          } as CSSStyleDeclaration)) as typeof window.getComputedStyle;
    Object.defineProperty(realmWindow, "requestAnimationFrame", {
      configurable: true,
      value: (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      },
    });
    Object.defineProperty(realmWindow, "cancelAnimationFrame", {
      configurable: true,
      value: () => {},
    });

    const realmObserve = vi.fn();
    Object.defineProperty(realmWindow, "ResizeObserver", {
      configurable: true,
      value: class {
        observe(target: Element) {
          realmObserve(target);
        }
        disconnect() {}
      },
    });

    const wrapperAddListener = vi.spyOn(wrapper, "addEventListener");

    function CrossRealmHarness() {
      const triggerRef = useRef<HTMLElement | null>(trigger);
      const { contentRef } = useFloatingPosition({
        triggerRef,
        open: true,
        side: "bottom",
        align: "start",
        avoidCollisions: false,
      });
      useLayoutEffect(() => {
        contentRef(content as unknown as HTMLDivElement);
        return () => {
          contentRef(null);
        };
      }, [contentRef]);
      return createElement("output", null, "ready");
    }

    try {
      render(createElement(CrossRealmHarness));

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("ready");
      });

      // Scroll-ancestor discovery must reach the cross-realm overflow wrapper.
      const wrapperScrollCalls = wrapperAddListener.mock.calls.filter(
        ([type]) => type === "scroll",
      );
      expect(wrapperScrollCalls.length).toBeGreaterThan(0);

      // Resize observation must run against the trigger's own realm, not the host.
      expect(realmObserve).toHaveBeenCalledWith(trigger);
      expect(realmObserve).toHaveBeenCalledWith(content);
      expect(hostObserve).not.toHaveBeenCalled();
    } finally {
      wrapperAddListener.mockRestore();
      realm.window.close();
      restoreProperty(globalThis, "ResizeObserver", hostResizeObserverDescriptor);
    }
  });

  describe("scroll-parent discovery", () => {
    const originalGetComputedStyle = window.getComputedStyle;
    let overflowByElement: Map<
      Element,
      { overflow: string; overflowX: string; overflowY: string; display: string }
    >;
    let wrapperNode: HTMLDivElement | null;

    beforeEach(() => {
      overflowByElement = new Map();
      wrapperNode = null;
      // Boundary mock: stubs computed style so overflow detection can be exercised without a real CSS engine
      window.getComputedStyle = ((el: Element) => {
        const override = overflowByElement.get(el);
        if (override) {
          return {
            overflow: override.overflow,
            overflowX: override.overflowX,
            overflowY: override.overflowY,
            display: override.display,
          } as CSSStyleDeclaration;
        }
        return originalGetComputedStyle.call(window, el);
      }) as typeof window.getComputedStyle;
    });

    afterEach(() => {
      window.getComputedStyle = originalGetComputedStyle;
    });

    function ScrollParentHarness({
      overflowStyle,
      getTriggerRect,
      getWrapperRect,
    }: {
      overflowStyle: { overflow?: string; overflowX?: string; overflowY?: string };
      getTriggerRect: () => DOMRect;
      getWrapperRect?: () => DOMRect;
    }) {
      const triggerRef = useRef<HTMLElement | null>(null);
      const { position, contentRef } = useFloatingPosition({
        triggerRef,
        open: true,
        side: "bottom",
        align: "start",
        avoidCollisions: false,
      });
      return createElement(
        "div",
        {
          ref: (node: HTMLDivElement | null) => {
            if (!node) return;
            wrapperNode = node;
            if (getWrapperRect) node.getBoundingClientRect = getWrapperRect;
            overflowByElement.set(node, {
              overflow: overflowStyle.overflow ?? "",
              overflowX: overflowStyle.overflowX ?? "",
              overflowY: overflowStyle.overflowY ?? "",
              display: "block",
            });
          },
        },
        createElement("button", {
          type: "button",
          ref: (n: HTMLButtonElement | null) => {
            triggerRef.current = n;
            if (n) n.getBoundingClientRect = getTriggerRect;
          },
        }),
        createElement(
          "div",
          {
            ref: (n: HTMLDivElement | null) => {
              if (n) n.getBoundingClientRect = () => contentRect;
              contentRef(n);
            },
          },
          createElement(
            "output",
            { "data-anchor-hidden": position?.anchorHidden ? "" : undefined },
            formatPosition(position),
          ),
        ),
      );
    }

    it.each([
      {
        name: "leaves the rendered position unchanged on scroll for overflow: visible ancestors",
        overflowStyle: {},
        expectUpdate: false,
      },
      {
        name: "updates the rendered position on scroll for ancestors with overflow-y: auto",
        overflowStyle: { overflowY: "auto" },
        expectUpdate: true,
      },
      {
        name: "updates the rendered position on scroll for ancestors with overflow: scroll",
        overflowStyle: { overflow: "scroll" },
        expectUpdate: true,
      },
    ])("$name", async ({ overflowStyle, expectUpdate }) => {
      setViewport();
      let triggerX = 100;
      render(
        createElement(ScrollParentHarness, {
          overflowStyle,
          getTriggerRect: () => makeDOMRect(triggerX, 100, 80, 40),
        }),
      );

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
      });

      triggerX = 250;
      act(() => {
        wrapperNode?.dispatchEvent(new Event("scroll"));
      });

      if (expectUpdate) {
        await waitFor(() => {
          expect(screen.getByRole("status")).toHaveTextContent("bottom:250:146");
        });
      } else {
        await act(async () => {
          await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
        });
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
      }
    });

    it("reports the anchor hidden once the trigger scrolls out of its scroll ancestor, even while it stays inside the viewport", async () => {
      setViewport();
      let triggerY = 150;
      render(
        createElement(ScrollParentHarness, {
          overflowStyle: { overflowY: "auto" },
          getTriggerRect: () => makeDOMRect(100, triggerY, 80, 40),
          getWrapperRect: () => makeDOMRect(0, 100, 400, 200),
        }),
      );

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:196");
      });
      expect(screen.getByRole("status")).not.toHaveAttribute("data-anchor-hidden");

      // Below the ancestor's bottom edge (300) but far from the viewport's (600).
      triggerY = 400;
      act(() => {
        wrapperNode?.dispatchEvent(new Event("scroll"));
      });

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveAttribute("data-anchor-hidden", "");
      });
    });
  });

  describe("clip-ancestor filtering by positioning mode", () => {
    // Inline styles are what jsdom's getComputedStyle reflects, so the containing-block
    // and overflow decisions under test are driven by real computed values here.
    function ClipHarness({ triggerCss, wrapperCss }: { triggerCss: string; wrapperCss: string }) {
      const triggerRef = useRef<HTMLElement | null>(null);
      const { position, contentRef } = useFloatingPosition({
        triggerRef,
        open: true,
        side: "bottom",
        align: "start",
        avoidCollisions: false,
      });

      return createElement(
        "div",
        null,
        createElement(
          "div",
          {
            // Named so a test can stub getComputedStyle for this node alone.
            id: "clip-wrapper",
            ref: (node: HTMLDivElement | null) => {
              if (!node) return;
              node.style.cssText = wrapperCss;
              // Clip region sits above the trigger: bottom edge at 300, trigger top at 400.
              node.getBoundingClientRect = () => makeDOMRect(0, 100, 400, 200);
            },
          },
          createElement("button", {
            type: "button",
            ref: (node: HTMLButtonElement | null) => {
              triggerRef.current = node;
              if (!node) return;
              node.style.cssText = triggerCss;
              node.getBoundingClientRect = () => makeDOMRect(100, 400, 80, 40);
            },
          }),
        ),
        createElement(
          "div",
          {
            ref: (node: HTMLDivElement | null) => {
              if (node) node.getBoundingClientRect = () => contentRect;
              contentRef(node);
            },
          },
          createElement(
            "output",
            { "data-anchor-hidden": position?.anchorHidden ? "" : undefined },
            formatPosition(position),
          ),
        ),
      );
    }

    it.each([
      {
        name: "a fixed trigger is not clipped by a static overflow ancestor it has escaped",
        triggerCss: "position: fixed;",
        wrapperCss: "overflow: hidden; position: static;",
        hidden: false,
      },
      {
        name: "a normal-flow trigger outside its overflow ancestor stays hidden",
        triggerCss: "",
        wrapperCss: "overflow: hidden;",
        hidden: true,
      },
      {
        name: "a fixed trigger is clipped by an overflow ancestor that is its containing block",
        triggerCss: "position: fixed;",
        wrapperCss: "overflow: hidden; transform: translateX(0px);",
        hidden: true,
      },
      {
        name: "an absolute trigger is not clipped by a static, non-containing-block overflow ancestor",
        triggerCss: "position: absolute;",
        wrapperCss: "overflow: hidden; position: static;",
        hidden: false,
      },
      {
        name: "an absolute trigger is clipped by a positioned overflow ancestor",
        triggerCss: "position: absolute;",
        wrapperCss: "overflow: hidden; position: relative;",
        hidden: true,
      },
    ])("$name", async ({ triggerCss, wrapperCss, hidden }) => {
      setViewport();
      render(createElement(ClipHarness, { triggerCss, wrapperCss }));

      // The trigger sits well inside the viewport, so only ancestor clipping can hide it.
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:446");
      });

      if (hidden) {
        expect(screen.getByRole("status")).toHaveAttribute("data-anchor-hidden", "");
      } else {
        expect(screen.getByRole("status")).not.toHaveAttribute("data-anchor-hidden");
      }
    });

    it("treats transform properties missing from the computed style as unset, not as a containing block", async () => {
      setViewport();
      const originalGetComputedStyle = window.getComputedStyle;
      // Boundary mock: an engine that does not implement translate/scale/rotate/perspective/
      // filter omits them from the declaration entirely. jsdom always returns "" for all of
      // them, so this absence is not reproducible without a stub — and reading an absent
      // property as a changed value would make every ancestor a fixed containing block, hiding
      // panels whose anchors are perfectly visible.
      window.getComputedStyle = ((el: Element) => {
        if (el instanceof HTMLElement && el.id === "clip-wrapper") {
          return {
            transform: "none",
            overflow: "hidden",
            overflowX: "hidden",
            overflowY: "hidden",
            display: "block",
            position: "static",
            willChange: "auto",
            contain: "none",
          } as unknown as CSSStyleDeclaration;
        }
        return originalGetComputedStyle.call(window, el);
      }) as typeof window.getComputedStyle;

      try {
        render(createElement(ClipHarness, { triggerCss: "position: fixed;", wrapperCss: "" }));

        await waitFor(() => {
          expect(screen.getByRole("status")).toHaveTextContent("bottom:100:446");
        });
        expect(screen.getByRole("status")).not.toHaveAttribute("data-anchor-hidden");
      } finally {
        window.getComputedStyle = originalGetComputedStyle;
      }
    });
  });

  describe("anchor visibility", () => {
    it("keeps the anchor visible while it is partly on screen and reports it hidden once it scrolls fully past the viewport edge", async () => {
      setViewport();
      let triggerY = 100;
      render(
        createElement(FloatingHarness, {
          open: true,
          avoidCollisions: true,
          getTriggerRect: () => makeDOMRect(100, triggerY, 80, 40),
        }),
      );

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
      });
      expect(screen.getByRole("status")).not.toHaveAttribute("data-anchor-hidden");

      // Straddling the top edge: 20px of the trigger is still on screen.
      triggerY = -20;
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:100:26");
      });
      expect(screen.getByRole("status")).not.toHaveAttribute("data-anchor-hidden");

      // Fully above the viewport. Collision handling clamps the panel to an unrelated
      // spot against the top edge, which is exactly what the hidden flag exists to suppress.
      triggerY = -60;
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveAttribute("data-anchor-hidden", "");
      });
      expect(screen.getByRole("status")).toHaveTextContent("right:186:8");

      triggerY = 100;
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      await waitFor(() => {
        expect(screen.getByRole("status")).not.toHaveAttribute("data-anchor-hidden");
      });
      expect(screen.getByRole("status")).toHaveTextContent("bottom:100:146");
    });

    it("never reports a zero-area trigger as hidden, since an unmeasured box cannot be told apart from a scrolled-away one", async () => {
      setViewport();
      render(
        createElement(FloatingHarness, {
          open: true,
          avoidCollisions: true,
          getTriggerRect: () => makeDOMRect(0, 0, 0, 0),
        }),
      );

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("bottom:8:8");
      });
      expect(screen.getByRole("status")).not.toHaveAttribute("data-anchor-hidden");
    });
  });
});
