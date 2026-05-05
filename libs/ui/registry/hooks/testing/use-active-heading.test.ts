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
    vi.unstubAllGlobals()
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
    vi.stubGlobal("scrollTo", scrollToSpy)

    const { result } = renderHook(() =>
      useActiveHeading({ ids: ["h1", "h2", "h3"] }),
    )

    act(() => {
      result.current.scrollTo("h2")
    })

    expect(result.current.activeId).toBe("h2")
    expect(scrollToSpy).toHaveBeenCalled()
  })
})
