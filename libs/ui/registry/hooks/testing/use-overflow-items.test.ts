import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useOverflowItems, computeVisibleCount } from "../use-overflow-items.js"

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

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
    // Without gap: 40+40+40 = 120, fits in 130
    // With gap 10: 40+10+40+10+40 = 140, doesn't fit in 130 (with indicator reserve)
    expect(computeVisibleCount([40, 40, 40], 130, 10, 20)).toBe(2)
  })
})

describe("useOverflowItems", () => {
  it("returns itemCount as initial visibleCount with zero overflow", () => {
    const { result } = renderHook(() => useOverflowItems({ itemCount: 5 }))
    expect(result.current.visibleCount).toBe(5)
    expect(result.current.overflowCount).toBe(0)
  })
})
