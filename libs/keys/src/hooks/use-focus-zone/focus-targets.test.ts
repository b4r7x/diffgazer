import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireKey, KeyboardWrapper } from "../../testing/test-utils.js";
import { useFocusZone } from "../use-focus-zone.js";
import { useKey } from "../use-key.js";

const wrapper = KeyboardWrapper;

describe("useFocusZone", () => {
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

    it("syncs the zone and bindings from focus inside an open shadow root", async () => {
      const shadowBinding = vi.fn();

      function Host() {
        const mainRef = useRef<HTMLDivElement>(null);
        const shadowARef = useRef<HTMLDivElement>(null);
        const shadowBRef = useRef<HTMLDivElement>(null);
        const shadowHostRef = useRef<HTMLDivElement>(null);
        const [ready, setReady] = useState(false);
        const focusZone = useFocusZone({
          initial: "main",
          zones: ["main", "shadow-a", "shadow-b"],
          focus: {
            targets: {
              main: mainRef,
              "shadow-a": shadowARef,
              "shadow-b": shadowBRef,
            },
          },
        });

        useKey("Enter", shadowBinding, focusZone.getKeyOptions("shadow-b"));

        useEffect(() => {
          const host = shadowHostRef.current;
          if (!host || host.shadowRoot) return;

          const shadowRoot = host.attachShadow({ mode: "open" });
          const shadowA = document.createElement("div");
          const shadowB = document.createElement("div");
          const shadowAButton = document.createElement("button");
          const shadowBButton = document.createElement("button");
          shadowA.dataset.zone = "shadow-a";
          shadowB.dataset.zone = "shadow-b";
          shadowAButton.type = "button";
          shadowBButton.type = "button";
          shadowAButton.textContent = "Shadow A";
          shadowBButton.textContent = "Shadow B";
          shadowA.append(shadowAButton);
          shadowB.append(shadowBButton);
          shadowRoot.append(shadowA, shadowB);
          shadowARef.current = shadowA;
          shadowBRef.current = shadowB;
          setReady(true);

          return () => {
            shadowARef.current = null;
            shadowBRef.current = null;
          };
        }, []);

        useEffect(() => {
          const zoneElements = [
            ["shadow-a", shadowARef.current],
            ["shadow-b", shadowBRef.current],
          ] as const;
          for (const [zone, element] of zoneElements) {
            if (focusZone.getZoneProps(zone)["data-focused"]) {
              element?.setAttribute("data-focused", "true");
            } else {
              element?.removeAttribute("data-focused");
            }
          }
        });

        return createElement(
          "div",
          null,
          createElement(
            "div",
            { ref: mainRef, ...focusZone.getZoneProps("main") },
            createElement("button", { type: "button" }, "Main"),
          ),
          createElement("div", { ref: shadowHostRef, "data-testid": "shadow-host" }),
          createElement("output", { "aria-label": "Shadow ready" }, ready ? "ready" : "pending"),
          createElement("output", { "aria-label": "Current zone" }, focusZone.zone),
        );
      }

      render(createElement(Host), { wrapper });

      await screen.findByText("ready");
      const shadowRoot = (screen.getByTestId("shadow-host") as HTMLDivElement).shadowRoot;
      expect(shadowRoot).not.toBeNull();

      const shadowA = shadowRoot?.querySelector<HTMLElement>('[data-zone="shadow-a"]');
      const shadowB = shadowRoot?.querySelector<HTMLElement>('[data-zone="shadow-b"]');
      const shadowBButton = shadowB?.querySelector<HTMLButtonElement>("button");
      expect(shadowA).not.toBeNull();
      expect(shadowB).not.toBeNull();
      expect(shadowBButton).not.toBeNull();

      act(() => shadowBButton?.focus());

      expect(screen.getByLabelText("Current zone").textContent).toBe("shadow-b");
      expect(shadowA?.hasAttribute("data-focused")).toBe(false);
      expect(shadowB?.hasAttribute("data-focused")).toBe(true);

      act(() => {
        shadowBButton?.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
            composed: true,
          }),
        );
      });

      expect(shadowBinding).toHaveBeenCalledOnce();
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
});
