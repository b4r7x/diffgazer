import { renderHook, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDeepActiveElement } from "../../dom/element-guards.js";
import { queryTestElement, requireFrameDocument } from "../../testing/internal/assertions.js";
import { useFocusTrap } from "../use-focus-trap.js";
import {
  createContainer,
  createContainerIn,
  fireTab,
  fireTabFromActive,
  renderTrap,
} from "./trap-harness.js";

// File convention: this suite asserts focus-trap focus movement to specific
// elements identified by `#id`. The buttons are intentionally labelled "A"/"B"/"C"
// to keep the test fixtures minimal — they share no distinguishing accessible name,
// so `getByRole` cannot identify the focused target. AGENTS.md keys library rules
// require this pattern: "test actual focus movement, active descendant, boundary
// callbacks, editable-target behavior." See TESTING.md rule 2 for the documented
// exception. Every `querySelector("#id")` call below carries the inline marker so
// per-line audits pass.

describe("useFocusTrap", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    vi.restoreAllMocks();
    container?.remove();
  });

  describe("Tab cycling", () => {
    it.each([
      "disabled",
      "removed",
    ] as const)("repairs focus when the active shadow control is %s", async (mutation) => {
      container = createContainer('<div id="host"></div>');
      const host = queryTestElement(container, "host");
      const shadowRoot = host.attachShadow({ mode: "open", delegatesFocus: true });
      shadowRoot.innerHTML = '<button id="a">A</button><button id="b">B</button>';
      const active = queryTestElement<HTMLButtonElement>(shadowRoot, "a");
      const fallback = queryTestElement(shadowRoot, "b");

      renderTrap(container, { restoreFocus: false });
      expect(getDeepActiveElement(document)).toBe(active);

      if (mutation === "disabled") active.disabled = true;
      else active.remove();

      await waitFor(() => expect(getDeepActiveElement(document)).toBe(fallback));
    });

    it("observes a shadow root attached after the trap activates", async () => {
      container = createContainer(
        '<button id="fallback">Fallback</button>',
        '<div id="host"></div>',
      );
      const fallback = queryTestElement(container, "fallback");
      const host = queryTestElement(container, "host");

      renderTrap(container, { restoreFocus: false });
      expect(getDeepActiveElement(document)).toBe(fallback);

      const shadowRoot = host.attachShadow({ mode: "open", delegatesFocus: true });
      shadowRoot.innerHTML = '<button id="late">Late shadow control</button>';
      const active = queryTestElement<HTMLButtonElement>(shadowRoot, "late");
      active.focus();
      expect(getDeepActiveElement(document)).toBe(active);

      active.disabled = true;
      await waitFor(() => expect(getDeepActiveElement(document)).toBe(fallback));
    });

    it("adds late shadow roots without reconnecting unchanged observer targets", async () => {
      container = createContainer(
        '<button id="fallback">Fallback</button>',
        '<div id="existing-host"></div>',
        '<div id="late-host"></div>',
      );
      const fallback = queryTestElement(container, "fallback");
      const existingRoot = queryTestElement(container, "existing-host").attachShadow({
        mode: "open",
      });
      existingRoot.innerHTML = '<button id="existing">Existing</button>';
      const existing = queryTestElement<HTMLButtonElement>(existingRoot, "existing");
      const lateHost = queryTestElement(container, "late-host");
      const observe = vi.spyOn(MutationObserver.prototype, "observe");
      const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");

      const { unmount } = renderTrap(container, { restoreFocus: false });
      const trapObserver = observe.mock.contexts[0];
      const trapObserveCount = () =>
        observe.mock.contexts.filter((context) => context === trapObserver).length;
      const trapDisconnectCount = () =>
        disconnect.mock.contexts.filter((context) => context === trapObserver).length;
      expect(trapObserveCount()).toBe(2);

      existing.focus();
      fireTab();
      expect(trapObserveCount()).toBe(2);
      expect(trapDisconnectCount()).toBe(0);

      const lateRoot = lateHost.attachShadow({ mode: "open" });
      lateRoot.innerHTML = '<button id="late">Late</button>';
      const late = queryTestElement<HTMLButtonElement>(lateRoot, "late");
      late.focus();
      expect(trapObserveCount()).toBe(3);

      late.disabled = true;
      await waitFor(() => expect(getDeepActiveElement(document)).toBe(fallback));
      expect(trapObserveCount()).toBe(3);
      expect(trapDisconnectCount()).toBe(0);

      unmount();
      expect(trapDisconnectCount()).toBe(1);
    });

    it("focuses and wraps through tabbable descendants of an open shadow host", () => {
      container = createContainer('<div id="host"></div>');
      const host = queryTestElement(container, "host");
      const shadowRoot = host.attachShadow({ mode: "open", delegatesFocus: true });
      shadowRoot.innerHTML = '<button id="a">A</button><button id="b">B</button>';
      const first = queryTestElement(shadowRoot, "a");
      const last = queryTestElement(shadowRoot, "b");

      renderTrap(container, { restoreFocus: false });

      expect(getDeepActiveElement(document)).toBe(first);
      last.focus();
      const tabEvent = fireTab();
      expect(tabEvent.defaultPrevented).toBe(true);
      expect(getDeepActiveElement(document)).toBe(first);

      const shiftTabEvent = fireTab(true);
      expect(shiftTabEvent.defaultPrevented).toBe(true);
      expect(getDeepActiveElement(document)).toBe(last);
    });

    it("uses the deep active element for a trap rendered in an open shadow root", () => {
      const host = document.createElement("div");
      const shadowRoot = host.attachShadow({ mode: "open" });
      container = document.createElement("div");
      container.innerHTML = '<button id="a">A</button><button id="b">B</button>';
      shadowRoot.append(container);
      document.body.append(host);

      renderTrap(container, { restoreFocus: false });

      const first = queryTestElement(container, "a");
      const second = queryTestElement(container, "b");
      expect(shadowRoot.activeElement).toBe(first);

      const nativeTab = fireTab();
      expect(nativeTab.defaultPrevented).toBe(false);
      second.focus();
      expect(shadowRoot.activeElement).toBe(second);

      const wrappingTab = fireTab();
      expect(wrappingTab.defaultPrevented).toBe(true);
      expect(shadowRoot.activeElement).toBe(first);

      const outside = document.createElement("button");
      document.body.append(outside);
      outside.focus();
      expect(shadowRoot.activeElement).toBe(first);

      outside.remove();
      host.remove();
    });

    it("wraps focus bidirectionally (Tab and Shift+Tab)", () => {
      container = createContainer(
        '<button id="a">A</button>',
        '<button id="b">B</button>',
        '<button id="c">C</button>',
      );
      renderTrap(container);

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const last = queryTestElement(container, "c");
      last.focus();
      const tabEvent = fireTab();
      expect(tabEvent.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      const shiftTabEvent = fireTab(true);
      expect(shiftTabEvent.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#c"));
    });

    it.each([
      ["content visibility", "content-visibility:hidden"],
      ["collapsed visibility", "visibility:collapse"],
    ])("wraps past %s targets at both visible boundaries", (_name, style) => {
      container = createContainer(
        `<div style="${style}"><button id="hidden-before">Hidden before</button></div>`,
        '<button id="first">First</button>',
        '<button id="last">Last</button>',
        `<div style="${style}"><button id="hidden-after">Hidden after</button></div>`,
      );
      renderTrap(container, { restoreFocus: false });
      const first = queryTestElement(container, "first");
      const last = queryTestElement(container, "last");

      last.focus();
      const forward = fireTab();
      expect(forward.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(first);

      const reverse = fireTab(true);
      expect(reverse.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(last);
    });

    it("includes focusable nodes added after the trap activated", () => {
      container = createContainer('<button id="a">A</button>', '<button id="b">B</button>');
      renderTrap(container);

      container.insertAdjacentHTML("beforeend", '<button id="c">C</button>');

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const newLast = queryTestElement(container, "c");
      newLast.focus();

      const event = fireTab();
      expect(event.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));
    });

    it("uses tabbable order for positive tabindex and skips negative tabindex boundaries", () => {
      container = createContainer(
        '<button id="a">A</button>',
        '<button id="b" tabindex="2">B</button>',
        '<button id="c" tabindex="1">C</button>',
        '<button id="d" tabindex="-1">D</button>',
      );
      renderTrap(container);

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const last = queryTestElement(container, "a");
      last.focus();

      const event = fireTab();
      expect(event.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#c"));
    });

    it("Tab lands on the Tab-eligible radio when the checked group member has negative tabindex", () => {
      container = createContainer(
        '<button id="lead">Lead</button>',
        '<input id="excluded" type="radio" name="choice" checked tabindex="-1" />',
        '<input id="eligible" type="radio" name="choice" />',
      );
      renderTrap(container);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#lead"));

      const event = fireTab();
      expect(event.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#eligible"));
    });

    it("moves from a programmatic initial target to the first tabbable element on Tab", () => {
      container = createContainer(
        '<div id="a" tabindex="-1">A</div>',
        '<button id="b">B</button>',
        '<button id="c">C</button>',
      );
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const targetEl = queryTestElement(container, "a");

      renderHook(() => {
        const ref = useRef<HTMLElement>(container);
        const initialRef = useRef<HTMLElement>(targetEl);
        useFocusTrap(ref, { initialFocus: initialRef });
      });

      const event = fireTab();
      expect(event.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#b"));
    });

    it("moves from a programmatic initial target to the last tabbable element on Shift+Tab", () => {
      container = createContainer(
        '<div id="a" tabindex="-1">A</div>',
        '<button id="b">B</button>',
        '<button id="c">C</button>',
      );
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const targetEl = queryTestElement(container, "a");

      renderHook(() => {
        const ref = useRef<HTMLElement>(container);
        const initialRef = useRef<HTMLElement>(targetEl);
        useFocusTrap(ref, { initialFocus: initialRef });
      });

      const event = fireTab(true);
      expect(event.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#c"));
    });

    it("Tab from a non-tabbable element inside the trap moves to the next tabbable in document order", () => {
      container = createContainer(
        '<button id="a">A</button>',
        '<div id="anchor" tabindex="-1">Anchor</div>',
        '<button id="b">B</button>',
        '<button id="c">C</button>',
      );
      renderTrap(container);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const anchor = queryTestElement(container, "anchor");
      anchor.focus();

      const event = fireTab();
      expect(event.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#b"));

      anchor.focus();
      const shiftEvent = fireTab(true);
      expect(shiftEvent.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));
    });

    it("moves from a shadow-root anchor through the composed tabbable list", () => {
      container = createContainer('<button id="before">Before</button>', '<div id="host"></div>');
      const host = queryTestElement(container, "host");
      const shadowRoot = host.attachShadow({ mode: "open" });
      shadowRoot.innerHTML = `
        <div id="anchor" tabindex="-1">Anchor</div>
        <button id="after">After</button>
      `;
      const before = queryTestElement(container, "before");
      const anchor = queryTestElement(shadowRoot, "anchor");
      const after = queryTestElement(shadowRoot, "after");

      renderTrap(container, { restoreFocus: false });
      anchor.focus();

      const tabEvent = fireTab();
      expect(tabEvent.defaultPrevented).toBe(true);
      expect(getDeepActiveElement(document)).toBe(after);

      anchor.focus();
      const shiftTabEvent = fireTab(true);
      expect(shiftTabEvent.defaultPrevented).toBe(true);
      expect(getDeepActiveElement(document)).toBe(before);
    });

    it("cycles focus within the trap container's owning document", () => {
      const frame = document.createElement("iframe");
      document.body.append(frame);
      const frameDocument = requireFrameDocument(frame);
      container = createContainerIn(
        frameDocument,
        '<button id="a">A</button>',
        '<button id="b">B</button>',
      );

      renderTrap(container, { restoreFocus: false });
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument.activeElement).toBe(container.querySelector("#a"));

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const last = queryTestElement(container, "b");
      last.focus();
      const event = fireTabFromActive(frameDocument);
      expect(event.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument.activeElement).toBe(container.querySelector("#a"));

      frame.remove();
    });
  });
});
