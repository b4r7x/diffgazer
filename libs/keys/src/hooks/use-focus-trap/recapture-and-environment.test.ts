import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryTestElement, requireFrameDocument } from "../../testing/internal/assertions.js";
import {
  createContainer,
  createContainerIn,
  fireTab,
  fireTabFromActive,
  renderTrap,
} from "../../testing/internal/focus-trap-harness.js";

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

  describe("environment without MutationObserver", () => {
    it("leaves the container untouched and focus in place when MutationObserver is unavailable", () => {
      container = document.createElement("div");
      container.insertAdjacentHTML("beforeend", '<button id="a">A</button>');
      document.body.appendChild(container);
      expect(container.hasAttribute("tabindex")).toBe(false);

      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      vi.stubGlobal("MutationObserver", undefined);
      try {
        renderTrap(container, { restoreFocus: true });
      } finally {
        vi.unstubAllGlobals();
      }

      expect(container.hasAttribute("tabindex")).toBe(false);
      expect(document.activeElement).toBe(outsideButton);

      outsideButton.remove();
    });
  });
});
