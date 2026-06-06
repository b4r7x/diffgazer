import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Portal } from "./portal"

describe("Portal", () => {
  it("renders nothing when no target can be resolved", () => {
    // An explicit null container opts out of the document.body fallback, so the
    // portal has no target and must commit nothing rather than throw.
    const { container } = render(<Portal container={null}>content</Portal>)
    expect(container).toBeEmptyDOMElement()
  })

  it("portals children into an explicit container", () => {
    const target = document.createElement("div")
    document.body.appendChild(target)
    try {
      render(<Portal container={target}>portaled</Portal>)
      expect(target).toHaveTextContent("portaled")
    } finally {
      target.remove()
    }
  })

  it("falls back to document.body when no container is provided", () => {
    render(<Portal>body-content</Portal>)
    expect(document.body).toHaveTextContent("body-content")
  })
})
