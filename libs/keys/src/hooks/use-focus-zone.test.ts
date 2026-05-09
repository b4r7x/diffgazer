import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useRef, type ReactNode } from "react";
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

  describe("getKeyOptions helper", () => {
    it("enables useKey only for the active zone and passes through extra options", () => {
      const handler = vi.fn();
      const { result } = renderHook(
        () => {
          const fz = useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
          });
          useKey("Enter", handler, fz.getKeyOptions("sidebar", { allowInInput: true }));
          return fz;
        },
        { wrapper },
      );

      act(() => fireKey("Enter"));
      expect(handler).not.toHaveBeenCalled();

      act(() => result.current.setZone("sidebar"));
      act(() => fireKey("Enter"));
      expect(handler).toHaveBeenCalledOnce();
    });

    it("respects the top-level enabled state", () => {
      const handler = vi.fn();
      renderHook(
        () => {
          const fz = useFocusZone({
            initial: "sidebar",
            zones: ["main", "sidebar"],
            enabled: false,
          });
          useKey("Enter", handler, fz.getKeyOptions("sidebar"));
        },
        { wrapper },
      );

      act(() => fireKey("Enter"));
      expect(handler).not.toHaveBeenCalled();
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
    it("registers scoped transition keys in the declared focus-zone scope", () => {
      const globalHandler = vi.fn();
      const { result } = renderHook(
        () => {
          useKey("ArrowRight", globalHandler, { scope: "global" });
          return useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
            scope: "modal",
            transitions: ({ zone, key }) => {
              if (zone === "main" && key === "ArrowRight") return "sidebar";
              return null;
            },
          });
        },
        { wrapper },
      );

      act(() => fireKey("ArrowRight"));
      expect(result.current.zone).toBe("sidebar");
      expect(globalHandler).not.toHaveBeenCalled();
    });

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

    it("can require transition keys to originate inside a container subtree", async () => {
      function Host() {
        const containerRef = useRef<HTMLDivElement>(null);
        const focusZone = useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          containerRef,
          focusWithinOnly: true,
          transitions: ({ zone, key }) => {
            if (zone === "main" && key === "ArrowRight") return "sidebar";
            return null;
          },
        });

        return createElement(
          "div",
          null,
          createElement(
            "div",
            { ref: containerRef },
            createElement("button", { type: "button" }, "Inside"),
            createElement("output", { "aria-label": "Current zone" }, focusZone.zone),
          ),
          createElement("button", { type: "button" }, "Outside"),
        );
      }

      render(createElement(Host), { wrapper });

      const outsideButton = screen.getByRole("button", { name: "Outside" });
      const insideButton = screen.getByRole("button", { name: "Inside" });

      outsideButton.focus();
      await userEvent.keyboard("{ArrowRight}");
      expect(screen.getByLabelText("Current zone").textContent).toBe("main");

      insideButton.focus();
      await userEvent.keyboard("{ArrowRight}");
      expect(screen.getByLabelText("Current zone").textContent).toBe("sidebar");
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

      act(() => fireKey("Tab"));
      expect(result.current.zone).toBe("a");

      act(() => fireKey("Tab"));
      expect(result.current.zone).toBe("b");

      act(() => fireKey("Tab"));
      expect(result.current.zone).toBe("c");

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
    it("getZoneProps, isZone, and getKeyOptions return correct values per zone", () => {
      const { result } = renderHook(
        () => useFocusZone({ initial: "main", zones: ["main", "sidebar", "footer"] }),
        { wrapper },
      );

      expect(result.current.getZoneProps("main")).toEqual({ "data-focused": true });
      expect(result.current.getZoneProps("sidebar")).toEqual({ "data-focused": undefined });

      expect(result.current.isZone("main")).toBe(true);
      expect(result.current.isZone("sidebar")).toBe(false);
      expect(result.current.isZone("main", "sidebar")).toBe(true);
      expect(result.current.isZone("sidebar", "footer")).toBe(false);

      act(() => result.current.setZone("sidebar"));

      expect(result.current.getZoneProps("main")).toEqual({ "data-focused": undefined });
      expect(result.current.getZoneProps("sidebar")).toEqual({ "data-focused": true });
      expect(result.current.isZone("main")).toBe(false);
      expect(result.current.isZone("sidebar")).toBe(true);
      expect(result.current.getKeyOptions("sidebar")).toMatchObject({ enabled: true });
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
