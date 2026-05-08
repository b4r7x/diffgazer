import { createRef } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { ToggleGroup } from "./index.js"

function renderGroup(props: Partial<React.ComponentProps<typeof ToggleGroup>> = {}) {
  return render(
    <ToggleGroup label="Options" {...props}>
      <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
      <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
    </ToggleGroup>
  )
}

function getRadios() {
  return screen.getAllByRole("radio")
}

describe("ToggleGroup", () => {
  it("supports direct namespaced items with custom item UI", async () => {
    const onValueChange = vi.fn()
    render(
      <ToggleGroup label="Options" onValueChange={onValueChange}>
        <ToggleGroup.Item value="a"><span>Alpha</span></ToggleGroup.Item>
        <ToggleGroup.Item value="b"><span>Beta</span></ToggleGroup.Item>
      </ToggleGroup>,
    )

    await userEvent.click(screen.getByRole("radio", { name: /beta/i }))

    expect(onValueChange).toHaveBeenCalledWith("b")
  })

  it("selects an item on click", async () => {
    renderGroup()
    await userEvent.click(screen.getByText("Beta"))
    expect(getRadios()[1]).toHaveAttribute("aria-checked", "true")
  })

  it("does not deselect when clicking the same item without allowDeselect", async () => {
    renderGroup({ defaultValue: "a" })
    await userEvent.click(screen.getByText("Alpha"))
    expect(getRadios()[0]).toHaveAttribute("aria-checked", "true")
  })

  it("deselects when clicking the same item with allowDeselect", async () => {
    const onChange = vi.fn()
    renderGroup({ defaultValue: "a", allowDeselect: true, onChange })
    await userEvent.click(screen.getByText("Alpha"))
    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "false")
  })

  it("moves focus without changing pressed state when allowDeselect is true", async () => {
    const onValueChange = vi.fn()
    renderGroup({ defaultValue: "a", allowDeselect: true, onValueChange })
    const alpha = screen.getByRole("button", { name: /alpha/i })
    const beta = screen.getByRole("button", { name: /beta/i })

    alpha.focus()
    await userEvent.keyboard("{ArrowRight}")

    expect(beta).toHaveFocus()
    expect(alpha).toHaveAttribute("aria-pressed", "true")
    expect(beta).toHaveAttribute("aria-pressed", "false")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("activates the focused item with Space and Enter when allowDeselect is true", async () => {
    const onValueChange = vi.fn()
    renderGroup({ defaultValue: "a", allowDeselect: true, onValueChange })
    const alpha = screen.getByRole("button", { name: /alpha/i })
    const beta = screen.getByRole("button", { name: /beta/i })

    alpha.focus()
    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard(" ")
    expect(onValueChange).toHaveBeenCalledWith("b")

    await userEvent.keyboard("{Enter}")
    expect(onValueChange).toHaveBeenCalledWith(null)
    expect(beta).toHaveAttribute("aria-pressed", "false")
  })

  it("uses button pressed semantics when deselection is allowed", () => {
    renderGroup({ defaultValue: "a", allowDeselect: true })

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
    expect(screen.getByRole("group", { name: /options/i })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: /options/i })).not.toHaveAttribute("aria-orientation")
    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /beta/i })).toHaveAttribute("aria-pressed", "false")
  })

  it("switches selection between items", async () => {
    renderGroup({ defaultValue: "a" })
    const radios = getRadios()
    expect(radios[0]).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByText("Charlie"))
    expect(radios[0]).toHaveAttribute("aria-checked", "false")
    expect(radios[2]).toHaveAttribute("aria-checked", "true")
  })

  it("does not select disabled items (individual or group-level)", async () => {
    const onChange = vi.fn()
    const { unmount: unmount1 } = render(
      <ToggleGroup label="Options" onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b" disabled>Beta</ToggleGroup.Item>
      </ToggleGroup>
    )
    await userEvent.click(screen.getByText("Beta"))
    expect(onChange).not.toHaveBeenCalled()
    unmount1()
    onChange.mockClear()

    render(
      <ToggleGroup label="Options" disabled onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>
    )
    const radios = screen.getAllByRole("radio")
    for (const radio of radios) {
      expect(radio).toHaveAttribute("aria-disabled", "true")
      expect(radio).toBeDisabled()
    }
    await userEvent.click(screen.getByText("Alpha"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("renders count in item when provided", () => {
    render(
      <ToggleGroup label="Options">
        <ToggleGroup.Item value="a" count={5}>Alpha</ToggleGroup.Item>
      </ToggleGroup>
    )
    expect(screen.getByRole("radio")).toHaveTextContent("[Alpha 5]")
  })

  it("works in uncontrolled mode with defaultValue", async () => {
    renderGroup({ defaultValue: "b" })
    const radios = getRadios()
    expect(radios[1]).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByText("Charlie"))
    expect(radios[1]).toHaveAttribute("aria-checked", "false")
    expect(radios[2]).toHaveAttribute("aria-checked", "true")
  })

  it("respects controlled value", async () => {
    const onChange = vi.fn()
    renderGroup({ value: "a", onChange })
    await userEvent.click(screen.getByText("Beta"))
    expect(onChange).toHaveBeenCalledWith("b")
    expect(getRadios()[0]).toHaveAttribute("aria-checked", "true")
    expect(getRadios()[1]).toHaveAttribute("aria-checked", "false")
  })

  it("calls onValueChange as the preferred controlled callback", async () => {
    const onValueChange = vi.fn()
    renderGroup({ value: "a", onValueChange })
    await userEvent.click(screen.getByText("Beta"))
    expect(onValueChange).toHaveBeenCalledWith("b")
  })

  it("forwards item props and refs while honoring preventDefault", async () => {
    const ref = createRef<HTMLButtonElement>()
    const onValueChange = vi.fn()
    const onClick = vi.fn((event) => event.preventDefault())

    render(
      <ToggleGroup label="Options" onValueChange={onValueChange}>
        <ToggleGroup.Item ref={ref} value="a" data-testid="toggle-item" onClick={onClick}>
          Alpha
        </ToggleGroup.Item>
      </ToggleGroup>,
    )

    const item = screen.getByTestId("toggle-item")
    expect(ref.current).toBe(item)
    await userEvent.click(item)
    expect(onClick).toHaveBeenCalledOnce()
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("participates in form data by name and resets to defaultValue", async () => {
    render(
      <form data-testid="form">
        <ToggleGroup label="Options" name="option" defaultValue="a">
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
          <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    )
    const form = screen.getByTestId("form") as HTMLFormElement

    expect(new FormData(form).get("option")).toBe("a")
    await userEvent.click(screen.getByRole("radio", { name: /beta/i }))
    expect(new FormData(form).get("option")).toBe("b")

    form.reset()
    await waitFor(() => expect(new FormData(form).get("option")).toBe("a"))
  })

  it("omits form data when disabled or deselected", async () => {
    const { rerender } = render(
      <form data-testid="form">
        <ToggleGroup label="Options" name="option" defaultValue="a" disabled>
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    )
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).has("option")).toBe(false)

    rerender(
      <form data-testid="form">
        <ToggleGroup label="Options" name="option" defaultValue="a" allowDeselect>
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    )
    await userEvent.click(screen.getByRole("button", { name: /alpha/i }))
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).has("option")).toBe(false)
  })

  it("has no a11y violations", async () => {
    const { container } = renderGroup()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations with a selected value", async () => {
    const { container } = renderGroup({ defaultValue: "b" })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("moves focus with ArrowRight", async () => {
    renderGroup({ defaultValue: "a" })
    const radios = getRadios()
    radios[0].focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(radios[1]).toHaveFocus()
  })

  it("exposes one tabbable enabled item when unselected and skips disabled items", async () => {
    render(
      <ToggleGroup label="Options">
        <ToggleGroup.Item value="a" disabled>Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>
    )

    const radios = getRadios()
    expect(radios.map((radio) => radio.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"])

    await userEvent.tab()
    expect(screen.getByRole("radio", { name: /beta/i })).toHaveFocus()
  })

  it("falls back to an enabled tab target when selected or highlighted values are invalid", async () => {
    render(
      <ToggleGroup label="Options" value="missing" highlighted="a">
        <ToggleGroup.Item value="a" disabled>Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>
    )

    const radios = getRadios()
    expect(radios.map((radio) => radio.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"])
    expect(screen.getByRole("radio", { name: /alpha/i })).not.toHaveAttribute("data-highlighted")

    await userEvent.tab()
    expect(screen.getByRole("radio", { name: /beta/i })).toHaveFocus()
  })

  it("keeps the tabbable item aligned with a valid controlled highlight", () => {
    renderGroup({ value: "a", highlighted: "b" })

    const alpha = screen.getByRole("radio", { name: /alpha/i })
    const beta = screen.getByRole("radio", { name: /beta/i })
    expect(alpha).toHaveAttribute("aria-checked", "true")
    expect(alpha).toHaveAttribute("tabindex", "-1")
    expect(beta).toHaveAttribute("tabindex", "0")
    expect(beta).toHaveAttribute("data-highlighted", "true")
  })

  it("does not focus or highlight disabled items with arrows or hover", async () => {
    render(
      <ToggleGroup label="Options" defaultValue="a">
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b" disabled>Beta</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>
    )

    const alpha = screen.getByRole("radio", { name: /alpha/i })
    const beta = screen.getByRole("radio", { name: /beta/i })
    alpha.focus()

    await userEvent.keyboard("{ArrowRight}")
    await userEvent.hover(beta)

    expect(screen.getByRole("radio", { name: /charlie/i })).toHaveFocus()
    expect(beta).not.toHaveAttribute("data-highlighted")
  })

  it("keeps keyboard highlight when a different enabled item is hovered", async () => {
    const onHighlightChange = vi.fn()
    renderGroup({ highlighted: "a", onHighlightChange })

    const alpha = screen.getByRole("radio", { name: /alpha/i })
    const beta = screen.getByRole("radio", { name: /beta/i })

    await userEvent.hover(beta)

    expect(onHighlightChange).not.toHaveBeenCalled()
    expect(alpha).toHaveAttribute("data-highlighted", "true")
    expect(beta).not.toHaveAttribute("data-highlighted")
  })

  it("moves focus with ArrowLeft", async () => {
    renderGroup({ defaultValue: "b" })
    const radios = getRadios()
    radios[1].focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(radios[0]).toHaveFocus()
  })

  it("wraps focus from last to first with ArrowRight", async () => {
    renderGroup({ defaultValue: "c" })
    const radios = getRadios()
    radios[2].focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(radios[0]).toHaveFocus()
  })

  it("selects focused item with Enter", async () => {
    const onChange = vi.fn()
    renderGroup({ defaultValue: "a", onChange })
    const radios = getRadios()
    radios[0].focus()
    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard("{Enter}")
    expect(onChange).toHaveBeenCalledWith("b")
  })

  it("uses vertical arrow keys when orientation is vertical", async () => {
    renderGroup({ orientation: "vertical", defaultValue: "a" })
    const radios = getRadios()
    radios[0].focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(radios[1]).toHaveFocus()
  })

  it("supports cross-axis arrow keys (ArrowUp/ArrowDown in horizontal)", async () => {
    renderGroup({ orientation: "horizontal", defaultValue: "a" })
    const radios = getRadios()
    radios[0].focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(radios[1]).toHaveFocus()
  })

  it("supports cross-axis arrow keys (ArrowLeft/ArrowRight in vertical)", async () => {
    renderGroup({ orientation: "vertical", defaultValue: "b" })
    const radios = getRadios()
    radios[1].focus()

    await userEvent.keyboard("{ArrowRight}")
    expect(radios[2]).toHaveFocus()

    await userEvent.keyboard("{ArrowLeft}")
    expect(radios[1]).toHaveFocus()
  })

  it("disabled items do not activate on Enter key", async () => {
    const onChange = vi.fn()
    render(
      <ToggleGroup label="Options" onChange={onChange}>
        <ToggleGroup.Item value="a" disabled>Alpha</ToggleGroup.Item>
      </ToggleGroup>
    )
    const alpha = screen.getByRole("radio", { name: /alpha/i })
    alpha.focus()
    await userEvent.keyboard("{Enter}")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("honors preventDefault in custom key handlers", async () => {
    const onChange = vi.fn()
    renderGroup({
      defaultValue: "a",
      onChange,
      onKeyDown: (event) => event.preventDefault(),
    })

    getRadios()[0].focus()
    await userEvent.keyboard("{ArrowRight}")

    expect(getRadios()[0]).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })
})
