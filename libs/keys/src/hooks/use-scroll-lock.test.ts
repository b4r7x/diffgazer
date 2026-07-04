import { render, renderHook, screen } from "@testing-library/react";
import { createElement, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScrollLock } from "./use-scroll-lock.js";

describe("useScrollLock", () => {
  afterEach(() => {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  });

  it("sets and restores overflow", () => {
    document.body.style.overflow = "auto";

    const { unmount } = renderHook(() => useScrollLock());
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("respects enabled flag", () => {
    document.body.style.overflow = "scroll";

    const { rerender, unmount } = renderHook(({ enabled }) => useScrollLock({ enabled }), {
      initialProps: { enabled: false },
    });
    expect(document.body.style.overflow).toBe("scroll");

    rerender({ enabled: true });
    expect(document.body.style.overflow).toBe("hidden");

    rerender({ enabled: false });
    expect(document.body.style.overflow).toBe("scroll");

    unmount();
  });

  it("works with a custom target ref", () => {
    const container = document.createElement("div");
    container.style.overflow = "auto";
    document.body.appendChild(container);

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      useScrollLock({ target: ref });
    });

    expect(container.style.overflow).toBe("hidden");

    unmount();
    expect(container.style.overflow).toBe("auto");

    container.remove();
  });

  it("does not lock document.body while a provided target ref is null", () => {
    document.body.style.overflow = "auto";
    const targetRef = { current: null };

    const { unmount } = renderHook(() => useScrollLock({ target: targetRef }));

    expect(document.body.style.overflow).toBe("auto");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);

    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("locks a DOM ref after React assigns it", () => {
    function Host() {
      const ref = useRef<HTMLDivElement>(null);
      useScrollLock({ target: ref });
      return createElement("div", {
        ref,
        "aria-label": "Scrollable region",
        style: { overflow: "auto" },
      });
    }

    const { unmount } = render(createElement(Host));
    const target = screen.getByLabelText("Scrollable region");

    expect(target.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("");

    unmount();
    expect(target.style.overflow).toBe("auto");
  });

  it("releases the previous target before locking a new one when the target ref changes", () => {
    const first = document.createElement("div");
    first.style.overflow = "auto";
    first.setAttribute("aria-label", "First region");
    const second = document.createElement("div");
    second.style.overflow = "scroll";
    second.setAttribute("aria-label", "Second region");
    document.body.append(first, second);

    const firstRef = { current: first as HTMLElement };
    const secondRef = { current: second as HTMLElement };

    const { rerender, unmount } = renderHook(
      ({ ref }: { ref: { current: HTMLElement | null } }) => useScrollLock({ target: ref }),
      { initialProps: { ref: firstRef } },
    );

    expect(first.style.overflow).toBe("hidden");
    expect(second.style.overflow).toBe("scroll");

    rerender({ ref: secondRef });
    expect(first.style.overflow).toBe("auto");
    expect(second.style.overflow).toBe("hidden");

    unmount();
    expect(second.style.overflow).toBe("scroll");

    first.remove();
    second.remove();
  });

  it("concurrent locks stay hidden until all unmount", () => {
    document.body.style.overflow = "auto";

    const { unmount: unmountA } = renderHook(() => useScrollLock());
    const { unmount: unmountB } = renderHook(() => useScrollLock());
    expect(document.body.style.overflow).toBe("hidden");

    unmountB();
    expect(document.body.style.overflow).toBe("hidden");
    unmountA();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("locks the owner document body when target is derived from a trigger element's ownerDocument", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    document.body.style.overflow = "auto";

    const ownerBody = trigger.ownerDocument.body;
    const targetRef = { current: ownerBody };

    const { unmount } = renderHook(() => useScrollLock({ target: targetRef }));

    expect(ownerBody).toBe(document.body);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("auto");

    trigger.remove();
  });

  it("marks the locked element with data-scroll-locked and removes it on release", () => {
    const { unmount } = renderHook(() => useScrollLock());
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);

    unmount();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
  });

  it("compensates for scrollbar width and restores the saved padding-right", () => {
    document.body.style.paddingRight = "8px";

    const docEl = document.documentElement;
    const view = document.defaultView as Window & typeof globalThis;
    const innerWidthSpy = vi.spyOn(view, "innerWidth", "get").mockReturnValue(1000);
    const clientWidthSpy = vi.spyOn(docEl, "clientWidth", "get").mockReturnValue(985);
    const computedStyleSpy = vi
      .spyOn(view, "getComputedStyle")
      .mockReturnValue({ paddingRight: "8px" } as CSSStyleDeclaration);

    const { unmount } = renderHook(() => useScrollLock());

    expect(document.body.style.paddingRight).toBe("23px");

    unmount();
    expect(document.body.style.paddingRight).toBe("8px");

    innerWidthSpy.mockRestore();
    clientWidthSpy.mockRestore();
    computedStyleSpy.mockRestore();
  });

  it("applies scrollbar compensation once across nested locks and restores once", () => {
    document.body.style.paddingRight = "4px";

    const docEl = document.documentElement;
    const view = document.defaultView as Window & typeof globalThis;
    const innerWidthSpy = vi.spyOn(view, "innerWidth", "get").mockReturnValue(1000);
    const clientWidthSpy = vi.spyOn(docEl, "clientWidth", "get").mockReturnValue(990);
    const computedStyleSpy = vi
      .spyOn(view, "getComputedStyle")
      .mockReturnValue({ paddingRight: "4px" } as CSSStyleDeclaration);

    const { unmount: unmountA } = renderHook(() => useScrollLock());
    const { unmount: unmountB } = renderHook(() => useScrollLock());

    expect(document.body.style.paddingRight).toBe("14px");

    unmountB();
    expect(document.body.style.paddingRight).toBe("14px");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);

    unmountA();
    expect(document.body.style.paddingRight).toBe("4px");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);

    innerWidthSpy.mockRestore();
    clientWidthSpy.mockRestore();
    computedStyleSpy.mockRestore();
  });

  it("does not add padding when there is no scrollbar width", () => {
    document.body.style.paddingRight = "12px";

    const docEl = document.documentElement;
    const view = document.defaultView as Window & typeof globalThis;
    const innerWidthSpy = vi.spyOn(view, "innerWidth", "get").mockReturnValue(1000);
    const clientWidthSpy = vi.spyOn(docEl, "clientWidth", "get").mockReturnValue(1000);

    const { unmount } = renderHook(() => useScrollLock());

    expect(document.body.style.paddingRight).toBe("12px");
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.paddingRight).toBe("12px");

    innerWidthSpy.mockRestore();
    clientWidthSpy.mockRestore();
  });

  it("subtracts element borders from non-viewport scrollbar compensation", () => {
    const container = document.createElement("div");
    container.style.overflow = "auto";
    container.style.paddingRight = "5px";
    document.body.appendChild(container);

    const view = document.defaultView as Window & typeof globalThis;
    const offsetWidthSpy = vi.spyOn(container, "offsetWidth", "get").mockReturnValue(128);
    const clientWidthSpy = vi.spyOn(container, "clientWidth", "get").mockReturnValue(100);
    const computedStyleSpy = vi.spyOn(view, "getComputedStyle").mockReturnValue({
      paddingRight: "5px",
      borderLeftWidth: "6px",
      borderRightWidth: "4px",
    } as CSSStyleDeclaration);

    const { unmount } = renderHook(() => useScrollLock({ target: { current: container } }));

    expect(container.style.paddingRight).toBe("23px");

    unmount();
    expect(container.style.paddingRight).toBe("5px");

    offsetWidthSpy.mockRestore();
    clientWidthSpy.mockRestore();
    computedStyleSpy.mockRestore();
    container.remove();
  });
});
