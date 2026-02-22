// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SectionHeader } from "@/components/ui/section-header/section-header"

describe("SectionHeader", () => {
  it("forwards native heading attributes", () => {
    render(
      <SectionHeader
        as="h2"
        id="installation"
        aria-label="Installation heading"
        data-testid="section-heading"
      >
        Installation
      </SectionHeader>,
    )

    const heading = screen.getByTestId("section-heading")

    expect(heading.tagName).toBe("H2")
    expect(heading.getAttribute("id")).toBe("installation")
    expect(heading.getAttribute("aria-label")).toBe("Installation heading")
  })
})
