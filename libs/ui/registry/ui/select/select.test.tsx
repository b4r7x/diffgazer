import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, Fragment, type ReactNode, useState } from "react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { applyReducedMotionFixture } from "../../../testing/prefers-reduced-motion";
import { selectDoc } from "../../component-docs/select";
import { Field } from "../field/index";
import { Select, type SelectProps, type SelectTagsProps, type SelectValueProps } from "./index";
import { useSelectContext } from "./select-context";
import type { SelectItemProps } from "./select-item";

const PICK_FRUIT = "Pick a fruit";

function getSelectTrigger() {
  const trigger = document.querySelector<HTMLElement>('[data-slot="select-trigger"]');
  if (!trigger) throw new Error("Expected a SelectTrigger to be rendered");
  return trigger;
}

function getSearchInput() {
  return screen.getByRole("combobox", { name: /search options/i });
}

function getTestForm(label: string | RegExp = "Test form") {
  return screen.getByRole("form", { name: label }) as HTMLFormElement;
}

function renderSelect({
  multiple,
  defaultValue,
  value,
  onChange,
  open,
  onOpenChange,
  defaultOpen,
  disabled,
  highlighted,
  items = ["Apple", "Banana", "Cherry"],
  withSearch = false,
  variant = "card",
  tagsClassName,
}: {
  multiple?: boolean;
  defaultValue?: string | string[];
  value?: string | string[];
  onChange?: (v: string | string[]) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  disabled?: boolean;
  highlighted?: string | null;
  items?: string[];
  withSearch?: boolean;
  variant?: "default" | "card";
  tagsClassName?: string;
} = {}) {
  const commonProps = {
    variant,
    children: null,
    ...(open !== undefined ? { open } : {}),
    ...(onOpenChange ? { onOpenChange } : {}),
    ...(defaultOpen !== undefined ? { defaultOpen } : {}),
    ...(disabled ? { disabled: true } : {}),
    ...(highlighted !== undefined ? { highlighted } : {}),
  };
  const props: SelectProps = multiple
    ? {
        ...commonProps,
        multiple: true,
        ...(Array.isArray(defaultValue) ? { defaultValue } : {}),
        ...(Array.isArray(value) ? { value } : {}),
        ...(onChange ? { onChange: onChange as (v: string[]) => void } : {}),
      }
    : {
        ...commonProps,
        multiple: false,
        ...(typeof defaultValue === "string" ? { defaultValue } : {}),
        ...(typeof value === "string" ? { value } : {}),
        ...(onChange ? { onChange: onChange as (v: string) => void } : {}),
      };

  return render(
    <Select {...props}>
      <Select.Trigger aria-label="Fruit">
        {multiple ? (
          <Select.Tags placeholder="Pick fruits" className={tagsClassName} />
        ) : (
          <Select.Value placeholder={PICK_FRUIT} />
        )}
      </Select.Trigger>
      <Select.Content>
        {withSearch && <Select.Search />}
        {items.map((item) => (
          <Select.Item key={item} value={item.toLowerCase()}>
            {item}
          </Select.Item>
        ))}
        {withSearch && <Select.Empty />}
      </Select.Content>
    </Select>,
  );
}

interface InlineRenderProps {
  readonly children: ReactNode;
  readonly multiple?: boolean;
  readonly variant?: "default" | "card";
  readonly defaultValue?: string | string[];
  readonly onChange?: (v: string | string[]) => void;
  readonly defaultOpen?: boolean;
  readonly highlighted?: string | null;
  readonly onHighlightChange?: (id: string | null) => void;
}

function renderSelectInline({
  children,
  multiple,
  variant = "card",
  defaultValue,
  onChange,
  defaultOpen,
  highlighted,
  onHighlightChange,
}: InlineRenderProps) {
  const commonProps = {
    variant,
    ...(defaultOpen !== undefined ? { defaultOpen } : {}),
    ...(highlighted !== undefined ? { highlighted } : {}),
    ...(onHighlightChange ? { onHighlightChange } : {}),
  };
  const props: SelectProps = multiple
    ? {
        ...commonProps,
        multiple: true,
        children: null,
        ...(Array.isArray(defaultValue) ? { defaultValue } : {}),
        ...(onChange ? { onChange: onChange as (v: string[]) => void } : {}),
      }
    : {
        ...commonProps,
        multiple: false,
        children: null,
        ...(typeof defaultValue === "string" ? { defaultValue } : {}),
        ...(onChange ? { onChange: onChange as (v: string) => void } : {}),
      };

  return render(
    <Select {...props}>
      <Select.Trigger aria-label="Fruit">
        {multiple ? (
          <Select.Tags placeholder="Pick fruits" />
        ) : (
          <Select.Value placeholder={PICK_FRUIT} />
        )}
      </Select.Trigger>
      <Select.Content>{children}</Select.Content>
    </Select>,
  );
}

describe("Select selection", () => {
  it("passes selected values and registered labels to the SelectValue render function", async () => {
    render(
      <Select defaultOpen defaultValue="banana">
        <Select.Trigger aria-label="Fruit">
          <Select.Value>
            {({ selected, labels }) =>
              `${selected.join(", ")}: ${selected.map((value) => labels.get(value)).join(", ")}`
            }
          </Select.Value>
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );

    expect(await screen.findByText("banana: Banana")).toBeInTheDocument();
  });

  it("supports direct namespaced parts with custom option UI inside Select.Item", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelectInline({
      defaultOpen: true,
      onChange,
      children: (
        <>
          <Select.Search />
          <Select.Item value="banana" textValue="Banana">
            <span>Banana</span>
            <span aria-hidden="true">ripe</span>
          </Select.Item>
        </>
      ),
    });

    await user.type(getSearchInput(), "ban");
    await user.click(screen.getByRole("option", { name: /banana/i }));
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("toggles open/close on trigger click", async () => {
    const user = userEvent.setup();
    renderSelect();
    const trigger = getSelectTrigger();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");
  });

  it("does not invalidate the context value when the consumer passes an inline onChange", async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useSelectContext("Probe"));
      return null;
    }
    // Constant children isolate F-054: only the inline onChange identity changes
    // across re-renders.
    const content = (
      <>
        <Select.Trigger>
          <Select.Value placeholder="x" />
        </Select.Trigger>
        <Probe />
      </>
    );
    function Parent() {
      const [, setTick] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            rerender
          </button>
          <Select value="a" onChange={() => undefined}>
            {content}
          </Select>
        </>
      );
    }
    render(<Parent />);
    const before = seen.length;
    const initialContext = seen.at(-1);
    await user.click(screen.getByRole("button", { name: "rerender" }));
    expect(seen.length).toBe(before);
    expect(seen.at(-1)).toBe(initialContext);
  });

  it("emits data-slot and data-state styling hooks on the trigger", async () => {
    const user = userEvent.setup();
    renderSelect();
    const trigger = getSelectTrigger();
    expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    expect(trigger).toHaveAttribute("data-state", "closed");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("data-state", "open");
  });

  it("exposes data-disabled on a disabled trigger", () => {
    renderSelect({ disabled: true });
    expect(getSelectTrigger()).toHaveAttribute("data-disabled", "");
  });

  it("selects a single value on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ onChange });
    await user.click(getSelectTrigger());
    await user.click(screen.getByText("Banana"));
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("activates a default portalled option on mouse click before outside-click close", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ variant: "default", onChange });
    await user.click(getSelectTrigger());
    await user.click(screen.getByRole("option", { name: /banana/i }));

    expect(onChange).toHaveBeenCalledWith("banana");
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("selects multiple values on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ multiple: true, defaultValue: [], onChange });
    await user.click(getSelectTrigger());
    await user.click(screen.getByText("Apple"));
    expect(onChange).toHaveBeenCalledWith(["apple"]);
    await user.click(screen.getByText("Cherry"));
    expect(onChange).toHaveBeenCalledWith(["apple", "cherry"]);
  });

  it("keeps a default portalled multi-select open while activating mouse options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ variant: "default", multiple: true, defaultValue: [], onChange });
    await user.click(getSelectTrigger());
    await user.click(screen.getByRole("option", { name: /apple/i }));

    expect(onChange).toHaveBeenCalledWith(["apple"]);
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("deselects an already-selected value in multiple mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ multiple: true, defaultValue: ["apple", "banana"], onChange });
    await user.click(getSelectTrigger());
    await user.click(screen.getByRole("option", { name: /Apple/i }));
    expect(onChange).toHaveBeenCalledWith(["banana"]);
  });

  it("stays open after selection in multiple mode", async () => {
    const user = userEvent.setup();
    renderSelect({ multiple: true, defaultValue: [] });
    const trigger = getSelectTrigger();
    await user.click(trigger);
    await user.click(screen.getByText("Apple"));
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("renders selected tags without nested controls in multiple mode", () => {
    renderSelect({ multiple: true, defaultValue: ["apple", "banana"] });
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/i })).not.toBeInTheDocument();
  });

  it.each([
    { state: "empty", defaultValue: [] as string[], visibleText: "Pick fruits" },
    { state: "selected", defaultValue: ["apple"], visibleText: "Apple" },
  ])("merges SelectTags className in the $state state", ({ defaultValue, visibleText }) => {
    renderSelect({
      multiple: true,
      defaultValue,
      tagsClassName: "custom-select-tags",
    });

    expect(screen.getByText(visibleText).closest(".custom-select-tags")).not.toBeNull();
  });

  it("removes a selected tag by selecting its option again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ multiple: true, defaultValue: ["apple", "banana"], onChange });
    await user.click(getSelectTrigger());
    await user.click(screen.getByRole("option", { name: /Apple/i }));
    expect(onChange).toHaveBeenCalledWith(["banana"]);
  });

  it("excludes decorative indicators from option names", () => {
    renderSelect({ defaultOpen: true, defaultValue: "banana" });
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /✓/ })).not.toBeInTheDocument();
  });
});

