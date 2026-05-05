import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { KeyboardProvider } from "../providers/keyboard-provider";
import { useFocusZone } from "./use-focus-zone";
import { useKey } from "./use-key";
import { fireKey } from "../testing/test-utils";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(KeyboardProvider, null, children);
}

describe("useFocusZone", () => {
  afterEach(() => {
    cleanup();
  });

  describe("uncontrolled mode", () => {
    it("manages zone state", () => {
      const onZoneChange = vi.fn();
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
            onZoneChange,
          }),
        { wrapper },
      );

      expect(result.current.zone).toBe("main");

      act(() => result.current.setZone("sidebar"));
      expect(result.current.zone).toBe("sidebar");
      expect(onZoneChange).toHaveBeenCalledWith("sidebar");
    });
  });

  describe("forZone helper", () => {
    it("enables useKey only for the active zone and passes through extra options", () => {
      const handler = vi.fn();
      const { result } = renderHook(
        () => {
          const fz = useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
          });
          useKey("Enter", handler, fz.forZone("sidebar", { allowInInput: true }));
          return fz;
        },
        { wrapper },
      );

      // Handler should not fire when zone is "main"
      act(() => fireKey("Enter"));
      expect(handler).not.toHaveBeenCalled();

      // Handler fires after switching to matching zone
      act(() => result.current.setZone("sidebar"));
      act(() => fireKey("Enter"));
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("controlled mode", () => {
    it("uses zone prop instead of internal state and fires onZoneChange without updating", () => {
      const onZoneChange = vi.fn();
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
            zone: "sidebar",
            onZoneChange,
          }),
        { wrapper },
      );

      expect(result.current.zone).toBe("sidebar");

      act(() => result.current.setZone("main"));
      expect(onZoneChange).toHaveBeenCalledWith("main");
      expect(result.current.zone).toBe("sidebar");
    });
  });

  describe("transitions", () => {
    it("changes zone on arrow key when transition returns new zone", () => {
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
            transitions: ({ zone, key }) => {
              if (zone === "main" && key === "ArrowRight") return "sidebar";
              if (zone === "sidebar" && key === "ArrowLeft") return "main";
              return null;
            },
          }),
        { wrapper },
      );

      act(() => fireKey("ArrowRight"));
      expect(result.current.zone).toBe("sidebar");

      act(() => fireKey("ArrowLeft"));
      expect(result.current.zone).toBe("main");
    });

    it("does not change zone when transition returns zone not in zones array", () => {
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
            transitions: () => "unknown" as "main",
          }),
        { wrapper },
      );

      act(() => fireKey("ArrowRight"));
      expect(result.current.zone).toBe("main");
    });

  });

  describe("tab cycling", () => {
    it("cycles through zones with Tab in configured order", () => {
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "c",
            zones: ["a", "b", "c"],
            tabCycle: ["c", "a", "b"],
          }),
        { wrapper },
      );

      // Forward follows tabCycle order, not zones order
      act(() => fireKey("Tab"));
      expect(result.current.zone).toBe("a");

      act(() => fireKey("Tab"));
      expect(result.current.zone).toBe("b");

      // Wraps around
      act(() => fireKey("Tab"));
      expect(result.current.zone).toBe("c");

      // Backward with Shift+Tab
      act(() => fireKey("Tab", { shiftKey: true }));
      expect(result.current.zone).toBe("b");

      act(() => fireKey("Tab", { shiftKey: true }));
      expect(result.current.zone).toBe("a");

      act(() => fireKey("Tab", { shiftKey: true }));
      expect(result.current.zone).toBe("c");
    });
  });

  describe("enabled flag", () => {
    it("ignores all keyboard handling when disabled", () => {
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
            enabled: false,
            transitions: ({ key }) => {
              if (key === "ArrowRight") return "sidebar";
              return null;
            },
            tabCycle: ["main", "sidebar"],
          }),
        { wrapper },
      );

      act(() => fireKey("ArrowRight"));
      expect(result.current.zone).toBe("main");

      act(() => fireKey("Tab"));
      expect(result.current.zone).toBe("main");
    });
  });

  describe("helpers", () => {
    it("zoneProps, inZone, and forZone return correct values per zone", () => {
      const { result } = renderHook(
        () => useFocusZone({ initial: "main", zones: ["main", "sidebar", "footer"] }),
        { wrapper },
      );

      // zoneProps reflects active zone
      expect(result.current.zoneProps("main")).toEqual({ "data-focused": true });
      expect(result.current.zoneProps("sidebar")).toEqual({ "data-focused": undefined });

      // inZone checks single and multiple zones
      expect(result.current.inZone("main")).toBe(true);
      expect(result.current.inZone("sidebar")).toBe(false);
      expect(result.current.inZone("main", "sidebar")).toBe(true);
      expect(result.current.inZone("sidebar", "footer")).toBe(false);

      // After zone change, all helpers update
      act(() => result.current.setZone("sidebar"));

      expect(result.current.zoneProps("main")).toEqual({ "data-focused": undefined });
      expect(result.current.zoneProps("sidebar")).toEqual({ "data-focused": true });
      expect(result.current.inZone("main")).toBe(false);
      expect(result.current.inZone("sidebar")).toBe(true);
    });
  });

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

    it("works with a single zone", () => {
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "only",
            zones: ["only"],
            tabCycle: ["only"],
          }),
        { wrapper },
      );

      act(() => fireKey("Tab"));
      expect(result.current.zone).toBe("only");
    });
  });
});
