import { describe, it, expect, afterEach } from "vitest";
import { render, renderHook, cleanup } from "@testing-library/react";
import { createElement, useRef } from "react";
import { useScrollLock } from "./use-scroll-lock";

describe("useScrollLock", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
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

    const { rerender, unmount } = renderHook(
      ({ enabled }) => useScrollLock({ enabled }),
      { initialProps: { enabled: false } },
    );
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

  it("locks a DOM ref after React assigns it", () => {
    function Host() {
      const ref = useRef<HTMLDivElement>(null);
      useScrollLock({ target: ref });
      return createElement("div", { ref, "data-testid": "target", style: { overflow: "auto" } });
    }

    const { getByTestId, unmount } = render(createElement(Host));
    const target = getByTestId("target");

    expect(target.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("");

    unmount();
    expect(target.style.overflow).toBe("auto");
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
});
