import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { expectFieldInvalid, expectResetClearsInvalid } from "../../testing/form-behavior";
import { Field } from "../field/index";
import { Checkbox } from "./index";

function getForm(name = "Test form"): HTMLFormElement {
  const form = screen.getByRole("form", { name });
  if (!(form instanceof HTMLFormElement)) throw new Error("Expected form test element");
  return form;
}

describe("Checkbox.Group", () => {
  it("toggles items and supports controlled value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Checkbox.Group value={["apple"]} onChange={onChange} label="Fruits">
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );
    expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByText("Banana"));
    expect(onChange).toHaveBeenCalledWith(["apple", "banana"]);
  });

  it("sets aria-disabled on group when disabled", () => {
    render(
      <Checkbox.Group label="Fruits" disabled>
        <Checkbox.Item value="apple" label="Apple" />
      </Checkbox.Group>,
    );
    expect(screen.getByRole("group")).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the group label visibly and names the group with aria-labelledby", () => {
    render(
      <Checkbox.Group label="Fruits">
        <Checkbox.Item value="apple" label="Apple" />
      </Checkbox.Group>,
    );

    const label = screen.getByText("Fruits");
    const group = screen.getByRole("group", { name: "Fruits" });
    expect(label).toBeVisible();
    expect(group).toHaveAttribute("aria-labelledby", label.id);
    expect(group).not.toHaveAttribute("aria-label");
  });

  it("uses an explicit aria-label instead of the visible group label", () => {
    render(
      <Checkbox.Group label="Visible fruits" aria-label="Fruit choices">
        <Checkbox.Item value="apple" label="Apple" />
      </Checkbox.Group>,
    );

    expect(screen.getByText("Visible fruits")).toBeVisible();
    const group = screen.getByRole("group", { name: "Fruit choices" });
    expect(group).toHaveAttribute("aria-label", "Fruit choices");
    expect(group).not.toHaveAttribute("aria-labelledby");
    expect(screen.queryByRole("group", { name: "Visible fruits" })).not.toBeInTheDocument();
  });

  it("preserves Field invalid and description wiring on the group", () => {
    render(
      <Field invalid>
        <Field.Label>Fruits</Field.Label>
        <Field.Control>
          <Checkbox.Group>
            <Checkbox.Item value="apple" label="Apple" />
          </Checkbox.Group>
        </Field.Control>
        <Field.Error>Select at least one fruit.</Field.Error>
      </Field>,
    );

    const group = screen.getByRole("group", { name: "Fruits" });
    expectFieldInvalid(group, "Select at least one fruit.");
  });

  it("navigates items with arrow keys", async () => {
    const user = userEvent.setup();
    const onHighlight = vi.fn();
    render(
      <Checkbox.Group label="Fruits" onHighlightChange={onHighlight}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
        <Checkbox.Item value="cherry" label="Cherry" />
      </Checkbox.Group>,
    );
    const banana = screen.getByRole("checkbox", { name: /banana/i });
    screen.getByRole("checkbox", { name: /apple/i }).focus();
    await user.keyboard("{ArrowDown}");

    expect(onHighlight).toHaveBeenCalledWith("banana");
    expect(banana).toHaveFocus();
  });

  it("autoFocus focuses the highlighted item when navigation is active", async () => {
    const onHighlight = vi.fn();
    render(
      <Checkbox.Group label="Fruits" highlighted="banana" onHighlightChange={onHighlight} autoFocus>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );

    await waitFor(() => expect(screen.getByRole("checkbox", { name: /banana/i })).toHaveFocus());
    expect(onHighlight).not.toHaveBeenCalled();
  });

  it("autoFocus falls back to the first selected item", async () => {
    const onHighlight = vi.fn();
    render(
      <Checkbox.Group label="Fruits" value={["banana"]} onHighlightChange={onHighlight} autoFocus>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );

    await waitFor(() => expect(screen.getByRole("checkbox", { name: /banana/i })).toHaveFocus());
    expect(onHighlight).toHaveBeenCalledWith("banana");
  });

  it("autoFocus supports empty string item values", async () => {
    const onHighlight = vi.fn();
    render(
      <Checkbox.Group label="Fruits" value={[""]} onHighlightChange={onHighlight} autoFocus>
        <Checkbox.Item value="" label="None" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );

    await waitFor(() => expect(screen.getByRole("checkbox", { name: /none/i })).toHaveFocus());
    expect(onHighlight).toHaveBeenCalledWith("");
  });

  it("keeps explicit value undefined controlled instead of adopting internal selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Checkbox.Group value={undefined} onChange={onChange} label="Fruits">
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );

    await user.click(screen.getByRole("checkbox", { name: /banana/i }));

    expect(onChange).toHaveBeenCalledWith(["banana"]);
    expect(screen.getByRole("checkbox", { name: /banana/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("can suspend keyboard navigation without disabling items", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onHighlight = vi.fn();
    render(
      <Checkbox.Group
        label="Fruits"
        onChange={onChange}
        onHighlightChange={onHighlight}
        keyboardNavigation={false}
      >
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );

    screen.getByRole("checkbox", { name: /apple/i }).focus();
    await user.keyboard("{ArrowDown}");
    expect(onHighlight).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: /banana/i }));
    expect(onChange).toHaveBeenCalledWith(["banana"]);
    expect(screen.getByRole("group")).not.toHaveAttribute("aria-disabled");
  });

  it("reports keyboard boundary when wrapping is disabled", async () => {
    const user = userEvent.setup();
    const onNavigationBoundaryReached = vi.fn();
    render(
      <Checkbox.Group
        label="Fruits"
        highlighted="banana"
        wrap={false}
        onNavigationBoundaryReached={onNavigationBoundaryReached}
      >
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );

    screen.getByRole("checkbox", { name: /banana/i }).focus();
    await user.keyboard("{ArrowDown}");

    expect(onNavigationBoundaryReached).toHaveBeenCalledWith(
      "next",
      expect.any(KeyboardEvent),
      "ArrowDown",
    );
  });

  it("reports top keyboard boundary when wrapping is disabled", async () => {
    const user = userEvent.setup();
    const onNavigationBoundaryReached = vi.fn();
    render(
      <Checkbox.Group
        label="Fruits"
        highlighted="apple"
        wrap={false}
        onNavigationBoundaryReached={onNavigationBoundaryReached}
      >
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );

    screen.getByRole("checkbox", { name: /apple/i }).focus();
    await user.keyboard("{ArrowUp}");

    expect(onNavigationBoundaryReached).toHaveBeenCalledWith(
      "previous",
      expect.any(KeyboardEvent),
      "ArrowUp",
    );
  });

  it("jumps to first and last item with Home and End", async () => {
    const user = userEvent.setup();
    const onHighlight = vi.fn();
    render(
      <Checkbox.Group label="Fruits" onHighlightChange={onHighlight}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
        <Checkbox.Item value="cherry" label="Cherry" />
      </Checkbox.Group>,
    );

    screen.getByRole("checkbox", { name: /apple/i }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("checkbox", { name: /cherry/i })).toHaveFocus();
    expect(onHighlight).toHaveBeenLastCalledWith("cherry");

    await user.keyboard("{Home}");
    expect(screen.getByRole("checkbox", { name: /apple/i })).toHaveFocus();
    expect(onHighlight).toHaveBeenLastCalledWith("apple");
  });

  it("does not move keyboard highlight on mouse hover", async () => {
    const user = userEvent.setup();
    const onHighlight = vi.fn();
    render(
      <Checkbox.Group label="Fruits" highlighted="apple" onHighlightChange={onHighlight}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );

    await user.hover(screen.getByRole("checkbox", { name: /banana/i }));

    expect(onHighlight).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: /apple/i })).toHaveAttribute("data-highlighted");
    expect(screen.getByRole("checkbox", { name: /banana/i })).not.toHaveAttribute(
      "data-highlighted",
    );
  });

  it("starts keyboard navigation from the first item when controlled highlight is cleared", () => {
    const onHighlight = vi.fn();
    const { rerender } = render(
      <Checkbox.Group label="Fruits" highlighted="apple" onHighlightChange={onHighlight}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );

    rerender(
      <Checkbox.Group label="Fruits" highlighted={null} onHighlightChange={onHighlight}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );

    // fireEvent retained: direct keydown exercises the no-focused-item + highlighted=null fallback.
    fireEvent.keyDown(screen.getByRole("group"), { key: "ArrowDown" });

    expect(screen.getByRole("checkbox", { name: /apple/i })).toHaveFocus();
    expect(onHighlight).toHaveBeenLastCalledWith("apple");
  });

  it("does not satisfy required validation with stale controlled values", async () => {
    render(
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" value={["missing"]} required>
          <Checkbox.Item value="apple" label="Apple" />
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>,
    );

    const form = getForm();
    expect(form.checkValidity()).toBe(false);
    expect(new FormData(form).getAll("fruits")).toEqual([]);

    expect(form.reportValidity()).toBe(false);
    expect(screen.getByRole("checkbox", { name: /apple/i })).toHaveFocus();
    await waitFor(() => expectFieldInvalid(screen.getByRole("group")));
  });

  it("validates required groups with items rendered through wrapper components", () => {
    function WrappedApple() {
      return <Checkbox.Item value="apple" label="Apple" />;
    }

    render(
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" value={["apple"]} required>
          <WrappedApple />
        </Checkbox.Group>
      </form>,
    );

    const form = getForm();
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).getAll("fruits")).toEqual(["apple"]);
  });

  it("does not satisfy required validation after a selected item is disabled or removed", async () => {
    const renderForm = (state: "enabled" | "disabled" | "removed") => (
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" value={["apple"]} required>
          {state !== "removed" && (
            <Checkbox.Item value="apple" label="Apple" disabled={state === "disabled"} />
          )}
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>
    );
    const { rerender } = render(renderForm("enabled"));

    await waitFor(() => expect(screen.getByRole("form", { name: "Test form" })).toBeValid());

    rerender(renderForm("disabled"));
    await waitFor(() => expect(screen.getByRole("form", { name: "Test form" })).not.toBeValid());
    expect(new FormData(getForm()).getAll("fruits")).toEqual([]);

    rerender(renderForm("removed"));
    await waitFor(() => expect(screen.getByRole("form", { name: "Test form" })).not.toBeValid());
    expect(new FormData(getForm()).getAll("fruits")).toEqual([]);
  });

  it("keeps arrow navigation scoped away from nested checkbox groups", async () => {
    const user = userEvent.setup();
    const onOuterHighlight = vi.fn();
    const onInnerHighlight = vi.fn();
    render(
      <Checkbox.Group label="Outer" onHighlightChange={onOuterHighlight}>
        <Checkbox.Item value="outer-a" label="Outer A" />
        <Checkbox.Group label="Inner" onHighlightChange={onInnerHighlight}>
          <Checkbox.Item value="inner-a" label="Inner A" />
          <Checkbox.Item value="inner-b" label="Inner B" />
        </Checkbox.Group>
        <Checkbox.Item value="outer-b" label="Outer B" />
      </Checkbox.Group>,
    );

    screen.getByRole("checkbox", { name: /inner a/i }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("checkbox", { name: /inner b/i })).toHaveFocus();
    expect(onInnerHighlight).toHaveBeenCalledWith("inner-b");
    expect(onOuterHighlight).not.toHaveBeenCalled();
  });

  it("skips nested checkbox group items when navigating the outer group", async () => {
    const user = userEvent.setup();
    const onOuterHighlight = vi.fn();
    const onInnerHighlight = vi.fn();
    render(
      <Checkbox.Group label="Outer" onHighlightChange={onOuterHighlight}>
        <Checkbox.Item value="outer-a" label="Outer A" />
        <Checkbox.Group label="Inner" onHighlightChange={onInnerHighlight}>
          <Checkbox.Item value="inner-a" label="Inner A" />
          <Checkbox.Item value="inner-b" label="Inner B" />
        </Checkbox.Group>
        <Checkbox.Item value="outer-b" label="Outer B" />
      </Checkbox.Group>,
    );

    screen.getByRole("checkbox", { name: /outer a/i }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("checkbox", { name: /outer b/i })).toHaveFocus();
    expect(onOuterHighlight).toHaveBeenCalledWith("outer-b");
    expect(onInnerHighlight).not.toHaveBeenCalled();
  });

  it("requires at least one checked item without making every item required", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" required>
          <Checkbox.Item value="apple" label="Apple" />
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>,
    );

    const form = getForm();
    expect(form.checkValidity()).toBe(false);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(form.reportValidity()).toBe(false);
    expect(screen.getByRole("checkbox", { name: /apple/i })).toHaveFocus();
    await waitFor(() => expectFieldInvalid(screen.getByRole("group")));

    await user.click(screen.getByRole("checkbox", { name: /banana/i }));

    expect(form.checkValidity()).toBe(true);
    expect(screen.getByRole("group")).not.toHaveAttribute("aria-invalid");
    expect(new FormData(form).getAll("fruits")).toEqual(["banana"]);
  });

  it("resets uncontrolled grouped checkbox values with native form reset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" defaultValue={["apple"]} onChange={onChange}>
          <Checkbox.Item value="apple" label="Apple" />
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>,
    );

    await user.click(screen.getByRole("checkbox", { name: /banana/i }));
    const form = getForm();
    expect(new FormData(form).getAll("fruits")).toEqual(["apple", "banana"]);
    expect(onChange).toHaveBeenCalledOnce();

    form.reset();
    await waitFor(() => expect(new FormData(form).getAll("fruits")).toEqual(["apple"]));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("keeps a CheckboxGroup activation newer than a same-task form reset", async () => {
    render(
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" defaultValue={["apple"]}>
          <Checkbox.Item value="apple" label="Apple" />
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>,
    );
    const banana = screen.getByRole("checkbox", { name: /banana/i });
    const form = getForm();

    form.reset();
    // fireEvent retained: activation must remain in the reset task before its microtask can flush.
    fireEvent.click(banana);
    await Promise.resolve();

    expect(new FormData(form).getAll("fruits")).toEqual(["apple", "banana"]);
  });

  it("applies a CheckboxGroup reset before a later activation", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" defaultValue={["apple"]}>
          <Checkbox.Item value="apple" label="Apple" />
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>,
    );
    const banana = screen.getByRole("checkbox", { name: /banana/i });
    const form = getForm();

    await user.click(banana);
    expect(new FormData(form).getAll("fruits")).toEqual(["apple", "banana"]);

    form.reset();
    await waitFor(() => expect(new FormData(form).getAll("fruits")).toEqual(["apple"]));
    expect(banana).toHaveAttribute("aria-checked", "false");

    await user.click(banana);
    expect(banana).toHaveAttribute("aria-checked", "true");
    expect(new FormData(form).getAll("fruits")).toEqual(["apple", "banana"]);
  });

  it("clears the group's aria-invalid on native form reset after a failed submit", async () => {
    render(
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" required>
          <Checkbox.Item value="apple" label="Apple" />
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>,
    );

    await expectResetClearsInvalid(getForm(), screen.getByRole("group", { name: "Fruits" }));
  });

  it("toggles the focused item on Enter key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Checkbox.Group label="Fruits" onChange={onChange}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );

    screen.getByRole("checkbox", { name: "Apple" }).focus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith(["apple"]);
  });

  it("does not toggle a disabled item on Enter key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Checkbox.Group label="Fruits" onChange={onChange}>
        <Checkbox.Item value="apple" label="Apple" disabled />
      </Checkbox.Group>,
    );

    screen.getByRole("checkbox", { name: "Apple" }).focus();
    await user.keyboard("{Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("respects consumer onKeyDown preventDefault for Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Checkbox.Group label="Fruits" onChange={onChange} onKeyDown={(e) => e.preventDefault()}>
        <Checkbox.Item value="apple" label="Apple" />
      </Checkbox.Group>,
    );

    screen.getByRole("checkbox", { name: "Apple" }).focus();
    await user.keyboard("{Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Checkbox.Group label="Fruits">
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
