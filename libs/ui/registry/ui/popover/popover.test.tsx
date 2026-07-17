import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type FormEvent, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { applyReducedMotionFixture } from "../../../testing/prefers-reduced-motion";
import { tooltipDoc } from "../../component-docs/tooltip";
import PopoverBasicExample from "../../examples/popover/popover-basic";
import PopoverControlledExample from "../../examples/popover/popover-controlled";
import PopoverMenuExample from "../../examples/popover/popover-menu";
import PopoverPlacementExample from "../../examples/popover/popover-placement";
import { Tooltip } from "../tooltip/index";
import { Popover, type PopoverProps } from "./index";

const tooltipSource = readFileSync(join(import.meta.dirname, "../tooltip/tooltip.tsx"), "utf8");

function renderClickPopover(props: Partial<PopoverProps> = {}) {
  return render(
    <Popover triggerMode="click" {...props}>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
    </Popover>,
  );
}

function expectClosedOrUnmounted(element: HTMLElement) {
  if (element.isConnected) {
    expect(element).toHaveAttribute("data-state", "closed");
    return;
  }
  expect(element).not.toBeInTheDocument();
}

let restorePointerEventSupport = () => {};

function setPointerEventSupport(enabled: boolean) {
  const descriptor = Object.getOwnPropertyDescriptor(window, "PointerEvent");

  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    writable: true,
    value: enabled ? class TestPointerEvent extends MouseEvent {} : undefined,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(window, "PointerEvent", descriptor);
    } else {
      Reflect.deleteProperty(window, "PointerEvent");
    }
  };
}

beforeEach(() => {
  restorePointerEventSupport = setPointerEventSupport(false);
});

afterEach(() => {
  restorePointerEventSupport();
});

