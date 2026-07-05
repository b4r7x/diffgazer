import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireKey, KeyboardWrapper } from "../testing/test-utils.js";
import { useFocusZone } from "./use-focus-zone.js";
import { useKey } from "./use-key.js";

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

  describe("tab cycling containment", () => {
    function ScopedTabHost() {
      const mainRef = useRef<HTMLDivElement>(null);
      const sidebarRef = useRef<HTMLDivElement>(null);
      const focusZone = useFocusZone({
        initial: "main",
        zones: ["main", "sidebar"],
        tabCycle: ["main", "sidebar"],
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
        createElement("button", { type: "button" }, "Outside"),
        createElement(
          "div",
          { ref: mainRef },
          createElement("button", { type: "button" }, "Main action"),
        ),
        createElement(
          "div",
          { ref: sidebarRef },
          createElement("button", { type: "button" }, "Sidebar action"),
        ),
        createElement("output", { "aria-label": "Active zone" }, focusZone.zone),
      );
    }

    it("does not prevent Tab and does not change zone when focus is outside every container", () => {
      render(createElement(ScopedTabHost), { wrapper });

      screen.getByRole("button", { name: "Outside" }).focus();

      const event = fireKey("Tab");
      expect(event.defaultPrevented).toBe(false);
      expect(screen.getByLabelText("Active zone").textContent).toBe("main");
    });

    it("prevents Tab and cycles the zone when focus is inside a registered container", () => {
      render(createElement(ScopedTabHost), { wrapper });

      screen.getByRole("button", { name: "Main action" }).focus();

      let event: KeyboardEvent | undefined;
      act(() => {
        event = fireKey("Tab");
      });
      expect(event?.defaultPrevented).toBe(true);
      expect(screen.getByLabelText("Active zone").textContent).toBe("sidebar");
    });

    it("keeps the legacy document-wide cycle when no containment is resolvable", () => {
      const { result } = renderHook(
        () =>
          useFocusZone({
            initial: "main",
            zones: ["main", "sidebar"],
            tabCycle: ["main", "sidebar"],
          }),
        { wrapper },
      );

      let event: KeyboardEvent | undefined;
      act(() => {
        event = fireKey("Tab");
      });
      expect(event?.defaultPrevented).toBe(true);
      expect(result.current.zone).toBe("sidebar");
    });
  });

  describe('tab cycling with tabCycleScope="document"', () => {
    function DocumentScopeHost({
      allowInInput,
      boundary,
    }: {
      allowInInput?: boolean;
      boundary?: "element" | "null";
    }) {
      const boundaryRef = useRef<HTMLDivElement>(null);
      const mainRef = useRef<HTMLDivElement>(null);
      const sidebarRef = useRef<HTMLDivElement>(null);
      const footerRef = useRef<HTMLDivElement>(null);
      const nullBoundary = () => null;
      let tabCycleBoundary: typeof boundaryRef | typeof nullBoundary | undefined;
      if (boundary === "element") {
        tabCycleBoundary = boundaryRef;
      } else if (boundary === "null") {
        tabCycleBoundary = nullBoundary;
      }
      const focusZone = useFocusZone({
        initial: "main",
        zones: ["main", "sidebar", "footer"],
        tabCycle: ["main", "sidebar", "footer"],
        tabCycleScope: "document",
        tabCycleBoundary,
        allowInInput,
        focus: {
          targets: {
            main: mainRef,
            sidebar: sidebarRef,
            footer: footerRef,
          },
        },
      });

      return createElement(
        "div",
        null,
        createElement("button", { type: "button" }, "Outside"),
        createElement("input", { "aria-label": "Outside input" }),
        createElement(
          "div",
          { ref: boundaryRef },
          createElement(
            "div",
            { ref: mainRef },
            createElement("button", { type: "button" }, "Main action"),
          ),
          createElement(
            "div",
            { ref: sidebarRef },
            createElement("button", { type: "button" }, "Sidebar action"),
          ),
          createElement(
            "div",
            { ref: footerRef },
            createElement("button", { type: "button" }, "Footer action"),
          ),
        ),
        createElement("output", { "aria-label": "Active zone" }, focusZone.zone),
      );
    }

    it("cycles zones and moves focus to the zone target when Tab originates outside every container", () => {
      render(createElement(DocumentScopeHost), { wrapper });

      screen.getByRole("button", { name: "Outside" }).focus();

      let event: KeyboardEvent | undefined;
      act(() => {
        event = fireKey("Tab");
      });
      expect(event?.defaultPrevented).toBe(true);
      expect(screen.getByLabelText("Active zone").textContent).toBe("sidebar");
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Sidebar action" }));
    });

    it("cycles backward with Shift+Tab when focus is outside every container", () => {
      render(createElement(DocumentScopeHost), { wrapper });

      screen.getByRole("button", { name: "Outside" }).focus();

      let event: KeyboardEvent | undefined;
      act(() => {
        event = fireKey("Tab", { shiftKey: true });
      });
      expect(event?.defaultPrevented).toBe(true);
      expect(screen.getByLabelText("Active zone").textContent).toBe("footer");
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Footer action" }));
    });

    it("keeps native Tab behavior on editable targets even with allowInInput", async () => {
      const user = userEvent.setup();
      render(createElement(DocumentScopeHost, { allowInInput: true }), { wrapper });

      const input = screen.getByRole("textbox", { name: "Outside input" });
      input.focus();
      await user.keyboard("{Tab}");

      expect(screen.getByLabelText("Active zone").textContent).toBe("main");
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Main action" }));
    });

    it("keeps native Tab behavior from an editable target inside an open shadow root", () => {
      function ShadowInputHost() {
        const hostRef = useRef<HTMLDivElement>(null);
        const mainRef = useRef<HTMLDivElement>(null);
        const sidebarRef = useRef<HTMLDivElement>(null);
        const focusZone = useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          tabCycle: ["main", "sidebar"],
          tabCycleScope: "document",
          allowInInput: true,
          focus: {
            targets: {
              main: mainRef,
              sidebar: sidebarRef,
            },
          },
        });

        useEffect(() => {
          const host = hostRef.current;
          if (!host || host.shadowRoot) return;

          const shadowRoot = host.attachShadow({ mode: "open" });
          const input = document.createElement("input");
          input.setAttribute("aria-label", "Shadow input");
          shadowRoot.append(input);
        }, []);

        return createElement(
          "div",
          null,
          createElement("div", { ref: hostRef, "data-shadow-host": "true" }),
          createElement(
            "div",
            { ref: mainRef },
            createElement("button", { type: "button" }, "Main action"),
          ),
          createElement(
            "div",
            { ref: sidebarRef },
            createElement("button", { type: "button" }, "Sidebar action"),
          ),
          createElement("output", { "aria-label": "Active zone" }, focusZone.zone),
        );
      }

      render(createElement(ShadowInputHost), { wrapper });

      const host = document.querySelector("[data-shadow-host='true']");
      const input = host?.shadowRoot?.querySelector("input");
      if (!input) throw new Error("Expected the shadow input to render");

      input.focus();
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      input.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(screen.getByLabelText("Active zone").textContent).toBe("main");
    });

    it("declines Tab while focus is outside the document-scope boundary", () => {
      render(createElement(DocumentScopeHost, { boundary: "element" }), { wrapper });

      screen.getByRole("button", { name: "Outside" }).focus();

      const event = fireKey("Tab");
      expect(event.defaultPrevented).toBe(false);
      expect(screen.getByLabelText("Active zone").textContent).toBe("main");
    });

    it("claims Tab and cycles while focus is inside the document-scope boundary", () => {
      render(createElement(DocumentScopeHost, { boundary: "element" }), { wrapper });

      screen.getByRole("button", { name: "Main action" }).focus();

      let event: KeyboardEvent | undefined;
      act(() => {
        event = fireKey("Tab");
      });
      expect(event?.defaultPrevented).toBe(true);
      expect(screen.getByLabelText("Active zone").textContent).toBe("sidebar");
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Sidebar action" }));
    });

    it("cycles document-wide when the document-scope boundary resolves null", () => {
      render(createElement(DocumentScopeHost, { boundary: "null" }), { wrapper });

      screen.getByRole("button", { name: "Outside" }).focus();

      let event: KeyboardEvent | undefined;
      act(() => {
        event = fireKey("Tab");
      });
      expect(event?.defaultPrevented).toBe(true);
      expect(screen.getByLabelText("Active zone").textContent).toBe("sidebar");
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
      const user = userEvent.setup();
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
          createElement(
            "button",
            { type: "button", onClick: () => focusZone.setZone("sidebar") },
            "Move",
          ),
        );
      }

      render(createElement(Host), { wrapper });

      await user.click(screen.getByRole("button", { name: "Move" }));

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
          createElement(
            "button",
            { type: "button", onClick: () => setZone("timeline") },
            "Timeline",
          ),
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
          createElement(
            "div",
            { ref: mainRef },
            createElement("button", { type: "button" }, "Main"),
          ),
          createElement("iframe", { ref: iframeRef, title: "Frame" }),
          createElement("output", { "aria-label": "Frame ready" }, ready ? "ready" : "pending"),
          createElement("output", { "aria-label": "Current zone" }, focusZone.zone),
        );
      }

      render(createElement(Host), { wrapper });

      await screen.findByText("ready");
      const iframe = screen.getByTitle("Frame") as HTMLIFrameElement;
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md) — cross-realm iframe content is outside RTL screen scope
      const frameButton = iframe.contentDocument?.body.querySelector<HTMLButtonElement>("button");
      expect(frameButton).not.toBeNull();

      act(() => frameButton?.focus());

      expect(screen.getByLabelText("Current zone").textContent).toBe("frame");
    });

    it("skips focus repair when the active element is already inside the zone container", async () => {
      const user = userEvent.setup();
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
          createElement(
            "button",
            { type: "button", onClick: () => setTick((value) => value + 1) },
            `Second ${tick}`,
          ),
        );
      }

      render(createElement(Host), { wrapper });

      const second = screen.getByRole("button", { name: /second/i });
      second.focus();
      await user.click(second);

      expect(document.activeElement).toBe(second);
    });

    it("moves DOM focus across zones when Tab cycles between zone targets", async () => {
      function Host() {
        const mainRef = useRef<HTMLDivElement>(null);
        const sidebarRef = useRef<HTMLDivElement>(null);

        useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          tabCycle: ["main", "sidebar"],
          focus: {
            autoFocus: true,
            targets: {
              main: mainRef,
              sidebar: sidebarRef,
            },
          },
        });

        return createElement(
          "div",
          null,
          createElement(
            "div",
            { ref: mainRef },
            createElement("button", { type: "button" }, "Main action"),
          ),
          createElement(
            "div",
            { ref: sidebarRef },
            createElement("button", { type: "button" }, "Sidebar action"),
          ),
        );
      }

      render(createElement(Host), { wrapper });

      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Main action" }));

      act(() => fireKey("Tab"));
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Sidebar action" }));

      act(() => fireKey("Tab", { shiftKey: true }));
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Main action" }));
    });
  });

  describe("focusin listener stability", () => {
    it("attaches the document focusin listener once across consumer re-renders", () => {
      const addSpy = vi.spyOn(document, "addEventListener");
      const removeSpy = vi.spyOn(document, "removeEventListener");

      function Host() {
        const [tick, setTick] = useState(0);
        const mainRef = useRef<HTMLDivElement>(null);
        useFocusZone({
          initial: "main",
          zones: ["main"],
          // Inline focus/transitions objects re-created on every render.
          focus: { targets: { main: mainRef } },
          transitions: () => null,
        });

        return createElement(
          "div",
          null,
          createElement("div", { ref: mainRef, tabIndex: -1 }, "Main"),
          createElement(
            "button",
            { type: "button", onClick: () => setTick((value) => value + 1) },
            `Tick ${tick}`,
          ),
        );
      }

      const { unmount } = render(createElement(Host), { wrapper });

      const focusinAdds = () => addSpy.mock.calls.filter(([type]) => type === "focusin").length;
      const focusinRemoves = () =>
        removeSpy.mock.calls.filter(([type]) => type === "focusin").length;

      expect(focusinAdds()).toBe(1);

      act(() => screen.getByRole("button", { name: /tick/i }).click());
      act(() => screen.getByRole("button", { name: /tick/i }).click());

      expect(focusinAdds()).toBe(1);
      expect(focusinRemoves()).toBe(0);

      unmount();
      expect(focusinRemoves()).toBe(1);

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it("detaches the focusin listener when the hook is disabled", () => {
      const removeSpy = vi.spyOn(document, "removeEventListener");

      function Host({ enabled }: { enabled: boolean }) {
        const mainRef = useRef<HTMLDivElement>(null);
        useFocusZone({
          initial: "main",
          zones: ["main"],
          enabled,
          focus: { targets: { main: mainRef } },
        });
        return createElement("div", { ref: mainRef, tabIndex: -1 }, "Main");
      }

      const { rerender } = render(createElement(Host, { enabled: true }), { wrapper });
      expect(removeSpy.mock.calls.filter(([type]) => type === "focusin")).toHaveLength(0);

      rerender(createElement(Host, { enabled: false }));
      expect(removeSpy.mock.calls.filter(([type]) => type === "focusin")).toHaveLength(1);

      removeSpy.mockRestore();
    });

    it("still moves focus to the new zone target when the zone changes after a re-render", async () => {
      const user = userEvent.setup();
      function Host() {
        const [tick, setTick] = useState(0);
        const mainRef = useRef<HTMLDivElement>(null);
        const sidebarRef = useRef<HTMLDivElement>(null);
        const focusZone = useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          focus: { targets: { main: mainRef, sidebar: sidebarRef } },
        });

        return createElement(
          "div",
          null,
          createElement("div", { ref: mainRef, tabIndex: -1 }, "Main"),
          createElement("div", { ref: sidebarRef, tabIndex: -1 }, "Sidebar"),
          createElement(
            "button",
            { type: "button", onClick: () => setTick((value) => value + 1) },
            `Tick ${tick}`,
          ),
          createElement(
            "button",
            { type: "button", onClick: () => focusZone.setZone("sidebar") },
            "Move",
          ),
        );
      }

      render(createElement(Host), { wrapper });

      // Re-render several times so the autofocus effect has stale-closure risk.
      act(() => screen.getByRole("button", { name: /tick/i }).click());
      act(() => screen.getByRole("button", { name: /tick/i }).click());

      await user.click(screen.getByRole("button", { name: "Move" }));
      expect(document.activeElement).toBe(screen.getByText("Sidebar"));
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
