import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { axe } from "../../../testing/axe"
import { requireAttribute } from "../../testing/assertions"
import { Field } from "../field/index"
import { Checkbox } from "./index"

function getForm(name = "Test form"): HTMLFormElement {
  const form = screen.getByRole("form", { name })
  if (!(form instanceof HTMLFormElement)) throw new Error("Expected form test element")
  return form
}

describe("Checkbox", () => {
  it("toggles on click and respects controlled value", async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Accept terms" />)
    await userEvent.click(screen.getByRole("checkbox"))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "false")
  })

  it("toggles on Space key", async () => {
    const onChange = vi.fn()
    render(<Checkbox onChange={onChange} label="Accept terms" />)
    screen.getByRole("checkbox").focus()
    await userEvent.keyboard(" ")
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it("does not toggle when disabled via click or keyboard", async () => {
    const onChange = vi.fn()
    const onClick = vi.fn()
    render(<Checkbox disabled onChange={onChange} onClick={onClick} label="Accept terms" />)
    const checkbox = screen.getByRole("checkbox")

    await userEvent.click(checkbox)
    checkbox.focus()
    await userEvent.keyboard(" ")

    expect(onChange).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
  })

  it("renders indeterminate state as aria-checked mixed", () => {
    render(<Checkbox checked="indeterminate" label="Select all" />)
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed")
  })

  it("provides accessible name from label or aria-label", () => {
    const { rerender } = render(<Checkbox label="Accept terms" />)
    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument()

    rerender(<Checkbox aria-label="Accept terms" />)
    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument()
  })

  it("links description via aria-describedby", () => {
    render(<Checkbox label="Accept" description="You must accept to proceed" />)
    const checkbox = screen.getByRole("checkbox")
    const descId = requireAttribute(checkbox, "aria-describedby")
    expect(document.getElementById(descId)).toHaveTextContent("You must accept to proceed")
  })

  it("composes Field label and description ids with local label and description", () => {
    render(
      <Field invalid>
        <Field.Label>Accept policy</Field.Label>
        <Field.Control>
          <Checkbox label="Terms" description="Local help" />
        </Field.Control>
        <Field.Description>Field help</Field.Description>
        <Field.Error>Field error</Field.Error>
      </Field>,
    )

    const checkbox = screen.getByRole("checkbox", { name: /accept policy.*terms/i })
    expect(checkbox).toHaveAccessibleDescription(/field help.*field error.*local help/i)
    expect(checkbox).toHaveAttribute("aria-invalid", "true")
  })

  it("renders aria-invalid and aria-required when set", () => {
    render(<Checkbox aria-invalid required label="Accept" />)
    const checkbox = screen.getByRole("checkbox")
    expect(checkbox).toHaveAttribute("aria-invalid", "true")
    expect(checkbox).toHaveAttribute("aria-required", "true")
  })

  it("resets uncontrolled checked state with native form reset", async () => {
    render(
      <form aria-label="Test form">
        <Checkbox name="terms" defaultChecked label="Accept terms" />
      </form>
    )

    await userEvent.click(screen.getByRole("checkbox"))
    const form = getForm()
    expect(new FormData(form).has("terms")).toBe(false)

    form.reset()
    await waitFor(() => expect(new FormData(form).get("terms")).toBe("on"))
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true")
  })

  it("focuses the visible checkbox when native required validation fails", async () => {
    render(
      <form aria-label="Test form">
        <Checkbox name="terms" required label="Accept terms" />
      </form>
    )

    const form = getForm()
    const checkbox = screen.getByRole("checkbox", { name: /accept terms/i })

    expect(form.reportValidity()).toBe(false)
    expect(checkbox).toHaveFocus()
    await waitFor(() => expect(checkbox).toHaveAttribute("aria-invalid", "true"))
  })

  it("validates required unnamed checkboxes without contributing FormData", async () => {
    render(
      <form aria-label="Test form">
        <Checkbox required label="Accept terms" />
      </form>
    )

    const form = getForm()
    const checkbox = screen.getByRole("checkbox", { name: /accept terms/i })

    expect(form.reportValidity()).toBe(false)
    expect(checkbox).toHaveFocus()
    await waitFor(() => expect(checkbox).toHaveAttribute("aria-invalid", "true"))
    expect(new FormData(form).entries().next().done).toBe(true)

    await userEvent.click(checkbox)
    expect(form.checkValidity()).toBe(true)
    expect(checkbox).not.toHaveAttribute("aria-invalid")
    expect(new FormData(form).entries().next().done).toBe(true)
  })

  it("keeps data-value aligned with submitted value, including empty values", () => {
    const { rerender } = render(
      <form aria-label="Test form">
        <Checkbox name="choice" value="custom" defaultChecked label="Custom choice" />
      </form>,
    )
    const form = getForm()
    const checkbox = screen.getByRole("checkbox", { name: /custom choice/i })

    expect(checkbox).toHaveAttribute("data-value", "custom")
    expect(new FormData(form).get("choice")).toBe("custom")

    rerender(
      <form aria-label="Test form">
        <Checkbox name="choice" value="" defaultChecked label="Empty choice" />
      </form>,
    )

    expect(screen.getByRole("checkbox", { name: /empty choice/i })).toHaveAttribute("data-value", "")
    expect(new FormData(getForm()).get("choice")).toBe("")
  })

  it("passes native root props and composes root handlers", async () => {
    const onClick = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <Checkbox
        label="Accept terms"
        data-source="external"
        style={{ maxWidth: "18px" }}
        onClick={onClick}
        onKeyDown={onKeyDown}
      />,
    )

    const checkbox = screen.getByRole("checkbox", { name: /accept terms/i })
    await userEvent.click(checkbox)
    checkbox.focus()
    await userEvent.keyboard(" ")

    expect(onClick).toHaveBeenCalledOnce()
    expect(onKeyDown).toHaveBeenCalled()
    expect(checkbox).toHaveAttribute("data-source", "external")
    expect(checkbox).toHaveStyle({ maxWidth: "18px" })
  })

  it("lets consumer click handlers prevent the built-in toggle", async () => {
    const onChange = vi.fn()
    render(
      <Checkbox
        label="Accept terms"
        onChange={onChange}
        onClick={(event) => event.preventDefault()}
      />,
    )

    await userEvent.click(screen.getByRole("checkbox", { name: /accept terms/i }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("checkbox", { name: /accept terms/i })).toHaveAttribute("aria-checked", "false")
  })

  it("lets consumer keyboard handlers prevent the built-in Space toggle", async () => {
    const onChange = vi.fn()
    render(
      <Checkbox
        label="Accept terms"
        onChange={onChange}
        onKeyDown={(event) => event.preventDefault()}
      />,
    )

    screen.getByRole("checkbox", { name: /accept terms/i }).focus()
    await userEvent.keyboard(" ")

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("checkbox", { name: /accept terms/i })).toHaveAttribute("aria-checked", "false")
  })

  it("has no a11y violations across states", async () => {
    const { container, rerender } = render(<Checkbox label="Accept terms" />)
    expect(await axe(container)).toHaveNoViolations()

    rerender(<Checkbox disabled label="Accept terms" />)
    expect(await axe(container)).toHaveNoViolations()

    rerender(<Checkbox checked="indeterminate" label="Select all" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("Checkbox.Group", () => {
  it("toggles items and supports controlled value", async () => {
    const onChange = vi.fn()
    render(
      <Checkbox.Group value={["apple"]} onChange={onChange} label="Fruits">
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )
    expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByText("Banana"))
    expect(onChange).toHaveBeenCalledWith(["apple", "banana"])
  })

  it("sets aria-disabled on group when disabled", () => {
    render(
      <Checkbox.Group label="Fruits" disabled>
        <Checkbox.Item value="apple" label="Apple" />
      </Checkbox.Group>
    )
    expect(screen.getByRole("group")).toHaveAttribute("aria-disabled", "true")
  })

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
    )

    const group = screen.getByRole("group", { name: "Fruits" })
    expect(group).toHaveAttribute("aria-invalid", "true")
    expect(group).toHaveAccessibleDescription("Select at least one fruit.")
  })

  it("navigates items with arrow keys", async () => {
    const onHighlight = vi.fn()
    render(
      <Checkbox.Group label="Fruits" onHighlightChange={onHighlight}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
        <Checkbox.Item value="cherry" label="Cherry" />
      </Checkbox.Group>
    )
    const banana = screen.getByRole("checkbox", { name: /banana/i })
    screen.getByRole("checkbox", { name: /apple/i }).focus()
    await userEvent.keyboard("{ArrowDown}")

    expect(onHighlight).toHaveBeenCalledWith("banana")
    expect(banana).toHaveFocus()
  })

  it("autoFocus focuses the highlighted item when navigation is active", async () => {
    const onHighlight = vi.fn()
    render(
      <Checkbox.Group
        label="Fruits"
        highlighted="banana"
        onHighlightChange={onHighlight}
        autoFocus
      >
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )

    await waitFor(() => expect(screen.getByRole("checkbox", { name: /banana/i })).toHaveFocus())
    expect(onHighlight).not.toHaveBeenCalled()
  })

  it("autoFocus falls back to the first selected item", async () => {
    const onHighlight = vi.fn()
    render(
      <Checkbox.Group
        label="Fruits"
        value={["banana"]}
        onHighlightChange={onHighlight}
        autoFocus
      >
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )

    await waitFor(() => expect(screen.getByRole("checkbox", { name: /banana/i })).toHaveFocus())
    expect(onHighlight).toHaveBeenCalledWith("banana")
  })

  it("autoFocus supports empty string item values", async () => {
    const onHighlight = vi.fn()
    render(
      <Checkbox.Group
        label="Fruits"
        value={[""]}
        onHighlightChange={onHighlight}
        autoFocus
      >
        <Checkbox.Item value="" label="None" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )

    await waitFor(() => expect(screen.getByRole("checkbox", { name: /none/i })).toHaveFocus())
    expect(onHighlight).toHaveBeenCalledWith("")
  })

  it("keeps explicit value undefined controlled instead of adopting internal selection", async () => {
    const onChange = vi.fn()
    render(
      <Checkbox.Group value={undefined} onChange={onChange} label="Fruits">
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )

    await userEvent.click(screen.getByRole("checkbox", { name: /banana/i }))

    expect(onChange).toHaveBeenCalledWith(["banana"])
    expect(screen.getByRole("checkbox", { name: /banana/i })).toHaveAttribute("aria-checked", "false")
  })

  it("can suspend keyboard navigation without disabling items", async () => {
    const onChange = vi.fn()
    const onHighlight = vi.fn()
    render(
      <Checkbox.Group
        label="Fruits"
        onChange={onChange}
        onHighlightChange={onHighlight}
        keyboardNavigation={false}
      >
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )

    screen.getByRole("checkbox", { name: /apple/i }).focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(onHighlight).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("checkbox", { name: /banana/i }))
    expect(onChange).toHaveBeenCalledWith(["banana"])
    expect(screen.getByRole("group")).not.toHaveAttribute("aria-disabled")
  })

  it("reports keyboard boundary when wrapping is disabled", async () => {
    const onNavigationBoundaryReached = vi.fn()
    render(
      <Checkbox.Group label="Fruits" highlighted="banana" wrap={false} onNavigationBoundaryReached={onNavigationBoundaryReached}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )

    screen.getByRole("checkbox", { name: /banana/i }).focus()
    await userEvent.keyboard("{ArrowDown}")

    expect(onNavigationBoundaryReached).toHaveBeenCalledWith("next", expect.any(KeyboardEvent), "ArrowDown")
  })

  it("reports top keyboard boundary when wrapping is disabled", async () => {
    const onNavigationBoundaryReached = vi.fn()
    render(
      <Checkbox.Group label="Fruits" highlighted="apple" wrap={false} onNavigationBoundaryReached={onNavigationBoundaryReached}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )

    screen.getByRole("checkbox", { name: /apple/i }).focus()
    await userEvent.keyboard("{ArrowUp}")

    expect(onNavigationBoundaryReached).toHaveBeenCalledWith("previous", expect.any(KeyboardEvent), "ArrowUp")
  })

  it("jumps to first and last item with Home and End", async () => {
    const onHighlight = vi.fn()
    render(
      <Checkbox.Group label="Fruits" onHighlightChange={onHighlight}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
        <Checkbox.Item value="cherry" label="Cherry" />
      </Checkbox.Group>
    )

    screen.getByRole("checkbox", { name: /apple/i }).focus()
    await userEvent.keyboard("{End}")
    expect(screen.getByRole("checkbox", { name: /cherry/i })).toHaveFocus()
    expect(onHighlight).toHaveBeenLastCalledWith("cherry")

    await userEvent.keyboard("{Home}")
    expect(screen.getByRole("checkbox", { name: /apple/i })).toHaveFocus()
    expect(onHighlight).toHaveBeenLastCalledWith("apple")
  })

  it("does not move keyboard highlight on mouse hover", async () => {
    const onHighlight = vi.fn()
    render(
      <Checkbox.Group label="Fruits" highlighted="apple" onHighlightChange={onHighlight}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )

    await userEvent.hover(screen.getByRole("checkbox", { name: /banana/i }))

    expect(onHighlight).not.toHaveBeenCalled()
    expect(screen.getByRole("checkbox", { name: /apple/i })).toHaveAttribute("data-highlighted", "true")
    expect(screen.getByRole("checkbox", { name: /banana/i })).not.toHaveAttribute("data-highlighted")
  })

  it("starts keyboard navigation from the first item when controlled highlight is cleared", () => {
    const onHighlight = vi.fn()
    const { rerender } = render(
      <Checkbox.Group label="Fruits" highlighted="apple" onHighlightChange={onHighlight}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )

    rerender(
      <Checkbox.Group label="Fruits" highlighted={null} onHighlightChange={onHighlight}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )

    // fireEvent retained: exercises the "no focused item + highlighted=null" fallback
    // in useNavigation.getFocusedIndex (third branch returning -1). userEvent.tab() would focus the
    // first checkbox first, making getFocusedIndex return 0 and ArrowDown advance to banana.
    fireEvent.keyDown(screen.getByRole("group"), { key: "ArrowDown" })

    expect(screen.getByRole("checkbox", { name: /apple/i })).toHaveFocus()
    expect(onHighlight).toHaveBeenLastCalledWith("apple")
  })

  it("does not satisfy required validation with stale controlled values", async () => {
    render(
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" value={["missing"]} required>
          <Checkbox.Item value="apple" label="Apple" />
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>
    )

    const form = getForm()
    expect(form.checkValidity()).toBe(false)
    expect(new FormData(form).getAll("fruits")).toEqual([])

    expect(form.reportValidity()).toBe(false)
    expect(screen.getByRole("checkbox", { name: /apple/i })).toHaveFocus()
    await waitFor(() => expect(screen.getByRole("group")).toHaveAttribute("aria-invalid", "true"))
  })

  it("validates required groups with items rendered through wrapper components", () => {
    function WrappedApple() {
      return <Checkbox.Item value="apple" label="Apple" />
    }

    render(
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" value={["apple"]} required>
          <WrappedApple />
        </Checkbox.Group>
      </form>
    )

    const form = getForm()
    expect(form.checkValidity()).toBe(true)
    expect(new FormData(form).getAll("fruits")).toEqual(["apple"])
  })

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
    )
    const { rerender } = render(renderForm("enabled"))

    await waitFor(() => expect(screen.getByRole("form", { name: "Test form" })).toBeValid())

    rerender(renderForm("disabled"))
    await waitFor(() => expect(screen.getByRole("form", { name: "Test form" })).not.toBeValid())
    expect(new FormData(getForm()).getAll("fruits")).toEqual([])

    rerender(renderForm("removed"))
    await waitFor(() => expect(screen.getByRole("form", { name: "Test form" })).not.toBeValid())
    expect(new FormData(getForm()).getAll("fruits")).toEqual([])
  })

  it("keeps arrow navigation scoped away from nested checkbox groups", async () => {
    const onOuterHighlight = vi.fn()
    const onInnerHighlight = vi.fn()
    render(
      <Checkbox.Group label="Outer" onHighlightChange={onOuterHighlight}>
        <Checkbox.Item value="outer-a" label="Outer A" />
        <Checkbox.Group label="Inner" onHighlightChange={onInnerHighlight}>
          <Checkbox.Item value="inner-a" label="Inner A" />
          <Checkbox.Item value="inner-b" label="Inner B" />
        </Checkbox.Group>
        <Checkbox.Item value="outer-b" label="Outer B" />
      </Checkbox.Group>
    )

    screen.getByRole("checkbox", { name: /inner a/i }).focus()
    await userEvent.keyboard("{ArrowDown}")

    expect(screen.getByRole("checkbox", { name: /inner b/i })).toHaveFocus()
    expect(onInnerHighlight).toHaveBeenCalledWith("inner-b")
    expect(onOuterHighlight).not.toHaveBeenCalled()
  })

  it("skips nested checkbox group items when navigating the outer group", async () => {
    const onOuterHighlight = vi.fn()
    const onInnerHighlight = vi.fn()
    render(
      <Checkbox.Group label="Outer" onHighlightChange={onOuterHighlight}>
        <Checkbox.Item value="outer-a" label="Outer A" />
        <Checkbox.Group label="Inner" onHighlightChange={onInnerHighlight}>
          <Checkbox.Item value="inner-a" label="Inner A" />
          <Checkbox.Item value="inner-b" label="Inner B" />
        </Checkbox.Group>
        <Checkbox.Item value="outer-b" label="Outer B" />
      </Checkbox.Group>
    )

    screen.getByRole("checkbox", { name: /outer a/i }).focus()
    await userEvent.keyboard("{ArrowDown}")

    expect(screen.getByRole("checkbox", { name: /outer b/i })).toHaveFocus()
    expect(onOuterHighlight).toHaveBeenCalledWith("outer-b")
    expect(onInnerHighlight).not.toHaveBeenCalled()
  })

  it("requires at least one checked item without making every item required", async () => {
    render(
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" required>
          <Checkbox.Item value="apple" label="Apple" />
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>
    )

    const form = getForm()
    expect(form.checkValidity()).toBe(false)
    expect(screen.getAllByRole("checkbox")).toHaveLength(2)
    expect(form.reportValidity()).toBe(false)
    expect(screen.getByRole("checkbox", { name: /apple/i })).toHaveFocus()
    await waitFor(() => expect(screen.getByRole("group")).toHaveAttribute("aria-invalid", "true"))

    await userEvent.click(screen.getByRole("checkbox", { name: /banana/i }))

    expect(form.checkValidity()).toBe(true)
    expect(screen.getByRole("group")).not.toHaveAttribute("aria-invalid")
    expect(new FormData(form).getAll("fruits")).toEqual(["banana"])
  })

  it("resets uncontrolled grouped checkbox values with native form reset", async () => {
    render(
      <form aria-label="Test form">
        <Checkbox.Group label="Fruits" name="fruits" defaultValue={["apple"]}>
          <Checkbox.Item value="apple" label="Apple" />
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>
    )

    await userEvent.click(screen.getByRole("checkbox", { name: /banana/i }))
    const form = getForm()
    expect(new FormData(form).getAll("fruits")).toEqual(["apple", "banana"])

    form.reset()
    await waitFor(() => expect(new FormData(form).getAll("fruits")).toEqual(["apple"]))
  })

  it("toggles the focused item on Enter key", async () => {
    const onChange = vi.fn()
    render(
      <Checkbox.Group label="Fruits" onChange={onChange}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>,
    )

    screen.getByRole("checkbox", { name: "Apple" }).focus()
    await userEvent.keyboard("{Enter}")

    expect(onChange).toHaveBeenCalledWith(["apple"])
  })

  it("does not toggle a disabled item on Enter key", async () => {
    const onChange = vi.fn()
    render(
      <Checkbox.Group label="Fruits" onChange={onChange}>
        <Checkbox.Item value="apple" label="Apple" disabled />
      </Checkbox.Group>,
    )

    screen.getByRole("checkbox", { name: "Apple" }).focus()
    await userEvent.keyboard("{Enter}")

    expect(onChange).not.toHaveBeenCalled()
  })

  it("respects consumer onKeyDown preventDefault for Enter", async () => {
    const onChange = vi.fn()
    render(
      <Checkbox.Group
        label="Fruits"
        onChange={onChange}
        onKeyDown={(e) => e.preventDefault()}
      >
        <Checkbox.Item value="apple" label="Apple" />
      </Checkbox.Group>,
    )

    screen.getByRole("checkbox", { name: "Apple" }).focus()
    await userEvent.keyboard("{Enter}")

    expect(onChange).not.toHaveBeenCalled()
  })

  it("has no a11y violations", async () => {
    const { container } = render(
      <Checkbox.Group label="Fruits">
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