describe("Select controlled state", () => {
  it("works in uncontrolled mode with defaultValue", async () => {
    const user = userEvent.setup();
    renderSelect({ defaultValue: "banana" });
    expect(screen.getByText("Banana")).toBeInTheDocument();
    await user.click(getSelectTrigger());
    expect(screen.getByRole("option", { name: /banana/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("respects controlled open prop", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderSelect({ open: false, onOpenChange });
    await user.click(getSelectTrigger());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("clears a searchable session when controlled open changes to false", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    function ControlledSelect({ open }: { open: boolean }) {
      return (
        <Select open={open} onOpenChange={onOpenChange}>
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <Select.Search />
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      );
    }

    const { rerender } = render(<ControlledSelect open />);
    await user.type(getSearchInput(), "ban");
    expect(getSearchInput()).toHaveValue("ban");
    expect(screen.queryByRole("option", { name: "Apple" })).not.toBeInTheDocument();

    rerender(<ControlledSelect open={false} />);
    rerender(<ControlledSelect open />);

    expect(getSearchInput()).toHaveValue("");
    expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes the dropdown and notifies onOpenChange when disabled while open", async () => {
    const onOpenChange = vi.fn();

    function Harness({ disabled }: { disabled?: boolean }) {
      return (
        <Select variant="default" defaultOpen disabled={disabled} onOpenChange={onOpenChange}>
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      );
    }

    const { rerender } = render(<Harness />);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    rerender(<Harness disabled />);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("respects controlled value prop", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ value: "apple", onChange });
    await user.click(getSelectTrigger());
    await user.click(screen.getByText("Banana"));
    expect(onChange).toHaveBeenCalledWith("banana");
    await user.click(getSelectTrigger());
    expect(screen.getByRole("option", { name: /apple/i })).toHaveAttribute("aria-selected", "true");
  });

  it("treats explicit undefined value as a controlled empty value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select variant="card" value={undefined} onChange={onChange}>
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );

    expect(screen.getByText(PICK_FRUIT)).toBeInTheDocument();
    await user.click(getSelectTrigger());
    await user.click(screen.getByRole("option", { name: /banana/i }));
    expect(onChange).toHaveBeenCalledWith("banana");
    expect(screen.getByText(PICK_FRUIT)).toBeInTheDocument();
  });

  it("keeps keyboard highlight when a different option is hovered", async () => {
    const user = userEvent.setup();
    const onHighlightChange = vi.fn();
    renderSelectInline({
      defaultOpen: true,
      onHighlightChange,
      children: (
        <>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </>
      ),
    });

    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith("apple"));
    onHighlightChange.mockClear();

    const appleOption = screen.getByRole("option", { name: /apple/i });
    const bananaOption = screen.getByRole("option", { name: /banana/i });
    await user.hover(bananaOption);

    expect(onHighlightChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-activedescendant", appleOption.id);
    expect(appleOption).toHaveAttribute("data-highlighted");
    expect(bananaOption).not.toHaveAttribute("data-highlighted");
  });

  it("assigns a div element to the forwarded ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Select ref={ref} variant="card">
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.childElementCount).toBeGreaterThan(0);
  });
});

