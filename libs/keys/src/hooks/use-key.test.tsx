import { describe, it, expect, vi, afterEach } from "vitest";
import { render, renderHook, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState, type ReactNode } from "react";
import { KeyboardProvider } from "../providers/keyboard-provider";
import { useKey } from "./use-key";
import { useScope } from "./use-scope";
import { fireKey } from "../testing/test-utils";

function wrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

function strictWrapper({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <KeyboardProvider>{children}</KeyboardProvider>
    </StrictMode>
  );
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

    fireKey("Escape");
    expect(handler).not.toHaveBeenCalled();

    enabled = true;
    rerender();
    fireKey("Escape");
    expect(handler).toHaveBeenCalledWith(expect.any(KeyboardEvent));

    handler.mockClear();
    fireKey("Enter");
    expect(handler).not.toHaveBeenCalled();

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

    it("preserves punctuation keys when tracking registrations", () => {
      const handler = vi.fn();
      renderHook(() => useKey([",", "Enter"], handler), { wrapper });

      fireKey(",");
      expect(handler).toHaveBeenCalledTimes(1);

      fireKey("Enter");
      expect(handler).toHaveBeenCalledTimes(2);
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

    it("cleans up old keys and enables new keys when the key map changes", () => {
      const handler = vi.fn();
      let key = "ArrowUp";
      const { rerender } = renderHook(
        () => useKey({ [key]: handler }),
        { wrapper },
      );

      fireKey("ArrowUp");
      expect(handler).toHaveBeenCalledTimes(1);

      key = "ArrowDown";
      rerender();
      fireKey("ArrowUp");
      expect(handler).toHaveBeenCalledTimes(1);

      fireKey("ArrowDown");
      expect(handler).toHaveBeenCalledTimes(2);
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

  describe("scope registration", () => {
    it("keeps parent shortcuts in their original scope when a modal scope opens", () => {
      const openShortcut = vi.fn();
      const globalEscape = vi.fn();
      const modalEscape = vi.fn();

      function Modal({ onClose }: { onClose: () => void }) {
        useScope("modal");
        useKey("Escape", () => {
          modalEscape();
          onClose();
        });
        return null;
      }

      function TestApp() {
        const [open, setOpen] = useState(false);
        useKey("o", () => {
          openShortcut();
          setOpen(true);
        });
        useKey("Escape", globalEscape);
        return open ? <Modal onClose={() => setOpen(false)} /> : null;
      }

      render(<TestApp />, { wrapper });

      act(() => fireKey("o"));
      expect(openShortcut).toHaveBeenCalledOnce();

      act(() => fireKey("o"));
      expect(openShortcut).toHaveBeenCalledOnce();

      act(() => fireKey("Escape"));
      expect(modalEscape).toHaveBeenCalledOnce();
      expect(globalEscape).not.toHaveBeenCalled();

      act(() => fireKey("Escape"));
      expect(globalEscape).toHaveBeenCalledOnce();
    });

    it("keeps explicit scoped registrations across scope push and pop", () => {
      const modalEscape = vi.fn();
      let open = false;

      function TestApp() {
        useScope("modal", { enabled: open });
        useKey("Escape", modalEscape, { scope: "modal" });
        return null;
      }

      const { rerender } = render(<TestApp />, { wrapper });

      act(() => fireKey("Escape"));
      expect(modalEscape).not.toHaveBeenCalled();

      open = true;
      rerender(<TestApp />);
      act(() => fireKey("Escape"));
      expect(modalEscape).toHaveBeenCalledOnce();

      open = false;
      rerender(<TestApp />);
      act(() => fireKey("Escape"));
      expect(modalEscape).toHaveBeenCalledOnce();

      open = true;
      rerender(<TestApp />);
      act(() => fireKey("Escape"));
      expect(modalEscape).toHaveBeenCalledTimes(2);
    });
  });

  describe("without KeyboardProvider", () => {
    it("does not throw when used without KeyboardProvider", async () => {
      const handler = vi.fn();
      const { unmount } = renderHook(() => useKey("a", handler));
      await userEvent.keyboard("a");
      expect(handler).not.toHaveBeenCalled();
      unmount();
    });
  });

  describe("StrictMode cleanup", () => {
    it("does not leave duplicate registrations after StrictMode effect replay or unmount", () => {
      const handler = vi.fn();
      const { rerender, unmount } = renderHook(
        () => useKey("Escape", handler),
        { wrapper: strictWrapper },
      );

      fireKey("Escape");
      expect(handler).toHaveBeenCalledTimes(1);

      rerender();
      fireKey("Escape");
      expect(handler).toHaveBeenCalledTimes(2);

      unmount();
      fireKey("Escape");
      expect(handler).toHaveBeenCalledTimes(2);
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
