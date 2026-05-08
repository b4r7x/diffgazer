import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Radio, RadioGroup } from "./index.js"

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
    render(<Radio disabled onChange={onChange} label="Option A" />)
    await userEvent.click(screen.getByRole("radio"))
    expect(onChange).not.toHaveBeenCalled()
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

  it("submits a meaningful default value and resets uncontrolled state", async () => {
    render(
      <form data-testid="form">
        <Radio name="choice" defaultChecked={false} label="Option A" />
      </form>
    )

    await userEvent.click(screen.getByRole("radio"))
    const form = screen.getByTestId("form") as HTMLFormElement
    expect(new FormData(form).get("choice")).toBe("on")

    form.reset()
    await waitFor(() => expect(new FormData(form).has("choice")).toBe(false))
    expect(screen.getByRole("radio")).toHaveAttribute("aria-checked", "false")
  })

  it("focuses the visible radio when native required validation fails", async () => {
    render(
      <form data-testid="form">
        <Radio name="choice" required label="Option A" />
      </form>
    )

    const form = screen.getByTestId("form") as HTMLFormElement
    const radio = screen.getByRole("radio", { name: /option a/i })

    expect(form.reportValidity()).toBe(false)
    expect(radio).toHaveFocus()
    await waitFor(() => expect(radio).toHaveAttribute("aria-invalid", "true"))
  })

  it("validates required unnamed radios without contributing FormData", async () => {
    render(
      <form data-testid="form">
        <Radio required label="Option A" />
      </form>
    )

    const form = screen.getByTestId("form") as HTMLFormElement
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
      <form data-testid="form">
        <Radio name="size" value="small" label="Small" />
        <Radio name="size" value="large" label="Large" />
      </form>
    )
    const small = screen.getByRole("radio", { name: /small/i })
    const large = screen.getByRole("radio", { name: /large/i })
    const form = screen.getByTestId("form") as HTMLFormElement

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
      <form data-testid="form">
        <Radio name="size" value="small" defaultChecked label="Small" />
        <Radio name="size" value="large" defaultChecked label="Large" />
      </form>
    )

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /small/i })).toHaveAttribute("aria-checked", "false")
      expect(screen.getByRole("radio", { name: /large/i })).toHaveAttribute("aria-checked", "true")
    })
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("size")).toBe("large")
  })
})

describe("RadioGroup", () => {
  it("supports direct namespaced items with custom label UI", async () => {
    const onValueChange = vi.fn()
    render(
      <RadioGroup onValueChange={onValueChange} label="Colors">
        <RadioGroup.Item value="red" label={<span>Red</span>} description={<span>Warm</span>} />
        <RadioGroup.Item value="blue" label={<span>Blue</span>} />
      </RadioGroup>
    )

    await userEvent.click(screen.getByRole("radio", { name: /blue/i }))

    expect(onValueChange).toHaveBeenCalledWith("blue")
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

  it("calls onValueChange as the preferred group callback", async () => {
    const onValueChange = vi.fn()
    render(
      <RadioGroup onValueChange={onValueChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )

    await userEvent.click(screen.getByRole("radio", { name: /blue/i }))
    expect(onValueChange).toHaveBeenCalledWith("blue")
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
    expect(screen.getByRole("radio", { name: /red/i })).toHaveClass("bg-secondary")
    expect(screen.getByRole("radio", { name: /blue/i })).not.toHaveClass("bg-secondary")
  })

  it("exposes one tabbable enabled item when unselected and skips disabled items", async () => {
    render(
      <RadioGroup label="Colors">
        <RadioGroup.Item value="red" label="Red" disabled />
        <RadioGroup.Item value="blue" label="Blue" />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>
    )

    const radios = screen.getAllByRole("radio")
    expect(radios.map((radio) => radio.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"])

    await userEvent.tab()
    expect(screen.getByRole("radio", { name: /blue/i })).toHaveFocus()
  })

  it("falls back to an enabled tab target when selected or highlighted values are invalid", async () => {
    render(
      <RadioGroup label="Colors" value="missing" highlighted="red">
        <RadioGroup.Item value="red" label="Red" disabled />
        <RadioGroup.Item value="blue" label="Blue" />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>
    )

    const radios = screen.getAllByRole("radio")
    expect(radios.map((radio) => radio.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"])
    expect(screen.getByRole("radio", { name: /red/i })).not.toHaveClass("bg-secondary")

    await userEvent.tab()
    expect(screen.getByRole("radio", { name: /blue/i })).toHaveFocus()
  })

  it("keeps the tabbable item aligned with a valid controlled highlight", () => {
    render(
      <RadioGroup label="Colors" value="red" highlighted="blue">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )

    const red = screen.getByRole("radio", { name: /red/i })
    const blue = screen.getByRole("radio", { name: /blue/i })
    expect(red).toHaveAttribute("aria-checked", "true")
    expect(red).toHaveAttribute("tabindex", "-1")
    expect(blue).toHaveAttribute("tabindex", "0")
    expect(blue).toHaveClass("bg-secondary")
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
    // controlled: DOM should not change
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

  it("navigates with ArrowDown and wraps around", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>
    )
    screen.getAllByRole("radio")[0].focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(onChange).toHaveBeenLastCalledWith("blue")
    await userEvent.keyboard("{ArrowDown}")
    expect(onChange).toHaveBeenLastCalledWith("green")
    await userEvent.keyboard("{ArrowDown}")
    expect(onChange).toHaveBeenLastCalledWith("red")
  })

  it("does not move focus to disabled radio items with arrow keys", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" disabled />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>
    )

    screen.getByRole("radio", { name: /red/i }).focus()
    await userEvent.keyboard("{ArrowDown}")

    expect(screen.getByRole("radio", { name: /green/i })).toHaveFocus()
    expect(onChange).toHaveBeenCalledWith("green")
  })

  it("navigates with ArrowRight and ArrowLeft (APG: all four arrow keys)", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    screen.getAllByRole("radio")[0].focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(onChange).toHaveBeenCalledWith("blue")
    onChange.mockClear()
    await userEvent.keyboard("{ArrowLeft}")
    expect(onChange).toHaveBeenCalledWith("red")
  })

  it("resets uncontrolled group value with native form reset", async () => {
    render(
      <form data-testid="form">
        <RadioGroup name="color" defaultValue="red" label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>
    )

    await userEvent.click(screen.getByRole("radio", { name: /blue/i }))
    const form = screen.getByTestId("form") as HTMLFormElement
    expect(new FormData(form).get("color")).toBe("blue")

    form.reset()
    await waitFor(() => expect(new FormData(form).get("color")).toBe("red"))
  })

  it("marks required groups and routes native validation to a visible radio", async () => {
    render(
      <form data-testid="form">
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
    for (const input of screen.getByTestId("form").querySelectorAll("input[required]")) {
      expect(input).toHaveAttribute("aria-hidden", "true")
    }
    expect(screen.getAllByRole("radio")).toHaveLength(2)

    const form = screen.getByTestId("form") as HTMLFormElement
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

  it("validates required unnamed groups without contributing FormData", async () => {
    render(
      <form data-testid="form">
        <RadioGroup required label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>
    )

    const form = screen.getByTestId("form") as HTMLFormElement
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
})
