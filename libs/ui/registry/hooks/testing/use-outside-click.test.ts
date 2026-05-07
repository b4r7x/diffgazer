import { StrictMode } from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useEscapeKey, useOutsideClick } from "../use-outside-click.js"
import { createRef } from "react"

let restorePointerEventSupport = () => {}

function setPointerEventSupport(enabled: boolean) {
  const descriptor = Object.getOwnPropertyDescriptor(window, "PointerEvent")

  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    writable: true,
    value: enabled ? class TestPointerEvent extends MouseEvent {} : undefined,
  })

  return () => {
    if (descriptor) {
      Object.defineProperty(window, "PointerEvent", descriptor)
    } else {
      Reflect.deleteProperty(window, "PointerEvent")
    }
  }
}

beforeEach(() => {
  restorePointerEventSupport = setPointerEventSupport(false)
})

afterEach(() => {
  restorePointerEventSupport()
})

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

  it("handles outside targets that stop propagation", () => {
    const { outside, handler, cleanup } = setup()
    outside.addEventListener("mousedown", (event) => event.stopPropagation())

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

  it("handles a pointer-supported outside interaction once", () => {
    restorePointerEventSupport()
    restorePointerEventSupport = setPointerEventSupport(true)
    const { outside, handler, cleanup } = setup()

    outside.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    outside.dispatchEvent(new Event("touchstart", { bubbles: true }))

    expect(handler).toHaveBeenCalledOnce()
    cleanup()
  })

  it("dedupes fallback mouse events after touch starts", () => {
    const { outside, handler, cleanup } = setup()

    outside.dispatchEvent(new Event("touchstart", { bubbles: true }))
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))

    expect(handler).toHaveBeenCalledOnce()
    cleanup()
  })

  it("uses the latest outside-click handler after rerender", () => {
    const inside = document.createElement("div")
    const outside = document.createElement("div")
    document.body.append(inside, outside)

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    ref.current = inside
    const firstHandler = vi.fn()
    const secondHandler = vi.fn()

    const { rerender } = renderHook(
      ({ handler }) => useOutsideClick(ref, handler, true),
      { initialProps: { handler: firstHandler } },
    )

    rerender({ handler: secondHandler })
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))

    expect(secondHandler).toHaveBeenCalledOnce()
    expect(firstHandler).not.toHaveBeenCalled()

    inside.remove()
    outside.remove()
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

  it("only calls the topmost outside-click layer", () => {
    const lower = document.createElement("div")
    const upper = document.createElement("div")
    const outside = document.createElement("button")
    document.body.append(lower, upper, outside)

    const lowerRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    const upperRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    lowerRef.current = lower
    upperRef.current = upper
    const lowerHandler = vi.fn()
    const upperHandler = vi.fn()

    renderHook(() => {
      useOutsideClick(lowerRef, lowerHandler, true)
      useOutsideClick(upperRef, upperHandler, true)
    })

    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))

    expect(upperHandler).toHaveBeenCalledOnce()
    expect(lowerHandler).not.toHaveBeenCalled()

    lower.remove()
    upper.remove()
    outside.remove()
  })

  it("routes Escape to the topmost enabled layer", () => {
    const lowerHandler = vi.fn()
    const upperHandler = vi.fn()

    renderHook(() => {
      useEscapeKey(lowerHandler, true)
      useEscapeKey(upperHandler, true)
    })

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))

    expect(upperHandler).toHaveBeenCalledOnce()
    expect(lowerHandler).not.toHaveBeenCalled()
  })

  it("cleans up StrictMode listener probes before handling outside clicks", () => {
    const addSpy = vi.spyOn(document, "addEventListener")
    const removeSpy = vi.spyOn(document, "removeEventListener")
    const inside = document.createElement("div")
    const outside = document.createElement("button")
    document.body.append(inside, outside)

    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    ref.current = inside
    const handler = vi.fn()

    const { unmount } = renderHook(
      () => useOutsideClick(ref, handler, true),
      { wrapper: StrictMode },
    )

    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()

    unmount()
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()

    expect(addSpy).toHaveBeenCalledWith("mousedown", expect.any(Function), expect.objectContaining({ capture: true }))
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function), expect.objectContaining({ capture: true }))

    addSpy.mockRestore()
    removeSpy.mockRestore()
    inside.remove()
    outside.remove()
  })

  it("uses the latest Escape handler after rerender", () => {
    const firstHandler = vi.fn()
    const secondHandler = vi.fn()

    const { rerender } = renderHook(
      ({ handler }) => useEscapeKey(handler, true),
      { initialProps: { handler: firstHandler } },
    )

    rerender({ handler: secondHandler })
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))

    expect(secondHandler).toHaveBeenCalledOnce()
    expect(firstHandler).not.toHaveBeenCalled()
  })
})
