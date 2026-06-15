import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { applyReducedMotionFixture } from "../../../testing/prefers-reduced-motion";
import { Popover } from "./index";

function renderClickPopover(props: Record<string, unknown> = {}) {
  return render(
    <Popover triggerMode="click" {...props}>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
    </Popover>,
  );
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
  it("opens on click and closes on second click", async () => {
    renderClickPopover();
    const trigger = screen.getByRole("button", { name: "Open" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-haspopup");

    await userEvent.click(trigger);
    expect(screen.getByText("Popover body")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(trigger);
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
    const onOpenChange = vi.fn();
    renderClickPopover({ onOpenChange });
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
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
      expect(screen.getByRole("tooltip")).toBeInTheDocument();

      // fireEvent retained: fake timers in use — user-event unhover requires real timers
      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "closed");
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

      // No timer advance: focus must open instantly.
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
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Popover open={false} onOpenChange={onOpenChange}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>,
    );

    expect(screen.queryByText("Popover body")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
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

    await userEvent.click(trigger);
    expect(screen.getByText("Popover body")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Escape and restores focus to trigger", async () => {
    renderClickPopover({ defaultOpen: true });
    const trigger = screen.getByRole("button", { name: "Open" });

    await userEvent.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("does not open when enabled is false", async () => {
    renderClickPopover({ enabled: false });
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
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

    rerender(
      <Popover defaultOpen enabled={false}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>,
    );
    expect(screen.getByText("Popover body")).toHaveAttribute("data-state", "closed");
  });

  it("closes only the top nested popover on outside click and Escape", async () => {
    render(
      <div>
        <button type="button">Outside</button>
        <Popover defaultOpen>
          <Popover.Trigger>Outer</Popover.Trigger>
          <Popover.Content role="dialog" aria-label="Outer popover">
            <Popover defaultOpen>
              <Popover.Trigger>Inner</Popover.Trigger>
              <Popover.Content role="dialog" aria-label="Inner popover">
                Inner body
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

    await userEvent.click(outside);
    expect(screen.getByRole("dialog", { name: "Inner popover" })).toHaveAttribute(
      "data-state",
      "closed",
    );
    expect(screen.getByRole("dialog", { name: "Outer popover" })).toHaveAttribute(
      "data-state",
      "open",
    );

    // fireEvent retained: animationend has no user-event equivalent; presence transitions complete on this event
    fireEvent.animationEnd(screen.getByRole("dialog", { name: "Inner popover" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Outer popover" })).toHaveAttribute(
      "data-state",
      "closed",
    );
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

    // fireEvent retained: direct pointerdown asserts the outside-click listener event type.
    fireEvent.pointerDown(outside);
    expect(screen.getByText("Popover body")).toHaveAttribute("data-state", "closed");

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

    // fireEvent retained: see pointerDown rationale above — touchstart is the same event-type contract test for non-pointer environments.
    fireEvent.touchStart(screen.getByRole("button", { name: "Outside" }));
    expect(screen.getByText("Popover body")).toHaveAttribute("data-state", "closed");
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
    await userEvent.hover(content);
    await userEvent.unhover(content);
    content.focus();
    await userEvent.keyboard("{Escape}");

    expect(onMouseEnter).toHaveBeenCalledOnce();
    expect(onMouseLeave).toHaveBeenCalledOnce();
    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(content).toHaveAttribute("data-state", "open");
  });
});

describe("Popover hover-mode trigger click toggle", () => {
  it("clicking an interactive hover-mode trigger toggles popover open and closed", async () => {
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

    await userEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "open");

    await userEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "closed");
  });
});

function renderClickPopoverWithFocusables() {
  return render(
    <Popover triggerMode="click" defaultOpen>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Content role="dialog" aria-label="Actions">
        <button type="button">First</button>
        <button type="button">Second</button>
        <button type="button">Third</button>
      </Popover.Content>
    </Popover>,
  );
}

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

  it("does not trap Tab within click-mode dialog content and dismisses when focus leaves", async () => {
    renderClickPopoverWithFocusables();
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    const third = screen.getByRole("button", { name: "Third" });

    expect(first).toHaveFocus();

    await userEvent.tab();
    expect(second).toHaveFocus();
    // Moving focus between content elements keeps the popover open.
    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open");

    await userEvent.tab();
    expect(third).toHaveFocus();

    // Tabbing past the last focusable element closes the popover.
    await userEvent.tab();
    expect(first).not.toHaveFocus();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "closed");
  });

  it("keeps the popover open when Shift+Tab moves focus back to the trigger", async () => {
    renderClickPopoverWithFocusables();
    const first = screen.getByRole("button", { name: "First" });

    expect(first).toHaveFocus();

    // Shift+Tab from the first content element lands on the trigger (the portal
    // content follows the trigger in DOM order); focus moving between trigger and
    // content must NOT dismiss the popover.
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open");
  });
});

describe("Popover non-modal focus", () => {
  it("does not trap Tab in default click-mode content", async () => {
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
    const second = screen.getByRole("button", { name: "Second" });
    first.focus();

    await userEvent.tab();
    expect(second).toHaveFocus();

    await userEvent.tab();
    expect(first).not.toHaveFocus();
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

    await userEvent.click(trigger);

    const firstAction = screen.getByRole("button", { name: "First action" });
    expect(firstAction).toHaveFocus();
  });

  it("does not move focus when autoFocus is false on a menu popover", async () => {
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
    await userEvent.click(trigger);

    const firstAction = screen.getByRole("button", { name: "First action" });
    expect(firstAction).not.toHaveFocus();
  });
});

describe("Popover hover-mode touch", () => {
  // The top-level beforeEach overrides PointerEvent with a stub that drops
  // pointerType. These tests rely on pointerType to distinguish touch from
  // mouse, so restore the jsdom-native PointerEvent for the block.
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
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "open");

    // fireEvent retained: second-tap close path uses the same pointerType signal
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "closed");
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
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "open");

    // fireEvent retained: document-level pointerdown listener attaches in capture phase; user.click would dispatch a different synthetic sequence
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "closed");
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
    // fireEvent retained: pointerdown targets the iframe ownerDocument listener without synthesizing unrelated click events.
    fireEvent.pointerDown(outside);
    expect(within(portalRoot).getByText("Popover body")).toHaveAttribute("data-state", "closed");

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

    // fireEvent retained: pointerdown targets the trigger ownerDocument listener for hover-mode outside dismissal.
    fireEvent.pointerDown(within(iframeDoc.body).getByRole("button", { name: "Outside" }));
    expect(within(portalRoot).getByRole("tooltip")).toHaveAttribute("data-state", "closed");

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
  // jsdom does not evaluate @media in stylesheets and does not compile the
  // Tailwind `ui-floating-panel[data-state="open"]` rules from theme-base.css
  // into the CSSOM (those rules are compiled at build time, not parsed by
  // jsdom). So a true behavior assertion on `panel.animationName` is not
  // observable here. The fixture lifts the reduced-motion `:root` overrides
  // out of their @media wrapper to simulate the user preference; the
  // assertion reads the resolved variables that the production stylesheet
  // would read from the same panel element.
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
