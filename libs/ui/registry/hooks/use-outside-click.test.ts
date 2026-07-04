import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEscapeKey, useOutsideClick } from "./use-outside-click";

let restorePointerEventSupport = () => {};

function setPointerEventSupport(enabled: boolean) {
  const descriptor = Object.getOwnPropertyDescriptor(window, "PointerEvent");

  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    writable: true,
    value: enabled ? class TestPointerEvent extends MouseEvent {} : undefined,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(window, "PointerEvent", descriptor);
    } else {
      Reflect.deleteProperty(window, "PointerEvent");
    }
  };
}

beforeEach(() => {
  restorePointerEventSupport = setPointerEventSupport(false);
});

afterEach(() => {
  restorePointerEventSupport();
});

describe("useOutsideClick", () => {
  function setup(
    opts: { enabled?: boolean; excludeRefs?: React.RefObject<HTMLElement | null>[] } = {},
  ) {
    const inside = document.createElement("div");
    const outside = document.createElement("div");
    document.body.appendChild(inside);
    document.body.appendChild(outside);

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    ref.current = inside;

    const handler = vi.fn();

    renderHook(() => useOutsideClick(ref, handler, opts.enabled ?? true, opts.excludeRefs));

    return {
      inside,
      outside,
      handler,
      cleanup: () => {
        inside.remove();
        outside.remove();
      },
    };
  }

  it("calls handler on outside click", async () => {
    const user = userEvent.setup();
    const { outside, handler, cleanup } = setup();
    await user.click(outside);
    expect(handler).toHaveBeenCalledOnce();
    cleanup();
  });

  it("handles outside targets that stop propagation", async () => {
    const user = userEvent.setup();
    const { outside, handler, cleanup } = setup();
    outside.addEventListener("mousedown", (event) => event.stopPropagation());

    await user.click(outside);

    expect(handler).toHaveBeenCalledOnce();
    cleanup();
  });

  it("does not call handler on inside click", async () => {
    const user = userEvent.setup();
    const { inside, handler, cleanup } = setup();
    await user.click(inside);
    expect(handler).not.toHaveBeenCalled();
    cleanup();
  });

  it("does not call handler when enabled=false", async () => {
    const user = userEvent.setup();
    const { outside, handler, cleanup } = setup({ enabled: false });
    await user.click(outside);
    expect(handler).not.toHaveBeenCalled();
    cleanup();
  });

  it("does not call handler when clicking on excluded ref", async () => {
    const user = userEvent.setup();
    const excluded = document.createElement("div");
    document.body.appendChild(excluded);
    const excludeRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    excludeRef.current = excluded;

    const { handler, cleanup } = setup({ excludeRefs: [excludeRef] });
    await user.click(excluded);
    expect(handler).not.toHaveBeenCalled();
    excluded.remove();
    cleanup();
  });

  it("handles a pointer-supported outside interaction once", async () => {
    const user = userEvent.setup();
    restorePointerEventSupport();
    restorePointerEventSupport = setPointerEventSupport(true);
    const { outside, handler, cleanup } = setup();

    await user.click(outside);

    expect(handler).toHaveBeenCalledOnce();
    cleanup();
  });

  it("dedupes fallback mouse events after touch starts", () => {
    const { outside, handler, cleanup } = setup();

    outside.dispatchEvent(new Event("touchstart", { bubbles: true }));
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(handler).toHaveBeenCalledOnce();
    cleanup();
  });

  it("uses the latest outside-click handler after rerender", async () => {
    const user = userEvent.setup();
    const inside = document.createElement("div");
    const outside = document.createElement("div");
    document.body.append(inside, outside);

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    ref.current = inside;
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const { rerender } = renderHook(({ handler }) => useOutsideClick(ref, handler, true), {
      initialProps: { handler: firstHandler },
    });

    rerender({ handler: secondHandler });
    await user.click(outside);

    expect(secondHandler).toHaveBeenCalledOnce();
    expect(firstHandler).not.toHaveBeenCalled();

    inside.remove();
    outside.remove();
  });

  it("does not re-register the stack entry when an inline excludeRefs array changes identity", async () => {
    const user = userEvent.setup();
    const inside = document.createElement("div");
    const outside = document.createElement("div");
    const excluded = document.createElement("div");
    document.body.append(inside, outside, excluded);

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    ref.current = inside;
    const excludeRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    excludeRef.current = excluded;
    const handler = vi.fn();

    // Detaching/re-pushing the stack entry would refcount the document listener
    // down and back up — spy on the document to prove no churn occurs.
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { rerender } = renderHook(() =>
      // New inline array identity every render.
      useOutsideClick(ref, handler, true, [excludeRef]),
    );
    const addCallsAfterMount = addSpy.mock.calls.length;

    rerender();
    rerender();

    // No additional attach/detach from the re-renders (entry registered once).
    expect(addSpy.mock.calls.length).toBe(addCallsAfterMount);
    expect(removeSpy).not.toHaveBeenCalled();

    // The latest excludeRefs is still honored.
    await user.click(excluded);
    expect(handler).not.toHaveBeenCalled();
    await user.click(outside);
    expect(handler).toHaveBeenCalledOnce();

    addSpy.mockRestore();
    removeSpy.mockRestore();
    inside.remove();
    outside.remove();
    excluded.remove();
  });

  it("does not call handler after unmount", async () => {
    const user = userEvent.setup();
    const inside = document.createElement("div");
    const outside = document.createElement("div");
    document.body.appendChild(inside);
    document.body.appendChild(outside);

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    ref.current = inside;

    const handler = vi.fn();

    const { unmount } = renderHook(() => useOutsideClick(ref, handler, true));

    unmount();
    await user.click(outside);
    expect(handler).not.toHaveBeenCalled();

    inside.remove();
    outside.remove();
  });

  it("does not call handler when clicking a child of the ref element", async () => {
    const user = userEvent.setup();
    const inside = document.createElement("div");
    const child = document.createElement("span");
    inside.appendChild(child);
    document.body.appendChild(inside);

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    ref.current = inside;

    const handler = vi.fn();

    renderHook(() => useOutsideClick(ref, handler, true));

    await user.click(child);
    expect(handler).not.toHaveBeenCalled();

    inside.remove();
  });

  it("only calls the topmost outside-click layer", async () => {
    const user = userEvent.setup();
    const lower = document.createElement("div");
    const upper = document.createElement("div");
    const outside = document.createElement("button");
    document.body.append(lower, upper, outside);

    const lowerRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    const upperRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    lowerRef.current = lower;
    upperRef.current = upper;
    const lowerHandler = vi.fn();
    const upperHandler = vi.fn();

    renderHook(() => {
      useOutsideClick(lowerRef, lowerHandler, true);
      useOutsideClick(upperRef, upperHandler, true);
    });

    await user.click(outside);

    expect(upperHandler).toHaveBeenCalledOnce();
    expect(lowerHandler).not.toHaveBeenCalled();

    lower.remove();
    upper.remove();
    outside.remove();
  });

  it("routes Escape to the topmost enabled layer", async () => {
    const user = userEvent.setup();
    const lowerHandler = vi.fn();
    const upperHandler = vi.fn();

    renderHook(() => {
      useEscapeKey(lowerHandler, true);
      useEscapeKey(upperHandler, true);
    });

    await user.keyboard("{Escape}");

    expect(upperHandler).toHaveBeenCalledOnce();
    expect(lowerHandler).not.toHaveBeenCalled();
  });

  it("ignores Escape dispatched during IME composition", () => {
    const handler = vi.fn();

    renderHook(() => useEscapeKey(handler, true));

    const event = new KeyboardEvent("keydown", { bubbles: true, key: "Escape" });
    Object.defineProperty(event, "isComposing", { value: true });
    document.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not handle outside clicks after StrictMode unmount", async () => {
    const user = userEvent.setup();
    const inside = document.createElement("div");
    const outside = document.createElement("button");
    document.body.append(inside, outside);

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    ref.current = inside;
    const handler = vi.fn();

    const { unmount } = renderHook(() => useOutsideClick(ref, handler, true), {
      wrapper: StrictMode,
    });

    await user.click(outside);
    expect(handler).toHaveBeenCalledOnce();

    unmount();
    await user.click(outside);
    expect(handler).toHaveBeenCalledOnce();
    inside.remove();
    outside.remove();
  });

  it("uses the latest Escape handler after rerender", async () => {
    const user = userEvent.setup();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const { rerender } = renderHook(({ handler }) => useEscapeKey(handler, true), {
      initialProps: { handler: firstHandler },
    });

    rerender({ handler: secondHandler });
    await user.keyboard("{Escape}");

    expect(secondHandler).toHaveBeenCalledOnce();
    expect(firstHandler).not.toHaveBeenCalled();
  });

  it("attaches listeners to the ref's ownerDocument, not the host document", () => {
    const altDoc = document.implementation.createHTMLDocument("alt");
    const altInside = altDoc.createElement("div");
    const altOutside = altDoc.createElement("div");
    altDoc.body.append(altInside, altOutside);

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    ref.current = altInside;
    const handler = vi.fn();

    const altAddSpy = vi.spyOn(altDoc, "addEventListener");
    const hostAddSpy = vi.spyOn(document, "addEventListener");

    try {
      renderHook(() => useOutsideClick(ref, handler, true));

      // Listener registers on alt document, not host document.
      const pointerLikeTypes = ["pointerdown", "mousedown", "touchstart"];
      const altCalls = altAddSpy.mock.calls.filter(([type]) =>
        pointerLikeTypes.includes(String(type)),
      );
      const hostCalls = hostAddSpy.mock.calls.filter(([type]) =>
        pointerLikeTypes.includes(String(type)),
      );

      expect(altCalls.length).toBeGreaterThan(0);
      expect(hostCalls).toHaveLength(0);
    } finally {
      altAddSpy.mockRestore();
      hostAddSpy.mockRestore();
    }
  });

  it("routes Escape from the ref's ownerDocument only", () => {
    const altDoc = document.implementation.createHTMLDocument("alt");
    const altInside = altDoc.createElement("div");
    altDoc.body.append(altInside);

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    ref.current = altInside;
    const handler = vi.fn();

    const altAddSpy = vi.spyOn(altDoc, "addEventListener");
    const hostAddSpy = vi.spyOn(document, "addEventListener");

    try {
      renderHook(() => useEscapeKey(handler, true, { ref }));

      const altKeydown = altAddSpy.mock.calls.filter(([type]) => type === "keydown");
      const hostKeydown = hostAddSpy.mock.calls.filter(([type]) => type === "keydown");
      expect(altKeydown.length).toBeGreaterThan(0);
      expect(hostKeydown).toHaveLength(0);
    } finally {
      altAddSpy.mockRestore();
      hostAddSpy.mockRestore();
    }
  });
});
