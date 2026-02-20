// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DocsPageHeader } from "@/components/docs-page"

describe("DocsPageHeader", () => {
  it("renders compact header style with pagefind metadata", () => {
    render(
      <DocsPageHeader
        title="Badge"
        description="Inline status label with semantic color variants."
      />,
    )

    const heading = screen.getByRole("heading", { name: "Badge", level: 1 })
    const description = screen.getByText(
      "Inline status label with semantic color variants.",
    )

    expect(heading.getAttribute("data-pagefind-meta")).toBe("title")
    expect(heading.className).toContain("font-mono")
    expect(heading.className).toContain("text-2xl")
    expect(description.className).toContain("font-mono")
    expect(description.className).toContain("text-sm")
  })

  it("renders tags when provided", () => {
    render(<DocsPageHeader title="Dialog" tags={["primitive", "overlay"]} />)

    expect(screen.getByText("primitive")).not.toBeNull()
    expect(screen.getByText("overlay")).not.toBeNull()
  })

  it("supports prominent variant typography", () => {
    render(
      <DocsPageHeader
        title="Prominent"
        description="Large heading style."
        variant="prominent"
      />,
    )

    const heading = screen.getByRole("heading", { name: "Prominent", level: 1 })
    const description = screen.getByText("Large heading style.")

    expect(heading.className).toContain("text-3xl")
    expect(description.className).toContain("text-lg")
  })
})
