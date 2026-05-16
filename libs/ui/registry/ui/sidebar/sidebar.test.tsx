import type { Ref } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Sidebar } from "./index.js"

function renderSidebar(props: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
} = {}) {
  return render(
    <Sidebar.Provider {...props}>
      <Sidebar>
        <Sidebar.Header>Header</Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Section>
            <Sidebar.SectionTitle>Section</Sidebar.SectionTitle>
            <Sidebar.Item>Item 1</Sidebar.Item>
          </Sidebar.Section>
        </Sidebar.Content>
        <Sidebar.Footer>Footer</Sidebar.Footer>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar>
    </Sidebar.Provider>,
  )
}

describe("Sidebar", () => {
  it("toggles open state via SidebarTrigger", async () => {
    renderSidebar()
    const trigger = screen.getByRole("button", { name: "Collapse sidebar" })
    const content = screen.getByText("Item 1").closest("[id]") as HTMLElement
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger).toHaveAttribute("aria-controls", content.id)
    expect(content).not.toHaveAttribute("aria-hidden")

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveAttribute("aria-label", "Expand sidebar")
    expect(content).toHaveAttribute("aria-hidden", "true")
    expect(content).toHaveAttribute("inert")
  })

  it("skips closed sidebar content in tab order", async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Before</button>
        <Sidebar.Provider defaultOpen={false}>
          <Sidebar>
            <Sidebar.Content>
              <Sidebar.Item>Hidden item</Sidebar.Item>
            </Sidebar.Content>
            <Sidebar.Trigger>Toggle</Sidebar.Trigger>
          </Sidebar>
        </Sidebar.Provider>
        <button type="button">After</button>
      </>,
    )

    await user.tab()
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveFocus()
    expect(screen.getByRole("button", { name: "Hidden item", hidden: true })).not.toHaveFocus()
  })

  it("calls custom onClick on trigger alongside toggle", async () => {
    const onClick = vi.fn()
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Trigger onClick={onClick}>Toggle</Sidebar.Trigger>
        </Sidebar>
      </Sidebar.Provider>,
    )
    await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(onClick).toHaveBeenCalled()
  })

  it("does not toggle when trigger click is prevented", async () => {
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Trigger onClick={(event) => event.preventDefault()}>Toggle</Sidebar.Trigger>
        </Sidebar>
      </Sidebar.Provider>,
    )
    const trigger = screen.getByRole("button", { name: "Collapse sidebar" })

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("respects controlled open prop", async () => {
    const onOpenChange = vi.fn()
    renderSidebar({ open: true, onOpenChange })
    const trigger = screen.getByRole("button", { name: "Collapse sidebar" })

    await userEvent.click(trigger)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("has no a11y violations", async () => {
    const { container } = renderSidebar()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("toggles open state when used without explicit SidebarProvider", async () => {
    render(
      <Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar>,
    )
    const trigger = screen.getByRole("button", { name: "Collapse sidebar" })
    expect(trigger).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("honors prevented content keydown before moving focus", async () => {
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content onKeyDown={(event) => event.preventDefault()}>
            <Sidebar.Item value="one">One</Sidebar.Item>
            <Sidebar.Item value="two">Two</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    )
    const first = screen.getByRole("button", { name: "One" })
    first.focus()

    await userEvent.keyboard("{ArrowDown}")
    expect(first).toHaveFocus()
  })

  it("navigates between sidebar items that omit an explicit value via derived value", async () => {
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item>One</Sidebar.Item>
            <Sidebar.Item>Two</Sidebar.Item>
            <Sidebar.Item>Three</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    )
    const first = screen.getByRole("button", { name: "One" })
    const second = screen.getByRole("button", { name: "Two" })

    expect(first).toHaveAttribute("data-value")
    expect(first.getAttribute("data-value")).not.toBe("")

    first.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(second).toHaveFocus()
  })

  it("navigates sidebar items without selecting nested data-value descendants", async () => {
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item value="one">
              One <span data-value="nested">nested</span>
            </Sidebar.Item>
            <Sidebar.Item value="two">Two</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    )
    const first = screen.getByRole("button", { name: "One nested" })
    const second = screen.getByRole("button", { name: "Two" })
    first.focus()

    await userEvent.keyboard("{ArrowDown}")
    expect(second).toHaveFocus()
  })

  it("keeps disabled render-prop items inert and out of tab order", async () => {
    const onClick = vi.fn()
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item disabled onClick={onClick}>
              {({ ref, ...itemProps }) => (
                <a
                  href="/settings"
                  ref={ref as Ref<HTMLAnchorElement> | undefined}
                  {...itemProps}
                >
                  Settings
                </a>
              )}
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    )
    const item = screen.getByRole("link", { name: "Settings" })

    await userEvent.click(item)

    expect(onClick).not.toHaveBeenCalled()
    expect(item).toHaveAttribute("aria-disabled", "true")
    expect(item).toHaveAttribute("tabindex", "-1")
  })

  it("keeps disabled anchor items inert and out of tab order", async () => {
    const onClick = vi.fn()
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="a" href="/settings" disabled onClick={onClick}>
              Settings
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    )
    const item = screen.getByRole("link", { name: "Settings" })

    await userEvent.click(item)
    expect(onClick).not.toHaveBeenCalled()
    expect(item).toHaveAttribute("aria-disabled", "true")
    expect(item).toHaveAttribute("tabindex", "-1")
  })

  it("skips disabled items in keyboard tab order", async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Before</button>
        <Sidebar.Provider>
          <Sidebar>
            <Sidebar.Content>
              <Sidebar.Item as="a" href="/one">One</Sidebar.Item>
              <Sidebar.Item as="a" href="/two" disabled>Two</Sidebar.Item>
              <Sidebar.Item as="a" href="/three">Three</Sidebar.Item>
            </Sidebar.Content>
          </Sidebar>
        </Sidebar.Provider>
        <button type="button">After</button>
      </>,
    )

    await user.tab()
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("link", { name: "One" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("link", { name: "Three" })).toHaveFocus()
    expect(screen.getByRole("link", { name: "Two" })).not.toHaveFocus()
  })
})

describe("SidebarSection collapsible", () => {
  it("does not reference a missing section title", () => {
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Section>
              <Sidebar.Item>Item</Sidebar.Item>
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    )

    expect(screen.getByRole("group")).not.toHaveAttribute("aria-labelledby")
  })

  it("toggles section open/closed with aria-expanded", async () => {
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Section collapsible>
              <Sidebar.SectionTitle>Files</Sidebar.SectionTitle>
              <Sidebar.Item>file.txt</Sidebar.Item>
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    )
    const title = screen.getByRole("button", { name: "Files" })
    expect(title).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(title)
    expect(title).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("file.txt")).not.toBeInTheDocument()
  })

  it("keeps a collapsible section open when title click is prevented", async () => {
    const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Section collapsible>
              <Sidebar.SectionTitle onClick={onClick}>Files</Sidebar.SectionTitle>
              <Sidebar.Item>file.txt</Sidebar.Item>
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    )
    const title = screen.getByRole("button", { name: "Files" })

    await userEvent.click(title)

    expect(onClick).toHaveBeenCalled()
    expect(title).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("file.txt")).toBeInTheDocument()
  })

  it("uses a single navigation landmark by default", async () => {
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item>Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    )
    const navs = screen.getAllByRole("navigation")
    expect(navs).toHaveLength(1)
    expect(navs[0]).toHaveAccessibleName("Sidebar")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

})
