import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Tooltip } from "./index";

function expectClosedOrUnmounted(element: HTMLElement) {
  if (element.isConnected) {
    expect(element).toHaveAttribute("data-state", "closed");
    return;
  }
  expect(element).not.toBeInTheDocument();
}

describe("Tooltip", () => {
  it("renders content when defaultOpen is true", () => {
    render(
      <Tooltip content="Tip text" defaultOpen>
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("Tip text")).toBeInTheDocument();
  });

  it("does not open when enabled is false", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tip text" enabled={false} delayMs={0}>
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    await user.hover(screen.getByText("Hover me"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("has no a11y violations when open", async () => {
    const { container } = render(
      <div>
        <Tooltip content="Tip text" defaultOpen>
          <button type="button">Hover me</button>
        </Tooltip>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations when closed", async () => {
    const { container } = render(
      <div>
        <Tooltip content="Tip text">
          <button type="button">Hover me</button>
        </Tooltip>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Tooltip keyboard", () => {
  it("fires a Tooltip-wrapped button's onClick on Enter and on Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Tooltip content="Tip text" delayMs={0}>
        <button type="button" onClick={onClick}>
          Save
        </button>
      </Tooltip>,
    );

    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("shows on focus via tab", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tip text" delayMs={0}>
        <button type="button">Focus me</button>
      </Tooltip>,
    );

    await user.tab();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("dismisses on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tip text" defaultOpen>
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expectClosedOrUnmounted(tooltip);
  });

  it("Escape claimed by a hover tooltip closes it without moving unrelated focus", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <label>
          Search
          <input />
        </label>
        <Tooltip content="Tip text" delayMs={0}>
          <button type="button">Hover me</button>
        </Tooltip>
      </div>,
    );

    await user.hover(screen.getByRole("button", { name: "Hover me" }));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("data-state", "open");

    const input = screen.getByRole("textbox", { name: "Search" });
    input.focus();
    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });

    // fireEvent retained: user-event does not expose the dispatched event for defaultPrevented assertions.
    fireEvent(input, escapeEvent);

    expectClosedOrUnmounted(tooltip);
    expect(input).toHaveFocus();
    expect(escapeEvent.defaultPrevented).toBe(true);
  });

  it("makes a tooltip on plain text reachable with Tab and opens on focus", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tip text" delayMs={0}>
        Passive text
      </Tooltip>,
    );

    const trigger = screen.getByText("Passive text");
    expect(trigger).toHaveAttribute("tabindex", "0");

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("does not add a duplicate tab stop when wrapping a native button", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tip text" delayMs={0}>
        <button type="button">Focus me</button>
      </Tooltip>,
    );

    const button = screen.getByRole("button", { name: "Focus me" });
    expect(button).not.toHaveAttribute("tabindex");

    // A single Tab lands on the button itself — no wrapper span tab stop precedes it.
    await user.tab();
    expect(button).toHaveFocus();
  });
});

describe("Tooltip trigger semantics", () => {
  it("enhances an interactive child without nesting controls", () => {
    render(
      <Tooltip content="Tip text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Hover me" });
    expect(button).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("does not expose passive text as a button", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Text tip" delayMs={0}>
        Passive text
      </Tooltip>,
    );

    expect(screen.queryByRole("button", { name: "Passive text" })).not.toBeInTheDocument();

    await user.hover(screen.getByText("Passive text"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("gives a disabled native trigger one named Tab stop and describes both AX nodes", async () => {
    const user = userEvent.setup();
    render(
      <>
        <span id="existing-description">Existing description</span>
        <Tooltip content="Disabled tip" delayMs={0} closeDelayMs={0}>
          <button type="button" disabled aria-describedby="existing-description">
            Unavailable
          </button>
        </Tooltip>
        <button type="button">After</button>
      </>,
    );

    const button = screen.getByRole("button", { name: "Unavailable" });
    const wrapper = button.parentElement as HTMLElement;
    expect(button).toBeDisabled();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(wrapper.tagName).toBe("SPAN");
    expect(wrapper).not.toHaveAttribute("role");
    expect(wrapper).toHaveAttribute("tabindex", "0");
    expect(wrapper).toHaveAttribute("aria-labelledby", button.id);
    expect(wrapper).toHaveAccessibleName("Unavailable");

    await user.tab();
    expect(wrapper).toHaveFocus();
    const tooltip = screen.getByRole("tooltip");
    expect(wrapper).toHaveAttribute("aria-describedby", tooltip.id);
    expect(button.getAttribute("aria-describedby")?.split(/\s+/)).toEqual([
      "existing-description",
      tooltip.id,
    ]);
    expect(button).toHaveAccessibleDescription("Existing description Disabled tip");

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    expectClosedOrUnmounted(tooltip);
  });

  it("dismisses a focus-open disabled trigger tooltip on Escape without moving focus", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Disabled tip" delayMs={0} closeDelayMs={0}>
        <button type="button" disabled>
          Unavailable
        </button>
      </Tooltip>,
    );

    const button = screen.getByRole("button", { name: "Unavailable" });
    const wrapper = button.parentElement as HTMLElement;
    await user.tab();
    const tooltip = screen.getByRole("tooltip");

    await user.keyboard("{Escape}");

    expectClosedOrUnmounted(tooltip);
    expect(wrapper).toHaveFocus();
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("preserves hover and touch behavior for a disabled native trigger", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Disabled tip" delayMs={0} closeDelayMs={0}>
        <button type="button" disabled>
          Unavailable
        </button>
      </Tooltip>,
    );

    const button = screen.getByRole("button", { name: "Unavailable" });
    const wrapper = button.parentElement as HTMLElement;

    await user.hover(wrapper);
    const hoveredTooltip = screen.getByRole("tooltip");
    expect(button).toHaveAttribute("aria-describedby", hoveredTooltip.id);
    await user.unhover(wrapper);
    expectClosedOrUnmounted(hoveredTooltip);

    // fireEvent retained: pointerType is required to exercise the touch-only toggle path.
    fireEvent.pointerDown(wrapper, { pointerType: "touch" });
    const touchedTooltip = screen.getByRole("tooltip");
    expect(button).toHaveAttribute("aria-describedby", touchedTooltip.id);

    // fireEvent retained: the second touch toggles the same disabled-trigger tooltip closed.
    fireEvent.pointerDown(wrapper, { pointerType: "touch" });
    expectClosedOrUnmounted(touchedTooltip);
  });
});

describe("Tooltip touch", () => {
  it("reveals on touch tap of passive trigger and hides on second tap", () => {
    render(<Tooltip content="Tip text">Passive label</Tooltip>);
    const trigger = screen.getByText("Passive label");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // fireEvent retained: pointerType is required to distinguish touch from mouse; user-event cannot set it
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("data-state", "open");

    // fireEvent retained: same pointerType signal closes the tooltip
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    expectClosedOrUnmounted(tooltip);
  });

  it("dismisses on outside tap", () => {
    render(
      <div>
        <button type="button">Outside</button>
        <Tooltip content="Tip text" defaultOpen>
          Passive label
        </Tooltip>
      </div>,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("data-state", "open");

    // fireEvent retained: document-level pointerdown listener attaches in capture phase
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expectClosedOrUnmounted(tooltip);
  });
});
