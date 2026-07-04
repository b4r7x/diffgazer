import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { ScrollArea } from "./scroll-area";

describe("ScrollArea", () => {
  function renderScrollArea(props: ComponentProps<typeof ScrollArea> = {}) {
    render(
      <ScrollArea aria-label="Content" {...props}>
        content
      </ScrollArea>,
    );
    return screen.getByRole("region", { name: "Content" });
  }

  function defineScrollMetrics(
    el: HTMLElement,
    metrics: Partial<
      Record<"clientHeight" | "clientWidth" | "scrollHeight" | "scrollWidth", number>
    >,
  ) {
    for (const [name, value] of Object.entries(metrics)) {
      Object.defineProperty(el, name, { value, configurable: true });
    }
  }

  function pressKey(target: Element, key: string) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }

  it("scrolls down/up with arrow keys in vertical mode", async () => {
    const user = userEvent.setup();
    const el = renderScrollArea();
    defineScrollMetrics(el, { clientHeight: 100, scrollHeight: 1000 });
    el.focus();
    await user.keyboard("{ArrowDown}");
    expect(el.scrollTop).toBe(40);

    el.scrollTop = 80;
    await user.keyboard("{ArrowUp}");
    expect(el.scrollTop).toBe(40);
  });

  it("scrolls left/right with arrow keys in horizontal mode", async () => {
    const user = userEvent.setup();
    const el = renderScrollArea({ orientation: "horizontal" });
    defineScrollMetrics(el, { clientWidth: 100, scrollWidth: 1000 });
    el.focus();
    await user.keyboard("{ArrowRight}");
    expect(el.scrollLeft).toBe(40);

    el.scrollLeft = 80;
    await user.keyboard("{ArrowLeft}");
    expect(el.scrollLeft).toBe(40);
  });

  it("ignores cross-axis arrow keys based on orientation", async () => {
    const user = userEvent.setup();
    const vertical = renderScrollArea({ orientation: "vertical" });
    defineScrollMetrics(vertical, { clientWidth: 100, scrollWidth: 1000 });
    vertical.focus();
    await user.keyboard("{ArrowRight}");
    expect(vertical.scrollLeft).toBe(0);

    const { unmount } = render(
      <ScrollArea aria-label="Horiz" orientation="horizontal">
        content
      </ScrollArea>,
    );
    const horizontal = screen.getByRole("region", { name: "Horiz" });
    defineScrollMetrics(horizontal, { clientHeight: 100, scrollHeight: 1000 });
    horizontal.focus();
    await user.keyboard("{ArrowDown}");
    expect(horizontal.scrollTop).toBe(0);
    unmount();
  });

  it("scrolls to start with Home and to end with End", async () => {
    const user = userEvent.setup();
    const el = renderScrollArea();
    defineScrollMetrics(el, { clientHeight: 100, scrollHeight: 1000 });
    el.focus();
    await user.keyboard("{End}");
    expect(el.scrollTop).toBe(1000);

    await user.keyboard("{Home}");
    expect(el.scrollTop).toBe(0);
  });

  it("uses the horizontal axis for Page, Home, and End in horizontal mode", async () => {
    const user = userEvent.setup();
    const el = renderScrollArea({ orientation: "horizontal" });
    defineScrollMetrics(el, { clientWidth: 200, scrollWidth: 1000 });

    el.focus();
    await user.keyboard("{PageDown}");
    expect(el.scrollLeft).toBe(160);
    expect(el.scrollTop).toBe(0);

    await user.keyboard("{PageUp}");
    expect(el.scrollLeft).toBe(0);

    await user.keyboard("{End}");
    expect(el.scrollLeft).toBe(1000);
    expect(el.scrollTop).toBe(0);

    await user.keyboard("{Home}");
    expect(el.scrollLeft).toBe(0);
  });

  it("does not handle keyboard scrolling when keyboardScrollable is false", async () => {
    const user = userEvent.setup();
    const el = renderScrollArea({ keyboardScrollable: false });
    defineScrollMetrics(el, { clientHeight: 100, scrollHeight: 1000 });
    el.focus();
    await user.keyboard("{ArrowDown}");
    expect(el.scrollTop).toBe(0);
    expect(el).not.toHaveAttribute("tabindex");
  });

  it("forwards custom onKeyDown handler", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    const el = renderScrollArea({ onKeyDown });
    el.focus();
    await user.keyboard("{ArrowDown}");
    expect(onKeyDown).toHaveBeenCalled();
  });

  it("does not hijack scroll keys from descendant controls", () => {
    render(
      <ScrollArea aria-label="Content">
        <textarea aria-label="Notes" defaultValue="Some editable content" />
      </ScrollArea>,
    );
    const el = screen.getByRole("region", { name: "Content" });
    const textarea = screen.getByRole("textbox", { name: "Notes" });
    defineScrollMetrics(el, { clientHeight: 100, scrollHeight: 1000 });
    el.scrollTop = 40;

    const event = pressKey(textarea, "PageDown");

    expect(event.defaultPrevented).toBe(false);
    expect(el.scrollTop).toBe(40);
  });

  it("does not prevent page keys when the region cannot scroll on that axis", () => {
    const el = renderScrollArea();
    defineScrollMetrics(el, { clientHeight: 200, scrollHeight: 200 });

    const event = pressKey(el, "PageDown");

    expect(event.defaultPrevented).toBe(false);
    expect(el.scrollTop).toBe(0);
  });

  it("prevents scroll keys when the region can scroll on that axis", () => {
    const el = renderScrollArea();
    defineScrollMetrics(el, { clientHeight: 100, scrollHeight: 1000 });

    const event = pressKey(el, "PageDown");

    expect(event.defaultPrevented).toBe(true);
    expect(el.scrollTop).toBe(80);
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <ScrollArea aria-label="Scrollable content">
        <p>Some content</p>
      </ScrollArea>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("provides accessible name when aria-label is set", () => {
    const el = renderScrollArea();
    expect(el).toHaveAttribute("aria-label", "Content");
    expect(el).toHaveAccessibleName("Content");
  });

  it("provides accessible name when aria-labelledby is set", () => {
    render(
      <>
        <h2 id="scroll-title">Scroll Container</h2>
        <ScrollArea aria-labelledby="scroll-title">content</ScrollArea>
      </>,
    );
    const scrollArea = screen.getByRole("region");
    expect(scrollArea).toHaveAttribute("aria-labelledby", "scroll-title");
    expect(scrollArea).toHaveAccessibleName("Scroll Container");
  });

  it("makes scroll area keyboard accessible when keyboardScrollable is true", () => {
    const el = renderScrollArea({ keyboardScrollable: true });
    expect(el).toHaveAttribute("tabindex", "0");
  });

  it("does not add an unnamed keyboard tab stop", async () => {
    const user = userEvent.setup();
    const { container } = render(<ScrollArea>content</ScrollArea>);
    const scrollArea = container.firstElementChild as HTMLElement;

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(scrollArea).not.toHaveAttribute("tabindex");

    scrollArea.focus();
    await user.keyboard("{ArrowDown}");
    expect(scrollArea.scrollTop).toBe(0);
  });
});
