import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, StrictMode, useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Popover } from "../popover/index";
import { CommandPaletteHighlightItem, categorize, matchPositions } from "./highlight";
import { CommandPalette } from "./index";

afterEach(() => {
  vi.restoreAllMocks();
});

interface RenderOptions {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  highlighted?: string | null;
  onHighlightChange?: (id: string | null) => void;
  onActivate?: (id: string) => void;
  shouldFilter?: boolean;
  filter?: (value: string, search: string) => boolean;
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

describe("CommandPalette", () => {
  it("supports direct namespaced parts inside groups", async () => {
    const onActivate = vi.fn();
    render(
      <CommandPalette open onActivate={onActivate}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Group heading="Actions">
              <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
              <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
            </CommandPalette.Group>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    await userEvent.type(screen.getByRole("combobox"), "{ArrowDown}{Enter}");

    expect(onActivate).toHaveBeenCalledWith("paste");
  });

  it("supports keyboard activation for items rendered by wrappers", async () => {
    const onActivate = vi.fn();
    function WrappedCommandItem() {
      return <CommandPalette.Item id="wrapped">Wrapped</CommandPalette.Item>;
    }

    render(
      <CommandPalette open onActivate={onActivate}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="direct">Direct</CommandPalette.Item>
            <WrappedCommandItem />
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    expect(screen.getByRole("option", { name: /wrapped/i })).toBeInTheDocument();

    await userEvent.type(screen.getByRole("combobox"), "wrapped{Enter}");

    expect(onActivate).toHaveBeenCalledWith("wrapped");
  });

  it("does not render content when closed", () => {
    renderPalette({ open: false });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("exposes modal dialog semantics", () => {
    renderPalette();
    expect(screen.getByRole("dialog", { name: "Command palette" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
  });

  it("focuses the combobox immediately when opened", () => {
    renderPalette();
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("filters items based on search input and shows empty state", async () => {
    renderPalette();
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "cop");
    expect(screen.getByRole("option", { name: /copy/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Paste" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Delete" })).not.toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "zzzzz");
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("uses a custom filter function", async () => {
    const customFilter = (_value: string, search: string) => search === "magic";
    renderPalette({ filter: customFilter });
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "magic");
    expect(screen.getByRole("option", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /paste/i })).toBeInTheDocument();
  });

  it("skips filtering when shouldFilter is false", async () => {
    renderPalette({ shouldFilter: false });
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "zzzzz");
    expect(screen.getByRole("option", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /paste/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /delete/i })).toBeInTheDocument();
  });

  it("filters a 200-item list down to the matching row", async () => {
    const items = Array.from({ length: 200 }, (_, index) => `item-${index}`);
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            {items.map((id) => (
              <CommandPalette.Item key={id} id={id}>
                {id}
              </CommandPalette.Item>
            ))}
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;
    await userEvent.type(input, "item-42");
    expect(input.value).toBe("item-42");

    await waitFor(() => {
      const visible = screen.getAllByRole("option");
      expect(visible).toHaveLength(1);
      expect(visible[0]).toHaveAccessibleName(/^item-42\b/);
    });
  });

  it("activates item on click, calls onSelect, closes palette, and skips disabled items", async () => {
    const onActivate = vi.fn();
    const onOpenChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <CommandPalette open onActivate={onActivate} onOpenChange={onOpenChange}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="nope" disabled>
              Nope
            </CommandPalette.Item>
            <CommandPalette.Item id="paste" onSelect={onSelect}>
              Paste
            </CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    await userEvent.click(screen.getByRole("option", { name: /nope/i }));
    expect(onActivate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("option", { name: /paste/i }));
    expect(onActivate).toHaveBeenCalledWith("paste");
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("auto-selects the first item and updates after filtering", async () => {
    renderPalette();
    expect(screen.getByRole("listbox", { name: "Command results" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "true");

    const input = screen.getByRole("combobox");
    await userEvent.type(input, "del");
    expect(screen.getByRole("option", { name: /delete/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("keeps item registration current under StrictMode filtering", async () => {
    const onActivate = vi.fn();
    render(
      <StrictMode>
        <CommandPalette open onActivate={onActivate}>
          <CommandPalette.Content>
            <CommandPalette.Input />
            <CommandPalette.List>
              <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
              <CommandPalette.Item id="delete">Delete</CommandPalette.Item>
            </CommandPalette.List>
          </CommandPalette.Content>
        </CommandPalette>
      </StrictMode>,
    );

    await userEvent.type(screen.getByRole("combobox"), "del{Enter}");
    expect(onActivate).toHaveBeenCalledWith("delete");
  });

  it("controlled search calls onSearchChange without updating internally", async () => {
    const onSearchChange = vi.fn();
    renderPalette({ search: "", onSearchChange });
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "x");
    expect(onSearchChange).toHaveBeenCalledWith("x");
    expect(input).toHaveValue("");
  });

  it("controlled highlighted calls onHighlightChange on navigation", async () => {
    const onHighlightChange = vi.fn();
    renderPalette({ highlighted: "copy", onHighlightChange });
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "{ArrowDown}");
    expect(onHighlightChange).toHaveBeenCalledWith("paste");
  });

  it("keeps Home and End available for text editing in the search input", async () => {
    const onHighlightChange = vi.fn();
    renderPalette({ highlighted: "delete", onHighlightChange });
    const input = screen.getByRole("combobox");

    await userEvent.type(input, "{Home}{End}");

    expect(onHighlightChange).not.toHaveBeenCalled();
  });

  it("keeps controlled null highlight unselected", () => {
    renderPalette({ highlighted: null });
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");
    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "false");
  });

  it("keeps public item ids separate from DOM-safe active descendant ids", () => {
    render(
      <CommandPalette open highlighted="a b/slash">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="">Empty</CommandPalette.Item>
            <CommandPalette.Item id="a b/slash">Special</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const input = screen.getByRole("combobox");
    const special = screen.getByRole("option", { name: /special/i });
    const empty = screen.getByRole("option", { name: "Empty" });

    expect(special.id).toBeTruthy();
    expect(empty.id).toBeTruthy();
    expect(special.id).not.toBe("a b/slash");
    expect(empty.id).not.toBe("");
    expect(special.id).not.toBe(empty.id);
    expect(input).toHaveAttribute("aria-activedescendant", special.id);
    expect(document.getElementById(special.id)).toBe(special);
  });

  it("omits stale controlled active descendants for disabled, filtered, and missing items", () => {
    const { rerender } = render(
      <CommandPalette open highlighted="delete">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
            <CommandPalette.Item id="delete" disabled>
              Delete
            </CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");

    rerender(
      <CommandPalette open highlighted="delete" search="copy">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
            <CommandPalette.Item id="delete">Delete</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");

    rerender(
      <CommandPalette open highlighted="missing">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");
  });

  it("forwards item props and refs while honoring preventDefault", async () => {
    const ref = createRef<HTMLDivElement>();
    const onActivate = vi.fn();
    const onClick = vi.fn((event) => event.preventDefault());

    render(
      <CommandPalette open onActivate={onActivate}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy" ref={ref} onClick={onClick}>
              Copy
            </CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const item = screen.getByRole("option", { name: /Copy/ });
    expect(ref.current).toBe(item);
    await userEvent.click(item);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("has no a11y violations when open or closed", async () => {
    const { container, rerender } = renderPalette();
    expect(await axe(container)).toHaveNoViolations();

    rerender(
      <CommandPalette open={false}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("navigates items with ArrowDown/ArrowUp and wraps around", async () => {
    renderPalette();
    const input = screen.getByRole("combobox");
    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "true");

    await userEvent.type(input, "{ArrowDown}");
    expect(screen.getByRole("option", { name: /paste/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "false");

    await userEvent.type(input, "{ArrowDown}");
    expect(screen.getByRole("option", { name: /delete/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await userEvent.type(input, "{ArrowUp}");
    expect(screen.getByRole("option", { name: /paste/i })).toHaveAttribute("aria-selected", "true");

    await userEvent.type(input, "{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "true");
  });

  it("lets input key handlers prevent Arrow and Enter navigation", async () => {
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

    await userEvent.type(input, "{ArrowDown}{Enter}");

    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /paste/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("activates the selected item on Enter", async () => {
    const onActivate = vi.fn();
    renderPalette({ onActivate });
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "{ArrowDown}");
    await userEvent.type(input, "{Enter}");
    expect(onActivate).toHaveBeenCalledWith("paste");
  });

  it("closes on Escape via dialog cancel, and clears search first when non-empty", async () => {
    const onOpenChange = vi.fn();
    renderPalette({ onOpenChange });
    const input = screen.getByRole("combobox");

    await userEvent.type(input, "cop");
    expect(input).toHaveValue("cop");
    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false }));
    expect(input).toHaveValue("");

    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clears search on Escape keydown without moving focus or closing", async () => {
    const onOpenChange = vi.fn();
    renderPalette({ onOpenChange });
    const input = screen.getByRole("combobox");

    await userEvent.type(input, "cop{Escape}");

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Space types in the search input without activating items", async () => {
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
    await userEvent.type(input, "hello world");
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

    // querySelector retained: the native <dialog> element drives the close-transition; the test needs the raw element to fire animationEnd against (a closed dialog loses its accessible role)
    const dialog = document.querySelector("dialog");
    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "closed"));
    // fireEvent retained: animationend has no user-event equivalent; presence transitions complete on this event
    if (dialog) fireEvent.animationEnd(dialog);

    await waitFor(() => expect(trigger).toHaveFocus());

    document.body.removeChild(trigger);
  });

  it("restores focus in close order for nested triggerless palettes", async () => {
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

    await userEvent.click(opener);
    const innerOpener = screen.getByRole("button", { name: "Open inner" });
    innerOpener.focus();
    await userEvent.click(innerOpener);

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

  it("emits data-frame on Content root and defaults to border", () => {
    const { rerender } = render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="a">A</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("data-frame", "border");

    rerender(
      <CommandPalette open>
        <CommandPalette.Content frame="terminal">
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="a">A</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("data-frame", "terminal");
  });

  it("emits data-density on Content root and defaults to compact", () => {
    const { rerender } = render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="a">A</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("data-density", "compact");

    rerender(
      <CommandPalette open>
        <CommandPalette.Content density="dense">
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="a">A</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("data-density", "dense");
  });

  it("propagates data-tone on items and defaults to neutral", () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="ok">Plain</CommandPalette.Item>
            <CommandPalette.Item id="rm" tone="destructive">
              Delete
            </CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.getByRole("option", { name: "Plain" })).toHaveAttribute("data-tone", "neutral");
    expect(screen.getByRole("option", { name: "Delete" })).toHaveAttribute(
      "data-tone",
      "destructive",
    );
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

    fireEvent.mouseMove(paste);

    expect(paste).toHaveAttribute("aria-selected", "true");
    expect(copy).toHaveAttribute("aria-selected", "false");
  });

  describe("CommandPaletteHighlightItem", () => {
    it("categorize maps verbs to tones", () => {
      expect(categorize("Delete branch")).toBe("destructive");
      expect(categorize("Go to History")).toBe("nav");
      expect(categorize("Toggle theme")).toBe("settings");
      expect(categorize("Ask the assistant")).toBe("ai");
      expect(categorize("Run tests")).toBe("action");
      expect(categorize("Random thing")).toBe("neutral");
    });

    it("categorize returns neutral for empty and whitespace-only input", () => {
      expect(categorize("")).toBe("neutral");
      expect(categorize("   ")).toBe("neutral");
    });

    it("matchPositions returns contiguous indices when substring present", () => {
      expect(matchPositions("Run tests", "tests")).toEqual([4, 5, 6, 7, 8]);
      expect(matchPositions("Run tests", "zzz")).toEqual([]);
    });

    it("matchPositions falls back to fuzzy non-contiguous indices", () => {
      // "hwl" is not contiguous in "Hello World" but each char appears in order.
      expect(matchPositions("Hello World", "hwl")).toEqual([0, 6, 9]);
    });

    it("infers tone and wraps matched characters in <mark>", async () => {
      render(
        <CommandPalette open search="del">
          <CommandPalette.Content>
            <CommandPalette.Input />
            <CommandPalette.List>
              <CommandPaletteHighlightItem id="rm">Delete branch</CommandPaletteHighlightItem>
            </CommandPalette.List>
          </CommandPalette.Content>
        </CommandPalette>,
      );

      const item = await screen.findByRole("option", { name: /delete branch/i });
      expect(item).toHaveAttribute("data-tone", "destructive");
      const marks = item.querySelectorAll('mark[data-slot="command-palette-item-match"]');
      expect(marks.length).toBe(3);
      expect(
        Array.from(marks)
          .map((m) => m.textContent)
          .join(""),
      ).toBe("Del");
    });

    it("explicit tone overrides inferred destructive tone", () => {
      render(
        <CommandPalette open>
          <CommandPalette.Content>
            <CommandPalette.Input />
            <CommandPalette.List>
              <CommandPaletteHighlightItem id="rm" tone="ai">
                Delete branch
              </CommandPaletteHighlightItem>
            </CommandPalette.List>
          </CommandPalette.Content>
        </CommandPalette>,
      );
      expect(screen.getByRole("option", { name: /delete branch/i })).toHaveAttribute(
        "data-tone",
        "ai",
      );
    });

    it("preserves non-text children when search is active (no silent content loss)", async () => {
      render(
        <CommandPalette open search="del">
          <CommandPalette.Content>
            <CommandPalette.Input />
            <CommandPalette.List>
              <CommandPaletteHighlightItem id="rm" label="Delete branch">
                Delete <strong>branch</strong>
              </CommandPaletteHighlightItem>
            </CommandPalette.List>
          </CommandPalette.Content>
        </CommandPalette>,
      );

      const item = await screen.findByRole("option", { name: /delete branch/i });
      // The <strong> node must still be in the rendered output — the highlight
      // wrapper must not strip mixed children to gain match marks.
      expect(item.querySelector("strong")).not.toBeNull();
      expect(item.querySelector("strong")?.textContent).toBe("branch");
    });
  });

  it("keeps the consumer-provided shortcut visible on the selected row", () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="theme" shortcut="⌘T">
              Switch Theme
            </CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    const item = screen.getByRole("option", { name: /switch theme/i });
    expect(item).toHaveAttribute("aria-selected", "true");
    // The shortcut span must still render its consumer text — no ↵ swap.
    const shortcut = item.querySelector('[data-slot="command-palette-item-shortcut"]');
    expect(shortcut?.textContent).toBe("⌘T");
    expect(item.textContent).not.toContain("↵");
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

    fireEvent.mouseMove(b);
    expect(b).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(c).toHaveAttribute("aria-selected", "true");
    expect(b).toHaveAttribute("aria-selected", "false");
  });

  it("keeps data-tone on disabled rows so consumers can still target them", () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="rm" tone="destructive" disabled>
              Delete branch
            </CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    const item = screen.getByRole("option", { name: /delete branch/i });
    expect(item).toHaveAttribute("data-tone", "destructive");
    expect(item).toHaveAttribute("aria-disabled", "true");
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

describe("CommandPalette CSS contract", () => {
  // command-palette.css declares frame/density/heading/item rules inside
  // @layer components. jsdom's CSSOM does not apply rules nested inside
  // @layer (and does not support pseudo-element getComputedStyle), so these
  // tests assert the public CSS contract by parsing the source CSS for the
  // selectors and declarations that frame/viewfinder/terminal/disabled depend on.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../../shared/command-palette.css");
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  function ruleBody(selectorFragment: string): string | null {
    const escaped = selectorFragment
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+")
      .replace(/:not\\\(/g, ":not\\(\\s*")
      .replace(/\\\)/g, "\\s*\\)");
    const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    return match?.[1] ?? null;
  }

  it("viewfinder selection draws a 2px left accent bar via ::after", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="viewfinder"] [data-slot="command-palette-item"][aria-selected="true"]::after',
    );
    expect(body).not.toBeNull();
    expect(body).toContain("width: 2px");
    expect(body).toContain("background: var(--cp-fg)");
    expect(body).toContain('content: ""');
  });

  it("viewfinder group headings render uppercase with letter-spacing", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="viewfinder"] [data-slot="command-palette-group-heading"]',
    );
    expect(body).not.toBeNull();
    expect(body).toContain("text-transform: uppercase");
    expect(body).toContain("letter-spacing: 0.06em");
    expect(body).toContain("font-size: 11px");
  });

  it("terminal frame heading adopts the kebab padding and lighter weight", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="terminal"] [data-slot="command-palette-group-heading"]',
    );
    expect(body).not.toBeNull();
    expect(body).toContain("font-weight: 400");
    expect(body).toContain("padding: 6px var(--cp-input-px) 2px");
  });

  it("terminal-frame selected row re-tints the tone bar to --cp-bg", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="terminal"] [data-slot="command-palette-item"][aria-selected="true"][data-tone]:not([data-tone="neutral"])::before',
    );
    expect(body).not.toBeNull();
    expect(body).toContain("background: var(--cp-bg)");
  });

  it("disabled items hide the tone bar", () => {
    const body = ruleBody('[data-slot="command-palette-item"][aria-disabled="true"]::before');
    expect(body).not.toBeNull();
    expect(body).toContain("display: none");
  });

  it("card frame defines a rounded shell with a gradient surface", () => {
    const body = ruleBody('[data-slot="command-palette-content"][data-frame="card"]');
    expect(body).not.toBeNull();
    expect(body).toContain("border-radius: 8px");
    expect(body).toContain("border: 1px solid var(--cp-border)");
    expect(body).toContain("linear-gradient");
  });

  it("card frame items float with rounded selection inside the list padding", () => {
    const itemBody = ruleBody(
      '[data-slot="command-palette-content"][data-frame="card"] [data-slot="command-palette-item"]',
    );
    expect(itemBody).not.toBeNull();
    expect(itemBody).toContain("margin: 0 var(--cp-list-p)");
    expect(itemBody).toContain("border-radius: 6px");

    const selectedBody = ruleBody(
      '[data-slot="command-palette-content"][data-frame="card"] [data-slot="command-palette-item"][aria-selected="true"]',
    );
    expect(selectedBody).not.toBeNull();
    expect(selectedBody).toContain("background: color-mix(in oklab, var(--cp-fg) 8%, transparent)");
  });
});

describe("CommandPaletteContent card frame", () => {
  it("emits data-frame=card on the dialog when frame=card is set", () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content frame="card">
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="a">Alpha</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("data-frame", "card");
  });
});
