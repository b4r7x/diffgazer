import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Overflow } from "./index";
import { OverflowText } from "./overflow-text";

let resizeCallbacks: Array<() => void> = [];
let animationCallbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  resizeCallbacks = [];
  animationCallbacks = [];

  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private cb: () => void) {}
      observe() {
        resizeCallbacks.push(this.cb);
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    animationCallbacks.push(cb);
    return animationCallbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

function mockDimensions(
  el: HTMLElement,
  dims: { scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number },
) {
  Object.defineProperty(el, "scrollWidth", { value: dims.scrollWidth, configurable: true });
  Object.defineProperty(el, "clientWidth", { value: dims.clientWidth, configurable: true });
  Object.defineProperty(el, "scrollHeight", { value: dims.scrollHeight, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: dims.clientHeight, configurable: true });
}

function mockWidth(element: Element, width: number) {
  Object.defineProperty(element, "offsetWidth", { value: width, configurable: true });
}

function flushObservers() {
  for (const callback of resizeCallbacks) callback();
  const callbacks = animationCallbacks;
  animationCallbacks = [];
  for (const callback of callbacks) callback(0);
}

describe("OverflowText", () => {
  it("does not expose a tooltip button when text is not overflowing", () => {
    render(<OverflowText tooltip>Short</OverflowText>);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Short")).toBeInTheDocument();
  });

  it("keeps overflowing text tooltip semantics passive and keyboard-reachable", async () => {
    const user = userEvent.setup();
    render(<OverflowText tooltip>Long label</OverflowText>);

    const text = screen.getByText("Long label");
    mockDimensions(text, {
      scrollWidth: 300,
      clientWidth: 100,
      scrollHeight: 20,
      clientHeight: 20,
    });

    act(flushObservers);

    const trigger = screen.getByText("Long label");
    expect(screen.queryByRole("button", { name: "Long label" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("tabindex", "0");

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Long label");
  });

  it("suppresses tooltip semantics entirely when tooltip is false, even while overflowing", () => {
    render(<OverflowText tooltip={false}>Long label</OverflowText>);

    const trigger = screen.getByText("Long label");
    mockDimensions(trigger, {
      scrollWidth: 300,
      clientWidth: 100,
      scrollHeight: 20,
      clientHeight: 20,
    });

    act(flushObservers);

    expect(trigger).not.toHaveAttribute("aria-describedby");
    trigger.focus();
    expect(trigger).not.toHaveFocus();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the custom tooltip content instead of the label text", async () => {
    const user = userEvent.setup();
    render(<OverflowText tooltip={<span>Custom info</span>}>Long label</OverflowText>);

    const trigger = screen.getByText("Long label");
    mockDimensions(trigger, {
      scrollWidth: 300,
      clientWidth: 100,
      scrollHeight: 20,
      clientHeight: 20,
    });

    act(flushObservers);

    expect(trigger).toHaveAttribute("tabindex", "0");

    await user.tab();
    expect(trigger).toHaveFocus();

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Custom info");
    expect(tooltip).not.toHaveTextContent("Long label");
  });
});

describe("Overflow", () => {
  it("defaults to text mode", () => {
    const ref = createRef<HTMLDivElement>();

    render(
      <Overflow ref={ref} id="overflow-root" style={{ maxWidth: 120 }}>
        Default text
      </Overflow>,
    );

    const root = screen.getByText("Default text");
    expect(root).toHaveTextContent("Default text");
    expect(root).toHaveAttribute("id", "overflow-root");
    expect(root).toHaveStyle({ maxWidth: "120px" });
    expect(ref.current).toBe(root);
  });

  it("renders explicit text mode", () => {
    render(
      <Overflow mode="text" lines={2}>
        Explicit text
      </Overflow>,
    );

    expect(screen.getByText("Explicit text")).toHaveStyle({ overflow: "hidden" });
  });

  it("renders explicit items mode", () => {
    const ref = createRef<HTMLDivElement>();

    render(
      <Overflow mode="items" ref={ref} aria-label="Recent files" data-state="items" gap="gap-2">
        <span>One</span>
        <span>Two</span>
      </Overflow>,
    );

    const root = screen.getByLabelText("Recent files");
    expect(root).toHaveAttribute("data-state", "items");
    expect(root).toHaveTextContent("One");
    expect(root).toHaveTextContent("Two");
    expect(ref.current).toBe(root);
  });

  it("counts and measures only rendered items when children contain empty conditions", () => {
    render(
      <Overflow mode="items" aria-label="Recent files">
        <span>One</span>
        {false}
        {null}
        {[<span key="two">Two</span>]}
      </Overflow>,
    );

    const root = screen.getByLabelText("Recent files");
    const itemWrappers = Array.from(root.children).slice(0, -1);
    const [firstItem, secondItem] = itemWrappers;
    const indicator = root.lastElementChild;
    if (!firstItem || !secondItem || !indicator)
      throw new Error("expected measured overflow items");

    expect(itemWrappers).toHaveLength(2);
    mockWidth(root, 80);
    mockWidth(firstItem, 50);
    mockWidth(secondItem, 50);
    mockWidth(indicator, 20);
    root.style.gap = "10px";

    act(flushObservers);

    expect(screen.getByRole("status", { name: "1 more items" })).toBe(indicator);
    expect(screen.queryByRole("status", { name: "3 more items" })).not.toBeInTheDocument();
  });
});
