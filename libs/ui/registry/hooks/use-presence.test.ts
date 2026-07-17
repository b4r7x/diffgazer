import { act, renderHook } from "@testing-library/react";
import { type AnimationEvent, createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presenceDoc } from "../hook-docs/presence";
import { usePresence } from "./use-presence";

function animationEvent(
  target: EventTarget | null,
  animationName: string = "",
  currentTarget: EventTarget | null = target,
): AnimationEvent {
  return { target, currentTarget, animationName } as unknown as AnimationEvent;
}

function makeElementRef(element: HTMLElement): React.MutableRefObject<HTMLElement | null> {
  const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
  ref.current = element;
  return ref;
}

// jsdom's AnimationEvent constructor ignores animationName, so build the event manually.
function dispatchNativeAnimation(
  element: HTMLElement,
  type: "animationend" | "animationcancel",
  animationName: string = "",
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "animationName", { value: animationName });
  element.dispatchEvent(event);
}

function withResolvedAnimationName(element: HTMLElement, animationName: string) {
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = ((el: Element) => {
    if (el === element) {
      return { animationName } as CSSStyleDeclaration;
    }
    return originalGetComputedStyle(el);
  }) as typeof window.getComputedStyle;
  return () => {
    window.getComputedStyle = originalGetComputedStyle;
  };
}

