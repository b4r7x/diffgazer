import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fireKey, KeyboardWrapper } from "../../testing/test-utils.js";
import { useFocusZone } from "../use-focus-zone.js";

const wrapper = KeyboardWrapper;

describe("useFocusZone", () => {
  describe("edge cases", () => {
    it("falls back to first zone when initial is invalid", () => {
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "unknown" as "a",
            zones: ["a", "b"],
          }),
        { wrapper },
      );
      expect(result.current.zone).toBe("a");
    });

    it("does not prevent native Tab when tabCycle cannot move zones", () => {
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "only",
            zones: ["only"],
            tabCycle: ["only"],
          }),
        { wrapper },
      );

      const event = fireKey("Tab");
      expect(event.defaultPrevented).toBe(false);
      expect(result.current.zone).toBe("only");
    });

    it("does not prevent native Tab for an empty tabCycle", () => {
      renderHook(
        () =>
          useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
            tabCycle: [],
          }),
        { wrapper },
      );

      expect(fireKey("Tab").defaultPrevented).toBe(false);
    });
  });

  describe("tabCycle validation", () => {
    it("filters tabCycle entries that are not in zones", () => {
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "a",
            zones: ["a", "b"],
            tabCycle: ["a", "ghost" as "a", "b"],
          }),
        { wrapper },
      );

      // Tab should cycle only between valid zones in declared order: a -> b -> a
      act(() => fireKey("Tab"));
      expect(result.current.zone).toBe("b");
      act(() => fireKey("Tab"));
      expect(result.current.zone).toBe("a");
    });

    it("when current zone is not in tabCycle, Tab moves to first cycle entry and Shift+Tab to last", () => {
      const { result, unmount } = renderHook(
        () =>
          useFocusZone({
            initial: "a",
            zones: ["a", "b", "c"],
            tabCycle: ["b", "c"],
          }),
        { wrapper },
      );

      expect(result.current.zone).toBe("a");
      act(() => fireKey("Tab"));
      expect(result.current.zone).toBe("b");

      unmount();
      const { result: r2 } = renderHook(
        () =>
          useFocusZone({
            initial: "a",
            zones: ["a", "b", "c"],
            tabCycle: ["b", "c"],
          }),
        { wrapper },
      );
      act(() => fireKey("Tab", { shiftKey: true }));
      expect(r2.current.zone).toBe("c");
    });
  });

  describe("imperative setZone", () => {
    it("does not fire lifecycle callbacks when called with a zone not in zones", () => {
      const onZoneChange = vi.fn();
      const onLeaveZone = vi.fn();
      const onEnterZone = vi.fn();
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
            onZoneChange,
            onLeaveZone,
            onEnterZone,
          }),
        { wrapper },
      );

      act(() => result.current.setZone("ghost" as "main"));

      expect(onZoneChange).not.toHaveBeenCalled();
      expect(onLeaveZone).not.toHaveBeenCalled();
      expect(onEnterZone).not.toHaveBeenCalled();
      expect(result.current.zone).toBe("main");
    });

    it("does not fire lifecycle callbacks when called with the current zone", () => {
      const onZoneChange = vi.fn();
      const onLeaveZone = vi.fn();
      const onEnterZone = vi.fn();
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
            onZoneChange,
            onLeaveZone,
            onEnterZone,
          }),
        { wrapper },
      );

      act(() => result.current.setZone("main"));

      expect(onZoneChange).not.toHaveBeenCalled();
      expect(onLeaveZone).not.toHaveBeenCalled();
      expect(onEnterZone).not.toHaveBeenCalled();
      expect(result.current.zone).toBe("main");
    });

    it("fires lifecycle callbacks for valid setZone", () => {
      const onZoneChange = vi.fn();
      const onLeaveZone = vi.fn();
      const onEnterZone = vi.fn();
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
            onZoneChange,
            onLeaveZone,
            onEnterZone,
          }),
        { wrapper },
      );

      act(() => result.current.setZone("sidebar"));
      expect(onLeaveZone).toHaveBeenCalledWith("main");
      expect(onEnterZone).toHaveBeenCalledWith("sidebar");
      expect(onZoneChange).toHaveBeenCalledWith("sidebar");
    });
  });
});
