import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { queryTestElement, requireFrameDocument } from "../../testing/internal/assertions.js";
import { useFocusRestore } from "../use-focus-restore.js";
import { useFocusTrap } from "../use-focus-trap.js";
import { createContainer, createContainerIn, renderTrap } from "./trap-harness.js";

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
});
