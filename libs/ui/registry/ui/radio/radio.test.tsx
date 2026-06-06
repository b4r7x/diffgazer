import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, expectTypeOf, it, vi } from "vitest"
import { axe } from "../../../testing/axe"
import { Field } from "../field/index"
import { Radio, RadioGroup, type RadioGroupItemProps } from "./index"
import type { RadioGroupProps } from "./radio-group"

function getForm(): HTMLFormElement {
  const form = screen.getByRole("form", { name: "Test form" })
  if (!(form instanceof HTMLFormElement)) throw new Error("Expected form test element")
  return form
}

describe("Radio", () => {
  it("selects on click", async () => {
    const onChange = vi.fn()
    render(<Radio onChange={onChange} label="Option A" />)
    await userEvent.click(screen.getByRole("radio"))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it("does not toggle off on second click (radio stays selected)", async () => {
    render(<Radio defaultChecked label="Option A" />)
    const radio = screen.getByRole("radio")
    expect(radio).toHaveAttribute("aria-checked", "true")
    await userEvent.click(radio)
    expect(radio).toHaveAttribute("aria-checked", "true")
  })

  it("does not select when disabled", async () => {
    const onChange = vi.fn()
    const onClick = vi.fn()
    render(<Radio disabled onChange={onChange} onClick={onClick} label="Option A" />)
    await userEvent.click(screen.getByRole("radio"))
    expect(onChange).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
  })

  it("works in uncontrolled mode with defaultChecked", async () => {
    render(<Radio defaultChecked={false} label="Option A" />)
    const radio = screen.getByRole("radio")
    expect(radio).toHaveAttribute("aria-checked", "false")
    await userEvent.click(radio)
    expect(radio).toHaveAttribute("aria-checked", "true")
  })

  it("respects controlled value", async () => {
    const onChange = vi.fn()
    render(<Radio checked={false} onChange={onChange} label="Option A" />)
    await userEvent.click(screen.getByRole("radio"))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole("radio")).toHaveAttribute("aria-checked", "false")
  })

  it("selects on Space key", async () => {
    const onChange = vi.fn()
    render(<Radio onChange={onChange} label="Option A" />)
    screen.getByRole("radio").focus()
    await userEvent.keyboard(" ")
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it("has no a11y violations (standalone)", async () => {
    const { container } = render(<Radio label="Option A" aria-label="Option A" />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("composes Field label and description ids with local label and description", () => {
    render(
      <Field invalid>
        <Field.Label>Payment method</Field.Label>
        <Field.Control>
          <Radio label="Card" description="Local help" />
        </Field.Control>
        <Field.Description>Field help</Field.Description>
        <Field.Error>Field error</Field.Error>
      </Field>,
    )

    const radio = screen.getByRole("radio", { name: /payment method.*card/i })
    expect(radio).toHaveAccessibleDescription(/field help.*field error.*local help/i)
    expect(radio).toHaveAttribute("aria-invalid", "true")
  })

  it("submits a meaningful default value and resets uncontrolled state", async () => {
    render(
      <form aria-label="Test form">
        <Radio name="choice" defaultChecked={false} label="Option A" />
      </form>
    )

    await userEvent.click(screen.getByRole("radio"))
    const form = getForm()
    expect(new FormData(form).get("choice")).toBe("on")

    form.reset()
    await waitFor(() => expect(new FormData(form).has("choice")).toBe(false))
    expect(screen.getByRole("radio")).toHaveAttribute("aria-checked", "false")
  })

  it("keeps custom and empty submitted values aligned with data-value", async () => {
    render(
      <form aria-label="Test form">
        <Radio name="choice" value="custom" label="Custom" />
        <Radio name="choice" value="" label="Empty" />
      </form>
    )

    const custom = screen.getByRole("radio", { name: /custom/i })
    const empty = screen.getByRole("radio", { name: /empty/i })

    expect(custom).toHaveAttribute("data-value", "custom")
    expect(empty).toHaveAttribute("data-value", "")

    await userEvent.click(custom)
    expect(new FormData(getForm()).get("choice")).toBe("custom")

    await userEvent.click(empty)
    expect(new FormData(getForm()).get("choice")).toBe("")
  })

  it("focuses the visible radio when native required validation fails", async () => {
    render(
      <form aria-label="Test form">
        <Radio name="choice" required label="Option A" />
      </form>
    )

    const form = getForm()
    const radio = screen.getByRole("radio", { name: /option a/i })

    expect(form.reportValidity()).toBe(false)
    expect(radio).toHaveFocus()
    await waitFor(() => expect(radio).toHaveAttribute("aria-invalid", "true"))
  })

  it("validates required unnamed radios without contributing FormData", async () => {
    render(
      <form aria-label="Test form">
        <Radio required label="Option A" />
      </form>
    )

    const form = getForm()
    const radio = screen.getByRole("radio", { name: /option a/i })

    expect(form.reportValidity()).toBe(false)
    expect(radio).toHaveFocus()
    await waitFor(() => expect(radio).toHaveAttribute("aria-invalid", "true"))
    expect(new FormData(form).entries().next().done).toBe(true)

    await userEvent.click(radio)
    expect(form.checkValidity()).toBe(true)
    expect(new FormData(form).entries().next().done).toBe(true)
  })

  it("keeps standalone radios with the same name mutually exclusive", async () => {
    render(
      <form aria-label="Test form">
        <Radio name="size" value="small" label="Small" />
        <Radio name="size" value="large" label="Large" />
      </form>
    )
    const small = screen.getByRole("radio", { name: /small/i })
    const large = screen.getByRole("radio", { name: /large/i })
    const form = getForm()

    await userEvent.click(small)
    expect(small).toHaveAttribute("aria-checked", "true")
    expect(large).toHaveAttribute("aria-checked", "false")
    expect(new FormData(form).get("size")).toBe("small")

    await userEvent.click(large)
    expect(small).toHaveAttribute("aria-checked", "false")
    expect(large).toHaveAttribute("aria-checked", "true")
    expect(new FormData(form).get("size")).toBe("large")
  })

  it("normalizes same-name default selections to one checked standalone radio", async () => {
    render(
      <form aria-label="Test form">
        <Radio name="size" value="small" defaultChecked label="Small" />
        <Radio name="size" value="large" defaultChecked label="Large" />
      </form>
    )

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /small/i })).toHaveAttribute("aria-checked", "false")
      expect(screen.getByRole("radio", { name: /large/i })).toHaveAttribute("aria-checked", "true")
    })
    expect(new FormData(getForm()).get("size")).toBe("large")
  })

  it("unchecks uncontrolled same-name radios when a controlled radio becomes checked", async () => {
    function MixedRadios() {
      const [smallChecked, setSmallChecked] = useState(false)

      return (
        <form aria-label="Test form">
          <Radio
            name="size"
            value="small"
            checked={smallChecked}
            onChange={() => setSmallChecked(true)}
            label="Small"
          />
          <Radio name="size" value="large" defaultChecked label="Large" />
          <button type="button" onClick={() => setSmallChecked(true)}>
            Choose small
          </button>
        </form>
      )
    }

    render(<MixedRadios />)

    await userEvent.click(screen.getByRole("button", { name: /choose small/i }))

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /small/i })).toHaveAttribute("aria-checked", "true")
      expect(screen.getByRole("radio", { name: /large/i })).toHaveAttribute("aria-checked", "false")
    })
  })

  it("passes native root props and composes root handlers", async () => {
    const onClick = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <Radio
        label="Option A"
        data-source="external"
        style={{ maxWidth: "16px" }}
        onClick={onClick}
        onKeyDown={onKeyDown}
      />,
    )

    const radio = screen.getByRole("radio", { name: /option a/i })
    await userEvent.click(radio)
    radio.focus()
    await userEvent.keyboard(" ")

    // onClick/onKeyDown are native event callbacks with no semantic value;
    // the contract here is that the consumer's handlers compose and fire.
    expect(onClick).toHaveBeenCalledOnce()
    expect(onKeyDown).toHaveBeenCalled()
    expect(radio).toHaveAttribute("data-source", "external")
    expect(radio).toHaveStyle({ maxWidth: "16px" })
  })

  it("lets consumer click handlers prevent the built-in selection", async () => {
    const onChange = vi.fn()
    render(
      <Radio
        label="Option A"
        onChange={onChange}
        onClick={(event) => event.preventDefault()}
      />,
    )

    await userEvent.click(screen.getByRole("radio", { name: /option a/i }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("radio", { name: /option a/i })).toHaveAttribute("aria-checked", "false")
  })

  it("lets consumer keyboard handlers prevent the built-in Space selection", async () => {
    const onChange = vi.fn()
    render(
      <Radio
        label="Option A"
        onChange={onChange}
        onKeyDown={(event) => event.preventDefault()}
      />,
    )

    screen.getByRole("radio", { name: /option a/i }).focus()
    await userEvent.keyboard(" ")

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("radio", { name: /option a/i })).toHaveAttribute("aria-checked", "false")
  })
})

