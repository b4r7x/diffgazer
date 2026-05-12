import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useEffect, useRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { KeyboardProvider } from "../providers/keyboard-provider";
import { useFocusZone } from "./use-focus-zone";
import { useKey } from "./use-key";
import { fireKey, KeyboardWrapper } from "../testing/test-utils";

const wrapper = KeyboardWrapper;

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

    it("passes allowInInput through to useKey options", async () => {
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
      await userEvent.keyboard("{Enter}");

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

  describe("focus targets", () => {
    it("does not focus the initial zone target on mount", () => {
      function Host() {
        const mainRef = useRef<HTMLDivElement>(null);
        useFocusZone({
          initial: "main",
          zones: ["main"],
          focus: {
            targets: {
              main: mainRef,
            },
          },
        });

        return createElement("div", { ref: mainRef, tabIndex: -1 }, "Main");
      }

      render(createElement(Host), { wrapper });

      expect(document.activeElement).toBe(document.body);
    });

    it("focuses the initial zone target when autoFocus is enabled", () => {
      function Host() {
        const mainRef = useRef<HTMLDivElement>(null);
        useFocusZone({
          initial: "main",
          zones: ["main"],
          focus: {
            autoFocus: true,
            targets: {
              main: mainRef,
            },
          },
        });

        return createElement("div", { ref: mainRef, tabIndex: -1 }, "Main");
      }

      render(createElement(Host), { wrapper });

      expect(document.activeElement).toBe(screen.getByText("Main"));
    });

    it("focuses after autoFocus becomes enabled", () => {
      function Host() {
        const [enabled, setEnabled] = useState(false);
        const mainRef = useRef<HTMLDivElement>(null);
        useFocusZone({
          initial: "main",
          zones: ["main"],
          enabled,
          focus: {
            autoFocus: true,
            targets: {
              main: mainRef,
            },
          },
        });

        return createElement(
          "div",
          null,
          createElement("button", { type: "button", onClick: () => setEnabled(true) }, "Enable"),
          createElement("div", { ref: mainRef, tabIndex: -1 }, "Main"),
        );
      }

      render(createElement(Host), { wrapper });

      expect(document.activeElement).toBe(document.body);
      act(() => screen.getByRole("button", { name: "Enable" }).click());
      expect(document.activeElement).toBe(screen.getByText("Main"));
    });

    it("focuses the first focusable child when the zone target is a non-focusable container", () => {
      function Host() {
        const mainRef = useRef<HTMLDivElement>(null);
        useFocusZone({
          initial: "main",
          zones: ["main"],
          focus: {
            autoFocus: true,
            targets: {
              main: mainRef,
            },
          },
        });

        return createElement(
          "div",
          { ref: mainRef },
          createElement("button", { type: "button" }, "First"),
        );
      }

      render(createElement(Host), { wrapper });

      expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
    });

    it("focuses the active zone target when the zone changes", async () => {
      function Host() {
        const mainRef = useRef<HTMLDivElement>(null);
        const sidebarRef = useRef<HTMLDivElement>(null);
        const focusZone = useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          focus: {
            targets: {
              main: mainRef,
              sidebar: sidebarRef,
            },
          },
        });

        return createElement(
          "div",
          null,
          createElement("div", { ref: mainRef, tabIndex: -1 }, "Main"),
          createElement("div", { ref: sidebarRef, tabIndex: -1 }, "Sidebar"),
          createElement("button", { type: "button", onClick: () => focusZone.setZone("sidebar") }, "Move"),
        );
      }

      render(createElement(Host), { wrapper });

      await userEvent.click(screen.getByRole("button", { name: "Move" }));

      expect(document.activeElement).toBe(screen.getByText("Sidebar"));
    });

    it("repairs focus when returning to a targeted zone from a targetless zone", async () => {
      const user = userEvent.setup();

      function Host() {
        const [zone, setZone] = useState<"main" | "timeline">("main");
        const mainRef = useRef<HTMLDivElement>(null);

        useFocusZone({
          initial: "main",
          zones: ["main", "timeline"],
          zone,
          onZoneChange: setZone,
          focus: {
            autoFocus: true,
            targets: {
              main: mainRef,
            },
          },
        });

        return createElement(
          "div",
          null,
          createElement("div", { ref: mainRef, tabIndex: -1 }, "Main"),
          createElement("button", { type: "button", onClick: () => setZone("timeline") }, "Timeline"),
          createElement("button", { type: "button", onClick: () => setZone("main") }, "Main zone"),
        );
      }

      render(createElement(Host), { wrapper });

      expect(document.activeElement).toBe(screen.getByText("Main"));

      await user.click(screen.getByRole("button", { name: "Timeline" }));
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Timeline" }));

      await user.click(screen.getByRole("button", { name: "Main zone" }));
      expect(document.activeElement).toBe(screen.getByText("Main"));
    });

    it("syncs zone state from focus targets in another ownerDocument", async () => {
      function Host() {
        const mainRef = useRef<HTMLDivElement>(null);
        const iframeRef = useRef<HTMLIFrameElement>(null);
        const frameButtonRef = useRef<HTMLButtonElement | null>(null);
        const [ready, setReady] = useState(false);
        const focusZone = useFocusZone({
          initial: "main",
          zones: ["main", "frame"],
          focus: {
            targets: {
              main: mainRef,
              frame: () => frameButtonRef.current,
            },
          },
        });

        useEffect(() => {
          const doc = iframeRef.current?.contentDocument;
          if (!doc || frameButtonRef.current) return;

          const button = doc.createElement("button");
          button.type = "button";
          button.textContent = "Frame item";
          doc.body.append(button);
          frameButtonRef.current = button;
          setReady(true);

          return () => {
            button.remove();
            frameButtonRef.current = null;
          };
        }, []);

        return createElement(
          "div",
          null,
          createElement("div", { ref: mainRef }, createElement("button", { type: "button" }, "Main")),
          createElement("iframe", { ref: iframeRef, title: "Frame" }),
          createElement("output", { "aria-label": "Frame ready" }, ready ? "ready" : "pending"),
          createElement("output", { "aria-label": "Current zone" }, focusZone.zone),
        );
      }

      render(createElement(Host), { wrapper });

      await screen.findByText("ready");
      const iframe = screen.getByTitle("Frame") as HTMLIFrameElement;
      const frameButton = iframe.contentDocument?.body.querySelector<HTMLButtonElement>("button");
      expect(frameButton).not.toBeNull();

      act(() => frameButton?.focus());

      expect(screen.getByLabelText("Current zone").textContent).toBe("frame");
    });

    it("skips focus repair when the active element is already inside the zone container", async () => {
      function Host() {
        const [tick, setTick] = useState(0);
        const containerRef = useRef<HTMLDivElement>(null);
        const targetRef = useRef<HTMLButtonElement>(null);

        useFocusZone({
          initial: "main",
          zones: ["main"],
          focus: {
            targets: {
              main: {
                container: containerRef,
                target: targetRef,
              },
            },
          },
        });

        return createElement(
          "div",
          { ref: containerRef },
          createElement("button", { type: "button", ref: targetRef }, "First"),
          createElement("button", { type: "button", onClick: () => setTick((value) => value + 1) }, `Second ${tick}`),
        );
      }

      render(createElement(Host), { wrapper });

      const second = screen.getByRole("button", { name: /second/i });
      second.focus();
      await userEvent.click(second);

      expect(document.activeElement).toBe(second);
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

    it("does not prevent native Tab when tabCycle cannot move zones", () => {
      renderHook(
        () =>
          useFocusZone({
            initial: "only",
            zones: ["only"],
            tabCycle: ["only"],
          }),
        { wrapper },
      );

      expect(fireKey("Tab").defaultPrevented).toBe(false);
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
    it("warns during render when tabCycle contains invalid entries", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      function Consumer() {
        useFocusZone({
          initial: "a",
          zones: ["a", "b"],
          tabCycle: ["a", "ghost" as "a", "b"],
        });
        return null;
      }

      renderToString(createElement(KeyboardProvider, null, createElement(Consumer)));

      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it("filters tabCycle entries that are not in zones and warns in dev", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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

      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("when current zone is not in tabCycle, Tab moves to first cycle entry and Shift+Tab to last", () => {
      const { result } = renderHook(
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

      cleanup();
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
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
      warn.mockRestore();
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
