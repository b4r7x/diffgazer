import { describe, it, expect, afterEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import { useRef, type RefObject } from "react";
import { useFocusTrap } from "./use-focus-trap";

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
    cleanup();
    container?.remove();
  });

  function renderTrap(
    containerEl: HTMLDivElement,
    options?: Parameters<typeof useFocusTrap>[1],
  ) {
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
      container = createContainer(
        '<button id="a">A</button>',
        '<button id="b">B</button>',
      );
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
      container = createContainer(
        '<button id="a">A</button>',
        '<button id="b">B</button>',
      );
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const targetEl = container.querySelector<HTMLElement>("#b")!;

      renderHook(() => {
        const ref = useRef<HTMLElement>(container);
        const initialRef = useRef<HTMLElement>(targetEl);
        useFocusTrap(ref, { initialFocus: initialRef });
      });

      expect(document.activeElement).toBe(targetEl);
    });

    it("respects programmatic initialFocus targets with negative tabindex", () => {
      container = createContainer(
        '<div id="a" tabindex="-1">A</div>',
        '<button id="b">B</button>',
      );
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const targetEl = container.querySelector<HTMLElement>("#a")!;

      renderHook(() => {
        const ref = useRef<HTMLElement>(container);
        const initialRef = useRef<HTMLElement>(targetEl);
        useFocusTrap(ref, { initialFocus: initialRef });
      });

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
      const last = container.querySelector<HTMLElement>("#c")!;
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
      container = createContainer(
        '<button id="a">A</button>',
        '<button id="b">B</button>',
      );
      renderTrap(container);

      container.insertAdjacentHTML("beforeend", '<button id="c">C</button>');

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const newLast = container.querySelector<HTMLElement>("#c")!;
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
      const last = container.querySelector<HTMLElement>("#a")!;
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
      const targetEl = container.querySelector<HTMLElement>("#a")!;

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
      const targetEl = container.querySelector<HTMLElement>("#a")!;

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

    it("cycles focus within the trap container's owning document", () => {
      const frame = document.createElement("iframe");
      document.body.append(frame);
      const frameDocument = frame.contentDocument;
      expect(frameDocument).not.toBeNull();
      container = createContainerIn(
        frameDocument!,
        '<button id="a">A</button>',
        '<button id="b">B</button>',
      );

      renderTrap(container, { restoreFocus: false });
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument!.activeElement).toBe(container.querySelector("#a"));

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const last = container.querySelector<HTMLElement>("#b")!;
      last.focus();
      const event = fireTabFromActive(frameDocument!);
      expect(event.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument!.activeElement).toBe(container.querySelector("#a"));

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

    it("captures and restores focus inside the trap container's owning document", () => {
      const frame = document.createElement("iframe");
      document.body.append(frame);
      const frameDocument = frame.contentDocument;
      expect(frameDocument).not.toBeNull();

      const outsideButton = frameDocument!.createElement("button");
      outsideButton.textContent = "Outside";
      frameDocument!.body.append(outsideButton);
      outsideButton.focus();
      expect(frameDocument!.activeElement).toBe(outsideButton);

      container = createContainerIn(frameDocument!, '<button id="a">A</button>');
      const { unmount } = renderTrap(container, { restoreFocus: true });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument!.activeElement).toBe(container.querySelector("#a"));

      unmount();
      expect(frameDocument!.activeElement).toBe(outsideButton);

      frame.remove();
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
  });

  describe("initialFocus guards", () => {
    it("ignores initialFocus when its node is outside the container", () => {
      container = createContainer(
        '<button id="a">A</button>',
        '<button id="b">B</button>',
      );

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
      const disabledButton = container.querySelector<HTMLElement>("#a")!;

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

  describe("document-level capture and focusin recapture", () => {
    it("recaptures focus on the next Tab when focus has escaped outside the container", () => {
      container = createContainer(
        '<button id="a">A</button>',
        '<button id="b">B</button>',
      );
      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);

      renderTrap(container);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      // Focus escapes outside the container — the document-level focusin
      // listener should recapture back to the last in-trap element.
      outsideButton.focus();
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#a"));

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const second = container.querySelector<HTMLElement>("#b")!;
      second.focus();
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(document.activeElement).toBe(container.querySelector("#b"));

      // Tab from in-trap should still wrap correctly after a prior escape.
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
      const last = container.querySelector<HTMLElement>("#c")!;
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
      const frameDocument = frame.contentDocument;
      expect(frameDocument).not.toBeNull();

      const hostOutside = document.createElement("button");
      hostOutside.id = "host-outside";
      document.body.appendChild(hostOutside);
      hostOutside.focus();

      container = createContainerIn(
        frameDocument!,
        '<button id="a">A</button>',
        '<button id="b">B</button>',
      );

      renderTrap(container, { restoreFocus: false });
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument!.activeElement).toBe(container.querySelector("#a"));

      // Tab in the host document must NOT be intercepted by the iframe trap.
      hostOutside.focus();
      expect(document.activeElement).toBe(hostOutside);
      const hostEvent = fireTabFromActive(document);
      expect(hostEvent.defaultPrevented).toBe(false);

      // Tab inside the iframe document IS intercepted.
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const frameLast = container.querySelector<HTMLElement>("#b")!;
      frameLast.focus();
      const frameEvent = fireTabFromActive(frameDocument!);
      expect(frameEvent.defaultPrevented).toBe(true);
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      expect(frameDocument!.activeElement).toBe(container.querySelector("#a"));

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

      // Trap activation focuses the container after assigning tabindex=-1.
      expect(document.activeElement).toBe(container);

      // Focus escapes; document-level focusin recaptures to the container.
      outsideButton.focus();
      expect(document.activeElement).toBe(container);

      // Tab from outside the trap is intercepted via document-level capture and
      // refocuses the container (since it is the only focusable target).
      outsideButton.focus();
      const tabEvent = fireTabFromActive(document);
      expect(tabEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(container);

      unmount();
      // Trap teardown removes the temporary tabindex it assigned.
      expect(container.hasAttribute("tabindex")).toBe(false);

      outsideButton.remove();
    });
  });
});