describe("Select empty-string values", () => {
  function renderWithNoneOption(props: Omit<InlineRenderProps, "children"> = {}) {
    return renderSelectInline({
      ...props,
      children: (
        <>
          <Select.Item value="">None</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </>
      ),
    });
  }

  it("selects an empty string value via mouse click in single mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithNoneOption({ onChange });

    expect(screen.getByText(PICK_FRUIT)).toBeInTheDocument();
    await user.click(getSelectTrigger());
    await user.click(screen.getByRole("option", { name: "None" }));

    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("retains empty string entries in multiple-select state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithNoneOption({ multiple: true, defaultValue: [""], onChange });

    expect(screen.getByText("None")).toBeInTheDocument();
    await user.click(getSelectTrigger());
    await user.click(screen.getByRole("option", { name: /banana/i }));
    expect(onChange).toHaveBeenCalledWith(["", "banana"]);
  });

  it("activates an empty string highlight via keyboard Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithNoneOption({ defaultOpen: true, highlighted: "", onChange });

    screen.getByRole("listbox").focus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("Select disabled options", () => {
  const disabledBananaChildren = (
    <>
      <Select.Item value="apple">Apple</Select.Item>
      <Select.Item value="banana" disabled>
        Banana
      </Select.Item>
      <Select.Item value="blueberry">Blueberry</Select.Item>
    </>
  );

  it("does not open when the whole select is disabled", async () => {
    const user = userEvent.setup();
    renderSelect({ disabled: true });
    await user.click(getSelectTrigger());
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("does not select disabled options by click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelectInline({ defaultOpen: true, onChange, children: disabledBananaChildren });

    const disabledOption = screen.getByRole("option", { name: /banana/i });
    await user.click(disabledOption);

    expect(onChange).not.toHaveBeenCalled();
    expect(disabledOption).toHaveAttribute("aria-selected", "false");
  });

  it.each<{ readonly commit: "Enter" | "Tab" }>([
    { commit: "Enter" },
    { commit: "Tab" },
  ])("skips a disabled option during keyboard navigation and commits the next enabled option on $commit", async ({
    commit,
  }) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelectInline({ variant: "default", onChange, children: disabledBananaChildren });

    await user.click(getSelectTrigger());
    const listbox = screen.getByRole("listbox");
    const disabledOption = screen.getByRole("option", { name: /banana/i });
    const blueberryOption = screen.getByRole("option", { name: /blueberry/i });

    listbox.focus();
    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", blueberryOption.id);
    expect(listbox).not.toHaveAttribute("aria-activedescendant", disabledOption.id);

    if (commit === "Enter") {
      await user.keyboard("b");
      expect(listbox).toHaveAttribute("aria-activedescendant", blueberryOption.id);
      await user.keyboard("{Enter}");
    } else {
      await user.tab();
      expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
    }

    expect(onChange).toHaveBeenCalledWith("blueberry");
    expect(onChange).not.toHaveBeenCalledWith("banana");
  });
});

describe("Select search position", () => {
  function renderSearchPositioned(position?: "top" | "bottom") {
    render(
      <Select variant="card" defaultOpen>
        <Select.Trigger>
          <Select.Value placeholder="Pick" />
        </Select.Trigger>
        <Select.Content>
          <Select.Search {...(position ? { position } : {})} />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );
  }

  it("renders the search row after the listbox by default (bottom)", () => {
    renderSearchPositioned();
    const search = getSearchInput();
    const listbox = screen.getByRole("listbox");
    expect(listbox.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the search row before the listbox when position='top'", () => {
    renderSearchPositioned("top");
    const search = getSearchInput();
    const listbox = screen.getByRole("listbox");
    expect(listbox.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
});

describe("Select results live region", () => {
  it("mounts the status region before any query and swaps its text as the query changes", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true, defaultOpen: true });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    await user.type(getSearchInput(), "ban");
    expect(status).toHaveTextContent("1 results");

    await user.clear(getSearchInput());
    expect(status).toHaveTextContent("");
  });
});

describe("Select search filtering", () => {
  it("renders no empty state before a query, even when the option list is empty", () => {
    renderSelect({ withSearch: true, defaultOpen: true, items: [] });

    expect(getSearchInput()).toHaveValue("");
    expect(screen.queryByText("> no results.")).not.toBeInTheDocument();
  });

  it("filters items based on search query", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true });
    await user.click(getSelectTrigger());
    await user.type(getSearchInput(), "ban");
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
    expect(screen.queryByText("Cherry")).not.toBeInTheDocument();
  });

  it("activates searchable default portalled options on mouse click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ variant: "default", withSearch: true, onChange });

    await user.click(getSelectTrigger());
    await user.type(getSearchInput(), "ban");
    await user.click(screen.getByRole("option", { name: /banana/i }));

    expect(onChange).toHaveBeenCalledWith("banana");
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("shows empty state when search has no matches", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true });
    await user.click(getSelectTrigger());
    await user.type(getSearchInput(), "zzz");
    expect(screen.getByText("> no results.")).toBeInTheDocument();
  });

  it("keeps Select.Empty outside the searchable listbox", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true, defaultOpen: true });
    const listbox = screen.getByRole("listbox");
    await user.type(getSearchInput(), "zzz");
    expect(listbox).not.toContainElement(screen.getByText("> no results."));
  });

  it("does not activate a filtered-out highlighted option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ withSearch: true, defaultOpen: true, highlighted: "banana", onChange });

    await user.type(getSearchInput(), "zzz");
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps Home and End available for text editing in searchable input", async () => {
    const user = userEvent.setup();
    const onHighlightChange = vi.fn();
    renderSelectInline({
      defaultOpen: true,
      highlighted: "banana",
      onHighlightChange,
      children: (
        <>
          <Select.Search />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
          <Select.Item value="cherry">Cherry</Select.Item>
        </>
      ),
    });

    onHighlightChange.mockClear();
    await user.type(getSearchInput(), "{Home}{End}");
    expect(onHighlightChange).not.toHaveBeenCalled();
  });

  it("keeps searchable input outside listbox ownership", () => {
    renderSelect({ withSearch: true, defaultOpen: true });
    expect(screen.getByRole("listbox")).not.toContainElement(getSearchInput());
  });

  it("keeps wrapped searchable inputs outside listbox ownership", () => {
    renderSelectInline({
      defaultOpen: true,
      children: (
        <>
          {/* biome-ignore lint/complexity/noUselessFragments: the Fragment wrapper is intentional — this test asserts that Fragment-wrapped Select.Search inputs stay outside listbox ownership. */}
          <Fragment>
            <Select.Search />
          </Fragment>
          <div>
            <Select.Search aria-label="Filter options" />
          </div>
          <Select.Item value="apple">Apple</Select.Item>
        </>
      ),
    });
    const listbox = screen.getByRole("listbox");

    expect(listbox).not.toContainElement(getSearchInput());
    expect(listbox).not.toContainElement(screen.getByRole("combobox", { name: /filter options/i }));
  });

  it("preserves a DOM wrapper around hoisted Search and Empty children", async () => {
    const user = userEvent.setup();
    renderSelectInline({
      defaultOpen: true,
      children: (
        <div data-testid="search-only-wrapper">
          <Select.Search />
          <Select.Empty>No matches</Select.Empty>
        </div>
      ),
    });

    await user.type(getSearchInput(), "missing");

    const listbox = screen.getByRole("listbox");
    const wrappers = screen.getAllByTestId("search-only-wrapper");
    const searchWrapper = getSearchInput().closest<HTMLElement>(
      '[data-testid="search-only-wrapper"]',
    );
    const emptyWrapper = screen
      .getByText("No matches")
      .closest<HTMLElement>('[data-testid="search-only-wrapper"]');

    expect(wrappers).toHaveLength(2);
    expect(searchWrapper).not.toBeNull();
    expect(emptyWrapper).not.toBeNull();
    expect(listbox).not.toContainElement(searchWrapper);
    expect(listbox).not.toContainElement(emptyWrapper);
  });

  it("clones a mixed DOM wrapper for hoisted parts and listbox options", async () => {
    const user = userEvent.setup();
    renderSelectInline({
      defaultOpen: true,
      children: (
        <section data-testid="mixed-select-wrapper">
          <Select.Search position="top" />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Empty>No matching fruit</Select.Empty>
        </section>
      ),
    });

    const listbox = screen.getByRole("listbox");
    const option = screen.getByRole("option", { name: "Apple" });
    const searchWrapper = getSearchInput().closest<HTMLElement>(
      '[data-testid="mixed-select-wrapper"]',
    );
    const optionWrapper = option.closest<HTMLElement>('[data-testid="mixed-select-wrapper"]');

    expect(searchWrapper).not.toBeNull();
    expect(optionWrapper).not.toBeNull();
    expect(listbox).not.toContainElement(searchWrapper);
    expect(listbox).toContainElement(optionWrapper);

    await user.type(getSearchInput(), "missing");
    const emptyWrapper = screen
      .getByText("No matching fruit")
      .closest<HTMLElement>('[data-testid="mixed-select-wrapper"]');
    expect(emptyWrapper).not.toBeNull();
    expect(listbox).not.toContainElement(emptyWrapper);
    expect(screen.getAllByTestId("mixed-select-wrapper")).toHaveLength(3);
  });

  it("assigns wrapper identity and ARIA semantics to only one partition", async () => {
    const user = userEvent.setup();
    const { container } = renderSelectInline({
      defaultOpen: true,
      children: (
        // biome-ignore lint/a11y/useSemanticElements: a generic wrapper verifies that secondary clones lose explicit semantics; fieldset would keep an implicit group role.
        <section
          id="partitioned-select-wrapper"
          role="group"
          aria-label="Partitioned fruit"
          tabIndex={-1}
          className="consumer-wrapper"
          data-testid="semantic-select-wrapper"
        >
          <Select.Search />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Empty>No matching fruit</Select.Empty>
        </section>
      ),
    });

    const semanticWrapper = screen.getByRole("group", { name: "Partitioned fruit" });
    expect(semanticWrapper).toContainElement(screen.getByRole("option", { name: "Apple" }));

    await user.type(getSearchInput(), "missing");

    const wrappers = screen.getAllByTestId("semantic-select-wrapper");
    expect(wrappers).toHaveLength(3);
    expect(container.querySelectorAll("#partitioned-select-wrapper")).toHaveLength(1);
    expect(semanticWrapper).toHaveAttribute("id", "partitioned-select-wrapper");
    for (const wrapper of wrappers) {
      expect(wrapper).toHaveClass("consumer-wrapper");
      if (wrapper === semanticWrapper) continue;
      expect(wrapper).not.toHaveAttribute("id");
      expect(wrapper).not.toHaveAttribute("role");
      expect(wrapper).not.toHaveAttribute("aria-label");
      expect(wrapper).not.toHaveAttribute("tabindex");
    }
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Select keyboard navigation", () => {
  it.each(["Enter", " ", "ArrowDown"])("opens with %s key on trigger", async (key) => {
    const user = userEvent.setup();
    renderSelect();
    getSelectTrigger().focus();
    await user.keyboard(key === " " ? " " : `{${key}}`);
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("transfers focus from its trigger to the listbox when opening", async () => {
    const user = userEvent.setup();
    renderSelect({ variant: "default" });
    getSelectTrigger().focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("listbox")).toHaveFocus();
  });

  it("transfers focus from trigger toggle to search combobox when opening searchable Select via keyboard", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true });
    getSelectTrigger().focus();
    await user.keyboard("{ArrowDown}");

    const searchInput = getSearchInput();
    expect(searchInput).toHaveFocus();
    expect(searchInput).toHaveAttribute("aria-expanded", "true");
    expect(searchInput).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
  });

  it("closes with Escape key", async () => {
    const user = userEvent.setup();
    renderSelect({ variant: "default", defaultOpen: true });
    screen.getByRole("listbox").focus();
    await user.keyboard("{Escape}");
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes with Escape when focus has moved outside the listbox", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Outside</button>
        <Select defaultOpen>
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );

    const outside = screen.getByRole("button", { name: "Outside" });
    outside.focus();
    expect(outside).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox", { hidden: true })).not.toBeInTheDocument();
    expect(getSelectTrigger()).toHaveFocus();
  });

  it("closes with Escape from outside focus even when the outside handler prevents default", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button" onKeyDown={(event) => event.preventDefault()}>
          Outside
        </button>
        <Select defaultOpen>
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );

    screen.getByRole("button", { name: "Outside" }).focus();
    await user.keyboard("{Escape}");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox", { hidden: true })).not.toBeInTheDocument();
  });

  it("closes the focused open Select when another Select also starts open", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Select>
          <Select.Trigger aria-label="Branch">
            <Select.Value placeholder="Select a branch..." />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="main">main</Select.Item>
            <Select.Item value="develop">develop</Select.Item>
          </Select.Content>
        </Select>
        <Select defaultOpen>
          <Select.Trigger aria-label="Framework">
            <Select.Value placeholder="Select framework..." />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="react">React</Select.Item>
            <Select.Item value="vue">Vue</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );

    const branchTrigger = screen.getByRole("combobox", { name: "Branch" });
    branchTrigger.focus();
    await user.keyboard("{Enter}");

    expect(branchTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("combobox", { name: "Framework" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.keyboard("{Escape}");

    expect(branchTrigger).toHaveAttribute("aria-expanded", "false");
  });

  it("honors preventDefault for Escape inside content key handlers", async () => {
    const user = userEvent.setup();
    render(
      <Select defaultOpen>
        <Select.Trigger aria-label="Fruit">
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content onKeyDown={(event) => event.preventDefault()}>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );

    screen.getByRole("listbox").focus();
    await user.keyboard("{Escape}");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toHaveAttribute("data-state", "open");
  });

  it("navigates and selects options from the listbox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ onChange, defaultOpen: true });
    const listbox = screen.getByRole("listbox");
    const bananaOption = screen.getByRole("option", { name: /banana/i });
    listbox.focus();

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", bananaOption.id);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("moves and selects options from the searchable input with Arrow keys and Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelect({ withSearch: true, defaultOpen: true, onChange });

    const searchInput = getSearchInput();
    const bananaOption = screen.getByRole("option", { name: /banana/i });

    await user.type(searchInput, "{ArrowDown}");
    expect(searchInput).toHaveAttribute("aria-activedescendant", bananaOption.id);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("ignores Enter and Escape during IME composition in the searchable select", () => {
    const onChange = vi.fn();
    renderSelect({ withSearch: true, defaultOpen: true, onChange });

    const searchInput = getSearchInput();
    // fireEvent retained: userEvent cannot mark key events as IME composition events.
    fireEvent.keyDown(searchInput, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(onChange).not.toHaveBeenCalled();
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");

    // fireEvent retained: userEvent cannot mark key events as IME composition events.
    fireEvent.keyDown(searchInput, { key: "Escape", isComposing: true, keyCode: 229 });
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(getSearchInput()).toBeInTheDocument();
  });

  it("closes only the focused or topmost Select on Escape", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Select defaultOpen>
          <Select.Trigger aria-label="First fruit">
            <Select.Value placeholder="Pick first" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select>
        <Select defaultOpen>
          <Select.Trigger aria-label="Second fruit">
            <Select.Value placeholder="Pick second" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );
    const firstTrigger = screen.getByRole("combobox", { name: "First fruit" });
    const secondTrigger = screen.getByRole("combobox", { name: "Second fruit" });
    const [firstListbox] = screen.getAllByRole("listbox");
    firstListbox?.focus();

    await user.keyboard("{Escape}");

    expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("listbox")).toHaveLength(1);

    // fireEvent retained: an Escape dispatched outside every Select has no userEvent focus target.
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(secondTrigger).toHaveAttribute("aria-expanded", "false");
  });

  it("honors preventDefault in content key handlers", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select variant="card" defaultOpen highlighted="banana" onChange={onChange}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content onKeyDown={(event) => event.preventDefault()}>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );

    screen.getByRole("listbox").focus();
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on outside click", async () => {
    const user = userEvent.setup();
    renderSelect({ defaultOpen: true });
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    await user.click(document.body);
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("card variant does not hijack Escape from an unrelated focused input", () => {
    render(
      <>
        <input aria-label="Unrelated" />
        <Select variant="card" defaultOpen>
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );

    const outsideInput = screen.getByRole("textbox", { name: "Unrelated" });
    outsideInput.focus();
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });

    outsideInput.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByRole("listbox")).toBeVisible();
    expect(outsideInput).toHaveFocus();
  });

  it("card variant keeps its inline list on Tab and does not commit the highlighted option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelectInline({
      defaultOpen: true,
      onChange,
      children: (
        <>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </>
      ),
    });

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /banana/i }).id,
    );

    await user.tab();

    expect(listbox).toBeVisible();
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens with the first enabled option highlighted on Home from the closed trigger", async () => {
    const user = userEvent.setup();
    renderSelect();
    getSelectTrigger().focus();
    await user.keyboard("{Home}");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /apple/i }).id,
    );
  });

  it("opens with the last enabled option highlighted on End from the closed trigger", async () => {
    const user = userEvent.setup();
    renderSelect();
    getSelectTrigger().focus();
    await user.keyboard("{End}");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /cherry/i }).id,
    );
  });

  it("opens and highlights the first typeahead match on a printable character from the closed trigger", async () => {
    const user = userEvent.setup();
    renderSelect();
    getSelectTrigger().focus();
    await user.keyboard("b");

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /banana/i }).id,
    );
  });

  it("starts a fresh typeahead query after close and reopen", async () => {
    const user = userEvent.setup();
    renderSelect();
    getSelectTrigger().focus();

    await user.keyboard("a");
    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /apple/i }).id,
    );

    await user.keyboard("{Escape}");
    await user.keyboard("b");

    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /banana/i }).id,
    );
  });

  it("scrolls the selected option into view when the dropdown opens", async () => {
    const user = userEvent.setup();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrolledElements: Element[] = [];
    const scrollFn = vi.fn(function (this: Element) {
      scrolledElements.push(this);
    });
    Element.prototype.scrollIntoView = scrollFn;
    const items = Array.from({ length: 50 }, (_, index) => `Option ${index + 1}`);

    try {
      const { unmount } = renderSelect({
        variant: "default",
        defaultValue: "option 45",
        items,
      });

      await user.click(getSelectTrigger());
      await waitFor(() => expect(scrollFn).toHaveBeenCalledWith({ block: "nearest" }));
      expect(scrolledElements).toContain(screen.getByRole("option", { name: "Option 45" }));

      unmount();
      scrollFn.mockClear();
      scrolledElements.length = 0;

      renderSelect({ variant: "default", items });
      getSelectTrigger().focus();
      await user.keyboard("{End}");

      await waitFor(() => expect(scrollFn).toHaveBeenCalledWith({ block: "nearest" }));
      expect(scrolledElements).toContain(screen.getByRole("option", { name: "Option 50" }));
    } finally {
      if (originalScrollIntoView) {
        Element.prototype.scrollIntoView = originalScrollIntoView;
      } else {
        Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      }
    }
  });

  it("scrolls the new highlighted option into view on listbox typeahead", async () => {
    const user = userEvent.setup();
    // jsdom does not implement scrollIntoView; define it before spying.
    const scrollFn = vi.fn();
    Element.prototype.scrollIntoView = scrollFn;
    renderSelect({ defaultOpen: true });
    screen.getByRole("listbox").focus();

    await user.keyboard("b");
    expect(scrollFn).toHaveBeenCalledWith({ block: "nearest" });
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  });

  it("scrolls the new highlighted option into view on searchable arrow navigation", async () => {
    const user = userEvent.setup();
    const scrollFn = vi.fn();
    Element.prototype.scrollIntoView = scrollFn;
    renderSelect({ withSearch: true, defaultOpen: true });

    await user.type(getSearchInput(), "{ArrowDown}");
    expect(scrollFn).toHaveBeenCalledWith({ block: "nearest" });
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  });

  it("extends the listbox typeahead query with Space without selecting", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelectInline({
      defaultOpen: true,
      onChange,
      children: (
        <>
          <Select.Item value="ny">New York</Select.Item>
          <Select.Item value="nj">New Jersey</Select.Item>
        </>
      ),
    });

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("new y");

    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "New York" }).id,
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Select Tab-close focus restore", () => {
  it("restores focus to the trigger when Tab-closing a multiple select", () => {
    render(
      <>
        <Select variant="default" multiple defaultValue={[]} defaultOpen>
          <Select.Trigger>
            <Select.Tags placeholder="Pick" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
        <button type="button">After</button>
      </>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    // fireEvent retained: direct keydown asserts synchronous focus handoff before browser Tab movement.
    fireEvent.keyDown(listbox, { key: "Tab" });

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(getSelectTrigger()).toHaveFocus();
  });

  it("restores focus to the trigger synchronously when Tab-closing a searchable select with no highlight", async () => {
    render(
      <>
        <Select variant="default" defaultOpen highlighted={null}>
          <Select.Trigger>
            <Select.Value placeholder="Pick" />
          </Select.Trigger>
          <Select.Content>
            <Select.Search />
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
        <button type="button">After</button>
      </>,
    );

    const searchInput = getSearchInput();
    searchInput.focus();
    // fireEvent retained: direct keydown asserts focus handoff while the search input unmounts.
    fireEvent.keyDown(searchInput, { key: "Tab" });

    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(getSelectTrigger()).toHaveFocus();
  });
});

