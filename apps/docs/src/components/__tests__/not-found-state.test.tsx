// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Button } from "@/components/ui/button/button"
import { NotFoundState } from "@/components/not-found-state"

describe("NotFoundState", () => {
  it("renders the docs variant with expected content and actions", () => {
    render(
      <NotFoundState
        variant="docs"
        title="Documentation page not found"
        description="The page you requested does not exist or was moved."
        primaryAction={<Button>Go to docs home</Button>}
      />,
    )

    expect(screen.getByText("404")).not.toBeNull()
    expect(screen.getByRole("heading", { name: "Documentation page not found" })).not.toBeNull()
    expect(screen.getByText("The page you requested does not exist or was moved.")).not.toBeNull()
    expect(screen.getByRole("button", { name: "Go to docs home" })).not.toBeNull()
  })

  it("renders optional secondary action", () => {
    render(
      <NotFoundState
        variant="global"
        title="Page not found"
        description="This path does not exist."
        primaryAction={<Button>Go home</Button>}
        secondaryAction={<Button variant="ghost">Open docs</Button>}
      />,
    )

    expect(screen.getByRole("button", { name: "Go home" })).not.toBeNull()
    expect(screen.getByRole("button", { name: "Open docs" })).not.toBeNull()
  })

  it("supports custom status label", () => {
    const { getByText } = render(
      <NotFoundState
        variant="global"
        statusLabel="ERROR"
        title="Something went wrong"
        description="Unexpected error."
        primaryAction={<Button>Try again</Button>}
      />,
    )

    expect(getByText("ERROR")).not.toBeNull()
  })
})
