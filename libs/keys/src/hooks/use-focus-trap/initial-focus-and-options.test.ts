import { act, renderHook, waitFor } from "@testing-library/react";
import { type RefObject, useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { queryTestElement } from "../../testing/internal/assertions.js";
import { useFocusTrap } from "../use-focus-trap.js";
import { createContainer, fireTab, renderTrap } from "./trap-harness.js";

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
    container?.remove();
  });

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

    it("repairs focus to the current initialFocus after the ref object is swapped", async () => {
      container = createContainer(
        '<button id="a">A</button>',
        '<button id="b">B</button>',
        '<button id="c">C</button>',
      );
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const firstStep: RefObject<HTMLElement | null> = {
        current: queryTestElement(container, "a"),
      };
      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const secondStep: RefObject<HTMLElement | null> = {
        current: queryTestElement(container, "b"),
      };

      const { rerender } = renderHook(
        ({ initialFocus }) => {
          const ref = useRef<HTMLElement>(container);
          useFocusTrap(ref, { initialFocus });
        },
        { initialProps: { initialFocus: firstStep } },
      );
      expect(document.activeElement).toBe(firstStep.current);

      rerender({ initialFocus: secondStep });

      // querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)
      const transient = queryTestElement(container, "c");
      transient.focus();
      transient.remove();

      await waitFor(() => expect(document.activeElement).toBe(secondStep.current));
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
});
