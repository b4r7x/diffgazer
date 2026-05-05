import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup, fireEvent } from "@testing-library/react";
import { type ReactNode } from "react";
import { KeyboardProvider } from "../providers/keyboard-provider";
import { useKey } from "./use-key";
import { fireKey } from "../testing/test-utils";

function wrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

describe("useKey", () => {
  afterEach(() => {
    cleanup();
  });

  it("hook lifecycle: registers, fires matching keys, respects enabled, and cleans up", () => {
    const handler = vi.fn();
    let enabled = false;
    const { rerender, unmount } = renderHook(
      () => useKey("Escape", handler, { enabled }),
      { wrapper },
    );

    // disabled — does not fire
    fireKey("Escape");
    expect(handler).not.toHaveBeenCalled();

    // re-enable — fires for matching key with correct event
    enabled = true;
    rerender();
    fireKey("Escape");
    expect(handler).toHaveBeenCalledWith(expect.any(KeyboardEvent));

    // non-matching key ignored
    handler.mockClear();
    fireKey("Enter");
    expect(handler).not.toHaveBeenCalled();

    // cleans up on unmount
    unmount();
    fireKey("Escape");
    expect(handler).not.toHaveBeenCalled();
  });

  describe("overload 2: array of keys + handler", () => {
    it("registers multiple keys with same handler", () => {
      const handler = vi.fn();
      renderHook(() => useKey(["Enter", " "], handler), { wrapper });

      fireKey("Enter");
      expect(handler).toHaveBeenCalled();

      handler.mockClear();
      fireKey(" ");
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("overload 3: key map", () => {
    it("calls correct handler per key", () => {
      const moveUp = vi.fn();
      const moveDown = vi.fn();
      renderHook(
        () =>
          useKey({
            ArrowUp: moveUp,
            ArrowDown: moveDown,
          }),
        { wrapper },
      );

      fireKey("ArrowUp");
      expect(moveUp).toHaveBeenCalled();
      expect(moveDown).not.toHaveBeenCalled();

      fireKey("ArrowDown");
      expect(moveDown).toHaveBeenCalled();
    });

    it("conditionally enables based on zone equality", () => {
      const handler = vi.fn();
      let zone = "search";
      const { rerender } = renderHook(
        () =>
          useKey(
            { ArrowDown: handler },
            { enabled: zone === "list" },
          ),
        { wrapper },
      );

      fireKey("ArrowDown");
      expect(handler).not.toHaveBeenCalled();

      zone = "list";
      rerender();

      fireKey("ArrowDown");
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("handler stability", () => {
    it("picks up latest handler without re-registration", () => {
      let callCount = 0;
      const firstHandler = vi.fn(() => (callCount = 1));
      const secondHandler = vi.fn(() => (callCount = 2));

      let handler = firstHandler;
      const { rerender } = renderHook(
        () => useKey("Escape", handler),
        { wrapper },
      );

      fireKey("Escape");
      expect(firstHandler).toHaveBeenCalled();
      expect(callCount).toBe(1);

      handler = secondHandler;
      rerender();

      fireKey("Escape");
      expect(secondHandler).toHaveBeenCalled();
      expect(callCount).toBe(2);
    });
  });

  describe("without KeyboardProvider", () => {
    it("does not throw when used without KeyboardProvider", () => {
      const handler = vi.fn();
      const { unmount } = renderHook(() => useKey("a", handler));
      fireEvent.keyDown(document, { key: "a" });
      expect(handler).not.toHaveBeenCalled();
      unmount();
    });
  });

  describe("options", () => {
    it("only calls preventDefault when explicitly enabled", () => {
      const handler = vi.fn();
      const { unmount } = renderHook(
        () => useKey("Escape", handler),
        { wrapper },
      );

      const defaultEvent = fireKey("Escape");
      expect(defaultEvent.defaultPrevented).toBe(false);
      unmount();

      renderHook(
        () => useKey("Escape", handler, { preventDefault: true }),
        { wrapper },
      );

      const preventedEvent = fireKey("Escape");
      expect(preventedEvent.defaultPrevented).toBe(true);
    });
  });
});
