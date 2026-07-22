import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireKey, KeyboardWrapper } from "../../testing/test-utils.js";
import { useFocusZone } from "../use-focus-zone.js";
import { useKey } from "../use-key.js";

const wrapper = KeyboardWrapper;

describe("useFocusZone", () => {
  describe("uncontrolled mode", () => {
    it("tracks the active zone and notifies the listener on change", () => {
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
    it("enables useKey only for the active zone", () => {
      const handler = vi.fn();
      const { result } = renderHook(
        () => {
          const fz = useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
          });
          useKey("Enter", handler, fz.getKeyOptions("sidebar"));
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

    it("honors allowInInput so keys fire even when an input is focused", async () => {
      const user = userEvent.setup();
      const handler = vi.fn();

      function Host() {
        const focusZone = useFocusZone({
          initial: "search",
          zones: ["search"],
        });
        useKey("Enter", handler, focusZone.getKeyOptions("search", { allowInInput: true }));
        return createElement("input", { "aria-label": "Search" });
      }

      render(createElement(Host), { wrapper });

      screen.getByRole("textbox", { name: "Search" }).focus();
      await user.keyboard("{Enter}");

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
    it("routes transition keys only inside the focus-zone's declared scope", () => {
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
      const user = userEvent.setup();
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
      await user.keyboard("{ArrowRight}");
      expect(screen.getByLabelText("Current zone").textContent).toBe("main");

      insideButton.focus();
      await user.keyboard("{ArrowRight}");
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

    it("falls through to lower-priority listeners for arrow keys the zone does not route", () => {
      const lowerPriorityArrowDown = vi.fn();
      const transitions = vi.fn(({ zone, key }) => {
        if (zone === "filters" && key === "ArrowDown") return "list";
        if (zone === "list" && key === "ArrowRight") return "details";
        return null;
      });
      const { result } = renderHook(
        () => {
          useKey("ArrowDown", lowerPriorityArrowDown);
          const fz = useFocusZone({
            initial: "list",
            zones: ["filters", "list", "details"],
            transitions,
          });
          return fz;
        },
        { wrapper },
      );

      expect(transitions).not.toHaveBeenCalled();

      act(() => fireKey("ArrowDown"));
      expect(result.current.zone).toBe("list");
      expect(transitions).toHaveBeenCalledWith({ zone: "list", key: "ArrowDown" });
      expect(lowerPriorityArrowDown).toHaveBeenCalledOnce();
    });

    it("keeps transition preventDefault opt-in", () => {
      renderHook(
        () =>
          useFocusZone({
            initial: "list",
            zones: ["list", "details"],
            transitions: ({ zone, key }) => {
              if (zone === "list" && key === "ArrowRight") return "details";
              return null;
            },
          }),
        { wrapper },
      );

      expect(fireKey("ArrowRight").defaultPrevented).toBe(false);
    });
  });
});