describe("Popover", () => {
  it.each([
    ["basic", PopoverBasicExample, "click me", "Popover content with interactive elements."],
    ["controlled", PopoverControlledExample, "open", "Controlled popover"],
    ["menu", PopoverMenuExample, "Actions", "Copy link"],
    ["placement", PopoverPlacementExample, "top", "Placed on top"],
  ])("keeps the %s example trigger from submitting an enclosing form", async (_, Example, triggerName, content) => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Example />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: triggerName }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it("opens on click and closes on second click", async () => {
    const user = userEvent.setup();
    renderClickPopover();
    const trigger = screen.getByRole("button", { name: "Open" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-haspopup");

    await user.click(trigger);
    expect(screen.getByText("Popover body")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it.each([
    "menu",
    "listbox",
    "grid",
    "tree",
    "dialog",
  ] as const)("sets aria-haspopup for click popovers with %s content", (role) => {
    render(
      <Popover triggerMode="click" defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role={role} aria-label={`${role} popup`}>
          Popover body
        </Popover.Content>
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    const content = screen.getByRole(role, { name: `${role} popup` });
    expect(trigger).toHaveAttribute("aria-haspopup", role);
    expect(trigger).toHaveAttribute("aria-controls", content.id);
  });

  it("derives aria-haspopup from content role before the popup opens", () => {
    render(
      <Popover triggerMode="click">
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role="menu" aria-label="Actions">
          Popover body
        </Popover.Content>
      </Popover>,
    );

    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("menu", { name: "Actions" })).not.toBeInTheDocument();
  });

  it("can declare click popup role on the root before content effects run", () => {
    render(
      <Popover triggerMode="click" popupRole="menu">
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role="menu" aria-label="Actions">
          Popover body
        </Popover.Content>
      </Popover>,
    );

    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-haspopup", "menu");
  });

  it("calls onOpenChange when toggled via click", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderClickPopover({ onOpenChange });
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  describe("hover trigger with delay", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("opens after delay on mouse enter", () => {
      render(
        <Popover triggerMode="hover" delayMs={200}>
          <Popover.Trigger>Hover me</Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByText("Hover me");

      // fireEvent retained: fake timers in use — user-event hover requires real timers
      fireEvent.mouseEnter(trigger);

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toBeInTheDocument();
      expect(trigger).not.toHaveAttribute("aria-haspopup");
      expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
    });

    it("merges an external aria-describedby with the tooltip description id (F-009)", () => {
      render(
        <Popover triggerMode="hover" delayMs={200}>
          <Popover.Trigger>
            <span aria-describedby="external-desc">Hover me</span>
          </Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByText("Hover me");

      // fireEvent retained: fake timers in use — user-event hover requires real timers
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tooltip = screen.getByRole("tooltip");
      const describedBy = trigger.getAttribute("aria-describedby")?.split(/\s+/) ?? [];
      expect(describedBy).toContain("external-desc");
      expect(describedBy).toContain(tooltip.id);
    });

    it("closes after closeDelay on mouse leave", () => {
      render(
        <Popover triggerMode="hover" delayMs={200} closeDelayMs={100}>
          <Popover.Trigger>Hover me</Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByText("Hover me");

      // fireEvent retained: fake timers in use — user-event hover requires real timers
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toBeInTheDocument();

      // fireEvent retained: fake timers in use — user-event unhover requires real timers
      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expectClosedOrUnmounted(tooltip);
    });

    it("keeps the tooltip visible when pointer leaves a focused trigger", () => {
      render(
        <Popover triggerMode="hover" delayMs={0} closeDelayMs={100}>
          <Popover.Trigger>Hover me</Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByText("Hover me");

      // fireEvent retained: fake timers in use and the regression needs independent pointer/focus ownership transitions.
      fireEvent.mouseEnter(trigger);
      fireEvent.focus(trigger);
      const tooltip = screen.getByRole("tooltip");
      // fireEvent retained: fake timers in use.
      fireEvent.mouseLeave(trigger);
      act(() => vi.advanceTimersByTime(100));

      expect(tooltip).toHaveAttribute("data-state", "open");
      expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);

      // fireEvent retained: the final focus owner releases visibility synchronously.
      fireEvent.blur(trigger);
      act(() => vi.advanceTimersByTime(100));
      expectClosedOrUnmounted(tooltip);
    });

    it("keeps the tooltip visible when focus blurs from a hovered trigger", () => {
      render(
        <Popover triggerMode="hover" delayMs={0} closeDelayMs={100}>
          <Popover.Trigger>Hover me</Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByText("Hover me");

      // fireEvent retained: fake timers in use and the regression needs independent focus/pointer ownership transitions.
      fireEvent.focus(trigger);
      fireEvent.mouseEnter(trigger);
      const tooltip = screen.getByRole("tooltip");
      // fireEvent retained: fake timers require a synchronous focus-owner transition.
      fireEvent.blur(trigger);
      act(() => vi.advanceTimersByTime(100));

      expect(tooltip).toHaveAttribute("data-state", "open");
      expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);

      // fireEvent retained: fake timers in use.
      fireEvent.mouseLeave(trigger);
      act(() => vi.advanceTimersByTime(100));
      expectClosedOrUnmounted(tooltip);
    });

    it("lets Escape dismiss a tooltip while trigger focus still owns visibility", () => {
      render(
        <Popover triggerMode="hover" delayMs={0} closeDelayMs={100}>
          <Popover.Trigger>Hover me</Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByText("Hover me");

      act(() => trigger.focus());
      expect(trigger).toHaveFocus();
      const tooltip = screen.getByRole("tooltip");
      // fireEvent retained: direct keydown isolates Escape dismissal while focus remains owned.
      fireEvent.keyDown(trigger, { key: "Escape" });

      expectClosedOrUnmounted(tooltip);
      expect(trigger).not.toHaveAttribute("aria-describedby");
      act(() => vi.advanceTimersByTime(1_000));
      expectClosedOrUnmounted(tooltip);
      expect(trigger).toHaveFocus();
    });

    it("lets outside pointerdown dismiss a tooltip while trigger focus still owns visibility", () => {
      render(
        <div>
          <button type="button">Outside</button>
          <Popover triggerMode="hover" delayMs={0} closeDelayMs={100}>
            <Popover.Trigger>Hover me</Popover.Trigger>
            <Popover.Content>Tooltip body</Popover.Content>
          </Popover>
        </div>,
      );
      const trigger = screen.getByText("Hover me");

      act(() => trigger.focus());
      expect(trigger).toHaveFocus();
      const tooltip = screen.getByRole("tooltip");
      expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);

      // fireEvent retained: document-level pointerdown dismissal is the behavior under test.
      fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));

      expectClosedOrUnmounted(tooltip);
      expect(trigger).not.toHaveAttribute("aria-describedby");
      expect(trigger).toHaveFocus();
      act(() => vi.advanceTimersByTime(1_000));
      expectClosedOrUnmounted(tooltip);
      expect(trigger).not.toHaveAttribute("aria-describedby");
    });

    it("keeps Tooltip pointer/focus timing docs and JSDoc in parity with runtime", () => {
      render(
        <Tooltip content="Tooltip body">
          <button type="button">Hover me</button>
        </Tooltip>,
      );
      const trigger = screen.getByRole("button", { name: "Hover me" });
      const delayNote = tooltipDoc.notes?.find((note) => note.title === "Delay");

      expect(delayNote?.content).toContain("pointer show delay is 500ms");
      expect(delayNote?.content).toContain("keyboard focus opens immediately");
      expect(delayNote?.content).toContain("hide delay after pointer or focus leaves is 150ms");
      expect(delayNote?.content).toContain("`delayMs` and `closeDelayMs`");
      expect(tooltipDoc.props?.Tooltip?.delayMs?.defaultValue).toBe("500");
      expect(tooltipDoc.props?.Tooltip?.closeDelayMs?.defaultValue).toBe("150");
      expect(tooltipDoc.props?.Tooltip?.delayMs?.description).toContain(
        "keyboard focus opens immediately",
      );
      expect(tooltipSource).toContain(
        "Show delay after pointer enters the trigger; keyboard focus opens immediately.",
      );

      // fireEvent retained: fake timers in use — user-event hover requires real timers.
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(499);
      });
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      const tooltip = screen.getByRole("tooltip");

      // fireEvent retained: fake timers in use — user-event unhover requires real timers.
      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(149);
      });
      expect(tooltip).toHaveAttribute("data-state", "open");

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expectClosedOrUnmounted(tooltip);

      // fireEvent retained: focus timing is synchronous and must not advance the pointer delay.
      fireEvent.focus(trigger);
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    it("opens immediately on keyboard focus without advancing the hover delay", () => {
      render(
        <Popover triggerMode="hover" delayMs={200}>
          <Popover.Trigger>Hover me</Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByText("Hover me");

      // fireEvent retained: fake timers in use.
      fireEvent.focus(trigger);

      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    it("cancels open timer if mouse leaves before delay elapses", () => {
      render(
        <Popover triggerMode="hover" delayMs={200}>
          <Popover.Trigger>Hover me</Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>,
      );
      const trigger = screen.getByText("Hover me");

      // fireEvent retained: fake timers in use — user-event hover requires real timers
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      // fireEvent retained: fake timers in use — user-event unhover requires real timers
      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  it("respects controlled open prop", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Popover open={false} onOpenChange={onOpenChange}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>,
    );

    expect(screen.queryByText("Popover body")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.queryByText("Popover body")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalled();

    rerender(
      <Popover open={true} onOpenChange={onOpenChange}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>,
    );
    expect(screen.getByText("Popover body")).toBeInTheDocument();
  });

  it("has no a11y violations when closed", async () => {
    const { container } = renderClickPopover();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations when open with aria-label", async () => {
    const { container } = renderClickPopover({ defaultOpen: true });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("uses an interactive child as the click trigger without nesting controls", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Popover triggerMode="click">
        <Popover.Trigger>
          <button type="button">Open child</button>
        </Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Open child" });
    expect(screen.getAllByRole("button", { name: "Open child" })).toHaveLength(1);
    expect(await axe(container)).toHaveNoViolations();

    await user.click(trigger);
    expect(screen.getByText("Popover body")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Escape and restores focus to trigger", async () => {
    const user = userEvent.setup();
    renderClickPopover({ defaultOpen: true });
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();

    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("does not open when enabled is false", async () => {
    const user = userEvent.setup();
    renderClickPopover({ enabled: false });
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.queryByText("Popover body")).not.toBeInTheDocument();
  });

  it("closes when enabled changes to false while open", () => {
    const { rerender } = render(
      <Popover defaultOpen enabled>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>,
    );
    expect(screen.getByText("Popover body")).toBeInTheDocument();
    const content = screen.getByText("Popover body");

    rerender(
      <Popover defaultOpen enabled={false}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>,
    );
    expectClosedOrUnmounted(content);
  });

  it("closes only the top nested popover on outside click and Escape", async () => {
    const user = userEvent.setup();
    const onOuterOpenChange = vi.fn();
    const onInnerOpenChange = vi.fn();
    render(
      <div>
        <button type="button">Outside</button>
        <Popover defaultOpen onOpenChange={onOuterOpenChange}>
          <Popover.Trigger>Outer</Popover.Trigger>
          <Popover.Content role="dialog" aria-label="Outer popover">
            <Popover defaultOpen onOpenChange={onInnerOpenChange}>
              <Popover.Trigger>Inner</Popover.Trigger>
              <Popover.Content role="dialog" aria-label="Inner popover">
                <button id="inner-action" type="button">
                  Inner action
                </button>
              </Popover.Content>
            </Popover>
          </Popover.Content>
        </Popover>
      </div>,
    );

    const outside = screen.getByRole("button", { name: "Outside" });
    expect(screen.getByRole("dialog", { name: "Outer popover" })).toHaveAttribute(
      "data-state",
      "open",
    );
    expect(screen.getByRole("dialog", { name: "Inner popover" })).toHaveAttribute(
      "data-state",
      "open",
    );
    expect(screen.getByRole("dialog", { name: "Outer popover" })).toContainElement(
      screen.getByRole("button", { name: "Inner" }),
    );
    const innerTrigger = screen.getByRole("button", { name: "Inner" });
    const innerAction = screen.getByRole("button", { name: "Inner action" });
    innerTrigger.focus();
    innerAction.focus();
    expect(innerAction).toHaveFocus();
    expect(onOuterOpenChange).not.toHaveBeenCalledWith(false);

    const inner = screen.getByRole("dialog", { name: "Inner popover" });
    await user.click(outside);
    expect(onInnerOpenChange).toHaveBeenCalledOnce();
    expect(onInnerOpenChange).toHaveBeenCalledWith(false);
    expect(onOuterOpenChange).not.toHaveBeenCalledWith(false);
    expectClosedOrUnmounted(inner);
    expect(screen.getByRole("dialog", { name: "Outer popover" })).toHaveAttribute(
      "data-state",
      "open",
    );

    if (inner.isConnected) {
      // fireEvent retained: animationend has no user-event equivalent; presence transitions complete on this event
      fireEvent.animationEnd(inner);
    }
    const outer = screen.getByRole("dialog", { name: "Outer popover" });
    await user.keyboard("{Escape}");
    expectClosedOrUnmounted(outer);
  });

  it("closes on pointer and touch outside interactions", () => {
    restorePointerEventSupport();
    restorePointerEventSupport = setPointerEventSupport(true);
    const { rerender } = render(
      <div>
        <button type="button">Outside</button>
        <Popover defaultOpen key="pointer">
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content>Popover body</Popover.Content>
        </Popover>
      </div>,
    );
    const outside = screen.getByRole("button", { name: "Outside" });
    const content = screen.getByText("Popover body");

    // fireEvent retained: direct pointerdown asserts the outside-click listener event type.
    fireEvent.pointerDown(outside);
    expectClosedOrUnmounted(content);

    restorePointerEventSupport();
    restorePointerEventSupport = setPointerEventSupport(false);

    rerender(
      <div>
        <button type="button">Outside</button>
        <Popover defaultOpen key="touch">
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content>Popover body</Popover.Content>
        </Popover>
      </div>,
    );

    const touchContent = screen.getByText("Popover body");
    // fireEvent retained: see pointerDown rationale above — touchstart is the same event-type contract test for non-pointer environments.
    fireEvent.touchStart(screen.getByRole("button", { name: "Outside" }));
    expectClosedOrUnmounted(touchContent);
  });

  it("applies a fallback accessible name for dialog popovers without aria-label or aria-labelledby", () => {
    render(
      <Popover defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role="dialog">Popover body</Popover.Content>
      </Popover>,
    );

    const dialog = screen.getByRole("dialog", { name: "Popover" });
    expect(dialog).toHaveAttribute("aria-label", "Popover");
    expect(dialog).not.toHaveAttribute("aria-labelledby");
  });

  it("uses explicit aria-label for dialog popover", () => {
    render(
      <Popover defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role="dialog" aria-label="Settings">
          Popover body
        </Popover.Content>
      </Popover>,
    );

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
  });

  it("uses explicit aria-labelledby for dialog popover", () => {
    render(
      <>
        <h2 id="external-popover-name">External name</h2>
        <Popover defaultOpen>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content role="dialog" aria-labelledby="external-popover-name">
            Popover body
          </Popover.Content>
        </Popover>
      </>,
    );

    const dialog = screen.getByRole("dialog", { name: "External name" });
    expect(dialog).not.toHaveAttribute("aria-label");
  });

  it("composes content handlers and lets prevented Escape keep the popover open", async () => {
    const user = userEvent.setup();
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();
    const onKeyDown = vi.fn((event) => {
      if (event.key === "Escape") event.preventDefault();
    });

    render(
      <Popover triggerMode="click" defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content
          role="dialog"
          aria-label="Actions"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onKeyDown={onKeyDown}
        >
          Popover body
        </Popover.Content>
      </Popover>,
    );

    const content = screen.getByRole("dialog", { name: "Actions" });
    await user.hover(content);
    await user.unhover(content);
    content.focus();
    await user.keyboard("{Escape}");

    expect(onMouseEnter).toHaveBeenCalledOnce();
    expect(onMouseLeave).toHaveBeenCalledOnce();
    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(content).toHaveAttribute("data-state", "open");
  });
});

describe("Popover hover-mode trigger click toggle", () => {
  it("clicking an interactive hover-mode trigger toggles popover open and closed", async () => {
    restorePointerEventSupport();
    restorePointerEventSupport = setPointerEventSupport(true);

    render(
      <Popover triggerMode="hover">
        <Popover.Trigger>
          <button type="button">Hover me</button>
        </Popover.Trigger>
        <Popover.Content>
          <p>Tooltip content</p>
        </Popover.Content>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Hover me" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-haspopup");

    // fireEvent retained: consumes pending outside-pointer click swallowers from earlier tests.
    fireEvent.click(document.body);
    fireEvent.click(document.body);
    // fireEvent retained: same pending swallower drain as above.
    fireEvent.click(document.body);
    // fireEvent retained: this isolates the hover trigger's click-toggle contract from jsdom focus sequencing.
    fireEvent.click(trigger);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveAttribute("data-state", "open");

    // fireEvent retained: same click-toggle contract as above.
    fireEvent.click(trigger);
    expectClosedOrUnmounted(tooltip);
  });
});

describe("Popover cloned-trigger activation cancellation", () => {
  it.each(["click", "hover"] as const)("honors a canceled click in %s mode", (triggerMode) => {
    render(
      <Popover triggerMode={triggerMode}>
        <Popover.Trigger>
          <button type="button" onClick={(event) => event.preventDefault()}>
            Open
          </button>
        </Popover.Trigger>
        <Popover.Content>Popover body</Popover.Content>
      </Popover>,
    );

    // fireEvent retained: focus would independently open a hover trigger before click dispatch.
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.queryByText("Popover body")).not.toBeInTheDocument();
  });

  it.each([
    "click",
    "hover",
  ] as const)("keeps an uncancelled cloned control active in %s mode", (triggerMode) => {
    render(
      <Popover triggerMode={triggerMode}>
        <Popover.Trigger>
          <button type="button">Open</button>
        </Popover.Trigger>
        <Popover.Content>Popover body</Popover.Content>
      </Popover>,
    );

    // fireEvent retained: this isolates click activation from hover-mode focus synchronization.
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByText("Popover body")).toBeInTheDocument();
  });

  it("honors a canceled passive touch pointerdown", () => {
    restorePointerEventSupport();
    render(
      <Popover triggerMode="hover">
        <Popover.Trigger>
          <span onPointerDown={(event) => event.preventDefault()}>Passive label</span>
        </Popover.Trigger>
        <Popover.Content>Popover body</Popover.Content>
      </Popover>,
    );

    // fireEvent retained: pointerType is required to exercise the passive touch boundary.
    fireEvent.pointerDown(screen.getByText("Passive label"), { pointerType: "touch" });

    expect(screen.queryByText("Popover body")).not.toBeInTheDocument();
  });

  it("keeps an uncancelled passive touch trigger active", () => {
    restorePointerEventSupport();
    render(
      <Popover triggerMode="hover">
        <Popover.Trigger>
          <span>Passive label</span>
        </Popover.Trigger>
        <Popover.Content>Popover body</Popover.Content>
      </Popover>,
    );

    // fireEvent retained: pointerType is required to exercise the passive touch boundary.
    fireEvent.pointerDown(screen.getByText("Passive label"), { pointerType: "touch" });

    expect(screen.getByText("Popover body")).toBeInTheDocument();
  });

  it("keeps native keyboard activation in click mode", async () => {
    const user = userEvent.setup();
    render(
      <Popover triggerMode="click">
        <Popover.Trigger>
          <button type="button">Open</button>
        </Popover.Trigger>
        <Popover.Content>Popover body</Popover.Content>
      </Popover>,
    );

    screen.getByRole("button", { name: "Open" }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("Popover body")).toBeInTheDocument();
  });

  it("keeps keyboard toggle activation in hover mode", async () => {
    const user = userEvent.setup();
    render(
      <Popover triggerMode="hover">
        <Popover.Trigger>
          <button type="button">Open</button>
        </Popover.Trigger>
        <Popover.Content>Popover body</Popover.Content>
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.tab();
    expect(trigger).toHaveFocus();
    const content = screen.getByText("Popover body");
    expect(content).toBeInTheDocument();

    await user.keyboard("{Enter}");

    expectClosedOrUnmounted(content);
  });
});

function renderClickPopoverWithFocusables() {
  return render(
    <div>
      <Popover triggerMode="click" defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role="dialog" aria-label="Actions">
          <button type="button">First</button>
          <button type="button">Second</button>
          <button type="button">Third</button>
        </Popover.Content>
      </Popover>
      <button type="button">Outside</button>
    </div>,
  );
}

function FocusBoundaryHarness({
  controlled,
  onOpenChange,
}: {
  controlled: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    setOpen(nextOpen);
  };
  const stateProps = controlled
    ? { open, onOpenChange: handleOpenChange }
    : { defaultOpen: true, onOpenChange };

  return (
    <div>
      <Popover triggerMode="click" {...stateProps}>
        <Popover.Trigger>Boundary trigger</Popover.Trigger>
        <Popover.Content autoFocus={false}>
          <button type="button">Boundary content</button>
        </Popover.Content>
      </Popover>
      <button type="button">Boundary outside</button>
    </div>
  );
}

describe.each([
  ["uncontrolled", false],
  ["controlled", true],
] as const)("Popover %s focus boundary", (_mode, controlled) => {
  it("preserves trigger-to-content and content-to-trigger transitions", () => {
    const onOpenChange = vi.fn();
    render(<FocusBoundaryHarness controlled={controlled} onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Boundary trigger" });
    const content = screen.getByRole("button", { name: "Boundary content" });

    trigger.focus();
    content.focus();
    expect(content).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    trigger.focus();
    expect(trigger).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText("Boundary content").closest("[data-state]")).toHaveAttribute(
      "data-state",
      "open",
    );
  });

  it("requests one close when focus moves from the trigger outside", () => {
    const onOpenChange = vi.fn();
    render(<FocusBoundaryHarness controlled={controlled} onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Boundary trigger" });
    const outside = screen.getByRole("button", { name: "Boundary outside" });

    trigger.focus();
    act(() => outside.focus());

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(outside).toHaveFocus();
  });

  it("requests one close when pointer focus moves from content outside", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<FocusBoundaryHarness controlled={controlled} onOpenChange={onOpenChange} />);
    const content = screen.getByRole("button", { name: "Boundary content" });
    const outside = screen.getByRole("button", { name: "Boundary outside" });

    content.focus();
    await user.click(outside);

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(outside).toHaveFocus();
  });
});

it("allows a controlled popover that refused close to receive a later dismissal request", async () => {
  const onOpenChange = vi.fn();
  render(
    <div>
      <Popover open onOpenChange={onOpenChange}>
        <Popover.Trigger>Refusing trigger</Popover.Trigger>
        <Popover.Content autoFocus={false}>
          <button type="button">Refusing content</button>
        </Popover.Content>
      </Popover>
      <button type="button">Refusing outside</button>
    </div>,
  );
  const trigger = screen.getByRole("button", { name: "Refusing trigger" });
  const outside = screen.getByRole("button", { name: "Refusing outside" });

  trigger.focus();
  act(() => outside.focus());
  expect(onOpenChange).toHaveBeenCalledTimes(1);
  expect(onOpenChange).toHaveBeenLastCalledWith(false);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  trigger.focus();
  act(() => outside.focus());

  expect(onOpenChange).toHaveBeenCalledTimes(2);
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(screen.getByText("Refusing content").closest("[data-state]")).toHaveAttribute(
    "data-state",
    "open",
  );
});

it("keeps the parent open when focus enters a nested portaled popover by its controlled id", () => {
  const onParentOpenChange = vi.fn();
  render(
    <Popover defaultOpen onOpenChange={onParentOpenChange}>
      <Popover.Trigger>Parent trigger</Popover.Trigger>
      <Popover.Content autoFocus={false}>
        <Popover defaultOpen>
          <Popover.Trigger>Nested trigger</Popover.Trigger>
          <Popover.Content autoFocus={false}>
            <button id="nested-action" type="button">
              Nested portaled action
            </button>
          </Popover.Content>
        </Popover>
      </Popover.Content>
    </Popover>,
  );
  const parentTrigger = screen.getByRole("button", { name: "Parent trigger" });
  const nestedTrigger = screen.getByRole("button", { name: "Nested trigger" });
  const nestedAction = screen.getByRole("button", { name: "Nested portaled action" });
  const nestedContentId = nestedTrigger.getAttribute("aria-controls");

  expect(nestedContentId).toBeTruthy();
  expect(nestedAction.id).toBe("nested-action");
  expect(document.getElementById(nestedContentId ?? "")).toContainElement(nestedAction);
  nestedTrigger.focus();
  nestedAction.focus();

  expect(nestedAction).toHaveFocus();
  expect(parentTrigger).toHaveAttribute("aria-expanded", "true");
  expect(onParentOpenChange).not.toHaveBeenCalledWith(false);
});

describe("Popover dialog focus", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lets native Tab advance within content without closing", async () => {
    const user = userEvent.setup();
    renderClickPopoverWithFocusables();
    const first = screen.getByRole("button", { name: "First" });

    expect(first).toHaveFocus();
    await user.tab();

    expect(screen.getByRole("button", { name: "Second" })).toHaveFocus();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open");
  });

  it("keeps the popover open when focus moves from content to trigger", () => {
    renderClickPopoverWithFocusables();
    const first = screen.getByRole("button", { name: "First" });
    const trigger = screen.getByRole("button", { name: "Open" });

    expect(first).toHaveFocus();
    trigger.focus();

    expect(trigger).toHaveFocus();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open");
  });

  it("restores focus to the trigger when the popover is closed programmatically while focus is inside the content", async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content role="dialog" aria-label="Actions" autoFocus={false}>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </Popover.Content>
        </Popover>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    const close = screen.getByRole("button", { name: "Close" });
    const dialog = screen.getByRole("dialog", { name: "Actions" });
    close.focus();

    // fireEvent retained: this test is about the programmatic close handler, not pointer sequencing.
    fireEvent.click(close);

    await waitFor(() => {
      expectClosedOrUnmounted(dialog);
      expect(trigger).toHaveFocus();
    });
  });

  it("closes without stealing focus when focus moves outside the pair", () => {
    renderClickPopoverWithFocusables();
    const outside = screen.getByRole("button", { name: "Outside" });

    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    const dialog = screen.getByRole("dialog");
    act(() => outside.focus());

    expectClosedOrUnmounted(dialog);
    expect(outside).toHaveFocus();
  });
});

describe("Popover non-modal focus", () => {
  it("does not intercept Tab before the browser moves focus", async () => {
    const user = userEvent.setup();
    render(
      <Popover triggerMode="click" defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content>
          <button type="button">First</button>
          <button type="button">Second</button>
        </Popover.Content>
      </Popover>,
    );
    const first = screen.getByRole("button", { name: "First" });
    const content = first.closest("[data-state]");
    first.focus();

    await user.tab();

    expect(content).toBeInstanceOf(HTMLElement);
    if (content instanceof HTMLElement) expect(content).toHaveAttribute("data-state", "open");
    expect(screen.getByRole("button", { name: "Second" })).toHaveFocus();
  });
});

describe("Popover menu focus", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves focus to first focusable inside content when opened with role=menu", async () => {
    const user = userEvent.setup();
    render(
      <Popover triggerMode="click">
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role="menu" aria-label="Actions">
          <button type="button">First action</button>
          <button type="button">Second action</button>
        </Popover.Content>
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");

    await user.click(trigger);

    const firstAction = screen.getByRole("button", { name: "First action" });
    expect(firstAction).toHaveFocus();
  });

  it("does not move focus when autoFocus is false on a menu popover", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Outside</button>
        <Popover triggerMode="click">
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content role="menu" aria-label="Actions" autoFocus={false}>
            <button type="button">First action</button>
          </Popover.Content>
        </Popover>
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);

    const firstAction = screen.getByRole("button", { name: "First action" });
    expect(firstAction).not.toHaveFocus();
  });
});

describe("Popover hover-mode touch", () => {
  // These tests need pointerType to tell touch from mouse, so restore the
  // jsdom-native PointerEvent that the top-level beforeEach stubs out.
  beforeEach(() => {
    restorePointerEventSupport();
  });

  it("tap on passive trigger opens hover-mode popover and second tap closes it", () => {
    render(
      <Popover triggerMode="hover">
        <Popover.Trigger>Passive label</Popover.Trigger>
        <Popover.Content>Tooltip body</Popover.Content>
      </Popover>,
    );
    const trigger = screen.getByText("Passive label");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // fireEvent retained: pointerType is required to distinguish touch from mouse; user-event cannot set it
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("data-state", "open");

    // fireEvent retained: second-tap close path uses the same pointerType signal
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    expectClosedOrUnmounted(tooltip);
  });

  it("ignores mouse pointerdown on passive trigger so it does not double-fire with hover", () => {
    render(
      <Popover triggerMode="hover" delayMs={0}>
        <Popover.Trigger>Passive label</Popover.Trigger>
        <Popover.Content>Tooltip body</Popover.Content>
      </Popover>,
    );
    const trigger = screen.getByText("Passive label");

    // fireEvent retained: mouse pointerType must be set explicitly to assert the touch-only gate
    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes hover-mode popover when a tap lands outside trigger and content", () => {
    render(
      <div>
        <button type="button">Outside</button>
        <Popover triggerMode="hover" defaultOpen>
          <Popover.Trigger>Passive label</Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>
      </div>,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("data-state", "open");

    // fireEvent retained: document-level pointerdown listener attaches in capture phase; user.click would dispatch a different synthetic sequence
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expectClosedOrUnmounted(tooltip);
  });

  it("does not close when pointerdown lands inside the popover content", () => {
    render(
      <Popover triggerMode="hover" defaultOpen>
        <Popover.Trigger>Passive label</Popover.Trigger>
        <Popover.Content>
          <button type="button">Inside</button>
        </Popover.Content>
      </Popover>,
    );
    const inside = screen.getByRole("button", { name: "Inside" });

    // fireEvent retained: contains() check requires pointerdown on the actual content element
    fireEvent.pointerDown(inside);
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "open");
  });
});

describe("Popover hover timer cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears pending hover timers on unmount", () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <Popover triggerMode="hover" delayMs={200} onOpenChange={onOpenChange}>
        <Popover.Trigger>Hover me</Popover.Trigger>
        <Popover.Content>Tooltip body</Popover.Content>
      </Popover>,
    );

    // fireEvent retained: fake timers in use — user-event hover requires real timers
    fireEvent.mouseEnter(screen.getByText("Hover me"));
    unmount();
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("Popover disabled reset", () => {
  it("does not re-fire onOpenChange for a controlled, disabled, closed popover across re-renders", () => {
    const onOpenChange = vi.fn();
    function Harness({ tick }: { tick: number }) {
      return (
        <Popover open={false} enabled={false} onOpenChange={onOpenChange}>
          <Popover.Trigger>Trigger {tick}</Popover.Trigger>
          <Popover.Content>Body {tick}</Popover.Content>
        </Popover>
      );
    }

    const { rerender } = render(<Harness tick={0} />);
    rerender(<Harness tick={1} />);
    rerender(<Harness tick={2} />);

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

function createSameOriginIframe() {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const iframeDoc = iframe.contentDocument;
  if (!iframeDoc) {
    iframe.remove();
    throw new Error("iframe.contentDocument is null; cannot exercise cross-document popover");
  }
  const mount = iframeDoc.createElement("div");
  const portalRoot = iframeDoc.createElement("div");
  iframeDoc.body.append(mount, portalRoot);
  return { iframe, iframeDoc, mount, portalRoot };
}

describe("Popover cross-document behavior", () => {
  it("closes click-mode popover when focus leaves its pair in the trigger ownerDocument", () => {
    const onOpenChange = vi.fn();
    const { iframe, iframeDoc, mount, portalRoot } = createSameOriginIframe();

    render(
      <div>
        <button type="button">Outside</button>
        <Popover triggerMode="click" open onOpenChange={onOpenChange}>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content portalContainer={portalRoot} autoFocus={false}>
            <button type="button">Popover action</button>
          </Popover.Content>
        </Popover>
      </div>,
      { container: mount },
    );

    const trigger = within(iframeDoc.body).getByRole("button", { name: "Open" });
    const outside = within(iframeDoc.body).getByRole("button", { name: "Outside" });
    trigger.focus();
    outside.focus();

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    iframe.remove();
  });

  it("closes click-mode popover on outside pointerdown in the trigger ownerDocument", () => {
    const { iframe, iframeDoc, mount, portalRoot } = createSameOriginIframe();

    render(
      <div>
        <button type="button">Outside</button>
        <Popover triggerMode="click" defaultOpen>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content portalContainer={portalRoot} aria-label="Popover menu">
            Popover body
          </Popover.Content>
        </Popover>
      </div>,
      { container: mount },
    );

    const outside = within(iframeDoc.body).getByRole("button", { name: "Outside" });
    const content = within(portalRoot).getByText("Popover body");
    // fireEvent retained: pointerdown targets the iframe ownerDocument listener without synthesizing unrelated click events.
    fireEvent.pointerDown(outside);
    expectClosedOrUnmounted(content);

    iframe.remove();
  });

  it("closes hover-mode popover on outside pointerdown in the trigger ownerDocument", () => {
    const { iframe, iframeDoc, mount, portalRoot } = createSameOriginIframe();

    render(
      <div>
        <button type="button">Outside</button>
        <Popover triggerMode="hover" defaultOpen>
          <Popover.Trigger>Passive label</Popover.Trigger>
          <Popover.Content portalContainer={portalRoot}>Tooltip body</Popover.Content>
        </Popover>
      </div>,
      { container: mount },
    );

    const tooltip = within(portalRoot).getByRole("tooltip");
    // fireEvent retained: pointerdown targets the trigger ownerDocument listener for hover-mode outside dismissal.
    fireEvent.pointerDown(within(iframeDoc.body).getByRole("button", { name: "Outside" }));
    expectClosedOrUnmounted(tooltip);

    iframe.remove();
  });

  it("renders content into an explicit portalContainer", () => {
    const portalHost = document.createElement("div");
    portalHost.id = "popover-portal-host";
    document.body.appendChild(portalHost);

    render(
      <Popover triggerMode="click" defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content portalContainer={portalHost} aria-label="Popover menu">
          Portaled body
        </Popover.Content>
      </Popover>,
    );

    expect(within(portalHost).getByText("Portaled body")).toBeInTheDocument();

    portalHost.remove();
  });
});

describe("Popover respects prefers-reduced-motion", () => {
  // jsdom evaluates no @media and does not compile the Tailwind motion rules,
  // so animationName is not observable. The fixture lifts the reduced-motion
  // :root overrides out of their @media wrapper; the assertion reads the
  // resolved variables the production stylesheet would read.
  applyReducedMotionFixture();

  it("neutralizes directional enter and exit motion when the open popover is shown", async () => {
    render(
      <Popover defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role="dialog" aria-label="Popover menu">
          Body
        </Popover.Content>
      </Popover>,
    );

    const content = await screen.findByRole("dialog", { name: "Popover menu" });
    const root = content.ownerDocument.documentElement;
    const resolved = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();

    expect(resolved("--ui-content-enter-from-top")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-enter-from-bottom")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-enter-from-left")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-enter-from-right")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-exit-to-top")).toMatch(/^ui-content-exit-fade\b/);
    expect(resolved("--ui-content-exit-to-bottom")).toMatch(/^ui-content-exit-fade\b/);
    expect(resolved("--ui-content-exit-to-left")).toMatch(/^ui-content-exit-fade\b/);
    expect(resolved("--ui-content-exit-to-right")).toMatch(/^ui-content-exit-fade\b/);
  });
});
