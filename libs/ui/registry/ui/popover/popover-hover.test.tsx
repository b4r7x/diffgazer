import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { applyReducedMotionFixture } from "../../../testing/prefers-reduced-motion";
import { tooltipDoc } from "../../component-docs/tooltip";
import { Tooltip } from "../tooltip/index";
import { Popover } from "./index";
import { expectClosedOrUnmounted, setPointerEventSupport } from "./popover-test-utils";

const tooltipSource = readFileSync(join(import.meta.dirname, "../tooltip/tooltip.tsx"), "utf8");

let restorePointerEventSupport = () => {};

beforeEach(() => {
  restorePointerEventSupport = setPointerEventSupport(false);
});

afterEach(() => {
  restorePointerEventSupport();
});

describe("Popover hover accessibility", () => {
  it("has no a11y violations for an open hover-mode popover", async () => {
    const { container } = render(
      <Popover triggerMode="hover" defaultOpen>
        <Popover.Trigger>Hover me</Popover.Trigger>
        <Popover.Content>Tooltip body</Popover.Content>
      </Popover>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Popover", () => {
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

    it("merges an external aria-describedby with the tooltip description id", () => {
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
