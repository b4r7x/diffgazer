import { createRef } from "react"
import { act, render, screen } from "@testing-library/react"
import { axe } from "../../../testing/utils.js"
import { afterEach, describe, it, expect, vi } from "vitest"
import { Spinner } from "./index.js"

const originalMatchMedia = window.matchMedia

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mql = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    }),
    removeEventListener: vi.fn((_: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    }),
    dispatchEvent: vi.fn(),
  }

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  })

  return mql
}

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: originalMatchMedia,
  })
})

describe("Spinner", () => {
  it("renders with role=status and default label when no children", () => {
    render(<Spinner />)
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
  })

  it("renders with role=status and no aria-label when children are provided", () => {
    render(<Spinner>Processing...</Spinner>)
    const status = screen.getByRole("status")
    expect(status).not.toHaveAttribute("aria-label")
    expect(status).toHaveTextContent("Processing...")
  })

  it("has no a11y violations", async () => {
    const { container } = render(<Spinner />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations with children", async () => {
    const { container } = render(<Spinner>Loading data...</Spinner>)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("forwards refs to the status element", () => {
    const ref = createRef<HTMLSpanElement>()
    render(<Spinner ref={ref} />)

    expect(ref.current).toBe(screen.getByRole("status", { name: "Loading" }))
  })

  it("uses the default speed when an invalid speed is provided", () => {
    vi.useFakeTimers()
    mockMatchMedia(false)
    const { container } = render(<Spinner variant="braille" speed={Number.NaN} />)
    const animation = container.querySelector("[aria-hidden='true']")

    expect(animation).toHaveTextContent("⠋")
    expect(vi.getTimerCount()).toBe(1)

    act(() => {
      vi.advanceTimersByTime(80)
    })

    expect(animation).toHaveTextContent("⠙")
  })

  it("does not start animation timers when reduced motion is requested", () => {
    vi.useFakeTimers()
    mockMatchMedia(true)
    const { container } = render(<Spinner variant="braille" />)
    const animation = container.querySelector("[aria-hidden='true']")

    expect(animation).toHaveTextContent("⠋")
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(animation).toHaveTextContent("⠋")
  })

  it("does not crash when matchMedia is unavailable", () => {
    vi.useFakeTimers()
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: undefined,
    })

    expect(() => render(<Spinner variant="braille" />)).not.toThrow()
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
  })

  it("removes motion listeners and timers on unmount", () => {
    vi.useFakeTimers()
    const mql = mockMatchMedia(false)
    const { unmount } = render(<Spinner variant="braille" />)

    expect(mql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function))
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
  })
})