describe("RadioGroup", () => {
  it("supports direct namespaced items with custom label UI", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label={<span>Red</span>} description={<span>Warm</span>} />
        <RadioGroup.Item value="blue" label={<span>Blue</span>} />
      </RadioGroup>
    )

    await userEvent.click(screen.getByRole("radio", { name: /blue/i }))

    expect(onChange).toHaveBeenCalledWith("blue")
    expect(screen.getByText("Warm")).toBeInTheDocument()
  })

  it("selects a value on click", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    await userEvent.click(screen.getByText("Blue"))
    expect(onChange).toHaveBeenCalledWith("blue")
  })

  it("preserves Field invalid and description wiring on the group", () => {
    render(
      <Field invalid>
        <Field.Label>Colors</Field.Label>
        <Field.Control>
          <RadioGroup>
            <RadioGroup.Item value="red" label="Red" />
          </RadioGroup>
        </Field.Control>
        <Field.Error>Select a color.</Field.Error>
      </Field>,
    )

    const group = screen.getByRole("radiogroup", { name: "Colors" })
    expect(group).toHaveAttribute("aria-invalid", "true")
    expect(group).toHaveAccessibleDescription("Select a color.")
  })

  it("does not select disabled items", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" disabled />
      </RadioGroup>
    )
    await userEvent.click(screen.getByText("Blue"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not move keyboard highlight on mouse hover", async () => {
    const onHighlight = vi.fn()
    render(
      <RadioGroup label="Colors" highlighted="red" onHighlightChange={onHighlight}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )

    await userEvent.hover(screen.getByRole("radio", { name: /blue/i }))

    expect(onHighlight).not.toHaveBeenCalled()
    expect(screen.getByRole("radio", { name: /red/i })).toHaveAttribute("data-highlighted", "true")
    expect(screen.getByRole("radio", { name: /blue/i })).not.toHaveAttribute("data-highlighted")
  })

  it("wraps across enabled radios, skips disabled items, and maps navigation keys", async () => {
    const onChange = vi.fn()
    const onNavigate = vi.fn()
    render(
      <RadioGroup label="Colors" onChange={onChange} onNavigate={onNavigate}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" disabled />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>
    )

    const red = screen.getByRole("radio", { name: /red/i })
    const blue = screen.getByRole("radio", { name: /blue/i })
    const green = screen.getByRole("radio", { name: /green/i })

    red.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(green).toHaveFocus()
    expect(green).toHaveAttribute("aria-checked", "true")
    expect(onChange).toHaveBeenLastCalledWith("green")
    expect(onNavigate).toHaveBeenLastCalledWith("green", "next")

    await userEvent.keyboard("{ArrowDown}")
    expect(red).toHaveFocus()
    expect(onNavigate).toHaveBeenLastCalledWith("red", "next")

    await userEvent.keyboard("{ArrowUp}")
    expect(green).toHaveFocus()
    expect(onNavigate).toHaveBeenLastCalledWith("green", "previous")

    await userEvent.keyboard("{Home}")
    expect(red).toHaveFocus()
    expect(onNavigate).toHaveBeenLastCalledWith("red", "first")

    await userEvent.keyboard("{End}")
    expect(green).toHaveFocus()
    expect(onNavigate).toHaveBeenLastCalledWith("green", "last")

    await userEvent.keyboard("{ArrowLeft}")
    expect(red).toHaveFocus()
    expect(onNavigate).toHaveBeenLastCalledWith("red", "previous")

    await userEvent.keyboard("{ArrowRight}")
    expect(green).toHaveFocus()
    expect(onNavigate).toHaveBeenLastCalledWith("green", "next")
    expect(blue).not.toHaveFocus()
    expect(blue).toHaveAttribute("aria-checked", "false")
  })

  it("reports non-wrapping keyboard boundaries without moving focus", async () => {
    const onNavigationBoundaryReached = vi.fn()
    render(
      <RadioGroup
        label="Colors"
        defaultValue="red"
        wrap={false}
        onNavigationBoundaryReached={onNavigationBoundaryReached}
      >
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )

    const red = screen.getByRole("radio", { name: /red/i })
    const blue = screen.getByRole("radio", { name: /blue/i })

    red.focus()
    await userEvent.keyboard("{ArrowUp}")
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith("previous", expect.any(KeyboardEvent), "ArrowUp")
    expect(red).toHaveFocus()

    await userEvent.keyboard("{ArrowLeft}")
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith("previous", expect.any(KeyboardEvent), "ArrowLeft")
    expect(red).toHaveFocus()

    await userEvent.keyboard("{ArrowDown}")
    expect(blue).toHaveFocus()

    await userEvent.keyboard("{ArrowDown}")
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith("next", expect.any(KeyboardEvent), "ArrowDown")
    expect(blue).toHaveFocus()

    await userEvent.keyboard("{ArrowRight}")
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith("next", expect.any(KeyboardEvent), "ArrowRight")
    expect(blue).toHaveFocus()
  })

  it("keeps arrow navigation scoped away from nested radio groups", async () => {
    const onOuterChange = vi.fn()
    const onInnerChange = vi.fn()
    render(
      <RadioGroup label="Outer" onChange={onOuterChange}>
        <RadioGroup.Item value="outer-a" label="Outer A" />
        <RadioGroup label="Inner" onChange={onInnerChange}>
          <RadioGroup.Item value="inner-a" label="Inner A" />
        </RadioGroup>
        <RadioGroup.Item value="outer-b" label="Outer B" />
      </RadioGroup>
    )

    screen.getByRole("radio", { name: /outer a/i }).focus()
    await userEvent.keyboard("{ArrowDown}")

    expect(screen.getByRole("radio", { name: /outer b/i })).toHaveFocus()
    expect(onOuterChange).toHaveBeenCalledWith("outer-b")
    expect(onInnerChange).not.toHaveBeenCalled()
  })

  it("does not handle arrow events bubbling from a nested group with suspended keyboard navigation", async () => {
    const onOuterChange = vi.fn()
    const onInnerChange = vi.fn()
    render(
      <RadioGroup label="Outer" onChange={onOuterChange}>
        <RadioGroup.Item value="outer-a" label="Outer A" />
        <RadioGroup label="Inner" onChange={onInnerChange} keyboardNavigation={false}>
          <RadioGroup.Item value="inner-a" label="Inner A" />
        </RadioGroup>
        <RadioGroup.Item value="outer-b" label="Outer B" />
      </RadioGroup>
    )

    screen.getByRole("radio", { name: /inner a/i }).focus()
    await userEvent.keyboard("{ArrowDown}")

    expect(screen.getByRole("radio", { name: /inner a/i })).toHaveFocus()
    expect(onOuterChange).not.toHaveBeenCalled()
    expect(onInnerChange).not.toHaveBeenCalled()
  })

  it("keeps the highlighted item tabbable during manual activation", () => {
    render(
      <RadioGroup label="Colors" value="red" highlighted="blue" activationMode="manual">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )

    const red = screen.getByRole("radio", { name: /red/i })
    const blue = screen.getByRole("radio", { name: /blue/i })
    expect(red).toHaveAttribute("aria-checked", "true")
    expect(red).toHaveAttribute("tabindex", "-1")
    expect(blue).toHaveAttribute("tabindex", "0")
    expect(blue).toHaveAttribute("data-highlighted", "true")
  })

  it("respects controlled value", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup value="red" onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    await userEvent.click(screen.getByText("Blue"))
    expect(onChange).toHaveBeenCalledWith("blue")
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "true")
    expect(screen.getAllByRole("radio")[1]).toHaveAttribute("aria-checked", "false")
  })

  it("keeps explicit value undefined controlled instead of adopting internal selection", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup value={undefined} onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )

    await userEvent.click(screen.getByText("Blue"))

    expect(onChange).toHaveBeenCalledWith("blue")
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "false")
    expect(screen.getAllByRole("radio")[1]).toHaveAttribute("aria-checked", "false")
  })

  it("has no a11y violations (unselected and selected)", async () => {
    const { container, rerender } = render(
      <RadioGroup label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    expect(await axe(container)).toHaveNoViolations()

    rerender(
      <RadioGroup label="Colors" defaultValue="red">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("uses native aria-labelledby for the group name", () => {
    render(
      <>
        <h2 id="choice-label">Choice set</h2>
        <RadioGroup aria-labelledby="choice-label">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </>,
    )

    expect(screen.getByRole("radiogroup", { name: "Choice set" })).toHaveAttribute("aria-labelledby", "choice-label")
  })

  it("moves selection with ArrowDown", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>
    )
    const red = screen.getByRole("radio", { name: /red/i })
    const blue = screen.getByRole("radio", { name: /blue/i })

    red.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(onChange).toHaveBeenLastCalledWith("blue")
    expect(blue).toHaveFocus()
    expect(blue).toHaveAttribute("aria-checked", "true")
  })

  it("can suspend keyboard navigation without disabling items", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors" keyboardNavigation={false}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )

    const red = screen.getByRole("radio", { name: /red/i })
    const blue = screen.getByRole("radio", { name: /blue/i })
    expect(red).toHaveAttribute("tabindex", "0")
    expect(blue).toHaveAttribute("tabindex", "0")

    red.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(onChange).not.toHaveBeenCalled()
    expect(red).toHaveFocus()

    await userEvent.tab()
    expect(blue).toHaveFocus()

    await userEvent.click(blue)
    expect(onChange).toHaveBeenCalledWith("blue")
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-disabled")
  })

  it("commits the focused value with Enter during manual activation", async () => {
    const onChange = vi.fn()
    const onEnter = vi.fn()
    render(
      <RadioGroup
        label="Colors"
        defaultValue="red"
        onChange={onChange}
        onEnter={onEnter}
        activationMode="manual"
      >
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )

    screen.getByRole("radio", { name: /red/i }).focus()
    await userEvent.keyboard("{ArrowDown}{Enter}")

    expect(onEnter).toHaveBeenCalledWith("blue", expect.any(Object))
    expect(onChange).toHaveBeenCalledWith("blue")
    expect(screen.getByRole("radio", { name: /blue/i })).toHaveAttribute("aria-checked", "true")
  })

  it("can separate keyboard navigation from value changes during manual activation", async () => {
    const onChange = vi.fn()
    const onNavigate = vi.fn()
    const onHighlight = vi.fn()
    render(
      <RadioGroup
        label="Colors"
        value="red"
        onChange={onChange}
        onNavigate={onNavigate}
        onHighlightChange={onHighlight}
        activationMode="manual"
      >
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )

    const red = screen.getByRole("radio", { name: /red/i })
    const blue = screen.getByRole("radio", { name: /blue/i })

    red.focus()
    await userEvent.keyboard("{ArrowDown}")

    expect(blue).toHaveFocus()
    expect(red).toHaveAttribute("tabindex", "-1")
    expect(blue).toHaveAttribute("tabindex", "0")
    expect(red).toHaveAttribute("aria-checked", "true")
    expect(blue).toHaveAttribute("aria-checked", "false")
    expect(onHighlight).toHaveBeenCalledWith("blue")
    expect(onNavigate).toHaveBeenCalledWith("blue", "next")
    expect(onChange).not.toHaveBeenCalled()

    await userEvent.keyboard(" ")
    expect(onChange).toHaveBeenCalledWith("blue")
  })

  it("focuses the highlighted item when autofocus is enabled", async () => {
    render(
      <RadioGroup
        label="Colors"
        value="red"
        highlighted="blue"
        activationMode="manual"
        autoFocus
      >
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )

    await waitFor(() => expect(screen.getByRole("radio", { name: /blue/i })).toHaveFocus())
    expect(screen.getByRole("radio", { name: /red/i })).toHaveAttribute("aria-checked", "true")
  })

  it("resets uncontrolled group value with native form reset", async () => {
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" defaultValue="red" label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>
    )

    await userEvent.click(screen.getByRole("radio", { name: /blue/i }))
    const form = getForm()
    expect(new FormData(form).get("color")).toBe("blue")

    form.reset()
    await waitFor(() => expect(new FormData(form).get("color")).toBe("red"))
  })

  it("marks required groups and routes native validation to a visible radio", async () => {
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" required label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>
    )

    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-required", "true")
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-required")
    }
    expect(screen.getAllByRole("radio")).toHaveLength(2)

    const form = getForm()
    expect(form.reportValidity()).toBe(false)
    expect(screen.getByRole("radio", { name: /red/i })).toHaveFocus()
    await waitFor(() => expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true"))
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-invalid")
    }

    await userEvent.click(screen.getByRole("radio", { name: /blue/i }))
    expect(form.checkValidity()).toBe(true)
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid")
    expect(new FormData(form).get("color")).toBe("blue")
  })

  it("does not satisfy required validation with a stale controlled value", async () => {
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" required label="Colors" value="missing">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>
    )

    const form = getForm()
    expect(form.checkValidity()).toBe(false)
    expect(new FormData(form).has("color")).toBe(false)

    expect(form.reportValidity()).toBe(false)
    expect(screen.getByRole("radio", { name: /red/i })).toHaveFocus()
    await waitFor(() => expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true"))
  })

  it("validates required groups with items rendered through wrapper components", () => {
    function WrappedBlue() {
      return <RadioGroup.Item value="blue" label="Blue" />
    }

    render(
      <form aria-label="Test form">
        <RadioGroup name="color" required label="Colors" value="blue">
          <WrappedBlue />
        </RadioGroup>
      </form>
    )

    const form = getForm()
    expect(form.checkValidity()).toBe(true)
    expect(new FormData(form).get("color")).toBe("blue")
  })

  it("validates required unnamed groups without contributing FormData", async () => {
    render(
      <form aria-label="Test form">
        <RadioGroup required label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>
    )

    const form = getForm()
    expect(form.reportValidity()).toBe(false)
    expect(screen.getByRole("radio", { name: /red/i })).toHaveFocus()
    await waitFor(() => expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true"))
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-invalid")
    }
    expect(new FormData(form).entries().next().done).toBe(true)

    await userEvent.click(screen.getByRole("radio", { name: /blue/i }))
    expect(form.checkValidity()).toBe(true)
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid")
    expect(new FormData(form).entries().next().done).toBe(true)
  })

  it("does not call the public value callback with undefined on native reset", async () => {
    const onChange = vi.fn()
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" onChange={onChange} label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>
    )

    await userEvent.click(screen.getByRole("radio", { name: /blue/i }))
    expect(onChange).toHaveBeenCalledWith("blue")

    const form = getForm()
    form.reset()

    await waitFor(() => expect(screen.getByRole("radio", { name: /blue/i })).toHaveAttribute("aria-checked", "false"))
    // call-count IS the contract: native form reset must NOT fire onChange (count stays at 1 from the explicit click; a reset-triggered onChange with undefined would be a regression)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

})

describe("RadioGroup types", () => {
  it("narrows value/onChange to the supplied literal union", () => {
    type Narrow = RadioGroupProps<"sm" | "md" | "lg">

    expectTypeOf<Narrow["value"]>().toEqualTypeOf<"sm" | "md" | "lg" | undefined>()
    expectTypeOf<Narrow["defaultValue"]>().toEqualTypeOf<"sm" | "md" | "lg" | undefined>()
    expectTypeOf<NonNullable<Narrow["onChange"]>>().parameter(0).toEqualTypeOf<"sm" | "md" | "lg">()
  })

  it("rejects RadioGroupItem values outside the literal union", () => {
    expectTypeOf<"xl">().not.toMatchTypeOf<RadioGroupItemProps<"sm" | "md" | "lg">["value"]>()
    expectTypeOf<"sm">().toMatchTypeOf<RadioGroupItemProps<"sm" | "md" | "lg">["value"]>()
  })

  it("keeps the loose default contract when no generic is supplied", () => {
    expectTypeOf<RadioGroupProps["value"]>().toEqualTypeOf<string | undefined>()
    expectTypeOf<RadioGroupItemProps["value"]>().toEqualTypeOf<string>()
  })
})