describe("Select open-focus stability", () => {
  it.each([
    { initialState: "missing", initialDisabled: false },
    { initialState: "disabled", initialDisabled: true },
  ])("initializes a late enabled option after opening with it $initialState", async ({
    initialDisabled,
  }) => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Harness({ ready }: { ready: boolean }) {
      const showOption = initialDisabled || ready;
      return (
        <Select variant="default" onChange={onChange}>
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            {showOption && (
              <Select.Item value="apple" disabled={!ready}>
                Apple
              </Select.Item>
            )}
          </Select.Content>
        </Select>
      );
    }

    const { rerender } = render(<Harness ready={false} />);
    await user.click(getSelectTrigger());
    const listbox = screen.getByRole("listbox");
    expect(listbox).not.toHaveAttribute("aria-activedescendant");

    rerender(<Harness ready />);

    const apple = screen.getByRole("option", { name: "Apple" });
    await waitFor(() => expect(listbox).toHaveAttribute("aria-activedescendant", apple.id));
    expect(listbox).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("apple");
  });

  it("requests a controlled highlight when the first option arrives", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Harness({ ready }: { ready: boolean }) {
      const [highlighted, setHighlighted] = useState<string | null>(null);
      return (
        <Select
          variant="default"
          highlighted={highlighted}
          onHighlightChange={setHighlighted}
          onChange={onChange}
        >
          <Select.Trigger aria-label="Fruit">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>{ready && <Select.Item value="apple">Apple</Select.Item>}</Select.Content>
        </Select>
      );
    }

    const { rerender } = render(<Harness ready={false} />);
    await user.click(getSelectTrigger());
    const listbox = screen.getByRole("listbox");

    rerender(<Harness ready />);

    const apple = screen.getByRole("option", { name: "Apple" });
    await waitFor(() => expect(listbox).toHaveAttribute("aria-activedescendant", apple.id));
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("apple");
  });

  it("focuses searchable content when default-open Select mounts with unowned focus", async () => {
    renderSelect({ variant: "default", defaultOpen: true, withSearch: true });

    await waitFor(() => expect(getSearchInput()).toHaveFocus());
  });

  it.each([
    { label: "non-searchable", searchable: false },
    { label: "searchable", searchable: true },
  ])("does not steal focus when a $label default-open Select mounts late", async ({
    searchable,
  }) => {
    const user = userEvent.setup();

    function Harness() {
      const [isMounted, setIsMounted] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setIsMounted(true)}>
            Mount Select
          </button>
          {isMounted && (
            <Select variant="card" defaultOpen>
              <Select.Trigger aria-label="Fruit">
                <Select.Value placeholder={PICK_FRUIT} />
              </Select.Trigger>
              <Select.Content>
                {searchable && <Select.Search />}
                <Select.Item value="apple">Apple</Select.Item>
                <Select.Item value="banana">Banana</Select.Item>
              </Select.Content>
            </Select>
          )}
        </>
      );
    }

    render(<Harness />);
    const focusOwner = screen.getByRole("button", { name: "Mount Select" });
    await user.click(focusOwner);

    const listbox = screen.getByRole("listbox");
    const apple = screen.getByRole("option", { name: "Apple" });
    const activeDescendantOwner = searchable ? getSearchInput() : listbox;
    await waitFor(() =>
      expect(activeDescendantOwner).toHaveAttribute("aria-activedescendant", apple.id),
    );
    expect(focusOwner).toHaveFocus();
  });

  it("focuses the listbox on open but does not re-steal focus on later re-renders while open", async () => {
    function Harness({ extra }: { extra: string }) {
      return (
        <>
          <Select variant="default" defaultOpen>
            <Select.Trigger>
              <Select.Value placeholder="Pick" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="apple">Apple {extra}</Select.Item>
              <Select.Item value="banana">Banana {extra}</Select.Item>
            </Select.Content>
          </Select>
          <button type="button">Outside</button>
        </>
      );
    }

    const { rerender } = render(<Harness extra="x" />);
    const listbox = await screen.findByRole("listbox");
    await waitFor(() => expect(listbox).toHaveFocus());

    const outside = screen.getByRole("button", { name: "Outside" });
    outside.focus();
    expect(outside).toHaveFocus();

    rerender(<Harness extra="y" />);
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
  });
});

