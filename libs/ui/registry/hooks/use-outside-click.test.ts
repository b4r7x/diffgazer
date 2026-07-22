import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createElement,
  createRef,
  Fragment,
  type RefObject,
  StrictMode,
  useRef,
  useState,
} from "react";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import OutsideClickBasicExample from "../examples/outside-click/outside-click-basic";
import { outsideClickDoc } from "../hook-docs/outside-click";
import { type OverlayStackOptions, useEscapeKey, useOutsideClick } from "./use-outside-click";

let restorePointerEventSupport = () => {};

function LateAttachHarness({ onOutside }: { onOutside: () => void }) {
  const [attached, setAttached] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, onOutside);

  return createElement(
    Fragment,
    null,
    createElement("button", { type: "button", onClick: () => setAttached(true) }, "Attach"),
    attached ? createElement("div", { ref }, "Inside") : null,
    createElement("button", { type: "button" }, "Outside"),
  );
}

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
  it("keeps the five positional parameters aligned with public metadata", () => {
    expect(outsideClickDoc.parameters?.map((parameter) => parameter.name)).toEqual([
      "ref",
      "handler",
      "enabled",
      "excludeRefs",
      "options",
    ]);
    expectTypeOf<Parameters<typeof useOutsideClick>>().toEqualTypeOf<
      [
        ref: RefObject<HTMLElement | null>,
        handler: () => void,
        enabled?: boolean,
        excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>,
        options?: OverlayStackOptions,
      ]
    >();
  });

  it("keeps modern listener timing aligned with the public metadata", () => {
    restorePointerEventSupport();
    restorePointerEventSupport = setPointerEventSupport(true);
    const addListener = vi.spyOn(document, "addEventListener");

    const { cleanup } = setup();

    expect(addListener).toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function),
      expect.objectContaining({ capture: true }),
    );
    expect(outsideClickDoc.notes?.find((note) => note.title === "Event Type")?.content).toContain(
      "capture-phase pointerdown",
    );
    cleanup();
    addListener.mockRestore();
  });

  it("keeps legacy capture listeners aligned with the public metadata", () => {
    const addListener = vi.spyOn(document, "addEventListener");

    const { cleanup } = setup();

    for (const eventName of ["touchstart", "mousedown"]) {
      expect(addListener).toHaveBeenCalledWith(
        eventName,
        expect.any(Function),
        expect.objectContaining({ capture: true }),
      );
    }
    const eventNote = outsideClickDoc.notes?.find((note) => note.title === "Event Type")?.content;
    expect(eventNote).toContain("capture-phase touchstart and mousedown fallbacks");
    cleanup();
    addListener.mockRestore();
  });

  it("lets the canonical example close and reopen", async () => {
    const user = userEvent.setup();
    render(createElement(OutsideClickBasicExample));

    expect(screen.getByText("Click outside to dismiss")).toBeInTheDocument();
    await user.click(document.body);
    const opener = screen.getByRole("button", { name: "Show panel" });

    await user.click(opener);

    expect(screen.getByText("Click outside to dismiss")).toBeInTheDocument();
  });

  it("registers when an initially null ref attaches in a later commit", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(createElement(LateAttachHarness, { onOutside: handler }));

    await user.click(screen.getByRole("button", { name: "Attach" }));
    await user.click(screen.getByRole("button", { name: "Outside" }));

    expect(handler).toHaveBeenCalledOnce();
  });

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
    const lower = document.createElement("div");
    const upper = document.createElement("div");
    const excluded = document.createElement("div");
    const outside = document.createElement("button");
    document.body.append(lower, upper, excluded, outside);

    const lowerRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    lowerRef.current = lower;
    const upperRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    upperRef.current = upper;
    const excludeRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    excludeRef.current = excluded;
    const lowerHandler = vi.fn();
    const upperHandler = vi.fn();

    const { rerender } = renderHook(() => {
      // New inline array identity every render for the lower layer.
      useOutsideClick(lowerRef, lowerHandler, true, [excludeRef]);
      useOutsideClick(upperRef, upperHandler, true);
    });

    rerender();
    rerender();

    // An outside press still dismisses only the unchanged upper (topmost) layer.
    await user.click(outside);
    expect(upperHandler).toHaveBeenCalledOnce();
    expect(lowerHandler).not.toHaveBeenCalled();

    // The lower layer honors its latest excluded ref and dismisses on a real
    // outside press once it becomes topmost.
    upper.remove();
    await user.click(excluded);
    expect(lowerHandler).not.toHaveBeenCalled();
    await user.click(outside);
    expect(lowerHandler).toHaveBeenCalledOnce();

    lower.remove();
    excluded.remove();
    outside.remove();
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

  it("skips a detached top entry and dismisses one live layer", async () => {
    const user = userEvent.setup();
    const lower = document.createElement("div");
    const upper = document.createElement("div");
    const outside = document.createElement("button");
    document.body.append(lower, upper, outside);

    const lowerRef: React.RefObject<HTMLElement | null> = { current: lower };
    const upperRef: React.RefObject<HTMLElement | null> = { current: upper };
    const lowerHandler = vi.fn();
    const upperHandler = vi.fn();

    renderHook(() => {
      useOutsideClick(lowerRef, lowerHandler);
      useOutsideClick(upperRef, upperHandler);
    });
    upper.remove();

    await user.click(outside);

    expect(lowerHandler).toHaveBeenCalledOnce();
    expect(upperHandler).not.toHaveBeenCalled();
    lower.remove();
    outside.remove();
  });

  it("does not swallow the opener gesture for a detached entry", async () => {
    const user = userEvent.setup();
    const inside = document.createElement("div");
    const opener = document.createElement("button");
    document.body.append(inside, opener);
    const ref: React.RefObject<HTMLElement | null> = { current: inside };
    const handler = vi.fn();
    const open = vi.fn();
    opener.addEventListener("click", open);

    renderHook(() => useOutsideClick(ref, handler));
    inside.remove();
    await user.click(opener);

    expect(handler).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledOnce();
    opener.remove();
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

  it("routes Escape to the sole enabled layer, then to a newly enabled higher layer", async () => {
    const user = userEvent.setup();
    const lowerHandler = vi.fn();
    const upperHandler = vi.fn();

    const { rerender } = renderHook(
      ({ upperEnabled }) => {
        useEscapeKey(lowerHandler, true);
        useEscapeKey(upperHandler, upperEnabled);
      },
      { initialProps: { upperEnabled: false } },
    );

    await user.keyboard("{Escape}");
    expect(lowerHandler).toHaveBeenCalledOnce();
    expect(upperHandler).not.toHaveBeenCalled();

    rerender({ upperEnabled: true });
    await user.keyboard("{Escape}");
    expect(upperHandler).toHaveBeenCalledOnce();
    expect(lowerHandler).toHaveBeenCalledOnce();
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

  it("dismisses on a fresh outside press in the ref's ownerDocument but ignores the host document", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeDocument = iframe.contentDocument;
    if (!iframeDocument) throw new Error("Expected iframe document");
    const inside = iframeDocument.createElement("div");
    const outside = iframeDocument.createElement("button");
    iframeDocument.body.append(inside, outside);
    const hostOutside = document.createElement("button");
    document.body.appendChild(hostOutside);

    const ref: React.RefObject<HTMLElement | null> = { current: inside };
    const handler = vi.fn();
    const { unmount } = renderHook(() => useOutsideClick(ref, handler, true));

    // Dispatch fresh pointer events from the iframe's own realm — its window
    // has its own PointerEvent constructor, distinct from the host window's.
    if (!iframeDocument.defaultView) throw new Error("Expected iframe window");
    const IframePointerEvent = iframeDocument.defaultView.PointerEvent;

    inside.dispatchEvent(new IframePointerEvent("pointerdown", { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();

    // A press in the host document is ignored: listeners attach only to the
    // ref's ownerDocument.
    hostOutside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();

    outside.dispatchEvent(new IframePointerEvent("pointerdown", { bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();

    unmount();
    outside.dispatchEvent(new IframePointerEvent("pointerdown", { bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();

    hostOutside.remove();
    iframe.remove();
  });

  it("treats primary and excluded refs across documents as one logical layer", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeDocument = iframe.contentDocument;
    if (!iframeDocument) throw new Error("Expected iframe document");
    const primary = document.createElement("div");
    const hostOutside = document.createElement("button");
    const excluded = iframeDocument.createElement("div");
    const iframeOutside = iframeDocument.createElement("button");
    document.body.append(primary, hostOutside);
    iframeDocument.body.append(excluded, iframeOutside);

    const primaryRef: React.RefObject<HTMLElement | null> = { current: primary };
    const excludedRef: React.RefObject<HTMLElement | null> = { current: excluded };
    const handler = vi.fn();
    const { unmount } = renderHook(() => useOutsideClick(primaryRef, handler, true, [excludedRef]));

    // Dispatch fresh pointer events from the iframe's own realm — its window
    // has its own PointerEvent constructor, distinct from the host window's.
    if (!iframeDocument.defaultView) throw new Error("Expected iframe window");
    const IframePointerEvent = iframeDocument.defaultView.PointerEvent;

    excluded.dispatchEvent(new IframePointerEvent("pointerdown", { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();

    hostOutside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();

    iframeOutside.dispatchEvent(new IframePointerEvent("pointerdown", { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(2);

    unmount();
    iframeOutside.dispatchEvent(new IframePointerEvent("pointerdown", { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(2);

    primary.remove();
    hostOutside.remove();
    iframe.remove();
  });

  it("routes Escape from the ref's ownerDocument only", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeDocument = iframe.contentDocument;
    if (!iframeDocument) throw new Error("Expected iframe document");
    const inside = iframeDocument.createElement("div");
    iframeDocument.body.append(inside);

    const ref: React.RefObject<HTMLElement | null> = { current: inside };
    const handler = vi.fn();

    renderHook(() => useEscapeKey(handler, true, { ref }));

    iframeDocument.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(handler).toHaveBeenCalledOnce();

    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(handler).toHaveBeenCalledOnce();

    iframe.remove();
  });
});
