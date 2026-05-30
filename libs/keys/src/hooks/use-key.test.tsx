import { describe, it, expect, vi, afterEach } from "vitest";
import { render, renderHook, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useKey } from "./use-key.js";
import { useScope } from "./use-scope.js";
import { fireKey, KeyboardWrapper, StrictKeyboardWrapper } from "../testing/test-utils.js";

describe("useKey", () => {
  afterEach(() => {
    cleanup();
  });

  it("hook lifecycle: registers, fires matching keys, respects enabled, and cleans up", () => {
    const handler = vi.fn();
    let enabled = false;
    const { rerender, unmount } = renderHook(
      () => useKey("Escape", handler, { enabled }),
      { wrapper: KeyboardWrapper },
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
      renderHook(() => useKey(["Enter", " "], handler), { wrapper: KeyboardWrapper });

      fireKey("Enter");
      expect(handler).toHaveBeenCalled();

      handler.mockClear();
      fireKey(" ");
      expect(handler).toHaveBeenCalled();
    });

    it("preserves punctuation keys when tracking registrations", () => {
      const handler = vi.fn();
      renderHook(() => useKey([",", "Enter"], handler), { wrapper: KeyboardWrapper });

      fireKey(",");
      expect(handler).toHaveBeenCalledOnce();

      handler.mockClear();
      fireKey("Enter");
      expect(handler).toHaveBeenCalledOnce();
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
        { wrapper: KeyboardWrapper },
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
        { wrapper: KeyboardWrapper },
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
        { wrapper: KeyboardWrapper },
      );

      fireKey("ArrowUp");
      // call-count IS the contract: handler fires once for old key before rebind
      expect(handler).toHaveBeenCalledTimes(1);

      key = "ArrowDown";
      rerender();
      fireKey("ArrowUp");
      // call-count IS the contract: handler must NOT fire for the old key after rebind (count stays at 1)
      expect(handler).toHaveBeenCalledTimes(1);

      fireKey("ArrowDown");
      // call-count IS the contract: handler fires for the new key after rebind (count increments to 2)
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
        { wrapper: KeyboardWrapper },
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

    it("keeps registration order stable across rerenders when the key set is unchanged", async () => {
      const user = userEvent.setup();
      const winner = vi.fn();

      // Two handlers on the same key. Dispatch is priority-ordered: the
      // last-registered handler wins (see the decline test above). If a rerender
      // re-registered the first handler, it would move to the tail and start
      // winning — so a stable winner across rerenders proves no re-registration.
      function First() {
        const [bump, setBump] = useState(0);
        useKey("x", () => {});
        return (
          <button type="button" onClick={() => setBump(bump + 1)}>
            Bump first
          </button>
        );
      }

      function Second() {
        useKey("x", winner);
        return null;
      }

      render(
        <>
          <First />
          <Second />
        </>,
        { wrapper: KeyboardWrapper },
      );

      act(() => fireKey("x"));
      expect(winner).toHaveBeenCalledTimes(1);

      // Re-render only First several times; its key set never changes.
      await user.click(screen.getByRole("button", { name: "Bump first" }));
      await user.click(screen.getByRole("button", { name: "Bump first" }));

      act(() => fireKey("x"));
      // Second still wins, proving First did not re-register to the tail.
      expect(winner).toHaveBeenCalledTimes(2);
    });
  });

  describe("handler return values", () => {
    it("lets a higher-priority handler decline a matched key", async () => {
      const user = userEvent.setup();

      function Consumer() {
        const [decline, setDecline] = useState(true);
        const [handledBy, setHandledBy] = useState("idle");

        useKey("a", () => setHandledBy("fallback"));
        useKey("a", () => {
          if (decline) return false;
          setHandledBy("primary");
          return;
        });

        return (
          <>
            <button type="button" onClick={() => setDecline(false)}>
              Handle primary
            </button>
            <output aria-label="Handled by">{handledBy}</output>
          </>
        );
      }

      render(<Consumer />, { wrapper: KeyboardWrapper });

      act(() => fireKey("a"));
      expect(screen.getByLabelText("Handled by").textContent).toBe("fallback");

      await user.click(screen.getByRole("button", { name: "Handle primary" }));
      act(() => fireKey("a"));
      expect(screen.getByLabelText("Handled by").textContent).toBe("primary");
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

      render(<TestApp />, { wrapper: KeyboardWrapper });

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

    it("does not register a parent implicit handler into a child scope during the same commit", () => {
      const parentHandler = vi.fn();
      const childHandler = vi.fn();

      function ChildScope() {
        useScope("modal");
        useKey("p", childHandler);
        return null;
      }

      function ParentWithKey() {
        useKey("p", parentHandler);
        return <ChildScope />;
      }

      render(<ParentWithKey />, { wrapper: KeyboardWrapper });

      act(() => fireKey("p"));

      expect(childHandler).toHaveBeenCalledOnce();
      expect(parentHandler).not.toHaveBeenCalled();
    });

    it("keeps explicit scoped registrations across scope push and pop", () => {
      const modalEscape = vi.fn();
      let open = false;

      function TestApp() {
        useScope("modal", { enabled: open });
        useKey("Escape", modalEscape, { scope: "modal" });
        return null;
      }

      const { rerender } = render(<TestApp />, { wrapper: KeyboardWrapper });

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
      // call-count IS the contract: re-opening the scope must re-fire the handler (count increments to 2, proving registration survives the push/pop/push cycle)
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
        { wrapper: StrictKeyboardWrapper },
      );

      fireKey("Escape");
      // call-count IS the contract: StrictMode must NOT cause duplicate registrations (count is 1, not 2)
      expect(handler).toHaveBeenCalledTimes(1);

      rerender();
      fireKey("Escape");
      // call-count IS the contract: rerender must NOT cause duplicate registrations (count is 2, not 3 or 4)
      expect(handler).toHaveBeenCalledTimes(2);

      unmount();
      fireKey("Escape");
      // call-count IS the contract: unmount cleanup must remove the registration (count stays at 2, no new call)
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe("options", () => {
    it("only calls preventDefault when explicitly enabled", () => {
      const handler = vi.fn();
      const { unmount } = renderHook(
        () => useKey("Escape", handler),
        { wrapper: KeyboardWrapper },
      );

      const defaultEvent = fireKey("Escape");
      expect(defaultEvent.defaultPrevented).toBe(false);
      unmount();

      renderHook(
        () => useKey("Escape", handler, { preventDefault: true }),
        { wrapper: KeyboardWrapper },
      );

      const preventedEvent = fireKey("Escape");
      expect(preventedEvent.defaultPrevented).toBe(true);
    });
  });
});
