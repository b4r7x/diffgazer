import { render, screen, waitFor } from "@testing-library/react"
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
        {multiple ? (
          <Select.Tags placeholder="Pick fruits" />
        ) : (
          <Select.Value placeholder="Pick a fruit" />
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
    const trigger = screen.getByRole("button")
    await userEvent.click(trigger)
    const appleOption = screen.getByRole("option", { name: /Apple/i })
    await userEvent.click(appleOption)
    expect(onChange).toHaveBeenCalledWith(["banana"])
  })

  it("stays open after selection in multiple mode", async () => {
    renderSelect({ multiple: true, defaultValue: [] })
    const trigger = screen.getByRole("button")
    await userEvent.click(trigger)
    await userEvent.click(screen.getByText("Apple"))
    expect(trigger).toHaveAttribute("aria-expanded", "true")
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

  it("does not highlight or select disabled options by click, arrows, typeahead, Enter, or Tab", async () => {
    const onChange = vi.fn()
    render(
      <Select variant="card" onChange={onChange} defaultOpen>
        <Select.Trigger>
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana" disabled>Banana</Select.Item>
          <Select.Item value="blueberry">Blueberry</Select.Item>
        </Select.Content>
      </Select>
    )

    const listbox = screen.getByRole("listbox")
    const disabledOption = screen.getByRole("option", { name: /banana/i })
    listbox.focus()

    await userEvent.click(disabledOption)
    expect(onChange).not.toHaveBeenCalled()

    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("blueberry"))

    await userEvent.keyboard("b")
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("blueberry"))

    await userEvent.keyboard("{Enter}")
    expect(onChange).toHaveBeenCalledWith("blueberry")

    onChange.mockClear()
    await userEvent.click(screen.getByRole("button"))
    listbox.focus()
    await userEvent.click(disabledOption)
    await userEvent.tab()
    expect(onChange).not.toHaveBeenCalled()
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

  it("renders combobox with proper ARIA attributes when search is present", async () => {
    renderSelect({ withSearch: true, defaultOpen: true })
    const searchInput = screen.getByRole("combobox")
    const listbox = screen.getByRole("listbox")
    expect(searchInput).toHaveAttribute("aria-expanded", "true")
    expect(searchInput).toHaveAttribute("aria-autocomplete", "list")
    expect(searchInput).toHaveAttribute("aria-controls")
    await waitFor(() => {
      expect(searchInput).toHaveAttribute("aria-activedescendant")
      expect(listbox).not.toHaveAttribute("aria-activedescendant")
    })
  })

  it("renders selected tags without nested controls in multiple mode", async () => {
    renderSelect({ multiple: true, defaultValue: ["apple", "banana"] })
    expect(screen.getByText("Apple")).toBeInTheDocument()
    expect(screen.getByText("Banana")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Remove/i })).not.toBeInTheDocument()
  })

  it("removes a selected tag by selecting its option again", async () => {
    const onChange = vi.fn()
    renderSelect({ multiple: true, defaultValue: ["apple", "banana"], onChange })
    await userEvent.click(screen.getByRole("button"))
    await userEvent.click(screen.getByRole("option", { name: /Apple/i }))
    expect(onChange).toHaveBeenCalledWith(["banana"])
  })

})

describe("Select form submission", () => {
  function renderFormSelect({
    name,
    defaultValue,
    multiple,
    defaultOpen,
    disabled,
    required,
    items = ["Apple", "Banana", "Cherry"],
  }: {
    name: string
    defaultValue?: string | string[]
    multiple?: boolean
    defaultOpen?: boolean
    disabled?: boolean
    required?: boolean
    items?: string[]
  }) {
    const props: any = { variant: "card", name, children: null }
    if (multiple) props.multiple = true
    if (defaultValue !== undefined) props.defaultValue = defaultValue
    if (defaultOpen !== undefined) props.defaultOpen = defaultOpen
    if (disabled) props.disabled = true
    if (required) props.required = true

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

  it("does not contribute FormData when disabled", () => {
    renderFormSelect({ name: "fruit", defaultValue: "banana", disabled: true })
    const form = screen.getByTestId("form") as HTMLFormElement
    expect(new FormData(form).has("fruit")).toBe(false)
  })

  it("does not contribute multiple FormData values when disabled", () => {
    renderFormSelect({ name: "fruits", defaultValue: ["apple", "cherry"], multiple: true, disabled: true })
    const form = screen.getByTestId("form") as HTMLFormElement
    expect(new FormData(form).has("fruits")).toBe(false)
  })

  it("uses native validity for required single and multiple selects", async () => {
    const { unmount } = renderFormSelect({ name: "fruit", required: true })
    const form = screen.getByTestId("form") as HTMLFormElement

    expect(form.checkValidity()).toBe(false)

    await userEvent.click(screen.getByRole("button"))
    await userEvent.click(screen.getByRole("option", { name: /banana/i }))
    expect(form.checkValidity()).toBe(true)

    unmount()
    render(
      <form data-testid="form">
        <Select variant="card" name="fruits" multiple required>
          <Select.Trigger>
            <Select.Tags placeholder="Pick" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      </form>
    )
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(false)
    await userEvent.click(screen.getByRole("button"))
    await userEvent.click(screen.getByRole("option", { name: /apple/i }))
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(true)
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
