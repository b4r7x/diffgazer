import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, act, renderHook } from "@testing-library/react"
import React from "react"
import { useOverflow, type OverflowDirection } from "../use-overflow.js"

let resizeCallbacks: (() => void)[] = []
let mutationCallbacks: (() => void)[] = []
let animationCallbacks: FrameRequestCallback[] = []

beforeEach(() => {
  resizeCallbacks = []
  mutationCallbacks = []
  animationCallbacks = []
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private cb: () => void
      constructor(cb: () => void) {
        this.cb = cb
      }
      observe() {
        resizeCallbacks.push(this.cb)
      }
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    "MutationObserver",
    class {
      private cb: () => void
      constructor(cb: () => void) {
        this.cb = cb
      }
      observe() {
        mutationCallbacks.push(this.cb)
      }
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  )
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    animationCallbacks.push(cb)
    return animationCallbacks.length
  })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
})

function TestComponent({ direction, onResult }: { direction?: OverflowDirection; onResult: (v: boolean) => void }) {
  const { ref, isOverflowing } = useOverflow<HTMLDivElement>(direction)
  React.useEffect(() => { onResult(isOverflowing) })
  return React.createElement("div", { ref, "data-testid": "target" })
}

function mockDimensions(el: HTMLElement, dims: { scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number }) {
  Object.defineProperty(el, "scrollWidth", { value: dims.scrollWidth, configurable: true })
  Object.defineProperty(el, "clientWidth", { value: dims.clientWidth, configurable: true })
  Object.defineProperty(el, "scrollHeight", { value: dims.scrollHeight, configurable: true })
  Object.defineProperty(el, "clientHeight", { value: dims.clientHeight, configurable: true })
}

function flushScheduledChecks() {
  const callbacks = animationCallbacks
  animationCallbacks = []
  for (const cb of callbacks) cb(0)
}

describe("useOverflow", () => {
  it("returns isOverflowing=false initially", () => {
    const { result } = renderHook(() => useOverflow())
    expect(result.current.isOverflowing).toBe(false)
  })

  it("detects horizontal overflow", () => {
    let lastResult = false
    const { getByTestId } = render(
      React.createElement(TestComponent, {
        direction: "horizontal",
        onResult: (v: boolean) => { lastResult = v },
      }),
    )

    const el = getByTestId("target")
    mockDimensions(el, { scrollWidth: 500, clientWidth: 300, scrollHeight: 100, clientHeight: 100 })

    act(() => {
      for (const cb of resizeCallbacks) cb()
      flushScheduledChecks()
    })

    expect(lastResult).toBe(true)
  })

  it("detects vertical overflow", () => {
    let lastResult = false
    const { getByTestId } = render(
      React.createElement(TestComponent, {
        direction: "vertical",
        onResult: (v: boolean) => { lastResult = v },
      }),
    )

    const el = getByTestId("target")
    mockDimensions(el, { scrollWidth: 100, clientWidth: 100, scrollHeight: 500, clientHeight: 300 })

    act(() => {
      for (const cb of resizeCallbacks) cb()
      flushScheduledChecks()
    })

    expect(lastResult).toBe(true)
  })

  it("returns false when no overflow in queried direction", () => {
    let lastResult = true
    const { getByTestId } = render(
      React.createElement(TestComponent, {
        direction: "vertical",
        onResult: (v: boolean) => { lastResult = v },
      }),
    )

    const el = getByTestId("target")
    mockDimensions(el, { scrollWidth: 500, clientWidth: 300, scrollHeight: 100, clientHeight: 100 })

    act(() => {
      for (const cb of resizeCallbacks) cb()
      flushScheduledChecks()
    })

    expect(lastResult).toBe(false)
  })

  it("detects both direction overflow from horizontal", () => {
    let lastResult = false
    const { getByTestId } = render(
      React.createElement(TestComponent, {
        direction: "both",
        onResult: (v: boolean) => { lastResult = v },
      }),
    )

    const el = getByTestId("target")
    mockDimensions(el, { scrollWidth: 500, clientWidth: 300, scrollHeight: 100, clientHeight: 100 })

    act(() => {
      for (const cb of resizeCallbacks) cb()
      flushScheduledChecks()
    })

    expect(lastResult).toBe(true)
  })

  it("detects both direction overflow from vertical only", () => {
    let lastResult = false
    const { getByTestId } = render(
      React.createElement(TestComponent, {
        direction: "both",
        onResult: (v: boolean) => { lastResult = v },
      }),
    )

    const el = getByTestId("target")
    mockDimensions(el, { scrollWidth: 100, clientWidth: 100, scrollHeight: 500, clientHeight: 300 })

    act(() => {
      for (const cb of resizeCallbacks) cb()
      flushScheduledChecks()
    })

    expect(lastResult).toBe(true)
  })

  it("updates when text content changes", () => {
    let lastResult = false
    const { getByTestId, rerender } = render(
      React.createElement(TestComponent, {
        direction: "horizontal",
        onResult: (v: boolean) => { lastResult = v },
      }),
    )

    const el = getByTestId("target")
    mockDimensions(el, { scrollWidth: 100, clientWidth: 100, scrollHeight: 100, clientHeight: 100 })

    act(() => {
      for (const cb of resizeCallbacks) cb()
      flushScheduledChecks()
    })
    expect(lastResult).toBe(false)

    rerender(
      React.createElement(TestComponent, {
        direction: "horizontal",
        onResult: (v: boolean) => { lastResult = v },
      }),
    )
    mockDimensions(el, { scrollWidth: 200, clientWidth: 100, scrollHeight: 100, clientHeight: 100 })

    act(() => {
      for (const cb of mutationCallbacks) cb()
      flushScheduledChecks()
    })

    expect(lastResult).toBe(true)
  })
})
