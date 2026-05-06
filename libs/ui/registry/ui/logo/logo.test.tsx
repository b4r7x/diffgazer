import { render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Logo } from "./index.js"

describe("Logo", () => {
  it("renders plain static text without requiring figlet output", () => {
    render(<Logo text="DIFFGAZER" font="Big" />)

    expect(screen.getByText("DIFFGAZER")).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("uses precomputed ascii text when provided", () => {
    render(<Logo text="OK" asciiText={" O \n K "} />)

    expect(screen.getByRole("img", { name: "OK" })).toHaveTextContent("O")
  })

  it("server-renders the static primitive", () => {
    expect(renderToString(<Logo text="SSR" />)).toContain("SSR")
  })
})
