import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Select } from "./index";
import {
  getSearchInput,
  getSelectTrigger,
  type InlineRenderProps,
  PICK_FRUIT,
  renderSelect,
  renderSelectInline,
} from "./select.test-utils";
import { useSelectContext } from "./select-context";

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
    // Constant children isolate the re-render cause: only the inline onChange identity changes
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

  it("excludes decorative indicators from option names", () => {
    renderSelect({ defaultOpen: true, defaultValue: "banana" });
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /✓/ })).not.toBeInTheDocument();
  });

  it("has no a11y violations in the closed base state", async () => {
    const { container } = renderSelect();
    expect(await axe(container)).toHaveNoViolations();
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
