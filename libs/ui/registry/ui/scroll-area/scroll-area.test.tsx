import { render, screen, fireEvent } from "@testing-library/react"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { ScrollArea } from "./scroll-area.js"

describe("ScrollArea", () => {
  function renderScrollArea(props: Record<string, unknown> = {}) {
    render(
      <ScrollArea aria-label="Content" {...props}>
        content
      </ScrollArea>,
    )
    return screen.getByRole("region", { name: "Content" })
  }

  it("scrolls down/up with arrow keys in vertical mode", () => {
    const el = renderScrollArea()
    fireEvent.keyDown(el, { key: "ArrowDown" })
    expect(el.scrollTop).toBe(40)

    Object.defineProperty(el, "scrollTop", { value: 80, writable: true })
    fireEvent.keyDown(el, { key: "ArrowUp" })
    expect(el.scrollTop).toBe(40)
  })

  it("scrolls left/right with arrow keys in horizontal mode", () => {
    const el = renderScrollArea({ orientation: "horizontal" })
    fireEvent.keyDown(el, { key: "ArrowRight" })
    expect(el.scrollLeft).toBe(40)

    Object.defineProperty(el, "scrollLeft", { value: 80, writable: true })
    fireEvent.keyDown(el, { key: "ArrowLeft" })
    expect(el.scrollLeft).toBe(40)
  })

  it("ignores cross-axis arrow keys based on orientation", () => {
    const vertical = renderScrollArea({ orientation: "vertical" })
    fireEvent.keyDown(vertical, { key: "ArrowRight" })
    expect(vertical.scrollLeft).toBe(0)

    const { unmount } = render(
      <ScrollArea aria-label="Horiz" orientation="horizontal">content</ScrollArea>,
    )
    const horizontal = screen.getByRole("region", { name: "Horiz" })
    fireEvent.keyDown(horizontal, { key: "ArrowDown" })
    expect(horizontal.scrollTop).toBe(0)
    unmount()
  })

  it("scrolls to start with Home and to end with End", () => {
    const el = renderScrollArea()
    Object.defineProperty(el, "scrollHeight", { value: 1000, configurable: true })
    fireEvent.keyDown(el, { key: "End" })
    expect(el.scrollTop).toBe(1000)

    fireEvent.keyDown(el, { key: "Home" })
    expect(el.scrollTop).toBe(0)
  })

  it("does not handle keyboard scrolling when keyboardScrollable is false", () => {
    const el = renderScrollArea({ keyboardScrollable: false })
    fireEvent.keyDown(el, { key: "ArrowDown" })
    expect(el.scrollTop).toBe(0)
    expect(el).not.toHaveAttribute("tabindex")
  })

  it("forwards custom onKeyDown handler", () => {
    const onKeyDown = vi.fn()
    const el = renderScrollArea({ onKeyDown })
    fireEvent.keyDown(el, { key: "ArrowDown" })
    expect(onKeyDown).toHaveBeenCalled()
  })

  it("has no a11y violations", async () => {
    const { container } = render(
      <ScrollArea aria-label="Scrollable content">
        <p>Some content</p>
      </ScrollArea>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
