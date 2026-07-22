import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Select, type SelectProps } from "./index";
import { getSearchInput, getSelectTrigger, getTestForm } from "./select.test-utils";

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