describe("Select active-descendant ownership", () => {
  it("makes the search input the editable combobox and reduces the trigger to a toggle when search is present", async () => {
    renderSelect({ withSearch: true, defaultOpen: true });
    const triggerButton = getSelectTrigger();
    const searchInput = getSearchInput();
    const listbox = screen.getByRole("listbox");
    const appleOption = screen.getByRole("option", { name: /apple/i });

    expect(screen.getAllByRole("combobox")).toEqual([searchInput]);
    expect(searchInput).toHaveAttribute("aria-controls", listbox.id);
    expect(searchInput).toHaveAttribute("aria-expanded", "true");
    expect(searchInput).toHaveAttribute("aria-autocomplete", "list");
    await waitFor(() => {
      expect(searchInput).toHaveAttribute("aria-activedescendant", appleOption.id);
      expect(listbox).not.toHaveAttribute("aria-activedescendant");
    });

    expect(triggerButton).not.toHaveAttribute("role", "combobox");
    expect(triggerButton).toHaveAttribute("aria-haspopup", "listbox");
    expect(triggerButton).toHaveAttribute("aria-expanded", "true");
    expect(triggerButton).not.toHaveAttribute("aria-controls");
    expect(triggerButton).not.toHaveAttribute("aria-activedescendant");
  });

  it("announces the first matching searchable option as the active descendant on the search input only", async () => {
    const user = userEvent.setup();
    renderSelect({ withSearch: true, defaultOpen: true });
    const searchInput = getSearchInput();
    await user.type(searchInput, "ban");

    const bananaOption = screen.getByRole("option", { name: /banana/i });
    expect(searchInput).toHaveAttribute("aria-activedescendant", bananaOption.id);
    expect(getSelectTrigger()).not.toHaveAttribute("aria-activedescendant");
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant");
  });

  it("generates unique option ids for values that differ by whitespace and punctuation", () => {
    renderSelectInline({
      defaultOpen: true,
      children: (
        <>
          <Select.Item value="a b">Spaced</Select.Item>
          <Select.Item value="a_b">Underscore</Select.Item>
        </>
      ),
    });

    const spaced = screen.getByRole("option", { name: "Spaced" });
    const underscore = screen.getByRole("option", { name: "Underscore" });
    expect(spaced.id).toBeTruthy();
    expect(underscore.id).toBeTruthy();
    expect(spaced.id).not.toBe(underscore.id);
  });

  it("omits stale controlled active descendants for disabled, filtered, and missing options", async () => {
    const user = userEvent.setup();
    function renderStale(children: ReactNode, opts: { withSearch?: boolean; highlighted: string }) {
      return (
        <Select variant="card" defaultOpen highlighted={opts.highlighted}>
          <Select.Trigger>
            <Select.Value placeholder="Pick a value" />
          </Select.Trigger>
          <Select.Content>
            {opts.withSearch && <Select.Search />}
            {children}
          </Select.Content>
        </Select>
      );
    }

    const { rerender } = render(
      renderStale(
        <>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana" disabled>
            Banana
          </Select.Item>
        </>,
        { highlighted: "banana" },
      ),
    );
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant");

    rerender(
      renderStale(
        <>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </>,
        { highlighted: "banana", withSearch: true },
      ),
    );
    await user.type(getSearchInput(), "apple");
    expect(getSelectTrigger()).not.toHaveAttribute("aria-activedescendant");
    expect(getSearchInput()).not.toHaveAttribute("aria-activedescendant");
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant");

    rerender(
      renderStale(<Select.Item value="apple">Apple</Select.Item>, { highlighted: "missing" }),
    );
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant");
    expect(getSelectTrigger()).not.toHaveAttribute("aria-activedescendant");
  });
});

