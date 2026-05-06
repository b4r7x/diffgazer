import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, renderHook, screen } from "@testing-library/react"
import { useOverflowItems, computeVisibleCount } from "../use-overflow-items.js"

let resizeCallbacks: (() => void)[] = []
let mutationCallbacks: (() => void)[] = []
let animationCallbacks: FrameRequestCallback[] = []
let disconnectCount = 0

beforeEach(() => {
  resizeCallbacks = []
  mutationCallbacks = []
  animationCallbacks = []
  disconnectCount = 0

  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private cb: () => void) {}
      observe() {
        resizeCallbacks.push(this.cb)
      }
      unobserve() {}
      disconnect() {
        disconnectCount++
      }
    },
  )
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(private cb: () => void) {}
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

function mockOffsetWidth(el: HTMLElement, width: number) {
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true })
}

function flushScheduledChecks() {
  const callbacks = animationCallbacks
  animationCallbacks = []
  for (const cb of callbacks) cb(0)
}

function TestOverflowItems({
  widths,
  containerWidth,
  indicatorWidth,
}: {
  widths: number[]
  containerWidth: number
  indicatorWidth: number
}) {
  const { ref, visibleCount, overflowCount } = useOverflowItems({ itemCount: widths.length })

  return (
    React.createElement(React.Fragment, null,
      React.createElement(
        "div",
        { ref, "data-testid": "container", style: { gap: "10px" } },
        widths.map((width, index) => (
          React.createElement("span", { key: index, "data-testid": `item-${index}`, "data-width": width }, `Item ${index}`)
        )),
        React.createElement("span", { "data-testid": "indicator", "data-width": indicatorWidth }, "More"),
      ),
      React.createElement("output", { "aria-label": "counts" }, `${visibleCount}/${overflowCount}/${containerWidth}`),
    )
  )
}

function setRenderedWidths(containerWidth: number) {
  mockOffsetWidth(screen.getByTestId("container"), containerWidth)
  for (const el of screen.getAllByTestId(/^item-/)) {
    mockOffsetWidth(el, Number(el.getAttribute("data-width")))
  }
  mockOffsetWidth(screen.getByTestId("indicator"), Number(screen.getByTestId("indicator").getAttribute("data-width")))
}

describe("computeVisibleCount", () => {
  it("returns all items when they fit", () => {
    const widths = [50, 50, 50]
    expect(computeVisibleCount(widths, 200, 10, 30)).toBe(3)
  })

  it("returns partial count with indicator reservation", () => {
    expect(computeVisibleCount([50, 50, 50], 150, 10, 30)).toBe(2)
  })

  it("always shows at least one item even if it overflows", () => {
    expect(computeVisibleCount([200], 100, 0, 30)).toBe(1)
  })

  it("returns 0 for zero items", () => {
    expect(computeVisibleCount([], 500, 10, 30)).toBe(0)
  })

  it("accounts for gap between items", () => {
    expect(computeVisibleCount([40, 40, 40], 130, 10, 20)).toBe(2)
  })

  it("sanitizes invalid dimensions", () => {
    expect(computeVisibleCount([50, Number.NaN], Number.NaN, -10, Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe("useOverflowItems", () => {
  it("returns itemCount as initial visibleCount with zero overflow", () => {
    const { result } = renderHook(() => useOverflowItems({ itemCount: 5 }))
    expect(result.current.visibleCount).toBe(5)
    expect(result.current.overflowCount).toBe(0)
  })

  it("clamps visible and overflow counts when itemCount shrinks", () => {
    const { result, rerender } = renderHook(
      ({ itemCount }) => useOverflowItems({ itemCount }),
      { initialProps: { itemCount: 5 } },
    )

    rerender({ itemCount: 2 })

    expect(result.current.visibleCount).toBe(2)
    expect(result.current.overflowCount).toBe(0)
  })

  it("updates when the overflow indicator width changes", () => {
    const { rerender } = render(
      React.createElement(TestOverflowItems, {
        widths: [50, 50, 50],
        containerWidth: 150,
        indicatorWidth: 30,
      }),
    )
    setRenderedWidths(150)

    act(() => {
      for (const cb of resizeCallbacks) cb()
      flushScheduledChecks()
    })
    expect(screen.getByLabelText("counts")).toHaveTextContent("2/1/150")

    rerender(
      React.createElement(TestOverflowItems, {
        widths: [50, 50, 50],
        containerWidth: 150,
        indicatorWidth: 80,
      }),
    )
    setRenderedWidths(150)

    act(() => {
      for (const cb of resizeCallbacks) cb()
      flushScheduledChecks()
    })

    expect(screen.getByLabelText("counts")).toHaveTextContent("1/2/150")
  })

  it("updates after child removal and disconnects observers", () => {
    const { rerender, unmount } = render(
      React.createElement(TestOverflowItems, {
        widths: [40, 40, 40],
        containerWidth: 140,
        indicatorWidth: 20,
      }),
    )
    setRenderedWidths(140)

    act(() => {
      for (const cb of resizeCallbacks) cb()
      flushScheduledChecks()
    })
    expect(screen.getByLabelText("counts")).toHaveTextContent("3/0/140")

    rerender(
      React.createElement(TestOverflowItems, {
        widths: [40],
        containerWidth: 140,
        indicatorWidth: 20,
      }),
    )
    setRenderedWidths(140)

    act(() => {
      for (const cb of mutationCallbacks) cb()
      flushScheduledChecks()
    })

    expect(screen.getByLabelText("counts")).toHaveTextContent("1/0/140")

    unmount()
    expect(disconnectCount).toBeGreaterThan(0)
  })
})
