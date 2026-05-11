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
    const onChange = vi.fn()
    render(
      <ToggleGroup label="Options" onChange={onChange}>
        <ToggleGroup.Item value="a"><span>Alpha</span></ToggleGroup.Item>
        <ToggleGroup.Item value="b"><span>Beta</span></ToggleGroup.Item>
      </ToggleGroup>,
    )

    await userEvent.click(screen.getByRole("radio", { name: /beta/i }))

    expect(onChange).toHaveBeenCalledWith("b")
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
    renderGroup({ defaultValue: "a", allowDeselect: true, onChange: onChange })
    await userEvent.click(screen.getByText("Alpha"))
    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "false")
  })

  it("moves focus without changing pressed state when allowDeselect is true", async () => {
    const onChange = vi.fn()
    renderGroup({ defaultValue: "a", allowDeselect: true, onChange })
    const alpha = screen.getByRole("button", { name: /alpha/i })
    const beta = screen.getByRole("button", { name: /beta/i })

    alpha.focus()
    await userEvent.keyboard("{ArrowRight}")

    expect(beta).toHaveFocus()
    expect(alpha).toHaveAttribute("aria-pressed", "true")
    expect(beta).toHaveAttribute("aria-pressed", "false")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("activates the focused item with Space and Enter when allowDeselect is true", async () => {
    const onChange = vi.fn()
    renderGroup({ defaultValue: "a", allowDeselect: true, onChange })
    const alpha = screen.getByRole("button", { name: /alpha/i })
    const beta = screen.getByRole("button", { name: /beta/i })

    alpha.focus()
    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard(" ")
    expect(onChange).toHaveBeenCalledWith("b")

    await userEvent.keyboard("{Enter}")
    expect(onChange).toHaveBeenCalledWith(null)
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
    renderGroup({ value: "a", onChange: onChange })
    await userEvent.click(screen.getByText("Beta"))
    expect(onChange).toHaveBeenCalledWith("b")
    expect(getRadios()[0]).toHaveAttribute("aria-checked", "true")
    expect(getRadios()[1]).toHaveAttribute("aria-checked", "false")
  })

  it("calls onChange as the preferred controlled callback", async () => {
    const onChange = vi.fn()
    renderGroup({ value: "a", onChange })
    await userEvent.click(screen.getByText("Beta"))
    expect(onChange).toHaveBeenCalledWith("b")
  })

  it("forwards item props and refs while honoring preventDefault", async () => {
    const ref = createRef<HTMLButtonElement>()
    const onChange = vi.fn()
    const onClick = vi.fn((event) => event.preventDefault())

    render(
      <ToggleGroup label="Options" onChange={onChange}>
        <ToggleGroup.Item ref={ref} value="a" onClick={onClick}>
          Alpha
        </ToggleGroup.Item>
      </ToggleGroup>,
    )

    const item = screen.getByRole("radio", { name: /alpha/i })
    expect(ref.current).toBe(item)
    await userEvent.click(item)
    expect(onClick).toHaveBeenCalledOnce()
    expect(onChange).not.toHaveBeenCalled()
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

  it("skips disabled items while wrapping across vertical and cross-axis arrows", async () => {
    const onChange = vi.fn()
    render(
      <ToggleGroup label="Options" orientation="vertical" defaultValue="a" onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b" disabled>Beta</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>
    )

    const alpha = screen.getByRole("radio", { name: /alpha/i })
    const beta = screen.getByRole("radio", { name: /beta/i })
    const charlie = screen.getByRole("radio", { name: /charlie/i })

    alpha.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(charlie).toHaveFocus()
    expect(onChange).toHaveBeenLastCalledWith("c")

    await userEvent.keyboard("{ArrowDown}")
    expect(alpha).toHaveFocus()
    expect(onChange).toHaveBeenLastCalledWith("a")

    await userEvent.keyboard("{ArrowUp}")
    expect(charlie).toHaveFocus()
    expect(onChange).toHaveBeenLastCalledWith("c")

    await userEvent.keyboard("{ArrowLeft}")
    expect(alpha).toHaveFocus()
    expect(onChange).toHaveBeenLastCalledWith("a")

    await userEvent.keyboard("{ArrowRight}")
    expect(charlie).toHaveFocus()
    expect(onChange).toHaveBeenLastCalledWith("c")
    expect(beta).not.toHaveFocus()
    expect(beta).toHaveAttribute("aria-checked", "false")
  })

  it("keeps nested toggle group keyboard navigation scoped to the owning group", async () => {
    const onOuterChange = vi.fn()
    const onInnerChange = vi.fn()
    render(
      <ToggleGroup label="Outer" onChange={onOuterChange}>
        <ToggleGroup.Item value="outer-a">Outer A</ToggleGroup.Item>
        <ToggleGroup label="Inner" onChange={onInnerChange}>
          <ToggleGroup.Item value="inner-a">Inner A</ToggleGroup.Item>
          <ToggleGroup.Item value="inner-b">Inner B</ToggleGroup.Item>
        </ToggleGroup>
        <ToggleGroup.Item value="outer-b">Outer B</ToggleGroup.Item>
      </ToggleGroup>,
    )

    const outerA = screen.getByRole("radio", { name: /outer a/i })
    const outerB = screen.getByRole("radio", { name: /outer b/i })
    const innerA = screen.getByRole("radio", { name: /inner a/i })
    const innerB = screen.getByRole("radio", { name: /inner b/i })

    outerA.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(outerB).toHaveFocus()
    expect(onOuterChange).toHaveBeenCalledWith("outer-b")
    expect(onInnerChange).not.toHaveBeenCalled()

    onOuterChange.mockClear()
    innerA.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(innerB).toHaveFocus()
    expect(onInnerChange).toHaveBeenCalledWith("inner-b")
    expect(onOuterChange).not.toHaveBeenCalled()
  })

  it("wraps button-mode focus and selects the focused item with Enter", async () => {
    const onChange = vi.fn()
    renderGroup({ allowDeselect: true, onChange })
    const alpha = screen.getByRole("button", { name: /alpha/i })
    const charlie = screen.getByRole("button", { name: /charlie/i })

    alpha.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(charlie).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()

    await userEvent.keyboard("{Enter}")
    expect(onChange).toHaveBeenCalledWith("c")
    expect(charlie).toHaveAttribute("aria-pressed", "true")
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
      onChange: onChange,
      onKeyDown: (event) => event.preventDefault(),
    })

    getRadios()[0].focus()
    await userEvent.keyboard("{ArrowRight}")

    expect(getRadios()[0]).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })
})
