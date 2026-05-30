import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, renderHook, screen } from "@testing-library/react"
import { useOverflowItems, computeVisibleCount } from "../use-overflow-items"

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
      constructor(private cb: () => void) {}
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

afterEach(() => {
  vi.unstubAllGlobals()
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
        "ul",
        { ref, "aria-label": "items", style: { gap: "10px" } },
        widths.map((width, index) => (
          React.createElement("li", { key: index, "data-width": width }, `Item ${index}`)
        )),
        React.createElement("span", { "aria-label": "overflow indicator", "data-width": indicatorWidth }, "More"),
      ),
      React.createElement("output", { "aria-label": "counts" }, `${visibleCount}/${overflowCount}/${containerWidth}`),
    )
  )
}

function TestOverflowItemsWithListener({
  listener,
}: {
  listener: (count: number) => void
}) {
  const { ref, visibleCount } = useOverflowItems({
    itemCount: 3,
    onVisibleCountChange: listener,
  })

  return (
    React.createElement(React.Fragment, null,
      React.createElement(
        "ul",
        { ref, "aria-label": "items", style: { gap: "10px" } },
        React.createElement("li", { "data-width": 50 }, "Item 0"),
        React.createElement("li", { "data-width": 50 }, "Item 1"),
        React.createElement("li", { "data-width": 50 }, "Item 2"),
        React.createElement("span", { "aria-label": "overflow indicator", "data-width": 30 }, "More"),
      ),
      React.createElement("output", { "aria-label": "visible count" }, visibleCount),
    )
  )
}

function setRenderedWidths(containerWidth: number) {
  mockOffsetWidth(screen.getByRole("list", { name: "items" }), containerWidth)
  for (const el of screen.getAllByRole("listitem")) {
    mockOffsetWidth(el, Number(el.getAttribute("data-width")))
  }
  const indicator = screen.getByLabelText("overflow indicator")
  mockOffsetWidth(indicator, Number(indicator.getAttribute("data-width")))
}

describe("computeVisibleCount", () => {
  it.each([
    {
      scenario: "all items fit",
      widths: [50, 50, 50],
      containerWidth: 200,
      gap: 10,
      indicatorWidth: 30,
      expected: 3,
    },
    {
      scenario: "partial fit reserves space for indicator",
      widths: [50, 50, 50],
      containerWidth: 150,
      gap: 10,
      indicatorWidth: 30,
      expected: 2,
    },
    {
      scenario: "always shows at least one item even if it overflows",
      widths: [200],
      containerWidth: 100,
      gap: 0,
      indicatorWidth: 30,
      expected: 1,
    },
    {
      scenario: "returns 0 for zero items",
      widths: [],
      containerWidth: 500,
      gap: 10,
      indicatorWidth: 30,
      expected: 0,
    },
    {
      scenario: "accounts for gap between items",
      widths: [40, 40, 40],
      containerWidth: 130,
      gap: 10,
      indicatorWidth: 20,
      expected: 2,
    },
    {
      scenario: "sanitizes invalid dimensions",
      widths: [50, Number.NaN],
      containerWidth: Number.NaN,
      gap: -10,
      indicatorWidth: Number.POSITIVE_INFINITY,
      expected: 1,
    },
  ])("$scenario", ({ widths, containerWidth, gap, indicatorWidth, expected }) => {
    expect(computeVisibleCount(widths, containerWidth, gap, indicatorWidth)).toBe(expected)
  })
})

describe("useOverflowItems", () => {
  it("initially reports all items visible with no overflow", () => {
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

  it("recomputes visible count when items are removed from the DOM", () => {
    const { rerender } = render(
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
  })

  it("notifies the latest visible-count listener after rerender", () => {
    const firstListener = vi.fn()
    const secondListener = vi.fn()
    const { rerender } = render(
      React.createElement(TestOverflowItemsWithListener, { listener: firstListener }),
    )

    setRenderedWidths(150)
    rerender(
      React.createElement(TestOverflowItemsWithListener, { listener: secondListener }),
    )
    setRenderedWidths(150)

    act(() => {
      for (const cb of resizeCallbacks) cb()
      flushScheduledChecks()
    })

    expect(screen.getByLabelText("visible count")).toHaveTextContent("2")
    expect(secondListener).toHaveBeenCalledWith(2)
    expect(firstListener).not.toHaveBeenCalledWith(2)
  })
})
