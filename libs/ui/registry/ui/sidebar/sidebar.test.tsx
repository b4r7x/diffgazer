import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Sidebar } from "./index.js"

function renderSidebar(props: {
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
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
  it("toggles collapsed state via SidebarTrigger", async () => {
    renderSidebar()
    const trigger = screen.getByRole("button", { name: "Collapse sidebar" })
    expect(trigger).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveAttribute("aria-label", "Expand sidebar")
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

  it("respects controlled collapsed prop", async () => {
    const onCollapsedChange = vi.fn()
    renderSidebar({ collapsed: false, onCollapsedChange })
    const trigger = screen.getByRole("button", { name: "Collapse sidebar" })

    await userEvent.click(trigger)
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("has no a11y violations", async () => {
    const { container } = renderSidebar()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("toggles collapsed state when used without explicit SidebarProvider", async () => {
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

})

describe("SidebarSection collapsible", () => {
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
