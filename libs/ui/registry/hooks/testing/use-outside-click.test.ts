import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEscapeKey, useOutsideClick } from "../use-outside-click";

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
    const { outside, handler, cleanup } = setup();
    await userEvent.click(outside);
    expect(handler).toHaveBeenCalledOnce();
    cleanup();
  });

  it("handles outside targets that stop propagation", async () => {
    const { outside, handler, cleanup } = setup();
    outside.addEventListener("mousedown", (event) => event.stopPropagation());

    await userEvent.click(outside);

    expect(handler).toHaveBeenCalledOnce();
    cleanup();
  });

  it("does not call handler on inside click", async () => {
    const { inside, handler, cleanup } = setup();
    await userEvent.click(inside);
    expect(handler).not.toHaveBeenCalled();
    cleanup();
  });

  it("does not call handler when enabled=false", async () => {
    const { outside, handler, cleanup } = setup({ enabled: false });
    await userEvent.click(outside);
    expect(handler).not.toHaveBeenCalled();
    cleanup();
  });

  it("does not call handler when clicking on excluded ref", async () => {
    const excluded = document.createElement("div");
    document.body.appendChild(excluded);
    const excludeRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    excludeRef.current = excluded;

    const { handler, cleanup } = setup({ excludeRefs: [excludeRef] });
    await userEvent.click(excluded);
    expect(handler).not.toHaveBeenCalled();
    excluded.remove();
    cleanup();
  });

  it("handles a pointer-supported outside interaction once", async () => {
    restorePointerEventSupport();
    restorePointerEventSupport = setPointerEventSupport(true);
    const { outside, handler, cleanup } = setup();

    await userEvent.click(outside);

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
    await userEvent.click(outside);

    expect(secondHandler).toHaveBeenCalledOnce();
    expect(firstHandler).not.toHaveBeenCalled();

    inside.remove();
    outside.remove();
  });

  it("does not call handler after unmount", async () => {
    const inside = document.createElement("div");
    const outside = document.createElement("div");
    document.body.appendChild(inside);
    document.body.appendChild(outside);

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    ref.current = inside;

    const handler = vi.fn();

    const { unmount } = renderHook(() => useOutsideClick(ref, handler, true));

    unmount();
    await userEvent.click(outside);
    expect(handler).not.toHaveBeenCalled();

    inside.remove();
    outside.remove();
  });

  it("does not call handler when clicking a child of the ref element", async () => {
    const inside = document.createElement("div");
    const child = document.createElement("span");
    inside.appendChild(child);
    document.body.appendChild(inside);

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    ref.current = inside;

    const handler = vi.fn();

    renderHook(() => useOutsideClick(ref, handler, true));

    await userEvent.click(child);
    expect(handler).not.toHaveBeenCalled();

    inside.remove();
  });

  it("only calls the topmost outside-click layer", async () => {
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

    await userEvent.click(outside);

    expect(upperHandler).toHaveBeenCalledOnce();
    expect(lowerHandler).not.toHaveBeenCalled();

    lower.remove();
    upper.remove();
    outside.remove();
  });

  it("routes Escape to the topmost enabled layer", async () => {
    const lowerHandler = vi.fn();
    const upperHandler = vi.fn();

    renderHook(() => {
      useEscapeKey(lowerHandler, true);
      useEscapeKey(upperHandler, true);
    });

    await userEvent.keyboard("{Escape}");

    expect(upperHandler).toHaveBeenCalledOnce();
    expect(lowerHandler).not.toHaveBeenCalled();
  });

  it("does not handle outside clicks after StrictMode unmount", async () => {
    const inside = document.createElement("div");
    const outside = document.createElement("button");
    document.body.append(inside, outside);

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    ref.current = inside;
    const handler = vi.fn();

    const { unmount } = renderHook(() => useOutsideClick(ref, handler, true), {
      wrapper: StrictMode,
    });

    await userEvent.click(outside);
    expect(handler).toHaveBeenCalledOnce();

    unmount();
    await userEvent.click(outside);
    expect(handler).toHaveBeenCalledOnce();
    inside.remove();
    outside.remove();
  });

  it("uses the latest Escape handler after rerender", async () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const { rerender } = renderHook(({ handler }) => useEscapeKey(handler, true), {
      initialProps: { handler: firstHandler },
    });

    rerender({ handler: secondHandler });
    await userEvent.keyboard("{Escape}");

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