describe("Select accessibility", () => {
  it.each<{ readonly mode: "single" | "multiple" }>([
    { mode: "single" },
    { mode: "multiple" },
  ])("has no a11y violations in $mode mode", async ({ mode }) => {
    const { container } =
      mode === "multiple"
        ? renderSelect({ multiple: true, defaultOpen: true, defaultValue: ["apple"] })
        : renderSelect({ defaultOpen: true });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("merges a consumer multi-id aria-describedby on the trigger via mergeIds (F-293)", () => {
    render(
      <>
        <span id="hint-a">a</span>
        <span id="hint-b">b</span>
        <Select>
          <Select.Trigger aria-label="Fruit" aria-describedby="hint-a hint-b">
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );
    expect(getSelectTrigger()).toHaveAttribute("aria-describedby", "hint-a hint-b");
  });

  it("overrides the searchable results-count live region via getResultsLabel (F-010)", async () => {
    const user = userEvent.setup();
    render(
      <Select defaultOpen>
        <Select.Trigger aria-label="Fruit">
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content getResultsLabel={(count) => `${count} trafień`}>
          <Select.Search />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
          <Select.Empty />
        </Select.Content>
      </Select>,
    );
    await user.type(getSearchInput(), "a");
    expect(screen.getByRole("status")).toHaveTextContent(/trafień/);
  });

  it("surfaces an unlabeled trigger to axe instead of a 'Select' fallback name (F-010/F-015)", async () => {
    const { container } = render(
      <Select>
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
        </Select.Content>
      </Select>,
    );
    const trigger = container.querySelector<HTMLElement>('[data-slot="select-trigger"]');
    expect(trigger).not.toHaveAttribute("aria-label");
    expect(trigger).not.toHaveAttribute("aria-labelledby");
    expect(await axe(container)).not.toHaveNoViolations();
  });

  it("search input uses Field label via aria-labelledby when inside a Field", () => {
    render(
      <Field>
        <Field.Label>Region</Field.Label>
        <Field.Control>
          <Select variant="card" defaultOpen>
            <Select.Trigger>
              <Select.Value placeholder="Pick a region" />
            </Select.Trigger>
            <Select.Content>
              <Select.Search />
              <Select.Item value="us">United States</Select.Item>
              <Select.Item value="eu">Europe</Select.Item>
            </Select.Content>
          </Select>
        </Field.Control>
      </Field>,
    );

    const searchInput = screen.getByRole("combobox", { name: "Region" });
    const fieldLabel = screen.getByText("Region");
    expect(searchInput).toHaveAttribute("aria-labelledby", fieldLabel.id);
    expect(searchInput).not.toHaveAttribute("aria-label");
  });

  it("merges a Field label with a trigger-level aria-labelledby via mergeIds (F-040)", () => {
    render(
      <>
        <span id="extra-label">Preferred</span>
        <Field>
          <Field.Label>Region</Field.Label>
          <Field.Control>
            <Select variant="card">
              <Select.Trigger aria-labelledby="extra-label">
                <Select.Value placeholder="Pick a region" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="us">United States</Select.Item>
              </Select.Content>
            </Select>
          </Field.Control>
        </Field>
      </>,
    );

    const fieldLabel = screen.getByText("Region");
    expect(getSelectTrigger()).toHaveAttribute("aria-labelledby", `extra-label ${fieldLabel.id}`);
  });

  it("wires Field description and error ids onto the search input while searching (F-062)", () => {
    render(
      <Field invalid>
        <Field.Label>Region</Field.Label>
        <Field.Control>
          <Select variant="card" defaultOpen>
            <Select.Trigger>
              <Select.Value placeholder="Pick a region" />
            </Select.Trigger>
            <Select.Content>
              <Select.Search />
              <Select.Item value="us">United States</Select.Item>
            </Select.Content>
          </Select>
        </Field.Control>
        <Field.Description>Pick your billing region</Field.Description>
        <Field.Error>Region is required</Field.Error>
      </Field>,
    );

    const searchInput = screen.getByRole("combobox", { name: "Region" });
    const description = screen.getByText("Pick your billing region");
    const error = screen.getByText("Region is required");
    expect(searchInput).toHaveAttribute("aria-describedby", `${description.id} ${error.id}`);
    expect(searchInput).toHaveAttribute("aria-invalid", "true");
  });

  it("wires Field description and error ids onto the open non-search listbox (F-066)", () => {
    render(
      <Field invalid>
        <Field.Label>Region</Field.Label>
        <Field.Control>
          <Select variant="card" required defaultOpen>
            <Select.Trigger>
              <Select.Value placeholder="Pick a region" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="us">United States</Select.Item>
            </Select.Content>
          </Select>
        </Field.Control>
        <Field.Description>Pick your billing region</Field.Description>
        <Field.Error>Region is required</Field.Error>
      </Field>,
    );

    const listbox = screen.getByRole("listbox");
    const description = screen.getByText("Pick your billing region");
    const error = screen.getByText("Region is required");
    expect(listbox).toHaveAttribute("aria-describedby", `${description.id} ${error.id}`);
    expect(listbox).toHaveAttribute("aria-invalid", "true");
    expect(listbox).toHaveAttribute("aria-required", "true");
  });
});

describe("Select form submission", () => {
  function renderFormSelect({
    name,
    defaultValue,
    multiple,
    defaultOpen,
    disabled,
    required,
    onChange,
    items = ["Apple", "Banana", "Cherry"],
    formLabel = "Test form",
  }: {
    name?: string;
    defaultValue?: string | string[];
    multiple?: boolean;
    defaultOpen?: boolean;
    disabled?: boolean;
    required?: boolean;
    onChange?: (value: string | string[]) => void;
    items?: string[];
    formLabel?: string;
  }) {
    const commonProps = {
      variant: "card" as const,
      name,
      children: null,
      ...(defaultOpen !== undefined ? { defaultOpen } : {}),
      ...(disabled ? { disabled: true } : {}),
      ...(required ? { required: true } : {}),
    };
    const props: SelectProps = multiple
      ? {
          ...commonProps,
          multiple: true,
          onChange: onChange as ((value: string[]) => void) | undefined,
          ...(Array.isArray(defaultValue) ? { defaultValue } : {}),
        }
      : {
          ...commonProps,
          multiple: false,
          onChange: onChange as ((value: string) => void) | undefined,
          ...(typeof defaultValue === "string" ? { defaultValue } : {}),
        };

    return render(
      <form aria-label={formLabel}>
        <Select {...props}>
          <Select.Trigger aria-label={multiple ? "Fruits" : "Fruit"}>
            {multiple ? <Select.Tags placeholder="Pick" /> : <Select.Value placeholder="Pick" />}
          </Select.Trigger>
          <Select.Content>
            {items.map((item) => (
              <Select.Item key={item} value={item.toLowerCase()}>
                {item}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </form>,
    );
  }

  it.each<{
    readonly label: string;
    readonly multiple: boolean;
    readonly disabled: boolean;
    readonly defaultValue: string | string[];
    readonly expected: readonly string[];
  }>([
    {
      label: "single mode contributes its value",
      multiple: false,
      disabled: false,
      defaultValue: "banana",
      expected: ["banana"],
    },
    {
      label: "multiple mode contributes every selected value",
      multiple: true,
      disabled: false,
      defaultValue: ["apple", "cherry"],
      expected: ["apple", "cherry"],
    },
    {
      label: "single mode contributes nothing when disabled",
      multiple: false,
      disabled: true,
      defaultValue: "banana",
      expected: [],
    },
    {
      label: "multiple mode contributes nothing when disabled",
      multiple: true,
      disabled: true,
      defaultValue: ["apple", "cherry"],
      expected: [],
    },
  ])("FormData: $label", ({ multiple, disabled, defaultValue, expected }) => {
    renderFormSelect({ name: "fruit", defaultValue, multiple, disabled });
    const form = getTestForm();
    if (expected.length === 0) {
      expect(new FormData(form).has("fruit")).toBe(false);
      return;
    }
    if (multiple) {
      expect(new FormData(form).getAll("fruit")).toEqual(expected);
    } else {
      expect(new FormData(form).get("fruit")).toBe(expected[0]);
    }
  });

  it("omits a retained single value when its option becomes disabled", async () => {
    function SingleSelect({ optionDisabled }: { optionDisabled: boolean }) {
      return (
        <form aria-label="Single fruit form">
          <Select name="fruit" value="banana">
            <Select.Trigger aria-label="Fruit">
              <Select.Value placeholder="Pick" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="banana" disabled={optionDisabled}>
                Banana
              </Select.Item>
            </Select.Content>
          </Select>
        </form>
      );
    }

    const { rerender } = render(<SingleSelect optionDisabled={false} />);
    const form = getTestForm("Single fruit form");
    expect(new FormData(form).get("fruit")).toBe("banana");

    rerender(<SingleSelect optionDisabled />);

    await waitFor(() => expect(new FormData(form).has("fruit")).toBe(false));
    expect(getSelectTrigger()).toHaveTextContent("Banana");
  });

  it("submits only enabled retained values when multiple options become disabled", async () => {
    function MultipleSelect({ disabledValues }: { disabledValues: ReadonlySet<string> }) {
      return (
        <form aria-label="Multiple fruit form">
          <Select name="fruit" multiple value={["apple", "banana"]}>
            <Select.Trigger aria-label="Fruits">
              <Select.Tags placeholder="Pick" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="apple" disabled={disabledValues.has("apple")}>
                Apple
              </Select.Item>
              <Select.Item value="banana" disabled={disabledValues.has("banana")}>
                Banana
              </Select.Item>
            </Select.Content>
          </Select>
        </form>
      );
    }

    const { rerender } = render(<MultipleSelect disabledValues={new Set()} />);
    const form = getTestForm("Multiple fruit form");
    expect(new FormData(form).getAll("fruit")).toEqual(["apple", "banana"]);

    rerender(<MultipleSelect disabledValues={new Set(["apple"])} />);
    await waitFor(() => expect(new FormData(form).getAll("fruit")).toEqual(["banana"]));

    rerender(<MultipleSelect disabledValues={new Set(["apple", "banana"])} />);
    await waitFor(() => expect(new FormData(form).has("fruit")).toBe(false));
    expect(getSelectTrigger()).toHaveTextContent("Apple");
    expect(getSelectTrigger()).toHaveTextContent("Banana");
  });

  it("uses native validity for required single and multiple selects", async () => {
    const user = userEvent.setup();
    const { container, unmount } = renderFormSelect({ name: "fruit", required: true });
    const form = getTestForm();

    expect(form.checkValidity()).toBe(false);
    expect(form.reportValidity()).toBe(false);
    expect(getSelectTrigger()).toHaveFocus();
    expect(getSelectTrigger()).toHaveAttribute("aria-required", "true");
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(await axe(container)).toHaveNoViolations();

    await user.click(getSelectTrigger());
    await user.click(screen.getByRole("option", { name: /banana/i }));
    expect(form.checkValidity()).toBe(true);

    unmount();
    renderFormSelect({
      name: "fruits",
      multiple: true,
      required: true,
      items: ["Apple", "Banana"],
    });
    expect(getTestForm().checkValidity()).toBe(false);
    await user.click(getSelectTrigger());
    await user.click(screen.getByRole("option", { name: /apple/i }));
    expect(getTestForm().checkValidity()).toBe(true);
  });

  it("validates required unnamed selects without contributing FormData", async () => {
    const user = userEvent.setup();
    renderFormSelect({ required: true });
    const form = getTestForm();

    expect(form.reportValidity()).toBe(false);
    expect(getSelectTrigger()).toHaveFocus();
    await waitFor(() => expect(getSelectTrigger()).toHaveAttribute("aria-invalid", "true"));
    expect(new FormData(form).entries().next().done).toBe(true);

    await user.click(getSelectTrigger());
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-required", "true");
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-invalid", "true");
    await user.click(screen.getByRole("option", { name: /banana/i }));
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).entries().next().done).toBe(true);
  });

  it("puts searchable required semantics on the search combobox, not its toggle", async () => {
    const { container } = render(
      <form aria-label="Test form">
        <Select variant="card" name="fruit" required aria-invalid defaultOpen>
          <Select.Trigger>
            <Select.Value placeholder="Pick" />
          </Select.Trigger>
          <Select.Content>
            <Select.Search />
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select>
      </form>,
    );

    expect(getSelectTrigger()).not.toHaveAttribute("aria-required");
    expect(getSelectTrigger()).toHaveAttribute("aria-invalid", "true");
    expect(getSearchInput()).toHaveAttribute("aria-required", "true");
    expect(getSearchInput()).toHaveAttribute("aria-invalid", "true");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("updates FormData when selection changes", async () => {
    const user = userEvent.setup();
    renderFormSelect({ name: "fruit", defaultOpen: true });
    await user.click(screen.getByText("Banana"));
    expect(new FormData(getTestForm()).get("fruit")).toBe("banana");
  });

  it("resets uncontrolled single and multiple selects with native form reset", async () => {
    const user = userEvent.setup();
    const singleOnChange = vi.fn();
    renderFormSelect({
      name: "fruit",
      defaultValue: "banana",
      defaultOpen: true,
      onChange: singleOnChange,
    });
    await user.click(screen.getByRole("option", { name: /cherry/i }));

    let form = getTestForm();
    expect(new FormData(form).get("fruit")).toBe("cherry");
    expect(singleOnChange).toHaveBeenCalledTimes(1);

    form.reset();
    await waitFor(() => expect(new FormData(form).get("fruit")).toBe("banana"));
    expect(singleOnChange).toHaveBeenCalledTimes(1);

    const multipleOnChange = vi.fn();
    renderFormSelect({
      name: "fruits",
      multiple: true,
      defaultValue: ["apple"],
      defaultOpen: true,
      items: ["Apple", "Banana"],
      formLabel: "Multi fruit form",
      onChange: multipleOnChange,
    });
    await user.click(screen.getByRole("option", { name: /banana/i }));
    form = getTestForm(/multi fruit form/i);
    expect(new FormData(form).getAll("fruits")).toEqual(["apple", "banana"]);
    expect(multipleOnChange).toHaveBeenCalledTimes(1);

    form.reset();
    await waitFor(() => expect(new FormData(form).getAll("fruits")).toEqual(["apple"]));
    expect(multipleOnChange).toHaveBeenCalledTimes(1);
  });

  it("keeps single and multiple selections newer than a same-task form reset", async () => {
    renderFormSelect({
      name: "fruit",
      defaultValue: "banana",
      defaultOpen: true,
    });
    let form = getTestForm();

    form.reset();
    // fireEvent retained: selection must remain in the reset task before its microtask can flush.
    fireEvent.click(screen.getByRole("option", { name: /cherry/i }));
    await Promise.resolve();
    expect(new FormData(form).get("fruit")).toBe("cherry");

    renderFormSelect({
      name: "fruits",
      multiple: true,
      defaultValue: ["apple"],
      defaultOpen: true,
      items: ["Apple", "Banana"],
      formLabel: "Multi fruit form",
    });
    form = getTestForm(/multi fruit form/i);

    form.reset();
    // fireEvent retained: selection must remain in the reset task before its microtask can flush.
    fireEvent.click(screen.getByRole("option", { name: /banana/i }));
    await Promise.resolve();
    expect(new FormData(form).getAll("fruits")).toEqual(["apple", "banana"]);
  });

  it.each([
    {
      label: "single",
      multiple: false,
      name: "fruit",
      defaultValue: "banana",
      changedValue: "cherry",
      defaultEntries: ["banana"],
      changedEntries: ["cherry"],
    },
    {
      label: "multiple",
      multiple: true,
      name: "fruits",
      defaultValue: ["apple"],
      changedValue: "banana",
      defaultEntries: ["apple"],
      changedEntries: ["apple", "banana"],
    },
  ])("applies a $label Select reset before a later activation", async ({
    multiple,
    name,
    defaultValue,
    changedValue,
    defaultEntries,
    changedEntries,
  }) => {
    const user = userEvent.setup();
    renderFormSelect({ name, multiple, defaultValue, defaultOpen: true });
    const form = getTestForm();

    await user.click(screen.getByRole("option", { name: new RegExp(changedValue, "i") }));
    expect(new FormData(form).getAll(name)).toEqual(changedEntries);

    form.reset();
    await waitFor(() => expect(new FormData(form).getAll(name)).toEqual(defaultEntries));

    if (!multiple) await user.click(getSelectTrigger());
    await user.click(screen.getByRole("option", { name: new RegExp(changedValue, "i") }));
    expect(new FormData(form).getAll(name)).toEqual(changedEntries);
  });

  it("omits FormData when name prop is omitted", () => {
    renderFormSelect({ defaultValue: "apple", items: ["Apple"] });
    expect(new FormData(getTestForm()).has("fruit")).toBe(false);
  });

  it("renders hidden form-mirror inputs with aria-hidden and no aria-label", () => {
    const { container } = renderFormSelect({ name: "fruit", defaultValue: "banana" });
    const mirror = container.querySelector('select[aria-hidden="true"]');
    expect(mirror).not.toBeNull();
    expect(mirror).not.toHaveAttribute("aria-label");
  });

  it("clears aria-invalid on form reset after a failed required submit", async () => {
    renderFormSelect({ name: "fruit", required: true });
    const form = getTestForm();

    expect(form.reportValidity()).toBe(false);
    await waitFor(() => expect(getSelectTrigger()).toHaveAttribute("aria-invalid", "true"));

    form.reset();
    await waitFor(() => expect(getSelectTrigger()).not.toHaveAttribute("aria-invalid", "true"));
  });
});

describe("Select respects prefers-reduced-motion", () => {
  // jsdom evaluates no @media and does not compile the Tailwind open-state rules,
  // so animationName is not observable. The fixture lifts the reduced-motion
  // :root overrides out of @media; the assertions read the resolved variables.
  applyReducedMotionFixture();

  it("neutralizes dropdown enter and exit motion when the listbox is open", async () => {
    renderSelect({ defaultOpen: true, variant: "default" });

    const listbox = await screen.findByRole("listbox");
    const root = listbox.ownerDocument.documentElement;
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

describe("Select dropdown width", () => {
  it("clamps dropdown to trigger width via the CSS variable", async () => {
    renderSelect({
      defaultOpen: true,
      variant: "default",
      items: [
        "A short one",
        "An extremely long option label that would otherwise stretch the dropdown",
      ],
    });

    const listbox = await screen.findByRole("listbox");
    expect(listbox.style.width).toBe("var(--ui-floating-trigger-width)");
    expect(listbox.style.minWidth).toBe("");
  });

  it("bounds a long dropdown to the available height and makes it scrollable", async () => {
    renderSelect({
      defaultOpen: true,
      variant: "default",
      items: Array.from({ length: 40 }, (_, i) => `Option ${i}`),
    });

    const listbox = await screen.findByRole("listbox");
    expect(listbox.style.maxHeight).toBe("var(--floating-panel-available-height)");
  });
});

describe("Select cross-document portal", () => {
  it("renders dropdown content into an explicit portalContainer", async () => {
    const portalHost = document.createElement("div");
    portalHost.id = "select-portal-host";
    document.body.appendChild(portalHost);

    render(
      <Select defaultOpen>
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content portalContainer={portalHost}>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );

    expect(portalHost.querySelector('[role="listbox"]')).not.toBeNull();

    portalHost.remove();
  });
});

describe("Select searchable combobox controlled value", () => {
  it("treats explicit undefined value as controlled for searchable combobox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select value={undefined} onChange={onChange} defaultOpen>
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <Select.Search />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    );

    expect(screen.getByText(PICK_FRUIT)).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /banana/i }));
    expect(onChange).toHaveBeenCalledWith("banana");
    expect(screen.getByText(PICK_FRUIT)).toBeInTheDocument();
  });
});

describe("Select indirect composition (registration)", () => {
  function WrappedItem({ value, children }: { value: string; children: ReactNode }) {
    return <Select.Item value={value}>{children}</Select.Item>;
  }

  function WrappedSearch() {
    return <Select.Search />;
  }

  it("makes a SelectItem rendered inside a consumer wrapper selectable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select defaultOpen onChange={onChange}>
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <WrappedItem value="apple">Apple</WrappedItem>
          <WrappedItem value="banana">Banana</WrappedItem>
        </Select.Content>
      </Select>,
    );

    await user.click(screen.getByRole("option", { name: /banana/i }));
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("exposes a mounted wrapper-rendered item's label in the value display metadata", () => {
    render(
      <Select defaultOpen defaultValue="banana">
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <WrappedItem value="apple">Apple</WrappedItem>
          <WrappedItem value="banana">Banana</WrappedItem>
        </Select.Content>
      </Select>,
    );

    expect(getSelectTrigger().textContent).toContain("Banana");
  });

  it("detects a SelectSearch rendered through a wrapper component", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      render(
        <Select defaultOpen>
          <Select.Trigger>
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <WrappedSearch />
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select>,
      );

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Select.Search rendered through"));
    } finally {
      warn.mockRestore();
    }
  });
});

describe("Select unified label derivation (JSX children)", () => {
  function renderComposite(onChange = vi.fn()) {
    render(
      <Select defaultOpen onChange={onChange}>
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <Select.Search />
          <Select.Item value="apple">
            <span aria-hidden="true">🍎</span>
            <span>Apple</span>
          </Select.Item>
          <Select.Item value="banana">
            <span aria-hidden="true">🍌</span>
            <span>Banana</span>
          </Select.Item>
        </Select.Content>
      </Select>,
    );
    return onChange;
  }

  it("filters, highlights, counts, and commits by the visible JSX text without textValue", async () => {
    const user = userEvent.setup();
    const onChange = renderComposite();
    const searchInput = getSearchInput();

    await user.type(searchInput, "banana");

    const bananaOption = screen.getByRole("option", { name: /banana/i });
    expect(screen.queryByRole("option", { name: /apple/i })).not.toBeInTheDocument();
    expect(searchInput).toHaveAttribute("aria-activedescendant", bananaOption.id);
    expect(screen.getByRole("status")).toHaveTextContent("1 results");

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("does not match the raw value string and never points activedescendant at an unmounted node", async () => {
    const user = userEvent.setup();
    renderComposite();
    const searchInput = getSearchInput();

    await user.type(searchInput, "banana");
    const active = searchInput.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    expect(document.getElementById(active as string)).not.toBeNull();

    await user.clear(searchInput);
    await user.type(searchInput, "apple");
    expect(screen.queryByRole("option", { name: /apple/i })).toBeInTheDocument();
    await user.clear(searchInput);
    await user.type(searchInput, "value");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    const stale = searchInput.getAttribute("aria-activedescendant");
    if (stale) expect(document.getElementById(stale)).not.toBeNull();
  });
});

describe("Select types", () => {
  it("keeps placeholder types aligned with public metadata", () => {
    expectTypeOf<SelectTagsProps["placeholder"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<SelectValueProps["placeholder"]>().toEqualTypeOf<ReactNode>();

    expect(selectDoc.props?.SelectTags?.placeholder).toMatchObject({
      type: "string",
      required: false,
      defaultValue: '"Select..."',
    });
    expect(selectDoc.props?.SelectValue?.placeholder).toMatchObject({
      type: "ReactNode",
      required: false,
      defaultValue: '"Select..."',
    });
  });

  it("accepts only a render function as SelectValue children", () => {
    expectTypeOf<NonNullable<ReactNode>>().not.toMatchTypeOf<
      NonNullable<SelectValueProps["children"]>
    >();
  });

  it("narrows value/onChange in single mode to the supplied union", () => {
    type SingleNarrow = Extract<SelectProps<"a" | "b">, { multiple?: false }>;

    expectTypeOf<SingleNarrow["value"]>().toEqualTypeOf<"a" | "b" | undefined>();
    expectTypeOf<SingleNarrow["defaultValue"]>().toEqualTypeOf<"a" | "b" | undefined>();
    expectTypeOf<NonNullable<SingleNarrow["onChange"]>>().parameter(0).toEqualTypeOf<"a" | "b">();
  });

  it("narrows value/onChange in multiple mode to the supplied union", () => {
    type MultiNarrow = Extract<SelectProps<"a" | "b">, { multiple: true }>;

    expectTypeOf<MultiNarrow["value"]>().toEqualTypeOf<("a" | "b")[] | undefined>();
    expectTypeOf<NonNullable<MultiNarrow["onChange"]>>()
      .parameter(0)
      .toEqualTypeOf<("a" | "b")[]>();
  });

  it("rejects SelectItem values outside the literal union", () => {
    expectTypeOf<"c">().not.toMatchTypeOf<SelectItemProps<"a" | "b">["value"]>();
    expectTypeOf<"a">().toMatchTypeOf<SelectItemProps<"a" | "b">["value"]>();
  });

  it("keeps the loose default contract when no generic is supplied", () => {
    type Single = Extract<SelectProps, { multiple?: false }>;
    expectTypeOf<Single["value"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<SelectItemProps["value"]>().toEqualTypeOf<string>();
  });
});
