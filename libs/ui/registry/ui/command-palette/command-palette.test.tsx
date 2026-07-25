import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
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
    const user = userEvent.setup();
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

    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("data-value", "copy");
    expect(screen.getByRole("option", { name: /paste/i })).toHaveAttribute("data-value", "paste");

    await user.type(screen.getByRole("combobox"), "{ArrowDown}{Enter}");

    expect(onActivate).toHaveBeenCalledWith("paste");
  });

  it("supports keyboard activation for items rendered by wrappers", async () => {
    const user = userEvent.setup();
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

    await user.type(screen.getByRole("combobox"), "wrapped{Enter}");

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
    const user = userEvent.setup();
    renderPalette();
    const input = screen.getByRole("combobox");
    await user.type(input, "cop");
    expect(screen.getByRole("option", { name: /copy/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Paste" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Delete" })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "zzzzz");
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("renders Empty as a presentational node with exactly one no-results announcer", async () => {
    const user = userEvent.setup();
    renderPalette();
    const input = screen.getByRole("combobox");
    await user.type(input, "zzzzz");

    const empty = screen.getByText("No results found");
    expect(empty).toHaveAttribute("role", "presentation");

    const liveRegions = screen
      .getAllByText(/no results/i)
      .filter((node) => node.getAttribute("aria-live") !== null);
    expect(liveRegions).toHaveLength(1);
    expect(empty).not.toHaveAttribute("aria-live");
  });

  it("keeps the listbox free of invalid live-region children when empty", async () => {
    const user = userEvent.setup();
    const { container } = renderPalette();
    const input = screen.getByRole("combobox");
    await user.type(input, "zzzzz");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("uses a custom filter function", async () => {
    const user = userEvent.setup();
    const customFilter = (_value: string, search: string) => search === "magic";
    renderPalette({ filter: customFilter });
    const input = screen.getByRole("combobox");
    await user.type(input, "magic");
    expect(screen.getByRole("option", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /paste/i })).toBeInTheDocument();
  });

  it("skips filtering when shouldFilter is false", async () => {
    const user = userEvent.setup();
    renderPalette({ shouldFilter: false });
    const input = screen.getByRole("combobox");
    await user.type(input, "zzzzz");
    expect(screen.getByRole("option", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /paste/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /delete/i })).toBeInTheDocument();
  });

  it("filters a 200-item list down to the matching row", async () => {
    const user = userEvent.setup();
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
    await user.type(input, "item-42");
    expect(input.value).toBe("item-42");

    await waitFor(() => {
      const visible = screen.getAllByRole("option");
      expect(visible).toHaveLength(1);
      expect(visible[0]).toHaveAccessibleName(/^item-42\b/);
    });
  });

  it("activates item on click, calls onSelect, closes palette, and skips disabled items", async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole("option", { name: /nope/i }));
    expect(onActivate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("option", { name: /paste/i }));
    expect(onActivate).toHaveBeenCalledWith("paste");
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("auto-selects the first item and updates after filtering", async () => {
    const user = userEvent.setup();
    renderPalette();
    expect(screen.getByRole("listbox", { name: "Command results" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "true");

    const input = screen.getByRole("combobox");
    await user.type(input, "del");
    expect(screen.getByRole("option", { name: /delete/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("marks the highlighted option with data-highlighted alongside aria-selected", async () => {
    const user = userEvent.setup();
    renderPalette();
    const copy = screen.getByRole("option", { name: /copy/i });
    const paste = screen.getByRole("option", { name: /paste/i });
    expect(copy).toHaveAttribute("data-highlighted");
    expect(paste).not.toHaveAttribute("data-highlighted");

    await user.type(screen.getByRole("combobox"), "{ArrowDown}");
    expect(paste).toHaveAttribute("data-highlighted");
    expect(paste).toHaveAttribute("aria-selected", "true");
    expect(copy).not.toHaveAttribute("data-highlighted");
  });

  it("keeps item registration current under StrictMode filtering", async () => {
    const user = userEvent.setup();
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

    await user.type(screen.getByRole("combobox"), "del{Enter}");
    expect(onActivate).toHaveBeenCalledWith("delete");
  });

  it("controlled search calls onSearchChange without updating internally", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    renderPalette({ search: "", onSearchChange });
    const input = screen.getByRole("combobox");
    await user.type(input, "x");
    expect(onSearchChange).toHaveBeenCalledWith("x");
    expect(input).toHaveValue("");
  });

  it("filters against the controlled live search value", () => {
    renderPalette({ search: "copy" });

    expect(screen.getByRole("option", { name: /copy/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /paste/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("controlled highlighted calls onHighlightChange on navigation", async () => {
    const user = userEvent.setup();
    const onHighlightChange = vi.fn();
    const { rerender } = renderPalette({ highlighted: "copy", onHighlightChange });
    const input = screen.getByRole("combobox");
    await user.type(input, "{ArrowDown}");
    expect(onHighlightChange).toHaveBeenCalledWith("paste");
    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /paste/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    rerender(
      <CommandPalette open highlighted="paste" onHighlightChange={onHighlightChange}>
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
    expect(screen.getByRole("option", { name: /paste/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /copy/i })).toHaveAttribute("aria-selected", "false");
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

  it.each<[string, { hidden?: boolean; inert?: boolean; "aria-hidden"?: boolean }]>([
    ["hidden", { hidden: true }],
    ["inert", { inert: true }],
    ["aria-hidden", { "aria-hidden": true }],
  ])("skips a %s first item when resolving the fallback active descendant", (_attribute, itemProps) => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item {...itemProps} id="first">
              First
            </CommandPalette.Item>
            <CommandPalette.Item id="second">Second</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const input = screen.getByRole("combobox");
    const second = screen.getByRole("option", { name: "Second" });
    expect(input).toHaveAttribute("aria-activedescendant", second.id);
  });

  it("re-resolves the fallback active descendant when an item is hidden after mount", async () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="first">First</CommandPalette.Item>
            <CommandPalette.Item id="second">Second</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const input = screen.getByRole("combobox");
    const first = screen.getByRole("option", { name: "First" });
    const second = screen.getByRole("option", { name: "Second" });
    expect(input).toHaveAttribute("aria-activedescendant", first.id);

    first.setAttribute("hidden", "");
    await waitFor(() => expect(input).toHaveAttribute("aria-activedescendant", second.id));
  });

  it("re-resolves the fallback active descendant when a stylesheet hides an item after mount", async () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item className="palette-stylesheet-hidden" id="first">
              First
            </CommandPalette.Item>
            <CommandPalette.Item id="second">Second</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    const input = screen.getByRole("combobox");
    const first = screen.getByRole("option", { name: "First" });
    const second = screen.getByRole("option", { name: "Second" });
    expect(input).toHaveAttribute("aria-activedescendant", first.id);

    // The rule lands outside the list subtree, so only document-level stylesheet
    // observation can invalidate eligibility here.
    const style = document.createElement("style");
    document.head.append(style);
    const ruleIndex = style.sheet?.insertRule(".palette-stylesheet-hidden { display: none; }");
    if (ruleIndex === undefined) throw new Error("Expected stylesheet rule insertion");

    try {
      await waitFor(() => expect(input).toHaveAttribute("aria-activedescendant", second.id));
    } finally {
      style.remove();
    }
  });

  it("forwards item props and refs while honoring preventDefault", async () => {
    const user = userEvent.setup();
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
    await user.click(item);
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
    const shortcut = item.querySelector('[data-slot="command-palette-item-shortcut"]');
    expect(shortcut?.textContent).toBe("⌘T");
    expect(item.textContent).not.toContain("↵");
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

describe("CommandPaletteContent embedded mode", () => {
  it("renders the open surface in the document flow without a dialog or focus steal", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Outside</button>
        <CommandPalette open>
          <CommandPalette.Content modal={false} label="Embedded palette" frame="viewfinder">
            <CommandPalette.Input />
            <CommandPalette.List>
              <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
              <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
            </CommandPalette.List>
          </CommandPalette.Content>
        </CommandPalette>
      </div>,
    );

    const region = screen.getByRole("group", { name: "Embedded palette" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(region).toHaveAttribute("data-frame", "viewfinder");
    expect(region).toHaveAttribute("data-state", "open");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(document.body).toHaveFocus();

    // No focus trap: the surrounding page stays reachable.
    await user.tab();
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
  });

  it("filters embedded items from the search input", async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette open>
        <CommandPalette.Content modal={false} label="Embedded palette">
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
            <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
            <CommandPalette.Empty>No results found</CommandPalette.Empty>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    await user.type(screen.getByRole("combobox", { name: "Command search" }), "past");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveAttribute("data-value", "paste");
  });

  it("unmounts the embedded surface when the consumer closes it", () => {
    const { rerender } = render(
      <CommandPalette open>
        <CommandPalette.Content modal={false} label="Embedded palette">
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.getByRole("group", { name: "Embedded palette" })).toBeInTheDocument();

    rerender(
      <CommandPalette open={false}>
        <CommandPalette.Content modal={false} label="Embedded palette">
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.queryByRole("group", { name: "Embedded palette" })).not.toBeInTheDocument();
  });
});