describe("usePresence", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts hidden when open=false", () => {
    const { result } = renderHook(() => usePresence({ open: false }));
    expect(result.current.present).toBe(false);
  });

  it("starts present when open=true", () => {
    const { result } = renderHook(() => usePresence({ open: true }));
    expect(result.current.present).toBe(true);
  });

  it("keeps present true while exiting, matching the public return reference", () => {
    const { result, rerender } = renderHook(({ open }) => usePresence({ open }), {
      initialProps: { open: true },
    });

    rerender({ open: false });

    expect(result.current.present).toBe(true);
    expect(result.current.exiting).toBe(true);
    if (!presenceDoc.returns) throw new Error("Presence return documentation is missing");
    const exitingProperty = presenceDoc.returns.properties?.find(({ name }) => name === "exiting");
    expect(exitingProperty?.description).toContain("while present remains true");
    expect(exitingProperty?.description).toContain("Both become false after");
  });

  it("transitions hidden→open when open changes to true", () => {
    const { result, rerender } = renderHook(({ open }) => usePresence({ open }), {
      initialProps: { open: false },
    });
    expect(result.current.present).toBe(false);

    rerender({ open: true });
    expect(result.current.present).toBe(true);
  });

  describe("native-listener path (production consumers)", () => {
    it("transitions open→closing→hidden on a native animationend dispatched on the ref element", () => {
      const element = document.createElement("div");
      document.body.appendChild(element);
      const restore = withResolvedAnimationName(element, "ui-content-exit-to-top");
      try {
        const ref = makeElementRef(element);
        const { result, rerender } = renderHook(({ open }) => usePresence({ open, ref }), {
          initialProps: { open: true },
        });

        rerender({ open: false });
        expect(result.current.present).toBe(true);
        expect(result.current.exiting).toBe(true);

        act(() => {
          dispatchNativeAnimation(element, "animationend", "ui-content-exit-to-top");
        });

        expect(result.current.present).toBe(false);
        expect(result.current.exiting).toBe(false);
      } finally {
        restore();
        element.remove();
      }
    });

    it("resolves exit via animationend when the element runs multiple exit animations", () => {
      vi.useFakeTimers();
      const element = document.createElement("div");
      document.body.appendChild(element);
      const restore = withResolvedAnimationName(element, "fade-out, slide-out");
      const onExitComplete = vi.fn();

      try {
        const ref = makeElementRef(element);
        const { result, rerender } = renderHook(
          ({ open }) => usePresence({ open, ref, exitFallbackMs: 50, onExitComplete }),
          { initialProps: { open: true } },
        );

        rerender({ open: false });
        expect(result.current.present).toBe(true);

        act(() => {
          dispatchNativeAnimation(element, "animationend", "fade-out");
        });

        expect(result.current.present).toBe(false);
        expect(onExitComplete).toHaveBeenCalledOnce();
      } finally {
        restore();
        element.remove();
      }
    });

    it("ignores native animationend events bubbling from descendants", () => {
      const element = document.createElement("div");
      const child = document.createElement("span");
      element.appendChild(child);
      document.body.appendChild(element);
      const restore = withResolvedAnimationName(element, "ui-content-exit-to-top");

      try {
        const ref = makeElementRef(element);
        const { result, rerender } = renderHook(({ open }) => usePresence({ open, ref }), {
          initialProps: { open: true },
        });

        rerender({ open: false });
        expect(result.current.present).toBe(true);

        act(() => {
          dispatchNativeAnimation(child, "animationend", "ui-content-exit-to-top");
        });
        expect(result.current.present).toBe(true);

        act(() => {
          dispatchNativeAnimation(element, "animationend", "ui-content-exit-to-top");
        });
        expect(result.current.present).toBe(false);
      } finally {
        restore();
        element.remove();
      }
    });

    it("finishes closing on native animationcancel", () => {
      const element = document.createElement("div");
      document.body.appendChild(element);
      const restore = withResolvedAnimationName(element, "ui-content-exit-to-top");

      try {
        const ref = makeElementRef(element);
        const { result, rerender } = renderHook(({ open }) => usePresence({ open, ref }), {
          initialProps: { open: true },
        });

        rerender({ open: false });
        act(() => {
          dispatchNativeAnimation(element, "animationcancel", "ui-content-exit-to-top");
        });

        expect(result.current.present).toBe(false);
      } finally {
        restore();
        element.remove();
      }
    });

    it("ignores stray animationcancel from the previous enter animation", () => {
      // Swapping enter→exit keyframes makes the browser fire animationcancel with the enter name.
      const element = document.createElement("div");
      document.body.appendChild(element);
      const restore = withResolvedAnimationName(element, "ui-content-exit-to-top");

      try {
        const ref = makeElementRef(element);
        const { result, rerender } = renderHook(({ open }) => usePresence({ open, ref }), {
          initialProps: { open: true },
        });

        rerender({ open: false });
        expect(result.current.present).toBe(true);

        act(() => {
          dispatchNativeAnimation(element, "animationcancel", "ui-content-enter-from-top");
        });
        expect(result.current.present).toBe(true);

        act(() => {
          dispatchNativeAnimation(element, "animationend", "ui-content-exit-to-top");
        });
        expect(result.current.present).toBe(false);
      } finally {
        restore();
        element.remove();
      }
    });

    it("completes exit immediately when the element has no exit animation", () => {
      vi.useFakeTimers();
      const element = document.createElement("div");
      document.body.appendChild(element);
      const onExitComplete = vi.fn();

      try {
        const ref = makeElementRef(element);
        const { result, rerender } = renderHook(
          ({ open }) => usePresence({ open, ref, onExitComplete }),
          { initialProps: { open: true } },
        );

        rerender({ open: false });

        expect(result.current.present).toBe(false);
        expect(result.current.exiting).toBe(false);
        expect(onExitComplete).toHaveBeenCalledOnce();

        act(() => {
          vi.advanceTimersByTime(250);
        });
        expect(onExitComplete).toHaveBeenCalledOnce();
      } finally {
        element.remove();
      }
    });

    it("fires onExitComplete exactly once on a native animationend", () => {
      const element = document.createElement("div");
      document.body.appendChild(element);
      const restore = withResolvedAnimationName(element, "ui-content-exit-to-top");
      const onExitComplete = vi.fn();

      try {
        const ref = makeElementRef(element);
        const { rerender } = renderHook(({ open }) => usePresence({ open, ref, onExitComplete }), {
          initialProps: { open: true },
        });

        rerender({ open: false });
        expect(onExitComplete).not.toHaveBeenCalled();

        act(() => {
          dispatchNativeAnimation(element, "animationend", "ui-content-exit-to-top");
        });

        expect(onExitComplete).toHaveBeenCalledOnce();
      } finally {
        restore();
        element.remove();
      }
    });

    it("does not fire onExitComplete twice when animationend arrives after the fallback timer", () => {
      vi.useFakeTimers();
      const element = document.createElement("div");
      document.body.appendChild(element);
      const restore = withResolvedAnimationName(element, "ui-content-exit-to-top");
      const onExitComplete = vi.fn();

      try {
        const ref = makeElementRef(element);
        const { result, rerender } = renderHook(
          ({ open }) => usePresence({ open, ref, exitFallbackMs: 50, onExitComplete }),
          { initialProps: { open: true } },
        );

        rerender({ open: false });

        act(() => {
          vi.advanceTimersByTime(50);
          dispatchNativeAnimation(element, "animationend", "ui-content-exit-to-top");
        });

        expect(result.current.present).toBe(false);
        expect(onExitComplete).toHaveBeenCalledOnce();
      } finally {
        restore();
        element.remove();
      }
    });

    it("falls back via exitFallbackMs when no native animationend fires", () => {
      vi.useFakeTimers();
      const element = document.createElement("div");
      document.body.appendChild(element);
      const restore = withResolvedAnimationName(element, "ui-content-exit-to-top");
      const onExitComplete = vi.fn();

      try {
        const ref = makeElementRef(element);
        const { result, rerender } = renderHook(
          ({ open }) => usePresence({ open, ref, exitFallbackMs: 50, onExitComplete }),
          { initialProps: { open: true } },
        );

        rerender({ open: false });
        expect(result.current.present).toBe(true);

        act(() => {
          vi.advanceTimersByTime(50);
        });

        expect(result.current.present).toBe(false);
        expect(onExitComplete).toHaveBeenCalledOnce();
      } finally {
        restore();
        element.remove();
      }
    });

    it("cleans up native listeners on unmount during closing without firing onExitComplete", () => {
      vi.useFakeTimers();
      const element = document.createElement("div");
      document.body.appendChild(element);
      const restore = withResolvedAnimationName(element, "ui-content-exit-to-top");
      const onExitComplete = vi.fn();

      try {
        const ref = makeElementRef(element);
        const { rerender, unmount } = renderHook(
          ({ open }) => usePresence({ open, ref, exitFallbackMs: 50, onExitComplete }),
          { initialProps: { open: true } },
        );

        rerender({ open: false });
        unmount();

        act(() => {
          dispatchNativeAnimation(element, "animationend", "ui-content-exit-to-top");
          vi.advanceTimersByTime(100);
        });

        expect(onExitComplete).not.toHaveBeenCalled();
      } finally {
        restore();
        element.remove();
      }
    });
  });

  describe("returned-handler path (synthetic-event consumers)", () => {
    it("transitions open→closing→hidden on returned onAnimationEnd (no ref)", () => {
      const { result, rerender } = renderHook(({ open }) => usePresence({ open }), {
        initialProps: { open: true },
      });

      rerender({ open: false });
      expect(result.current.present).toBe(true);

      act(() => {
        result.current.onAnimationEnd(animationEvent(null));
      });
      expect(result.current.present).toBe(false);
    });

    it("sets exiting=true when open goes from true to false until onAnimationEnd", () => {
      const { result, rerender } = renderHook(({ open }) => usePresence({ open }), {
        initialProps: { open: true },
      });

      expect(result.current.exiting).toBe(false);

      rerender({ open: false });
      expect(result.current.exiting).toBe(true);
      expect(result.current.present).toBe(true);

      act(() => {
        result.current.onAnimationEnd(animationEvent(null));
      });
      expect(result.current.exiting).toBe(false);
      expect(result.current.present).toBe(false);
    });

    it("ignores returned onAnimationEnd events bubbling from descendants (no ref)", () => {
      const wrapper = document.createElement("div");
      const child = document.createElement("span");
      const { result, rerender } = renderHook(({ open }) => usePresence({ open }), {
        initialProps: { open: true },
      });

      rerender({ open: false });
      expect(result.current.present).toBe(true);

      act(() => {
        result.current.onAnimationEnd(animationEvent(child, "", wrapper));
      });
      expect(result.current.present).toBe(true);

      act(() => {
        result.current.onAnimationEnd(animationEvent(wrapper, "", wrapper));
      });
      expect(result.current.present).toBe(false);
    });
  });

  it("re-opens when open=true is set during closing phase", () => {
    const { result, rerender } = renderHook(({ open }) => usePresence({ open }), {
      initialProps: { open: true },
    });

    rerender({ open: false });
    expect(result.current.exiting).toBe(true);

    rerender({ open: true });
    expect(result.current.present).toBe(true);
    expect(result.current.exiting).toBe(false);
  });

  it("finishes closing when no animation event fires (fallback timer, no ref)", () => {
    vi.useFakeTimers();
    const onExitComplete = vi.fn();
    const { result, rerender } = renderHook(
      ({ open }) => usePresence({ open, exitFallbackMs: 50, onExitComplete }),
      { initialProps: { open: true } },
    );

    rerender({ open: false });
    expect(result.current.present).toBe(true);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current.present).toBe(false);
    expect(onExitComplete).toHaveBeenCalledOnce();
  });

  it("does not restart the fallback timer when onExitComplete identity changes", () => {
    vi.useFakeTimers();
    const firstOnExitComplete = vi.fn();
    const secondOnExitComplete = vi.fn();
    const { result, rerender } = renderHook(
      ({ open, onExitComplete }) => usePresence({ open, exitFallbackMs: 50, onExitComplete }),
      { initialProps: { open: true, onExitComplete: firstOnExitComplete } },
    );

    rerender({ open: false, onExitComplete: firstOnExitComplete });
    act(() => {
      vi.advanceTimersByTime(25);
    });
    rerender({ open: false, onExitComplete: secondOnExitComplete });
    act(() => {
      vi.advanceTimersByTime(24);
    });
    expect(result.current.present).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.present).toBe(false);
    expect(firstOnExitComplete).not.toHaveBeenCalled();
    expect(secondOnExitComplete).toHaveBeenCalledOnce();
  });
});
