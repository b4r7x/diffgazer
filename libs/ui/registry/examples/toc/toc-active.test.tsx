import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TocActive from "./toc-active";

// jsdom reports every box as zero-sized, so layout is stubbed: the demo's pane
// shows all of its content at once (nothing left to scroll) and the headings sit
// below each other. The marker must follow the heading the reader can see.
const HEADING_TOPS: Record<string, number> = {
  overview: 16,
  installation: 320,
  npm: 640,
  pnpm: 960,
  usage: 1280,
};
const PANE_HEIGHT = 1600;

// Heading ids are namespaced per instance, so the stub matches on the slug
// suffix. A bare id (a host page's own anchor) stays at the top of the pane.
function topOf(id: string): number {
  const slug = Object.keys(HEADING_TOPS).find((key) => id.endsWith(`-${key}`));
  return slug ? (HEADING_TOPS[slug] ?? 0) : 0;
}

function stubUnscrolledLayout() {
  const paneSize = {
    configurable: true,
    get(this: HTMLElement): number {
      return this.classList.contains("overflow-y-auto") ? PANE_HEIGHT : 0;
    },
  };

  Object.defineProperty(HTMLElement.prototype, "clientHeight", paneSize);
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", paneSize);
  const originalRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function rect(this: Element): DOMRect {
    const top = topOf(this.id);
    return {
      x: 0,
      y: top,
      width: 100,
      height: 20,
      top,
      right: 100,
      bottom: top + 20,
      left: 0,
      toJSON() {},
    };
  };

  return () => {
    Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
    Element.prototype.getBoundingClientRect = originalRect;
  };
}

describe("TocActive", () => {
  it.each([
    { id: "overview", title: "Overview", level: 2 },
    { id: "installation", title: "Installation", level: 2 },
    { id: "npm", title: "npm", level: 3 },
    { id: "pnpm", title: "pnpm", level: 3 },
    { id: "usage", title: "Usage", level: 2 },
  ])("renders $title depth as an h$level target", ({ id, title, level }) => {
    render(<TocActive />);

    const headingId = screen.getByRole("heading", { name: title, level }).id;
    expect(headingId).not.toBe(id);
    expect(headingId.endsWith(`-${id}`)).toBe(true);
    expect(screen.getByRole("link", { name: title })).toHaveAttribute("href", `#${headingId}`);
  });

  it("tracks its own headings when the host page owns the same anchors", () => {
    const restoreLayout = stubUnscrolledLayout();
    try {
      render(
        <>
          <h2 id="installation">Host page installation</h2>
          <h2 id="usage">Host page usage</h2>
          <TocActive />
        </>,
      );

      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
        "aria-current",
        "location",
      );
    } finally {
      restoreLayout();
    }
  });

  it("marks the heading the pane is showing, not the last one, while nothing is scrolled", () => {
    const restoreLayout = stubUnscrolledLayout();
    try {
      render(<TocActive />);

      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
        "aria-current",
        "location",
      );
      expect(screen.getByRole("link", { name: "Usage" })).not.toHaveAttribute("aria-current");
    } finally {
      restoreLayout();
    }
  });

  it("moves aria-current to the link the user clicks", async () => {
    // jsdom implements neither window.scrollTo nor Element.prototype.scrollTo;
    // the demo scrolls its own container, so both are stubbed here.
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Element.prototype.scrollTo = vi.fn();
    try {
      const user = userEvent.setup();
      render(<TocActive />);

      const links = screen.getAllByRole("link");
      const initiallyActive = links.find(
        (link) => link.getAttribute("aria-current") === "location",
      );
      if (!initiallyActive) throw new Error("expected an initially active link");
      const target = links.find((link) => link !== initiallyActive);
      if (!target) throw new Error("expected a non-current link to click");

      await user.click(target);

      expect(target).toHaveAttribute("aria-current", "location");
      expect(initiallyActive).not.toHaveAttribute("aria-current");
    } finally {
      scrollTo.mockRestore();
      Reflect.deleteProperty(Element.prototype, "scrollTo");
    }
  });
});
