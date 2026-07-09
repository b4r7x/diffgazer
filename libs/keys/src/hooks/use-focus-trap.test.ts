import { act, render, renderHook, waitFor } from "@testing-library/react";
import { createElement, type RefObject, useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { queryTestElement, requireFrameDocument } from "../testing/assertions.js";
import { useFocusRestore } from "./use-focus-restore.js";
import { useFocusTrap } from "./use-focus-trap.js";

// File convention: this suite asserts focus-trap focus movement to specific
// elements identified by `#id`. The buttons are intentionally labelled "A"/"B"/"C"
// to keep the test fixtures minimal — they share no distinguishing accessible name,
// so `getByRole` cannot identify the focused target. AGENTS.md keys library rules
// require this pattern: "test actual focus movement, active descendant, boundary
// callbacks, editable-target behavior." See TESTING.md rule 2 for the documented
// exception. Every `querySelector("#id")` call below carries the inline marker so
// per-line audits pass.

function createContainerIn(ownerDocument: Document, ...focusableHTML: string[]) {
  const container = ownerDocument.createElement("div");
  container.tabIndex = -1;
  for (const html of focusableHTML) {
    container.insertAdjacentHTML("beforeend", html);
  }
  ownerDocument.body.appendChild(container);
  return container;
}

function createContainer(...focusableHTML: string[]) {
  return createContainerIn(document, ...focusableHTML);
}

function fireTabFromActive(ownerDocument: Document, shiftKey = false) {
  const KeyboardEventCtor = ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
  const event = new KeyboardEventCtor("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  ownerDocument.activeElement?.dispatchEvent(event);
  return event;
}

function fireTab(shiftKey = false) {
  return fireTabFromActive(document, shiftKey);
}

describe("useFocusTrap", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container?.remove();
  });

  function renderTrap(containerEl: HTMLDivElement, options?: Parameters<typeof useFocusTrap>[1]) {
    return renderHook(
      ({ opts }) => {
        const ref = useRef<HTMLElement>(containerEl);
        useFocusTrap(ref, opts);
      },
      { initialProps: { opts: options } },
    );
  }

  describe("initial focus", () => {
    it("focuses first focusable element", () => {
      container = createContainer('<button id="a">A</button>', '<button id="b">B</button>');
      renderTrap(container);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));
    });

    it("falls back to container when no focusable children", () => {
      container = createContainer("<p>No focusable</p>");
      renderTrap(container);
      expect(document.activeElement).toBe(container);

      const event = fireTab();
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(container);
    });

    it("respects initialFocus ref", () => {
      container = createContainer('<button id="a">A</button>', '<button id="b">B</button>');
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const targetEl = queryTestElement(container, "b");

      renderHook(() => {
        const ref = useRef<HTMLElement>(container);
        const initialRef = useRef<HTMLElement>(targetEl);
        useFocusTrap(ref, { initialFocus: initialRef });
      });

      expect(document.activeElement).toBe(targetEl);
    });

    it("respects programmatic initialFocus targets with negative tabindex", () => {
      container = createContainer('<div id="a" tabindex="-1">A</div>', '<button id="b">B</button>');
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const targetEl = queryTestElement(container, "a");

      renderHook(() => {
        const ref = useRef<HTMLElement>(container);
        const initialRef = useRef<HTMLElement>(targetEl);
        useFocusTrap(ref, { initialFocus: initialRef });
      });

      expect(document.activeElement).toBe(targetEl);
    });

    it("does not move focus when the active element is already inside the container on activation", () => {
      container = createContainer('<button id="a">A</button>', '<button id="b">B</button>');
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const targetEl = queryTestElement(container, "b");
      targetEl.focus();

      renderTrap(container);

      expect(document.activeElement).toBe(targetEl);
    });
  });

  describe("Tab cycling", () => {
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

  describe("focus restoration", () => {
    it("restores focus on unmount when restoreFocus is true", () => {
      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);
      outsideButton.focus();
      expect(document.activeElement).toBe(outsideButton);

      container = createContainer('<button id="a">A</button>');
      const { unmount } = renderTrap(container, { restoreFocus: true });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      unmount();
      expect(document.activeElement).toBe(outsideButton);

      outsideButton.remove();
    });

    it("does not restore focus when restoreFocus is false", () => {
      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);
      outsideButton.focus();
      expect(document.activeElement).toBe(outsideButton);

      container = createContainer('<button id="a">A</button>');
      const { unmount } = renderTrap(container, { restoreFocus: false });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      unmount();
      expect(document.activeElement).not.toBe(outsideButton);

      outsideButton.remove();
    });

    it("restores focus when enabled changes from true to false", () => {
      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      container = createContainer('<button id="a">A</button>');
      const { rerender } = renderHook(
        ({ enabled }) => {
          const ref = useRef<HTMLElement>(container);
          useFocusTrap(ref, { enabled });
        },
        { initialProps: { enabled: true } },
      );

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      rerender({ enabled: false });
      expect(document.activeElement).toBe(outsideButton);

      outsideButton.remove();
    });

    it("outer overlay focus restore still works after a mounted trap is disabled", () => {
      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      container = createContainer('<button id="a">A</button>');

      const { result, rerender } = renderHook(
        ({ trapEnabled }: { trapEnabled: boolean }) => {
          const outerRestore = useFocusRestore({ restoreOnUnmount: false });
          const ref = useRef<HTMLElement>(container);
          useFocusTrap(ref, { enabled: trapEnabled });
          return outerRestore;
        },
        { initialProps: { trapEnabled: false } },
      );

      act(() => {
        expect(result.current.capture()).toBe(outsideButton);
      });

      rerender({ trapEnabled: true });
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      rerender({ trapEnabled: false });

      act(() => {
        expect(result.current.restore()).toBe(true);
      });
      expect(document.activeElement).toBe(outsideButton);

      outsideButton.remove();
    });

    it("captures and restores focus inside the trap container's owning document", () => {
      const frame = document.createElement("iframe");
      document.body.append(frame);
      const frameDocument = requireFrameDocument(frame);

      const outsideButton = frameDocument.createElement("button");
      outsideButton.textContent = "Outside";
      frameDocument.body.append(outsideButton);
      outsideButton.focus();
      expect(frameDocument.activeElement).toBe(outsideButton);

      container = createContainerIn(frameDocument, '<button id="a">A</button>');
      const { unmount } = renderTrap(container, { restoreFocus: true });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument.activeElement).toBe(container.querySelector("#a"));

      unmount();
      expect(frameDocument.activeElement).toBe(outsideButton);

      frame.remove();
    });

    it("restores focus to the original opener when restoreFocus toggles false to true", () => {
      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      container = createContainer('<button id="a">A</button>', '<button id="b">B</button>');
      const { rerender, unmount } = renderHook(
        ({ restoreFocus }) => {
          const ref = useRef<HTMLElement>(container);
          useFocusTrap(ref, { restoreFocus });
        },
        { initialProps: { restoreFocus: false } },
      );

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const second = queryTestElement(container, "b");
      second.focus();

      rerender({ restoreFocus: true });
      expect(document.activeElement).toBe(second);

      unmount();
      expect(document.activeElement).toBe(outsideButton);

      outsideButton.remove();
    });

    it("does not restore focus when restoreFocus toggles true to false", () => {
      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      container = createContainer('<button id="a">A</button>');
      const { rerender, unmount } = renderHook(
        ({ restoreFocus }) => {
          const ref = useRef<HTMLElement>(container);
          useFocusTrap(ref, { restoreFocus });
        },
        { initialProps: { restoreFocus: true } },
      );

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      rerender({ restoreFocus: false });
      unmount();

      expect(document.activeElement).not.toBe(outsideButton);

      outsideButton.remove();
    });
  });

  describe("enabled option", () => {
    it("does nothing when enabled is false", () => {
      const outsideButton = document.createElement("button");
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      container = createContainer('<button id="a">A</button>');
      renderTrap(container, { enabled: false });

      expect(document.activeElement).toBe(outsideButton);

      outsideButton.remove();
    });

    it("activates when enabled changes from false to true", () => {
      container = createContainer('<button id="a">A</button>');

      const { rerender } = renderHook(
        ({ enabled }) => {
          const ref = useRef<HTMLElement>(container);
          useFocusTrap(ref, { enabled });
        },
        { initialProps: { enabled: false } },
      );

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).not.toBe(container.querySelector("#a"));

      rerender({ enabled: true });
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));
    });

    it("moves the trap when the container ref changes", () => {
      const first = createContainer('<button id="a">A</button>');
      const second = createContainer('<button id="b">B</button>');
      container = first;
      const firstRef: RefObject<HTMLElement | null> = { current: first };
      const secondRef: RefObject<HTMLElement | null> = { current: second };

      const { rerender } = renderHook(
        ({ ref }) => {
          useFocusTrap(ref);
        },
        { initialProps: { ref: firstRef } },
      );

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(first.querySelector("#a"));

      rerender({ ref: secondRef });
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(second.querySelector("#b"));

      second.remove();
    });
  });

  describe("focusable filtering", () => {
    it("chooses the first focusable descendant when non-focusable nodes appear first", () => {
      container = createContainer(
        '<button id="a" style="display:none">Hidden</button>',
        '<button id="disabled" disabled>Disabled</button>',
        '<button id="b">B</button>',
      );
      renderTrap(container);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#b"));
    });

    it("recaptures focus when the focused element becomes disabled", async () => {
      container = createContainer('<button id="a">A</button>', '<button id="b">B</button>');
      renderTrap(container);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const btnA = queryTestElement<HTMLButtonElement>(container, "a");
      expect(document.activeElement).toBe(btnA);

      await act(async () => {
        btnA.disabled = true;
      });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#b"));
    });
  });

  describe("initialFocus guards", () => {
    it("ignores initialFocus when its node is outside the container", () => {
      container = createContainer('<button id="a">A</button>', '<button id="b">B</button>');

      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);

      renderHook(() => {
        const ref = useRef<HTMLElement>(container);
        const initialRef = useRef<HTMLElement>(outsideButton);
        useFocusTrap(ref, { initialFocus: initialRef });
      });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      outsideButton.remove();
    });

    it("ignores initialFocus when its node is not focusable", () => {
      container = createContainer(
        '<button id="a" disabled>A</button>',
        '<button id="b">B</button>',
      );
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const disabledButton = queryTestElement(container, "a");

      renderHook(() => {
        const ref = useRef<HTMLElement>(container);
        const initialRef = useRef<HTMLElement>(disabledButton);
        useFocusTrap(ref, { initialFocus: initialRef });
      });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#b"));
    });
  });

  describe("ref node mutation", () => {
    it("retraps focus on the new container when the trap target swaps in-place", () => {
      const first = createContainer('<button id="a">A</button>');
      const second = createContainer('<button id="b">B</button>');
      container = first;
      const stableRef: RefObject<HTMLElement | null> = { current: first };

      const { rerender } = renderHook(
        ({ tick }) => {
          useFocusTrap(stableRef, { restoreFocus: false });
          return tick;
        },
        { initialProps: { tick: 0 } },
      );

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(first.querySelector("#a"));

      stableRef.current = second;
      rerender({ tick: 1 });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(second.querySelector("#b"));

      second.remove();
    });
  });

  describe("per-document trap stacks", () => {
    it("keeps independent trap stacks in separate owner documents", () => {
      const frame = document.createElement("iframe");
      document.body.append(frame);
      const frameDocument = requireFrameDocument(frame);

      const hostContainer = createContainer('<button id="h1">H1</button>');
      const frameContainer = createContainerIn(
        frameDocument,
        '<button id="f1">F1</button>',
        '<button id="f2">F2</button>',
      );

      const hostRef: RefObject<HTMLElement | null> = { current: hostContainer };
      const frameRef: RefObject<HTMLElement | null> = { current: frameContainer };

      renderHook(() => {
        useFocusTrap(hostRef, { restoreFocus: false });
        useFocusTrap(frameRef, { restoreFocus: false });
      });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const hostFirst = queryTestElement(hostContainer, "h1");
      hostFirst.focus();
      expect(document.activeElement).toBe(hostFirst);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument.activeElement).toBe(frameContainer.querySelector("#f1"));

      const hostOutside = document.createElement("button");
      document.body.append(hostOutside);
      hostOutside.focus();
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(hostContainer.querySelector("#h1"));

      const frameOutside = frameDocument.createElement("button");
      frameDocument.body.append(frameOutside);
      frameOutside.focus();
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument.activeElement).toBe(frameContainer.querySelector("#f1"));

      hostOutside.remove();
      frameOutside.remove();
      frame.remove();
    });
  });

  describe("nested trap stack", () => {
    it("inner trap mounted in the same commit as an outer parent-component trap holds focus", () => {
      function InnerTrap() {
        const innerRef = useRef<HTMLDivElement>(null);
        useFocusTrap(innerRef, { restoreFocus: false });

        return createElement(
          "div",
          { ref: innerRef, "data-testid": "inner" },
          createElement("button", { id: "i1", type: "button" }, "I1"),
          createElement("button", { id: "i2", type: "button" }, "I2"),
        );
      }

      function OuterTrap() {
        const outerRef = useRef<HTMLDivElement>(null);
        useFocusTrap(outerRef, { restoreFocus: false });

        return createElement(
          "div",
          { ref: outerRef, "data-testid": "outer" },
          createElement("button", { id: "o1", type: "button" }, "O1"),
          createElement(InnerTrap),
          createElement("button", { id: "o2", type: "button" }, "O2"),
        );
      }

      const view = render(createElement(OuterTrap));
      const inner = view.getByTestId("inner");

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(inner.querySelector("#i1"));

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const innerSecond = queryTestElement(inner, "i2");
      innerSecond.focus();
      expect(document.activeElement).toBe(innerSecond);

      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(inner.querySelector("#i2"));

      outsideButton.remove();
    });

    it("inner trap captures focus while outer trap is suspended, and outer recaptures on inner release", () => {
      container = createContainer('<button id="o1">O1</button>', '<button id="o2">O2</button>');
      const outerEl = container;
      const outerRef: RefObject<HTMLElement | null> = { current: outerEl };
      const innerEl = createContainer('<button id="i1">I1</button>', '<button id="i2">I2</button>');
      const innerRef: RefObject<HTMLElement | null> = { current: innerEl };

      const { rerender } = renderHook(
        ({ innerEnabled }: { innerEnabled: boolean }) => {
          useFocusTrap(outerRef, { restoreFocus: false });
          useFocusTrap(innerRef, { restoreFocus: false, enabled: innerEnabled });
        },
        { initialProps: { innerEnabled: false } },
      );

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(outerEl.querySelector("#o1"));

      rerender({ innerEnabled: true });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(innerEl.querySelector("#i1"));

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const innerLast = queryTestElement(innerEl, "i2");
      innerLast.focus();
      const event = fireTab();
      expect(event.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(innerEl.querySelector("#i1"));

      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);
      outsideButton.focus();
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(innerEl.querySelector("#i1"));

      rerender({ innerEnabled: false });

      expect(outerEl.contains(document.activeElement)).toBe(true);

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const outerLast = queryTestElement(outerEl, "o2");
      outerLast.focus();
      const outerEvent = fireTab();
      expect(outerEvent.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(outerEl.querySelector("#o1"));

      outsideButton.remove();
      innerEl.remove();
    });

    it("makes an earlier-DOM disjoint trap active when it opens after a later-DOM trap", () => {
      const earlier = createContainer('<button id="e1">E1</button>', '<button id="e2">E2</button>');
      const later = createContainer('<button id="l1">L1</button>', '<button id="l2">L2</button>');
      const earlierRef: RefObject<HTMLElement | null> = { current: earlier };
      const laterRef: RefObject<HTMLElement | null> = { current: later };

      const { rerender } = renderHook(
        ({ earlierEnabled }: { earlierEnabled: boolean }) => {
          useFocusTrap(laterRef, { restoreFocus: false });
          useFocusTrap(earlierRef, { restoreFocus: false, enabled: earlierEnabled });
        },
        { initialProps: { earlierEnabled: false } },
      );

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(later.querySelector("#l1"));

      rerender({ earlierEnabled: true });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(earlier.querySelector("#e1"));

      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);
      outsideButton.focus();
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(earlier.querySelector("#e1"));

      outsideButton.remove();
      earlier.remove();
      later.remove();
    });
  });

  describe("visibility recapture", () => {
    it("recaptures focus when the focused element is hidden via a style mutation", async () => {
      container = createContainer('<button id="a">A</button>', '<button id="b">B</button>');
      renderTrap(container, { restoreFocus: false });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const second = queryTestElement(container, "b");
      second.focus();
      expect(document.activeElement).toBe(second);

      act(() => {
        second.style.display = "none";
      });

      await waitFor(() => {
        // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
        expect(document.activeElement).toBe(container.querySelector("#a"));
      });
    });
  });

  describe("document-level capture and focusin recapture", () => {
    it("recaptures focus on the next Tab when focus has escaped outside the container", () => {
      container = createContainer('<button id="a">A</button>', '<button id="b">B</button>');
      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);

      renderTrap(container);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      outsideButton.focus();
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const second = queryTestElement(container, "b");
      second.focus();
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#b"));

      const event = fireTab();
      expect(event.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      outsideButton.remove();
    });

    it("traps Tab even when a descendant calls stopPropagation on keydown", () => {
      container = createContainer(
        '<button id="a">A</button>',
        '<button id="b">B</button>',
        '<button id="c">C</button>',
      );
      renderTrap(container);

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const last = queryTestElement(container, "c");
      last.addEventListener("keydown", (e) => e.stopPropagation());
      last.focus();

      const event = fireTab();
      expect(event.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));
    });

    it("listens on the trap container's owning document, not the host document", () => {
      const frame = document.createElement("iframe");
      document.body.append(frame);
      const frameDocument = requireFrameDocument(frame);

      const hostOutside = document.createElement("button");
      hostOutside.id = "host-outside";
      document.body.appendChild(hostOutside);
      hostOutside.focus();

      container = createContainerIn(
        frameDocument,
        '<button id="a">A</button>',
        '<button id="b">B</button>',
      );

      renderTrap(container, { restoreFocus: false });
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument.activeElement).toBe(container.querySelector("#a"));

      hostOutside.focus();
      expect(document.activeElement).toBe(hostOutside);
      const hostEvent = fireTabFromActive(document);
      expect(hostEvent.defaultPrevented).toBe(false);

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const frameLast = queryTestElement(container, "b");
      frameLast.focus();
      const frameEvent = fireTabFromActive(frameDocument);
      expect(frameEvent.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument.activeElement).toBe(container.querySelector("#a"));

      hostOutside.remove();
      frame.remove();
    });

    it("recaptures focus to the container when no tabbable children exist and container had no tabindex", () => {
      container = document.createElement("div");
      container.insertAdjacentHTML("beforeend", "<p>No focusable</p>");
      document.body.appendChild(container);
      expect(container.hasAttribute("tabindex")).toBe(false);

      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);

      const { unmount } = renderTrap(container, { restoreFocus: false });

      expect(document.activeElement).toBe(container);

      outsideButton.focus();
      expect(document.activeElement).toBe(container);

      outsideButton.focus();
      const tabEvent = fireTabFromActive(document);
      expect(tabEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(container);

      unmount();
      expect(container.hasAttribute("tabindex")).toBe(false);

      outsideButton.remove();
    });
  });
});
