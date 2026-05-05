import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Select } from "./index.js"

function renderSelect({
  multiple,
  defaultValue,
  value,
  onChange,
  open,
  onOpenChange,
  defaultOpen,
  disabled,
  items = ["Apple", "Banana", "Cherry"],
  withSearch = false,
}: {
  multiple?: boolean
  defaultValue?: string | string[]
  value?: string | string[]
  onChange?: (v: string | string[]) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  disabled?: boolean
  items?: string[]
  withSearch?: boolean
} = {}) {
  const props: any = { variant: "card", children: null }
  if (multiple) props.multiple = true
  if (defaultValue !== undefined) props.defaultValue = defaultValue
  if (value !== undefined) props.value = value
  if (onChange) props.onChange = onChange
  if (open !== undefined) props.open = open
  if (onOpenChange) props.onOpenChange = onOpenChange
  if (defaultOpen !== undefined) props.defaultOpen = defaultOpen
  if (disabled) props.disabled = true

  return render(
    <Select {...props}>
      <Select.Trigger>
        <Select.Value placeholder="Pick a fruit" />
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
    </Select>
  )
}

describe("Select", () => {
  it("toggles open/close on trigger click", async () => {
    renderSelect()
    const trigger = screen.getByRole("button")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("selects a single value on click", async () => {
    const onChange = vi.fn()
    renderSelect({ onChange })
    await userEvent.click(screen.getByRole("button"))
    await userEvent.click(screen.getByText("Banana"))
    expect(onChange).toHaveBeenCalledWith("banana")
  })

  it("selects multiple values on click", async () => {
    const onChange = vi.fn()
    renderSelect({ multiple: true, defaultValue: [], onChange })
    await userEvent.click(screen.getByRole("button"))
    await userEvent.click(screen.getByText("Apple"))
    expect(onChange).toHaveBeenCalledWith(["apple"])
    await userEvent.click(screen.getByText("Cherry"))
    expect(onChange).toHaveBeenCalledWith(["apple", "cherry"])
  })

  it("deselects an already-selected value in multiple mode", async () => {
    const onChange = vi.fn()
    renderSelect({ multiple: true, defaultValue: ["apple", "banana"], onChange })
    await userEvent.click(screen.getByRole("button"))
    await userEvent.click(screen.getByText("Apple"))
    expect(onChange).toHaveBeenCalledWith(["banana"])
  })

  it("stays open after selection in multiple mode", async () => {
    renderSelect({ multiple: true, defaultValue: [] })
    await userEvent.click(screen.getByRole("button"))
    await userEvent.click(screen.getByText("Apple"))
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true")
  })

  it("filters items based on search query", async () => {
    renderSelect({ withSearch: true })
    await userEvent.click(screen.getByRole("button"))
    const searchInput = screen.getByRole("combobox")
    await userEvent.type(searchInput, "ban")
    expect(screen.getByText("Banana")).toBeInTheDocument()
    expect(screen.queryByText("Apple")).not.toBeInTheDocument()
    expect(screen.queryByText("Cherry")).not.toBeInTheDocument()
  })

  it("shows empty state when search has no matches", async () => {
    renderSelect({ withSearch: true })
    await userEvent.click(screen.getByRole("button"))
    await userEvent.type(screen.getByRole("combobox"), "zzz")
    expect(screen.getByText("> no results.")).toBeInTheDocument()
  })

  it("does not open when disabled", async () => {
    renderSelect({ disabled: true })
    await userEvent.click(screen.getByRole("button"))
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false")
  })

  it("works in uncontrolled mode with defaultValue", async () => {
    renderSelect({ defaultValue: "banana" })
    expect(screen.getByText("Banana")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button"))
    const bananaOption = screen.getByRole("option", { name: /banana/i })
    expect(bananaOption).toHaveAttribute("aria-selected", "true")
  })

  it("respects controlled open prop", async () => {
    const onOpenChange = vi.fn()
    renderSelect({ open: false, onOpenChange })
    await userEvent.click(screen.getByRole("button"))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false")
  })

  it("respects controlled value prop", async () => {
    const onChange = vi.fn()
    renderSelect({ value: "apple", onChange })
    await userEvent.click(screen.getByRole("button"))
    await userEvent.click(screen.getByText("Banana"))
    expect(onChange).toHaveBeenCalledWith("banana")
    await userEvent.click(screen.getByRole("button"))
    const appleOption = screen.getByRole("option", { name: /apple/i })
    expect(appleOption).toHaveAttribute("aria-selected", "true")
  })

  it("has no a11y violations", async () => {
    const { container } = renderSelect({ defaultOpen: true })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations in multiple mode", async () => {
    const { container } = renderSelect({ multiple: true, defaultOpen: true, defaultValue: ["apple"] })
    expect(await axe(container)).toHaveNoViolations()
  })

  it.each(["Enter", " ", "ArrowDown"])("opens with %s key on trigger", async (key) => {
    renderSelect()
    screen.getByRole("button").focus()
    await userEvent.keyboard(key === " " ? " " : `{${key}}`)
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true")
  })

  it("closes with Escape key", async () => {
    renderSelect({ defaultOpen: true })
    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await userEvent.keyboard("{Escape}")
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false")
  })

  it("selects highlighted item with Enter key", async () => {
    const onChange = vi.fn()
    renderSelect({ onChange, defaultOpen: true })
    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard("{Enter}")
    expect(onChange).toHaveBeenCalled()
  })

  it("navigates options with ArrowDown and ArrowUp", async () => {
    renderSelect({ defaultOpen: true })
    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await userEvent.keyboard("{ArrowDown}")
    const first = listbox.getAttribute("aria-activedescendant")
    await userEvent.keyboard("{ArrowDown}")
    const second = listbox.getAttribute("aria-activedescendant")
    expect(first).toBeTruthy()
    expect(second).toBeTruthy()
    expect(first).not.toBe(second)
  })

  it("closes on outside click", async () => {
    renderSelect({ defaultOpen: true })
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true")
    await userEvent.click(document.body)
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false")
  })

})

describe("Select form submission", () => {
  function renderFormSelect({
    name,
    defaultValue,
    multiple,
    defaultOpen,
    items = ["Apple", "Banana", "Cherry"],
  }: {
    name: string
    defaultValue?: string | string[]
    multiple?: boolean
    defaultOpen?: boolean
    items?: string[]
  }) {
    const props: any = { variant: "card", name, children: null }
    if (multiple) props.multiple = true
    if (defaultValue !== undefined) props.defaultValue = defaultValue
    if (defaultOpen !== undefined) props.defaultOpen = defaultOpen

    return render(
      <form data-testid="form">
        <Select {...props}>
          <Select.Trigger>
            <Select.Value placeholder="Pick" />
          </Select.Trigger>
          <Select.Content>
            {items.map((item) => (
              <Select.Item key={item} value={item.toLowerCase()}>
                {item}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </form>
    )
  }

  it("includes hidden input value in FormData for single select", () => {
    renderFormSelect({ name: "fruit", defaultValue: "banana" })
    const form = screen.getByTestId("form") as HTMLFormElement
    const formData = new FormData(form)
    expect(formData.get("fruit")).toBe("banana")
  })

  it("includes multiple hidden input values in FormData for multi select", () => {
    renderFormSelect({ name: "fruits", defaultValue: ["apple", "cherry"], multiple: true })
    const form = screen.getByTestId("form") as HTMLFormElement
    const formData = new FormData(form)
    expect(formData.getAll("fruits")).toEqual(["apple", "cherry"])
  })

  it("updates hidden input when selection changes", async () => {
    renderFormSelect({ name: "fruit", defaultOpen: true })
    await userEvent.click(screen.getByText("Banana"))

    const form = screen.getByTestId("form") as HTMLFormElement
    const formData = new FormData(form)
    expect(formData.get("fruit")).toBe("banana")
  })

  it("does not render hidden input when name prop is omitted", () => {
    render(
      <form data-testid="form">
        <Select variant="card" defaultValue="apple">
          <Select.Trigger>
            <Select.Value placeholder="Pick" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select>
      </form>
    )
    const form = screen.getByTestId("form") as HTMLFormElement
    const formData = new FormData(form)
    expect(formData.has("fruit")).toBe(false)
  })
})
