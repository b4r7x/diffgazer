import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Overflow } from "./index";
import { OverflowText } from "./overflow-text";

let resizeCallbacks: Array<() => void> = [];
let animationCallbacks: FrameRequestCallback[] = [];
let resizeObserverObserveCalls = 0;
let mutationObserverObserveCalls = 0;

beforeEach(() => {
  resizeCallbacks = [];
  animationCallbacks = [];
  resizeObserverObserveCalls = 0;
  mutationObserverObserveCalls = 0;

  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private cb: () => void) {}
      observe() {
        resizeObserverObserveCalls += 1;
        resizeCallbacks.push(this.cb);
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "MutationObserver",
    class {
      observe() {
        mutationObserverObserveCalls += 1;
      }
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    animationCallbacks.push(cb);
    return animationCallbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("still calls consumer pointer handlers once the tooltip owns the same events", async () => {
    const user = userEvent.setup();
    const onMouseEnter = vi.fn();
    const onFocus = vi.fn();
    render(
      <OverflowText tooltip onMouseEnter={onMouseEnter} onFocus={onFocus}>
        Long label
      </OverflowText>,
    );

    const text = screen.getByText("Long label");
    mockDimensions(text, {
      scrollWidth: 300,
      clientWidth: 100,
      scrollHeight: 20,
      clientHeight: 20,
    });
    act(flushObservers);

    await user.hover(screen.getByText("Long label"));
    expect(onMouseEnter).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(onFocus).toHaveBeenCalledTimes(1);
    // The tooltip's own handler still ran.
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Long label");
  });

  it("keeps the consumer description on the trigger and adds the tooltip's to it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <span id="unit-hint">Bytes per second</span>
        <OverflowText tooltip aria-describedby="unit-hint">
          Long label
        </OverflowText>
      </>,
    );

    const trigger = screen.getByText("Long label");
    mockDimensions(trigger, {
      scrollWidth: 300,
      clientWidth: 100,
      scrollHeight: 20,
      clientHeight: 20,
    });
    act(flushObservers);

    expect(trigger).toHaveAccessibleDescription("Bytes per second");

    await user.tab();
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    expect(trigger).toHaveAccessibleDescription("Bytes per second Long label");
  });

  it("keeps a consumer tabIndex while the tooltip has nothing to reveal", () => {
    render(
      <OverflowText tooltip tabIndex={-1}>
        Short
      </OverflowText>,
    );

    expect(screen.getByText("Short")).toHaveAttribute("tabindex", "-1");
  });

  it("suppresses tooltip semantics entirely when tooltip is false, even while overflowing", () => {
    render(<OverflowText tooltip={false}>Long label</OverflowText>);

    const trigger = screen.getByText("Long label");
    let scrollWidthReads = 0;
    let clientWidthReads = 0;
    let scrollHeightReads = 0;
    let clientHeightReads = 0;
    Object.defineProperty(trigger, "scrollWidth", {
      configurable: true,
      get() {
        scrollWidthReads += 1;
        return 300;
      },
    });
    Object.defineProperty(trigger, "clientWidth", {
      configurable: true,
      get() {
        clientWidthReads += 1;
        return 100;
      },
    });
    Object.defineProperty(trigger, "scrollHeight", {
      configurable: true,
      get() {
        scrollHeightReads += 1;
        return 20;
      },
    });
    Object.defineProperty(trigger, "clientHeight", {
      configurable: true,
      get() {
        clientHeightReads += 1;
        return 20;
      },
    });

    act(flushObservers);

    expect(resizeObserverObserveCalls).toBe(0);
    expect(mutationObserverObserveCalls).toBe(0);
    expect(scrollWidthReads).toBe(0);
    expect(clientWidthReads).toBe(0);
    expect(scrollHeightReads).toBe(0);
    expect(clientHeightReads).toBe(0);
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

  it("keeps the line clamp when a consumer passes style", () => {
    render(
      <OverflowText lines={3} tooltip={false} style={{ maxWidth: 200 }}>
        Clamped label
      </OverflowText>,
    );

    const root = screen.getByText("Clamped label");
    expect(root).toHaveStyle({
      display: "-webkit-box",
      overflow: "hidden",
      maxWidth: "200px",
    });
    expect(root.style.webkitLineClamp).toBe("3");
  });

  it("keeps the line clamp when a consumer passes style in tooltip mode", () => {
    render(
      <OverflowText lines={3} style={{ maxWidth: 200 }}>
        Clamped tooltip label
      </OverflowText>,
    );

    const root = screen.getByText("Clamped tooltip label");
    expect(root).toHaveStyle({
      display: "-webkit-box",
      overflow: "hidden",
      maxWidth: "200px",
    });
    expect(root.style.webkitLineClamp).toBe("3");
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
      <Overflow
        mode="items"
        ref={ref}
        aria-label="Recent files"
        data-state="items"
        className="gap-2"
      >
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
