import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Spinner } from "./index";

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<() => void>();

  const mql = {
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
    get matches() {
      return matches;
    },
    setMatches(next: boolean) {
      matches = next;
      for (const listener of listeners) listener();
    },
  };

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });

  return mql;
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: originalMatchMedia,
  });
});

describe("Spinner", () => {
  it("renders with role=status and default label when no children", () => {
    render(<Spinner />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders with role=status and no aria-label when children are provided", () => {
    render(<Spinner>Processing...</Spinner>);
    const status = screen.getByRole("status");
    expect(status).not.toHaveAttribute("aria-label");
    expect(status).toHaveTextContent("Processing...");
  });

  it("has no a11y violations", async () => {
    const { container } = render(<Spinner />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations with children", async () => {
    const { container } = render(<Spinner>Loading data...</Spinner>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("forwards refs to the status element", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Spinner ref={ref} />);

    expect(ref.current).toBe(screen.getByRole("status", { name: "Loading" }));
  });

  it("holds the first braille frame while reduced motion matches, then advances and resets as the query changes", () => {
    vi.useFakeTimers();
    try {
      const mql = mockMatchMedia(true);

      render(<Spinner variant="braille" />);
      const status = screen.getByRole("status", { name: "Loading" });
      const firstFrame = status.textContent;

      act(() => {
        vi.advanceTimersByTime(80 * 5);
      });
      expect(status.textContent).toBe(firstFrame);

      act(() => {
        mql.setMatches(false);
      });
      act(() => {
        vi.advanceTimersByTime(80 * 3);
      });
      expect(status.textContent).not.toBe(firstFrame);

      act(() => {
        mql.setMatches(true);
      });
      expect(status.textContent).toBe(firstFrame);
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes the change listener and clears the pending interval on unmount", () => {
    vi.useFakeTimers();
    try {
      const mql = mockMatchMedia(false);

      const { unmount } = render(<Spinner variant="braille" />);
      const [, changeListener] = mql.addEventListener.mock.calls[0] as [string, () => void];
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      unmount();

      expect(mql.removeEventListener).toHaveBeenCalledWith("change", changeListener);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders accessible status when matchMedia is unavailable", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    render(<Spinner variant="braille" />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
