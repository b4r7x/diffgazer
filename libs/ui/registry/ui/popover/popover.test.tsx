import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import PopoverBasicExample from "../../examples/popover/popover-basic";
import PopoverControlledExample from "../../examples/popover/popover-controlled";
import PopoverMenuExample from "../../examples/popover/popover-menu";
import PopoverPlacementExample from "../../examples/popover/popover-placement";
import { Popover, type PopoverProps } from "./index";
import { expectClosedOrUnmounted, setPointerEventSupport } from "./popover-test-utils";

function renderClickPopover(props: Partial<PopoverProps> = {}) {
  return render(
    <Popover triggerMode="click" {...props}>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
    </Popover>,
  );
}

let restorePointerEventSupport = () => {};

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
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);

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
