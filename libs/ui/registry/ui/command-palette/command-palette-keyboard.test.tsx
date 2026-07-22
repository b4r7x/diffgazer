import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { commandPaletteDoc } from "../../component-docs/command-palette";
import { Popover } from "../popover/index";
import { CommandPalette } from "./index";

interface RenderOptions {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  highlighted?: string | null;
  onHighlightChange?: (id: string | null) => void;
  onActivate?: (id: string) => void;
}

function renderPalette(props: RenderOptions = {}) {
  const { open = true, ...rest } = props;
  return render(
    <CommandPalette open={open} {...rest}>
      <CommandPalette.Content>
        <CommandPalette.Input />
        <CommandPalette.List>
          <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
          <CommandPalette.Item id="delete">Delete</CommandPalette.Item>
        </CommandPalette.List>
        <CommandPalette.Empty>No results found</CommandPalette.Empty>
      </CommandPalette.Content>
    </CommandPalette>,
  );
}

describe("CommandPalette keyboard", () => {
  it("keeps Home and End available for text editing in the search input", async () => {
    const user = userEvent.setup();
    const onHighlightChange = vi.fn();
    renderPalette({ highlighted: "delete", onHighlightChange });
    const input = screen.getByRole<HTMLInputElement>("combobox");

    expect(commandPaletteDoc.keyboard?.keys).not.toContainEqual(
      expect.objectContaining({ keys: "Home / End" }),
    );
    expect(commandPaletteDoc.keyboard?.description).toContain(
      "Home and End retain their native search-input editing behavior",
    );

    await user.type(input, "copy");
    onHighlightChange.mockClear();

    await user.keyboard("{Home}");
    expect(input.selectionStart).toBe(0);

    await user.keyboard("{End}");
    expect(input.selectionStart).toBe(4);

    expect(onHighlightChange).not.toHaveBeenCalled();
  });

  it("navigates items with ArrowDown/ArrowUp and wraps around", async () => {
    const user = userEvent.setup();
    const { container } = renderPalette();
    const input = screen.getByRole("combobox");
    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "true");

    await user.type(input, "{ArrowDown}");
    expect(screen.getByRole("option", { name: /paste/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "false");

    await user.type(input, "{ArrowDown}");
    expect(screen.getByRole("option", { name: /delete/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.type(input, "{ArrowUp}");
    expect(screen.getByRole("option", { name: /paste/i })).toHaveAttribute("aria-selected", "true");

    await user.type(input, "{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "true");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("lets input key handlers prevent Arrow and Enter navigation", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(
      <CommandPalette open onActivate={onActivate}>
        <CommandPalette.Content>
          <CommandPalette.Input onKeyDown={(event) => event.preventDefault()} />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
            <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    const input = screen.getByRole("combobox");

    await user.type(input, "{ArrowDown}{Enter}");

    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /paste/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("activates the selected item on Enter", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    renderPalette({ onActivate });
    const input = screen.getByRole("combobox");
    await user.type(input, "{ArrowDown}");
    await user.type(input, "{Enter}");
    expect(onActivate).toHaveBeenCalledWith("paste");
  });

  it("ignores Enter during IME composition", () => {
    const onActivate = vi.fn();
    const onOpenChange = vi.fn();
    renderPalette({ onActivate, onOpenChange });
    const input = screen.getByRole("combobox");

    // fireEvent retained: composition state is a native KeyboardEvent property.
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", isComposing: true });

    expect(onActivate).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });

  it("closes on Escape via dialog cancel, and clears search first when non-empty", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPalette({ onOpenChange });
    const input = screen.getByRole("combobox");

    await user.type(input, "cop");
    expect(input).toHaveValue("cop");
    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false }));
    expect(input).toHaveValue("");

    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clears search on Escape keydown without moving focus or closing", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPalette({ onOpenChange });
    const input = screen.getByRole("combobox");

    await user.type(input, "cop{Escape}");

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Space types in the search input without activating items", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(
      <CommandPalette open onActivate={onActivate}>
        <CommandPalette.Content>
          <CommandPalette.Input placeholder="Search..." />
          <CommandPalette.List>
            <CommandPalette.Item id="item-1">Item One</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    const input = screen.getByRole("combobox");
    input.focus();
    await user.type(input, "hello world");
    expect(input).toHaveValue("hello world");
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("restores focus to previously-focused element after close", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "External";
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="one">One</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const dialog = document.querySelector("dialog");

    rerender(
      <CommandPalette open={false}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="one">One</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    if (dialog && document.body.contains(dialog)) {
      await waitFor(() => expect(dialog).toHaveAttribute("data-state", "closed"));
      // fireEvent retained: animationend has no user-event equivalent; presence transitions complete on this event
      fireEvent.animationEnd(dialog);
    }

    await waitFor(() => expect(trigger).toHaveFocus());

    document.body.removeChild(trigger);
  });

  it("restores focus in close order for nested triggerless palettes", async () => {
    const user = userEvent.setup();
    function NestedPalettes() {
      const [outerOpen, setOuterOpen] = useState(false);
      const [innerOpen, setInnerOpen] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setOuterOpen(true)}>
            Open outer
          </button>
          <CommandPalette open={outerOpen} onOpenChange={setOuterOpen}>
            <CommandPalette.Content label="Outer palette">
              <button type="button" onClick={() => setInnerOpen(true)}>
                Open inner
              </button>
              <CommandPalette.Input />
              <CommandPalette.List>
                <CommandPalette.Item id="outer">Outer action</CommandPalette.Item>
              </CommandPalette.List>
            </CommandPalette.Content>
          </CommandPalette>
          <CommandPalette open={innerOpen} onOpenChange={setInnerOpen}>
            <CommandPalette.Content label="Inner palette">
              <CommandPalette.Input />
              <CommandPalette.List>
                <CommandPalette.Item id="inner">Inner action</CommandPalette.Item>
              </CommandPalette.List>
            </CommandPalette.Content>
          </CommandPalette>
        </>
      );
    }

    render(<NestedPalettes />);
    const opener = screen.getByRole("button", { name: "Open outer" });

    await user.click(opener);
    const innerOpener = screen.getByRole("button", { name: "Open inner" });
    innerOpener.focus();
    await user.click(innerOpener);

    const innerDialog = screen.getByRole("dialog", { name: "Inner palette" });
    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(innerDialog, new Event("cancel", { bubbles: false }));
    await waitFor(() => expect(innerDialog).toHaveAttribute("data-state", "closed"));
    // fireEvent retained: animationend has no user-event equivalent; presence transitions complete on this event
    fireEvent.animationEnd(innerDialog);
    await waitFor(() => expect(innerOpener).toHaveFocus());

    const outerDialog = screen.getByRole("dialog", { name: "Outer palette" });
    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(outerDialog, new Event("cancel", { bubbles: false }));
    await waitFor(() => expect(outerDialog).toHaveAttribute("data-state", "closed"));
    // fireEvent retained: animationend has no user-event equivalent; presence transitions complete on this event
    fireEvent.animationEnd(outerDialog);
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("moves highlight to the item under the mouse on mousemove", async () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
            <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    const copy = screen.getByRole("option", { name: /copy/i });
    const paste = screen.getByRole("option", { name: /paste/i });
    expect(copy).toHaveAttribute("aria-selected", "true");

    // fireEvent retained: hover movement changes active descendant without click/focus side effects.
    fireEvent.mouseMove(paste);

    expect(paste).toHaveAttribute("aria-selected", "true");
    expect(copy).toHaveAttribute("aria-selected", "false");
  });

  it("keyboard ArrowDown advances past a mouse-hovered row", () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="a">Alpha</CommandPalette.Item>
            <CommandPalette.Item id="b">Bravo</CommandPalette.Item>
            <CommandPalette.Item id="c">Charlie</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const a = screen.getByRole("option", { name: "Alpha" });
    const b = screen.getByRole("option", { name: "Bravo" });
    const c = screen.getByRole("option", { name: "Charlie" });
    expect(a).toHaveAttribute("aria-selected", "true");

    // fireEvent retained: hover movement establishes the mouse-highlighted row before keyboard navigation.
    fireEvent.mouseMove(b);
    expect(b).toHaveAttribute("aria-selected", "true");

    // fireEvent retained: direct keydown asserts ArrowDown behavior after a pointer-only highlight.
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(c).toHaveAttribute("aria-selected", "true");
    expect(b).toHaveAttribute("aria-selected", "false");
  });

  it("keeps nested portals inside the command palette dialog", async () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <Popover triggerMode="click" defaultOpen>
            <Popover.Trigger>Nested popover trigger</Popover.Trigger>
            <Popover.Content aria-label="Command nested popover">
              <button type="button">Nested action</button>
            </Popover.Content>
          </Popover>
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    const popoverTrigger = screen.getByRole("button", { name: "Nested popover trigger" });
    const popoverId = popoverTrigger.getAttribute("aria-controls");
    if (!popoverId) throw new Error("Expected nested popover trigger to control mounted content");

    await waitFor(() => {
      const popover = document.getElementById(popoverId);
      expect(popover).not.toBeNull();
      expect(dialog.contains(popover)).toBe(true);
      expect(popover?.parentElement).not.toBe(document.body);
    });
  });
});
