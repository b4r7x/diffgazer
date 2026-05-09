import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Logo } from "./index.js"

describe("Logo", () => {
  it("renders plain static text without requiring figlet output", () => {
    render(<Logo text="DIFFGAZER" />)

    expect(screen.getByText("DIFFGAZER")).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("uses precomputed ascii text when provided", () => {
    render(<Logo text="OK" asciiText={" O \n K "} />)

    expect(screen.getByRole("img", { name: "OK" })).toHaveTextContent("O")
  })
})
