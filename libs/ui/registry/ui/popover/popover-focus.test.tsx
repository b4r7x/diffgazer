import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Popover } from "./index";
import { expectClosedOrUnmounted, setPointerEventSupport } from "./popover-test-utils";

let restorePointerEventSupport = () => {};

beforeEach(() => {
  restorePointerEventSupport = setPointerEventSupport(false);
});

afterEach(() => {
  restorePointerEventSupport();
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

describe("Popover focus accessibility", () => {
  it("has no a11y violations for an open dialog-role popover with focusable content", async () => {
    const { container } = renderClickPopoverWithFocusables();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Popover nested focus", () => {
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
});

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
