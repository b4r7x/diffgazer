import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireKey, KeyboardWrapper } from "../../testing/test-utils.js";
import { useFocusZone } from "../use-focus-zone.js";
import { useKey } from "../use-key.js";

const wrapper = KeyboardWrapper;

describe("useFocusZone", () => {
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

    it("keeps outside Tab native and moves zone plus DOM focus inside FocusZonesDemo", async () => {
      vi.doMock("@diffgazer/keys", () => ({ useFocusZone, useKey }));
      try {
        const { FocusZonesDemo } = await import(
          "../../../examples/playground/src/demos/focus-zones.js"
        );

        function PlaygroundHost() {
          return createElement(
            "main",
            null,
            createElement("button", { type: "button" }, "Outside playground"),
            createElement(FocusZonesDemo),
          );
        }

        render(createElement(PlaygroundHost), { wrapper });

        const dispatchTab = (target: HTMLElement) => {
          const event = new KeyboardEvent("keydown", {
            key: "Tab",
            bubbles: true,
            cancelable: true,
          });
          act(() => {
            target.dispatchEvent(event);
          });
          return event;
        };

        const outside = screen.getByRole("button", { name: "Outside playground" });
        outside.focus();
        const outsideTab = dispatchTab(outside);
        expect(outsideTab.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(outside);

        const sidebar = screen.getByRole("button", { name: "sidebar" });
        sidebar.focus();
        const insideTab = dispatchTab(sidebar);

        expect(insideTab.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "content" }));
        expect(screen.getByText("content", { selector: ".demo-wrapper__scope" })).toBeTruthy();
      } finally {
        vi.doUnmock("@diffgazer/keys");
      }
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
});
