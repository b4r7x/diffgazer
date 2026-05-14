import { describe, it, expect, afterEach } from "vitest";
import { render, renderHook, screen, cleanup } from "@testing-library/react";
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
});
