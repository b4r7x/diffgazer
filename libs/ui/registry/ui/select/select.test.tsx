import { Fragment, createRef } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Select, type SelectProps } from "./index.js"

function getSelectTrigger() {
  const trigger = screen.getAllByRole("combobox").find((element) => element.tagName === "BUTTON")
  if (!trigger) throw new Error("Select trigger not found")
  return trigger
}

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
  variant = "card",
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
  variant?: "default" | "card"
} = {}) {
  const commonProps = {
    variant,
    children: null,
    ...(open !== undefined ? { open } : {}),
    ...(onOpenChange ? { onOpenChange } : {}),
    ...(defaultOpen !== undefined ? { defaultOpen } : {}),
    ...(disabled ? { disabled: true } : {}),
  }
  const props: SelectProps = multiple
    ? {
        ...commonProps,
        multiple: true,
        ...(Array.isArray(defaultValue) ? { defaultValue } : {}),
        ...(Array.isArray(value) ? { value } : {}),
        ...(onChange ? { onChange: onChange as (v: string[]) => void } : {}),
      }
    : {
        ...commonProps,
        multiple: false,
        ...(typeof defaultValue === "string" ? { defaultValue } : {}),
        ...(typeof value === "string" ? { value } : {}),
        ...(onChange ? { onChange: onChange as (v: string) => void } : {}),
      }

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
  it("supports direct namespaced parts with custom option UI inside Select.Item", async () => {
    const onChange = vi.fn()
    render(
      <Select variant="card" defaultOpen onChange={onChange}>
        <Select.Trigger>
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Search />
          <Select.Item value="banana" textValue="Banana">
            <span>Banana</span>
            <span aria-hidden="true">ripe</span>
          </Select.Item>
        </Select.Content>
      </Select>,
    )

    await userEvent.type(screen.getByRole("searchbox", { name: /search options/i }), "ban")
    await userEvent.click(screen.getByRole("option", { name: /banana/i }))

    expect(onChange).toHaveBeenCalledWith("banana")
  })

  it("toggles open/close on trigger click", async () => {
    renderSelect()
    const trigger = getSelectTrigger()
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).not.toHaveAttribute("aria-controls")
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger).toHaveAttribute("aria-controls", screen.getByRole("listbox").id)
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).not.toHaveAttribute("aria-controls")
  })

  it("selects a single value on click", async () => {
    const onChange = vi.fn()
    renderSelect({ onChange: onChange })
    await userEvent.click(getSelectTrigger())
    await userEvent.click(screen.getByText("Banana"))
    expect(onChange).toHaveBeenCalledWith("banana")
  })

  it("activates a default portalled option on mouse click before outside-click close", async () => {
    const onChange = vi.fn()
    renderSelect({ variant: "default", onChange: onChange })

    await userEvent.click(getSelectTrigger())
    await userEvent.click(screen.getByRole("option", { name: /banana/i }))

    expect(onChange).toHaveBeenCalledWith("banana")
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false")
  })

  it("calls onChange as the preferred single-value callback", async () => {
    const onChange = vi.fn()
    render(
      <Select variant="card" onChange={onChange}>
        <Select.Trigger>
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    )

    await userEvent.click(getSelectTrigger())
    await userEvent.click(screen.getByText("Banana"))
    expect(onChange).toHaveBeenCalledWith("banana")
  })

  it("selects multiple values on click", async () => {
    const onChange = vi.fn()
    renderSelect({ multiple: true, defaultValue: [], onChange: onChange })
    await userEvent.click(getSelectTrigger())
    await userEvent.click(screen.getByText("Apple"))
    expect(onChange).toHaveBeenCalledWith(["apple"])
    await userEvent.click(screen.getByText("Cherry"))
    expect(onChange).toHaveBeenCalledWith(["apple", "cherry"])
  })

  it("keeps a default portalled multi-select open while activating mouse options", async () => {
    const onChange = vi.fn()
    renderSelect({ variant: "default", multiple: true, defaultValue: [], onChange: onChange })

    await userEvent.click(getSelectTrigger())
    await userEvent.click(screen.getByRole("option", { name: /apple/i }))

    expect(onChange).toHaveBeenCalledWith(["apple"])
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true")
  })

  it("calls onChange as the preferred multiple-value callback", async () => {
    const onChange = vi.fn()
    render(
      <Select variant="card" multiple defaultValue={[]} onChange={onChange}>
        <Select.Trigger>
          <Select.Tags placeholder="Pick fruits" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
        </Select.Content>
      </Select>,
    )

    await userEvent.click(getSelectTrigger())
    await userEvent.click(screen.getByText("Apple"))
    expect(onChange).toHaveBeenCalledWith(["apple"])
  })

  it("deselects an already-selected value in multiple mode", async () => {
    const onChange = vi.fn()
    renderSelect({ multiple: true, defaultValue: ["apple", "banana"], onChange: onChange })
    const trigger = getSelectTrigger()
    await userEvent.click(trigger)
    const appleOption = screen.getByRole("option", { name: /Apple/i })
    await userEvent.click(appleOption)
    expect(onChange).toHaveBeenCalledWith(["banana"])
  })

  it("stays open after selection in multiple mode", async () => {
    renderSelect({ multiple: true, defaultValue: [] })
    const trigger = getSelectTrigger()
    await userEvent.click(trigger)
    await userEvent.click(screen.getByText("Apple"))
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("filters items based on search query", async () => {
    renderSelect({ withSearch: true })
    await userEvent.click(getSelectTrigger())
    const searchInput = screen.getByRole("searchbox", { name: /search options/i })
    await userEvent.type(searchInput, "ban")
    expect(screen.getByText("Banana")).toBeInTheDocument()
    expect(screen.queryByText("Apple")).not.toBeInTheDocument()
    expect(screen.queryByText("Cherry")).not.toBeInTheDocument()
  })

  it("activates searchable default portalled options on mouse click", async () => {
    const onChange = vi.fn()
    renderSelect({ variant: "default", withSearch: true, onChange: onChange })

    await userEvent.click(getSelectTrigger())
    await userEvent.type(screen.getByRole("searchbox", { name: /search options/i }), "ban")
    await userEvent.click(screen.getByRole("option", { name: /banana/i }))

    expect(onChange).toHaveBeenCalledWith("banana")
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false")
  })

  it("shows empty state when search has no matches", async () => {
    renderSelect({ withSearch: true })
    await userEvent.click(getSelectTrigger())
    await userEvent.type(screen.getByRole("searchbox", { name: /search options/i }), "zzz")
    expect(screen.getByText("> no results.")).toBeInTheDocument()
  })

  it("does not open when disabled", async () => {
    renderSelect({ disabled: true })
    await userEvent.click(getSelectTrigger())
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false")
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
    const blueberryOption = screen.getByRole("option", { name: /blueberry/i })
    listbox.focus()

    await userEvent.click(disabledOption)
    expect(onChange).not.toHaveBeenCalled()

    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute("aria-activedescendant", blueberryOption.id)

    await userEvent.keyboard("b")
    expect(listbox).toHaveAttribute("aria-activedescendant", blueberryOption.id)

    await userEvent.keyboard("{Enter}")
    expect(onChange).toHaveBeenCalledWith("blueberry")

    onChange.mockClear()
    await userEvent.click(getSelectTrigger())
    listbox.focus()
    await userEvent.click(disabledOption)
    await userEvent.tab()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("works in uncontrolled mode with defaultValue", async () => {
    renderSelect({ defaultValue: "banana" })
    expect(screen.getByText("Banana")).toBeInTheDocument()
    await userEvent.click(getSelectTrigger())
    const bananaOption = screen.getByRole("option", { name: /banana/i })
    expect(bananaOption).toHaveAttribute("aria-selected", "true")
  })

  it("respects controlled open prop", async () => {
    const onOpenChange = vi.fn()
    renderSelect({ open: false, onOpenChange })
    await userEvent.click(getSelectTrigger())
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false")
  })

  it("keeps keyboard highlight when a different option is hovered", async () => {
    const onHighlightChange = vi.fn()
    render(
      <Select variant="card" defaultOpen onHighlightChange={onHighlightChange}>
        <Select.Trigger>
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    )

    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith("apple"))
    onHighlightChange.mockClear()

    const listbox = screen.getByRole("listbox")
    const appleOption = screen.getByRole("option", { name: /apple/i })
    await userEvent.hover(screen.getByRole("option", { name: /banana/i }))

    expect(onHighlightChange).not.toHaveBeenCalled()
    expect(listbox).toHaveAttribute("aria-activedescendant", appleOption.id)
  })

  it("respects controlled value prop", async () => {
    const onChange = vi.fn()
    renderSelect({ value: "apple", onChange: onChange })
    await userEvent.click(getSelectTrigger())
    await userEvent.click(screen.getByText("Banana"))
    expect(onChange).toHaveBeenCalledWith("banana")
    await userEvent.click(getSelectTrigger())
    const appleOption = screen.getByRole("option", { name: /apple/i })
    expect(appleOption).toHaveAttribute("aria-selected", "true")
  })

  it("treats explicit undefined value as a controlled empty value", async () => {
    const onChange = vi.fn()
    render(
      <Select variant="card" value={undefined} onChange={onChange}>
        <Select.Trigger>
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    )

    expect(screen.getByText("Pick a fruit")).toBeInTheDocument()
    await userEvent.click(getSelectTrigger())
    await userEvent.click(screen.getByRole("option", { name: /banana/i }))
    expect(onChange).toHaveBeenCalledWith("banana")
    expect(screen.getByText("Pick a fruit")).toBeInTheDocument()
  })

  it("supports an empty string single-select option value", async () => {
    const onChange = vi.fn()
    render(
      <Select variant="card" onChange={onChange}>
        <Select.Trigger>
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="">None</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    )

    expect(screen.getByText("Pick a fruit")).toBeInTheDocument()

    await userEvent.click(getSelectTrigger())
    await userEvent.click(screen.getByRole("option", { name: "None" }))

    expect(onChange).toHaveBeenCalledWith("")
    expect(screen.getByText("None")).toBeInTheDocument()
  })

  it("supports empty string values in multiple-select state", async () => {
    const onChange = vi.fn()
    render(
      <Select variant="card" multiple defaultValue={[""]} onChange={onChange}>
        <Select.Trigger>
          <Select.Tags placeholder="Pick fruits" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="">None</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    )

    expect(screen.getByText("None")).toBeInTheDocument()

    await userEvent.click(getSelectTrigger())
    await userEvent.click(screen.getByRole("option", { name: /banana/i }))

    expect(onChange).toHaveBeenCalledWith(["", "banana"])
  })

  it("selects an empty string option from keyboard navigation", async () => {
    const onChange = vi.fn()
    render(
      <Select variant="card" defaultOpen highlighted="" onChange={onChange}>
        <Select.Trigger>
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="">None</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    )

    screen.getByRole("listbox").focus()
    await userEvent.keyboard("{Enter}")

    expect(onChange).toHaveBeenCalledWith("")
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
    getSelectTrigger().focus()
    await userEvent.keyboard(key === " " ? " " : `{${key}}`)
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true")
  })

  it("closes with Escape key", async () => {
    renderSelect({ defaultOpen: true })
    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await userEvent.keyboard("{Escape}")
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false")
  })

  it("selects highlighted item with Enter key", async () => {
    const onChange = vi.fn()
    renderSelect({ onChange: onChange, defaultOpen: true })
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

  it("generates unique option ids for values that differ by whitespace and punctuation", async () => {
    render(
      <Select variant="card" defaultOpen>
        <Select.Trigger>
          <Select.Value placeholder="Pick a value" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="a b">Spaced</Select.Item>
          <Select.Item value="a_b">Underscore</Select.Item>
        </Select.Content>
      </Select>,
    )

    const spaced = screen.getByRole("option", { name: "Spaced" })
    const underscore = screen.getByRole("option", { name: "Underscore" })
    expect(spaced.id).toBeTruthy()
    expect(underscore.id).toBeTruthy()
    expect(spaced.id).not.toBe(underscore.id)
  })

  it("omits stale controlled active descendants for disabled, filtered, and missing options", async () => {
    const { rerender } = render(
      <Select variant="card" defaultOpen highlighted="banana">
        <Select.Trigger>
          <Select.Value placeholder="Pick a value" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana" disabled>Banana</Select.Item>
        </Select.Content>
      </Select>,
    )

    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant")

    rerender(
      <Select variant="card" defaultOpen highlighted="banana">
        <Select.Trigger>
          <Select.Value placeholder="Pick a value" />
        </Select.Trigger>
        <Select.Content>
          <Select.Search />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>,
    )

    await userEvent.type(screen.getByRole("searchbox", { name: /search options/i }), "apple")
    expect(getSelectTrigger()).not.toHaveAttribute("aria-activedescendant")
    expect(screen.getByRole("searchbox", { name: /search options/i })).not.toHaveAttribute("aria-activedescendant")
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant")

    rerender(
      <Select variant="card" defaultOpen highlighted="missing">
        <Select.Trigger>
          <Select.Value placeholder="Pick a value" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
        </Select.Content>
      </Select>,
    )
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant")
    expect(getSelectTrigger()).not.toHaveAttribute("aria-activedescendant")
  })

  it("closes on outside click", async () => {
    renderSelect({ defaultOpen: true })
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "true")
    await userEvent.click(document.body)
    expect(getSelectTrigger()).toHaveAttribute("aria-expanded", "false")
  })

  it("keeps the trigger as the only combobox when search is present", async () => {
    renderSelect({ withSearch: true, defaultOpen: true })
    const trigger = getSelectTrigger()
    const searchInput = screen.getByRole("searchbox", { name: /search options/i })
    const listbox = screen.getByRole("listbox")
    const appleOption = screen.getByRole("option", { name: /apple/i })
    expect(screen.getAllByRole("combobox")).toEqual([trigger])
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger).toHaveAttribute("aria-controls", listbox.id)
    await waitFor(() => {
      expect(searchInput).toHaveAttribute("aria-activedescendant", appleOption.id)
      expect(listbox).not.toHaveAttribute("aria-activedescendant")
    })
    expect(trigger).not.toHaveAttribute("aria-activedescendant")
    expect(searchInput).toHaveAttribute("aria-controls", listbox.id)
  })

  it("announces the first matching searchable option as the active descendant", async () => {
    renderSelect({ withSearch: true, defaultOpen: true })
    const searchInput = screen.getByRole("searchbox", { name: /search options/i })

    await userEvent.type(searchInput, "ban")

    const bananaOption = screen.getByRole("option", { name: /banana/i })
    expect(searchInput).toHaveAttribute("aria-activedescendant", bananaOption.id)
    expect(getSelectTrigger()).not.toHaveAttribute("aria-activedescendant")
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-activedescendant")
  })

  it("keeps Home and End available for text editing in searchable input", async () => {
    const onHighlightChange = vi.fn()
    render(
      <Select variant="card" defaultOpen highlighted="banana" onHighlightChange={onHighlightChange}>
        <Select.Trigger>
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Search />
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
          <Select.Item value="cherry">Cherry</Select.Item>
        </Select.Content>
      </Select>,
    )
    const searchInput = screen.getByRole("searchbox", { name: /search options/i })

    onHighlightChange.mockClear()
    await userEvent.type(searchInput, "{Home}{End}")

    expect(onHighlightChange).not.toHaveBeenCalled()
  })

  it("keeps searchable input outside listbox ownership", () => {
    renderSelect({ withSearch: true, defaultOpen: true })
    const searchInput = screen.getByRole("searchbox", { name: /search options/i })
    const listbox = screen.getByRole("listbox")

    expect(listbox).not.toContainElement(searchInput)
  })

  it("keeps wrapped searchable input outside listbox ownership", () => {
    render(
      <Select variant="card" defaultOpen>
        <Select.Trigger>
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Fragment>
            <Select.Search />
          </Fragment>
          <div>
            <Select.Search aria-label="Filter options" />
          </div>
          <Select.Item value="apple">Apple</Select.Item>
        </Select.Content>
      </Select>,
    )
    const searchInput = screen.getByRole("searchbox", { name: /search options/i })
    const wrappedSearchInput = screen.getByRole("searchbox", { name: /filter options/i })
    const listbox = screen.getByRole("listbox")

    expect(listbox).not.toContainElement(searchInput)
    expect(listbox).not.toContainElement(wrappedSearchInput)
  })

  it("excludes decorative indicators from option names", () => {
    renderSelect({ defaultOpen: true, defaultValue: "banana" })

    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: /✓/ })).not.toBeInTheDocument()
  })

  it("does not activate a filtered-out highlighted option", async () => {
    const onChange = vi.fn()
    renderSelect({ withSearch: true, defaultOpen: true, highlighted: "banana", onChange: onChange })

    await userEvent.type(screen.getByRole("searchbox", { name: /search options/i }), "zzz")
    await userEvent.keyboard("{Enter}")

    expect(onChange).not.toHaveBeenCalled()
  })

  it("honors preventDefault in content key handlers", async () => {
    const onChange = vi.fn()
    render(
      <Select variant="card" defaultOpen highlighted="banana" onChange={onChange}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content onKeyDown={(event) => event.preventDefault()}>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>
    )

    screen.getByRole("listbox").focus()
    await userEvent.keyboard("{Enter}")

    expect(onChange).not.toHaveBeenCalled()
  })

  it("forwards root props and refs", () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Select ref={ref} data-testid="select-root" variant="card">
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Content>
      </Select>
    )

    expect(screen.getByTestId("select-root")).toBe(ref.current)
  })

  it("renders selected tags without nested controls in multiple mode", async () => {
    renderSelect({ multiple: true, defaultValue: ["apple", "banana"] })
    expect(screen.getByText("Apple")).toBeInTheDocument()
    expect(screen.getByText("Banana")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Remove/i })).not.toBeInTheDocument()
  })

  it("removes a selected tag by selecting its option again", async () => {
    const onChange = vi.fn()
    renderSelect({ multiple: true, defaultValue: ["apple", "banana"], onChange: onChange })
    await userEvent.click(getSelectTrigger())
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
    name?: string
    defaultValue?: string | string[]
    multiple?: boolean
    defaultOpen?: boolean
    disabled?: boolean
    required?: boolean
    items?: string[]
  }) {
    const commonProps = {
      variant: "card" as const,
      name,
      children: null,
      ...(defaultOpen !== undefined ? { defaultOpen } : {}),
      ...(disabled ? { disabled: true } : {}),
      ...(required ? { required: true } : {}),
    }
    const props: SelectProps = multiple
      ? {
          ...commonProps,
          multiple: true,
          ...(Array.isArray(defaultValue) ? { defaultValue } : {}),
        }
      : {
          ...commonProps,
          multiple: false,
          ...(typeof defaultValue === "string" ? { defaultValue } : {}),
        }

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
    expect(form.reportValidity()).toBe(false)
    expect(getSelectTrigger()).toHaveFocus()
    expect(getSelectTrigger()).toHaveAttribute("aria-required", "true")
    expect(screen.getAllByRole("combobox")).toHaveLength(1)
    expect(form.querySelector("select[required]")).toHaveAttribute("aria-hidden", "true")

    await userEvent.click(getSelectTrigger())
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
    const multiSelect = screen.getByTestId("form").querySelector("select[multiple][required]")
    expect(multiSelect).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByTestId("form").querySelector("input[type='checkbox'][required]")).toHaveAttribute("aria-hidden", "true")
    await userEvent.click(getSelectTrigger())
    await userEvent.click(screen.getByRole("option", { name: /apple/i }))
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(true)
  })

  it("validates required unnamed selects without contributing FormData", async () => {
    renderFormSelect({ required: true })
    const form = screen.getByTestId("form") as HTMLFormElement

    expect(form.reportValidity()).toBe(false)
    expect(getSelectTrigger()).toHaveFocus()
    await waitFor(() => expect(getSelectTrigger()).toHaveAttribute("aria-invalid", "true"))
    expect(new FormData(form).entries().next().done).toBe(true)

    await userEvent.click(getSelectTrigger())
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-required", "true")
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-invalid", "true")
    await userEvent.click(screen.getByRole("option", { name: /banana/i }))
    expect(form.checkValidity()).toBe(true)
    expect(new FormData(form).entries().next().done).toBe(true)
  })

  it("propagates required and invalid semantics to searchable visible controls", () => {
    render(
      <form data-testid="form">
        <Select variant="card" name="fruit" required aria-invalid defaultOpen>
          <Select.Trigger>
            <Select.Value placeholder="Pick" />
          </Select.Trigger>
          <Select.Content>
            <Select.Search />
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select>
      </form>
    )

    expect(getSelectTrigger()).toHaveAttribute("aria-required", "true")
    expect(getSelectTrigger()).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("searchbox", { name: /search options/i })).toHaveAttribute("aria-required", "true")
    expect(screen.getByRole("searchbox", { name: /search options/i })).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByTestId("form").querySelector("select[required]")).toHaveAttribute("aria-hidden", "true")
  })

  it("updates hidden input when selection changes", async () => {
    renderFormSelect({ name: "fruit", defaultOpen: true })
    await userEvent.click(screen.getByText("Banana"))

    const form = screen.getByTestId("form") as HTMLFormElement
    const formData = new FormData(form)
    expect(formData.get("fruit")).toBe("banana")
  })

  it("resets uncontrolled single and multiple selects with native form reset", async () => {
    renderFormSelect({ name: "fruit", defaultValue: "banana", defaultOpen: true })
    await userEvent.click(screen.getByRole("option", { name: /cherry/i }))

    let form = screen.getByTestId("form") as HTMLFormElement
    expect(new FormData(form).get("fruit")).toBe("cherry")

    form.reset()
    await waitFor(() => expect(new FormData(form).get("fruit")).toBe("banana"))

    render(
      <form data-testid="multi-form">
        <Select variant="card" name="fruits" multiple defaultValue={["apple"]} defaultOpen>
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

    await userEvent.click(screen.getByRole("option", { name: /banana/i }))
    form = screen.getByTestId("multi-form") as HTMLFormElement
    expect(new FormData(form).getAll("fruits")).toEqual(["apple", "banana"])

    form.reset()
    await waitFor(() => expect(new FormData(form).getAll("fruits")).toEqual(["apple"]))
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
