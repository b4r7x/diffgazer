import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils"
import { describe, it, expect, vi } from "vitest"
import { ScrollArea } from "./scroll-area"

describe("ScrollArea", () => {
  function renderScrollArea(props: Record<string, unknown> = {}) {
    render(
      <ScrollArea aria-label="Content" {...props}>
        content
      </ScrollArea>,
    )
    return screen.getByRole("region", { name: "Content" })
  }

  it("scrolls down/up with arrow keys in vertical mode", async () => {
    const el = renderScrollArea()
    el.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(el.scrollTop).toBe(40)

    Object.defineProperty(el, "scrollTop", { value: 80, writable: true })
    await userEvent.keyboard("{ArrowUp}")
    expect(el.scrollTop).toBe(40)
  })

  it("scrolls left/right with arrow keys in horizontal mode", async () => {
    const el = renderScrollArea({ orientation: "horizontal" })
    el.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(el.scrollLeft).toBe(40)

    Object.defineProperty(el, "scrollLeft", { value: 80, writable: true })
    await userEvent.keyboard("{ArrowLeft}")
    expect(el.scrollLeft).toBe(40)
  })

  it("ignores cross-axis arrow keys based on orientation", async () => {
    const vertical = renderScrollArea({ orientation: "vertical" })
    vertical.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(vertical.scrollLeft).toBe(0)

    const { unmount } = render(
      <ScrollArea aria-label="Horiz" orientation="horizontal">content</ScrollArea>,
    )
    const horizontal = screen.getByRole("region", { name: "Horiz" })
    horizontal.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(horizontal.scrollTop).toBe(0)
    unmount()
  })

  it("scrolls to start with Home and to end with End", async () => {
    const el = renderScrollArea()
    Object.defineProperty(el, "scrollHeight", { value: 1000, configurable: true })
    el.focus()
    await userEvent.keyboard("{End}")
    expect(el.scrollTop).toBe(1000)

    await userEvent.keyboard("{Home}")
    expect(el.scrollTop).toBe(0)
  })

  it("uses the horizontal axis for Page, Home, and End in horizontal mode", async () => {
    const el = renderScrollArea({ orientation: "horizontal" })
    Object.defineProperty(el, "clientWidth", { value: 200, configurable: true })
    Object.defineProperty(el, "scrollWidth", { value: 1000, configurable: true })

    el.focus()
    await userEvent.keyboard("{PageDown}")
    expect(el.scrollLeft).toBe(160)
    expect(el.scrollTop).toBe(0)

    await userEvent.keyboard("{PageUp}")
    expect(el.scrollLeft).toBe(0)

    await userEvent.keyboard("{End}")
    expect(el.scrollLeft).toBe(1000)
    expect(el.scrollTop).toBe(0)

    await userEvent.keyboard("{Home}")
    expect(el.scrollLeft).toBe(0)
  })

  it("does not handle keyboard scrolling when keyboardScrollable is false", async () => {
    const el = renderScrollArea({ keyboardScrollable: false })
    el.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(el.scrollTop).toBe(0)
    expect(el).not.toHaveAttribute("tabindex")
  })

  it("forwards custom onKeyDown handler", async () => {
    const onKeyDown = vi.fn()
    const el = renderScrollArea({ onKeyDown })
    el.focus()
    await userEvent.keyboard("{ArrowDown}")
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

  it("provides accessible name when aria-label is set", () => {
    const el = renderScrollArea()
    expect(el).toHaveAttribute("aria-label", "Content")
    expect(el).toHaveAccessibleName("Content")
  })

  it("provides accessible name when aria-labelledby is set", () => {
    render(
      <>
        <h2 id="scroll-title">Scroll Container</h2>
        <ScrollArea aria-labelledby="scroll-title">
          content
        </ScrollArea>
      </>
    )
    const scrollArea = screen.getByRole("region")
    expect(scrollArea).toHaveAttribute("aria-labelledby", "scroll-title")
    expect(scrollArea).toHaveAccessibleName("Scroll Container")
  })

  it("makes scroll area keyboard accessible when keyboardScrollable is true", () => {
    const el = renderScrollArea({ keyboardScrollable: true })
    expect(el).toHaveAttribute("tabindex", "0")
  })

  it("does not add an unnamed keyboard tab stop", async () => {
    const { container } = render(
      <ScrollArea>
        content
      </ScrollArea>,
    )
    const scrollArea = container.firstElementChild as HTMLElement

    expect(screen.queryByRole("region")).not.toBeInTheDocument()
    expect(scrollArea).not.toHaveAttribute("tabindex")

    scrollArea.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(scrollArea.scrollTop).toBe(0)
  })

})
