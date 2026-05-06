import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useActiveHeading } from "../use-active-heading.js"

describe("useActiveHeading", () => {
  let headings: HTMLElement[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    headings = ["h1", "h2", "h3"].map((id) => {
      const el = document.createElement("h2")
      el.id = id
      document.body.appendChild(el)
      return el
    })
  })

  afterEach(() => {
    headings.forEach((el) => el.remove())
    headings = []
    vi.useRealTimers()
  })

  it("returns first id as initial activeId", () => {
    const { result } = renderHook(() =>
      useActiveHeading({ ids: ["h1", "h2", "h3"] }),
    )
    expect(result.current.activeId).toBe("h1")
  })

  it("returns null when disabled", () => {
    const { result } = renderHook(() =>
      useActiveHeading({ ids: ["h1", "h2", "h3"], enabled: false }),
    )
    expect(result.current.activeId).toBeNull()
  })

  it("returns null for empty ids", () => {
    const { result } = renderHook(() =>
      useActiveHeading({ ids: [] }),
    )
    expect(result.current.activeId).toBeNull()
  })

  it("scrollTo sets activeId and calls window.scrollTo", () => {
    const scrollToSpy = vi.fn()
    const originalScrollTo = window.scrollTo
    window.scrollTo = scrollToSpy

    try {
      const { result } = renderHook(() =>
        useActiveHeading({ ids: ["h1", "h2", "h3"] }),
      )

      act(() => {
        result.current.scrollTo("h2")
      })

      expect(result.current.activeId).toBe("h2")
      expect(scrollToSpy).toHaveBeenCalled()
    } finally {
      window.scrollTo = originalScrollTo
    }
  })

  it("recalculates the active heading when activation options change", () => {
    headings[0]!.getBoundingClientRect = () => ({ top: 0, bottom: 10, height: 10, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => null })
    headings[1]!.getBoundingClientRect = () => ({ top: 300, bottom: 310, height: 10, left: 0, right: 0, width: 0, x: 0, y: 300, toJSON: () => null })
    headings[2]!.getBoundingClientRect = () => ({ top: 600, bottom: 610, height: 10, left: 0, right: 0, width: 0, x: 0, y: 600, toJSON: () => null })

    const { result, rerender } = renderHook(
      ({ activation }) => useActiveHeading({ ids: ["h1", "h2", "h3"], activation, topOffset: 0, bottomLock: false }),
      { initialProps: { activation: "top-line" as const } },
    )

    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(result.current.activeId).toBe("h1")

    rerender({ activation: "viewport-center" })
    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(result.current.activeId).toBe("h2")
  })
})
