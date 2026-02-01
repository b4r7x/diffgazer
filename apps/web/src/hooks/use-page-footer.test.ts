import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageFooter } from "./use-page-footer";
import type { Shortcut } from "@/components/layout";

/**
 * Tests for usePageFooter - Infinite Loop Fix Verification
 *
 * These tests verify that the usePageFooter hook correctly handles:
 * 1. Stable array references (single update)
 * 2. Unstable references with same content (no extra updates via deep equality)
 * 3. Content changes (triggers update)
 * 4. Empty/undefined rightShortcuts (defaults to empty array)
 * 5. Independent updates (only changed side updates)
 *
 * The hook uses deep equality checks (areShortcutsEqual) and refs to prevent
 * infinite render loops caused by inline array literals.
 */

// Mock the useFooter hook
const mockSetShortcuts = vi.fn();
const mockSetRightShortcuts = vi.fn();

vi.mock("@/components/layout", () => ({
  useFooter: () => ({
    setShortcuts: mockSetShortcuts,
    setRightShortcuts: mockSetRightShortcuts,
  }),
}));

describe("usePageFooter - Infinite Loop Fix", () => {
  beforeEach(() => {
    mockSetShortcuts.mockClear();
    mockSetRightShortcuts.mockClear();
  });

  describe("Stable reference - single update", () => {
    it("calls setShortcuts only once when same array reference is passed on re-render", () => {
      const shortcuts: Shortcut[] = [
        { key: "a", label: "Action A" },
        { key: "b", label: "Action B" },
      ];

      const { rerender } = renderHook(
        ({ shortcuts }) => usePageFooter({ shortcuts }),
        { initialProps: { shortcuts } }
      );

      // Initial render should call setShortcuts
      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetShortcuts).toHaveBeenCalledWith(shortcuts);

      mockSetShortcuts.mockClear();

      // Re-render with same reference - should NOT call setShortcuts again
      rerender({ shortcuts });

      expect(mockSetShortcuts).not.toHaveBeenCalled();
    });

    it("calls setRightShortcuts only once when same array reference is passed on re-render", () => {
      const shortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];
      const rightShortcuts: Shortcut[] = [{ key: "q", label: "Quit" }];

      const { rerender } = renderHook(
        ({ shortcuts, rightShortcuts }) => usePageFooter({ shortcuts, rightShortcuts }),
        { initialProps: { shortcuts, rightShortcuts } }
      );

      // Initial render
      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetRightShortcuts).toHaveBeenCalledWith(rightShortcuts);

      mockSetRightShortcuts.mockClear();

      // Re-render with same references - should NOT call setRightShortcuts again
      rerender({ shortcuts, rightShortcuts });

      expect(mockSetRightShortcuts).not.toHaveBeenCalled();
    });
  });

  describe("Unstable reference, same content - no extra updates", () => {
    it("does NOT call setShortcuts again when new array with identical content is passed", () => {
      const initialShortcuts: Shortcut[] = [
        { key: "a", label: "Action A" },
        { key: "b", label: "Action B" },
      ];

      const { rerender } = renderHook(
        ({ shortcuts }) => usePageFooter({ shortcuts }),
        { initialProps: { shortcuts: initialShortcuts } }
      );

      // Initial render
      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);

      mockSetShortcuts.mockClear();

      // Re-render with NEW array but SAME content (deep equality)
      const newShortcuts: Shortcut[] = [
        { key: "a", label: "Action A" },
        { key: "b", label: "Action B" },
      ];

      rerender({ shortcuts: newShortcuts });

      // Deep equality check should prevent update
      expect(mockSetShortcuts).not.toHaveBeenCalled();
    });

    it("does NOT call setRightShortcuts again when new array with identical content is passed", () => {
      const shortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];
      const initialRightShortcuts: Shortcut[] = [{ key: "q", label: "Quit" }];

      const { rerender } = renderHook(
        ({ shortcuts, rightShortcuts }) => usePageFooter({ shortcuts, rightShortcuts }),
        { initialProps: { shortcuts, rightShortcuts: initialRightShortcuts } }
      );

      // Initial render
      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);

      mockSetRightShortcuts.mockClear();

      // Re-render with NEW array but SAME content
      const newRightShortcuts: Shortcut[] = [{ key: "q", label: "Quit" }];
      rerender({ shortcuts, rightShortcuts: newRightShortcuts });

      expect(mockSetRightShortcuts).not.toHaveBeenCalled();
    });

    it("handles inline array literals correctly without infinite loops", () => {
      // This simulates the common case that caused infinite loops:
      // usePageFooter({ shortcuts: [{ key: "a", label: "Action" }] })
      // where a new array is created on every render

      let renderCount = 0;
      const { rerender } = renderHook(() => {
        renderCount++;
        // New array literal on every render (unstable reference)
        return usePageFooter({
          shortcuts: [{ key: "a", label: "Action A" }],
        });
      });

      // Initial render
      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);

      mockSetShortcuts.mockClear();

      // Force re-render
      rerender();

      // Deep equality should prevent update even with new array
      expect(mockSetShortcuts).not.toHaveBeenCalled();

      // Verify we didn't trigger infinite renders
      expect(renderCount).toBeLessThan(10);
    });
  });

  describe("Content change - triggers update", () => {
    it("calls setShortcuts when shortcut content changes", () => {
      const initialShortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];

      const { rerender } = renderHook(
        ({ shortcuts }) => usePageFooter({ shortcuts }),
        { initialProps: { shortcuts: initialShortcuts } }
      );

      // Initial render
      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetShortcuts).toHaveBeenCalledWith(initialShortcuts);

      mockSetShortcuts.mockClear();

      // Re-render with DIFFERENT content
      const newShortcuts: Shortcut[] = [{ key: "b", label: "Action B" }];
      rerender({ shortcuts: newShortcuts });

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetShortcuts).toHaveBeenCalledWith(newShortcuts);
    });

    it("calls setShortcuts when shortcut label changes", () => {
      const initialShortcuts: Shortcut[] = [{ key: "a", label: "Old Label" }];

      const { rerender } = renderHook(
        ({ shortcuts }) => usePageFooter({ shortcuts }),
        { initialProps: { shortcuts: initialShortcuts } }
      );

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);

      mockSetShortcuts.mockClear();

      // Same key, different label
      const newShortcuts: Shortcut[] = [{ key: "a", label: "New Label" }];
      rerender({ shortcuts: newShortcuts });

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetShortcuts).toHaveBeenCalledWith(newShortcuts);
    });

    it("calls setShortcuts when array length changes", () => {
      const initialShortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];

      const { rerender } = renderHook(
        ({ shortcuts }) => usePageFooter({ shortcuts }),
        { initialProps: { shortcuts: initialShortcuts } }
      );

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);

      mockSetShortcuts.mockClear();

      // Add another shortcut
      const newShortcuts: Shortcut[] = [
        { key: "a", label: "Action A" },
        { key: "b", label: "Action B" },
      ];
      rerender({ shortcuts: newShortcuts });

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetShortcuts).toHaveBeenCalledWith(newShortcuts);
    });

    it("calls setRightShortcuts when rightShortcut content changes", () => {
      const shortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];
      const initialRightShortcuts: Shortcut[] = [{ key: "q", label: "Quit" }];

      const { rerender } = renderHook(
        ({ shortcuts, rightShortcuts }) => usePageFooter({ shortcuts, rightShortcuts }),
        { initialProps: { shortcuts, rightShortcuts: initialRightShortcuts } }
      );

      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);

      mockSetRightShortcuts.mockClear();

      // Change rightShortcuts content
      const newRightShortcuts: Shortcut[] = [{ key: "h", label: "Help" }];
      rerender({ shortcuts, rightShortcuts: newRightShortcuts });

      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetRightShortcuts).toHaveBeenCalledWith(newRightShortcuts);
    });
  });

  describe("Empty/undefined rightShortcuts - defaults to empty", () => {
    it("does NOT call setRightShortcuts when rightShortcuts is undefined (initial ref is empty)", () => {
      const shortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];

      renderHook(() => usePageFooter({ shortcuts }));

      // NOTE: This is current behavior - when rightShortcuts is undefined, it becomes EMPTY_SHORTCUTS
      // which is [], and since the ref starts as [], the deep equality check passes, so setter is NOT called
      // This is a known limitation - the hook doesn't call setters when the value equals initial ref
      expect(mockSetRightShortcuts).not.toHaveBeenCalled();
    });

    it("uses stable EMPTY_SHORTCUTS reference for undefined rightShortcuts", () => {
      const shortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];

      const { rerender } = renderHook(
        ({ shortcuts }) => usePageFooter({ shortcuts }),
        { initialProps: { shortcuts } }
      );

      // Initial render - no call because [] === []
      expect(mockSetRightShortcuts).not.toHaveBeenCalled();

      mockSetRightShortcuts.mockClear();

      // Re-render with rightShortcuts still undefined
      rerender({ shortcuts });

      // Should NOT call setRightShortcuts again (stable reference)
      expect(mockSetRightShortcuts).not.toHaveBeenCalled();
    });

    it("does NOT call setRightShortcuts when empty array explicitly passed (initial ref is empty)", () => {
      const shortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];
      const rightShortcuts: Shortcut[] = [];

      renderHook(() => usePageFooter({ shortcuts, rightShortcuts }));

      // NOTE: Since ref starts as [], passing [] triggers deep equality which returns true
      // so the setter is NOT called on first render
      expect(mockSetRightShortcuts).not.toHaveBeenCalled();
    });
  });

  describe("Independent updates - only changed side updates", () => {
    it("only calls setShortcuts when shortcuts change, not setRightShortcuts", () => {
      const initialShortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];
      const rightShortcuts: Shortcut[] = [{ key: "q", label: "Quit" }];

      const { rerender } = renderHook(
        ({ shortcuts, rightShortcuts }) => usePageFooter({ shortcuts, rightShortcuts }),
        { initialProps: { shortcuts: initialShortcuts, rightShortcuts } }
      );

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);

      mockSetShortcuts.mockClear();
      mockSetRightShortcuts.mockClear();

      // Change ONLY shortcuts
      const newShortcuts: Shortcut[] = [{ key: "b", label: "Action B" }];
      rerender({ shortcuts: newShortcuts, rightShortcuts });

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetShortcuts).toHaveBeenCalledWith(newShortcuts);
      // rightShortcuts should NOT update
      expect(mockSetRightShortcuts).not.toHaveBeenCalled();
    });

    it("only calls setRightShortcuts when rightShortcuts change, not setShortcuts", () => {
      const shortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];
      const initialRightShortcuts: Shortcut[] = [{ key: "q", label: "Quit" }];

      const { rerender } = renderHook(
        ({ shortcuts, rightShortcuts }) => usePageFooter({ shortcuts, rightShortcuts }),
        { initialProps: { shortcuts, rightShortcuts: initialRightShortcuts } }
      );

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);

      mockSetShortcuts.mockClear();
      mockSetRightShortcuts.mockClear();

      // Change ONLY rightShortcuts
      const newRightShortcuts: Shortcut[] = [{ key: "h", label: "Help" }];
      rerender({ shortcuts, rightShortcuts: newRightShortcuts });

      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetRightShortcuts).toHaveBeenCalledWith(newRightShortcuts);
      // shortcuts should NOT update
      expect(mockSetShortcuts).not.toHaveBeenCalled();
    });

    it("calls both setters when both shortcuts and rightShortcuts change", () => {
      const initialShortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];
      const initialRightShortcuts: Shortcut[] = [{ key: "q", label: "Quit" }];

      const { rerender } = renderHook(
        ({ shortcuts, rightShortcuts }) => usePageFooter({ shortcuts, rightShortcuts }),
        { initialProps: { shortcuts: initialShortcuts, rightShortcuts: initialRightShortcuts } }
      );

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);

      mockSetShortcuts.mockClear();
      mockSetRightShortcuts.mockClear();

      // Change BOTH
      const newShortcuts: Shortcut[] = [{ key: "b", label: "Action B" }];
      const newRightShortcuts: Shortcut[] = [{ key: "h", label: "Help" }];
      rerender({ shortcuts: newShortcuts, rightShortcuts: newRightShortcuts });

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetShortcuts).toHaveBeenCalledWith(newShortcuts);
      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetRightShortcuts).toHaveBeenCalledWith(newRightShortcuts);
    });
  });

  describe("Edge cases", () => {
    it("does NOT call setShortcuts when empty array passed (matches initial ref)", () => {
      const shortcuts: Shortcut[] = [];

      renderHook(() => usePageFooter({ shortcuts }));

      // NOTE: Since ref starts as [], passing [] triggers deep equality which returns true
      // so the setter is NOT called on first render
      expect(mockSetShortcuts).not.toHaveBeenCalled();
    });

    it("handles transitioning from undefined to defined rightShortcuts", () => {
      const shortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];

      const { rerender } = renderHook(
        ({ shortcuts, rightShortcuts }: { shortcuts: Shortcut[]; rightShortcuts?: Shortcut[] }) =>
          usePageFooter({ shortcuts, rightShortcuts }),
        { initialProps: { shortcuts, rightShortcuts: undefined } }
      );

      // Initial render - undefined becomes EMPTY_SHORTCUTS [], which matches initial ref
      expect(mockSetRightShortcuts).not.toHaveBeenCalled();

      mockSetRightShortcuts.mockClear();

      // Add rightShortcuts - now it's non-empty so it will trigger update
      const rightShortcuts: Shortcut[] = [{ key: "q", label: "Quit" }];
      rerender({ shortcuts, rightShortcuts });

      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetRightShortcuts).toHaveBeenCalledWith(rightShortcuts);
    });

    it("handles transitioning from defined to undefined rightShortcuts", () => {
      const shortcuts: Shortcut[] = [{ key: "a", label: "Action A" }];
      const rightShortcuts: Shortcut[] = [{ key: "q", label: "Quit" }];

      const { rerender } = renderHook(
        ({ shortcuts, rightShortcuts }: { shortcuts: Shortcut[]; rightShortcuts?: Shortcut[] }) =>
          usePageFooter({ shortcuts, rightShortcuts }),
        { initialProps: { shortcuts, rightShortcuts } }
      );

      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetRightShortcuts).toHaveBeenCalledWith(rightShortcuts);

      mockSetRightShortcuts.mockClear();

      // Remove rightShortcuts
      rerender({ shortcuts, rightShortcuts: undefined });

      expect(mockSetRightShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetRightShortcuts).toHaveBeenCalledWith([]);
    });

    it("handles shortcuts with disabled property correctly", () => {
      const initialShortcuts: Shortcut[] = [
        { key: "a", label: "Action A", disabled: false },
      ];

      const { rerender } = renderHook(
        ({ shortcuts }) => usePageFooter({ shortcuts }),
        { initialProps: { shortcuts: initialShortcuts } }
      );

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);

      mockSetShortcuts.mockClear();

      // Change disabled property - should trigger update since disabled affects UI
      const newShortcuts: Shortcut[] = [
        { key: "a", label: "Action A", disabled: true },
      ];
      rerender({ shortcuts: newShortcuts });

      expect(mockSetShortcuts).toHaveBeenCalledTimes(1);
      expect(mockSetShortcuts).toHaveBeenCalledWith(newShortcuts);
    });
  });
});
