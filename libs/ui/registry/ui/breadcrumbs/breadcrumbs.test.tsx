import { render, screen } from "@testing-library/react"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect } from "vitest"
import { Breadcrumbs } from "./index.js"

describe("Breadcrumbs", () => {
  it("renders as navigation with correct aria-label", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/about">About</Breadcrumbs.Link>
        </Breadcrumbs.Item>
      </Breadcrumbs>
    )
    const nav = screen.getByRole("navigation")
    expect(nav).toHaveAttribute("aria-label", "Breadcrumb")
  })

  it("renders items in a list", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/about">About</Breadcrumbs.Link>
        </Breadcrumbs.Item>
      </Breadcrumbs>
    )
    const list = screen.getByRole("list")
    const items = screen.getAllByRole("listitem")

    expect(list.tagName).toBe("OL")
    expect(items).toHaveLength(2)
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about")
  })

  it("marks the final item as the current page by default", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          About
        </Breadcrumbs.Item>
      </Breadcrumbs>
    )
    const items = screen.getAllByRole("listitem")
    expect(items[1]).not.toHaveAttribute("aria-current")
    expect(screen.getByText("About")).toHaveAttribute("aria-current", "page")
  })

  it("uses the explicit current item when provided", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item current>
          About
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          Details
        </Breadcrumbs.Item>
      </Breadcrumbs>
    )
    const items = screen.getAllByRole("listitem")
    expect(items[1]).not.toHaveAttribute("aria-current")
    expect(screen.getByText("About")).toHaveAttribute("aria-current", "page")
    expect(items[2]).not.toHaveAttribute("aria-current")
  })

  it("marks the current breadcrumb link instead of the list item", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item current>
          <Breadcrumbs.Link href="/about">About</Breadcrumbs.Link>
        </Breadcrumbs.Item>
      </Breadcrumbs>
    )

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page")
    expect(screen.getAllByRole("listitem")[1]).not.toHaveAttribute("aria-current")
  })

  it("uses custom separator", () => {
    const { container } = render(
      <Breadcrumbs separator="|">
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/about">About</Breadcrumbs.Link>
        </Breadcrumbs.Item>
      </Breadcrumbs>
    )
    expect(container.textContent).toContain("|")
  })

  it("has no a11y violations", async () => {
    const { container } = render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/products">Products</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item current>
          Widget
        </Breadcrumbs.Item>
      </Breadcrumbs>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("supports render props for custom item rendering", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">
            {(props) => <a {...props}>Custom Home</a>}
          </Breadcrumbs.Link>
        </Breadcrumbs.Item>
      </Breadcrumbs>
    )
    expect(screen.getByText("Custom Home")).toBeInTheDocument()
  })
})
