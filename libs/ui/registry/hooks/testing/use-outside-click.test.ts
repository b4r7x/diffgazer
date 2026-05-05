import { describe, it, expect, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useOutsideClick } from "../use-outside-click.js"
import { createRef } from "react"

describe("useOutsideClick", () => {
  function setup(opts: { enabled?: boolean; excludeRefs?: React.RefObject<HTMLElement | null>[] } = {}) {
    const inside = document.createElement("div")
    const outside = document.createElement("div")
    document.body.appendChild(inside)
    document.body.appendChild(outside)

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    ref.current = inside

    const handler = vi.fn()

    renderHook(() =>
      useOutsideClick(ref, handler, opts.enabled ?? true, opts.excludeRefs),
    )

    return { inside, outside, handler, cleanup: () => { inside.remove(); outside.remove() } }
  }

  it("calls handler on outside click", () => {
    const { outside, handler, cleanup } = setup()
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()
    cleanup()
  })

  it("does not call handler on inside click", () => {
    const { inside, handler, cleanup } = setup()
    inside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    expect(handler).not.toHaveBeenCalled()
    cleanup()
  })

  it("does not call handler when enabled=false", () => {
    const { outside, handler, cleanup } = setup({ enabled: false })
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    expect(handler).not.toHaveBeenCalled()
    cleanup()
  })

  it("does not call handler when clicking on excluded ref", () => {
    const excluded = document.createElement("div")
    document.body.appendChild(excluded)
    const excludeRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    excludeRef.current = excluded

    const { handler, cleanup } = setup({ excludeRefs: [excludeRef] })
    excluded.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    expect(handler).not.toHaveBeenCalled()
    excluded.remove()
    cleanup()
  })

  it("does not call handler after unmount", () => {
    const inside = document.createElement("div")
    const outside = document.createElement("div")
    document.body.appendChild(inside)
    document.body.appendChild(outside)

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    ref.current = inside

    const handler = vi.fn()

    const { unmount } = renderHook(() =>
      useOutsideClick(ref, handler, true),
    )

    unmount()
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    expect(handler).not.toHaveBeenCalled()

    inside.remove()
    outside.remove()
  })

  it("does not call handler when clicking a child of the ref element", () => {
    const inside = document.createElement("div")
    const child = document.createElement("span")
    inside.appendChild(child)
    document.body.appendChild(inside)

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    ref.current = inside

    const handler = vi.fn()

    renderHook(() =>
      useOutsideClick(ref, handler, true),
    )

    child.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    expect(handler).not.toHaveBeenCalled()

    inside.remove()
  })
})
