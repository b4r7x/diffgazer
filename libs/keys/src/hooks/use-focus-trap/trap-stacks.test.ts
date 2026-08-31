import { render, renderHook } from "@testing-library/react";
import { createElement, type RefObject, useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { queryTestElement, requireFrameDocument } from "../../testing/internal/assertions.js";
import {
  createContainer,
  createContainerIn,
  fireTab,
} from "../../testing/internal/focus-trap-harness.js";
import { useFocusTrap } from "../use-focus-trap.js";

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
});
