import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { usePresence } from "../use-presence.js"
import { createRef, type AnimationEvent } from "react"

describe("usePresence", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts hidden when open=false", () => {
    const { result } = renderHook(() => usePresence({ open: false }))
    expect(result.current.present).toBe(false)
  })

  it("starts present when open=true", () => {
    const { result } = renderHook(() => usePresence({ open: true }))
    expect(result.current.present).toBe(true)
  })

  it("transitions hidden→open when open changes to true", () => {
    const { result, rerender } = renderHook(
      ({ open }) => usePresence({ open }),
      { initialProps: { open: false } },
    )
    expect(result.current.present).toBe(false)

    rerender({ open: true })
    expect(result.current.present).toBe(true)
  })

  it("transitions open→closing→hidden on animationEnd", () => {
    const { result, rerender } = renderHook(
      ({ open }) => usePresence({ open }),
      { initialProps: { open: true } },
    )

    rerender({ open: false })
    // Should be in "closing" phase — still present
    expect(result.current.present).toBe(true)

    // Fire animation end
    act(() => {
      result.current.onAnimationEnd({ target: null } as unknown as AnimationEvent)
    })
    expect(result.current.present).toBe(false)
  })

  it("ignores animationEnd from non-ref target when ref is provided", () => {
    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    ref.current = document.createElement("div")

    const { result, rerender } = renderHook(
      ({ open }) => usePresence({ open, ref }),
      { initialProps: { open: true } },
    )

    rerender({ open: false })
    expect(result.current.present).toBe(true)

    // Fire from wrong target
    act(() => {
      result.current.onAnimationEnd({
        target: document.createElement("span"),
      } as unknown as AnimationEvent)
    })
    expect(result.current.present).toBe(true)

    // Fire from correct target
    act(() => {
      result.current.onAnimationEnd({
        target: ref.current,
      } as unknown as AnimationEvent)
    })
    expect(result.current.present).toBe(false)
  })

  it("sets exiting=true when open goes from true to false until onAnimationEnd", () => {
    const { result, rerender } = renderHook(
      ({ open }) => usePresence({ open }),
      { initialProps: { open: true } },
    )

    expect(result.current.exiting).toBe(false)

    rerender({ open: false })
    expect(result.current.exiting).toBe(true)
    expect(result.current.present).toBe(true)

    act(() => {
      result.current.onAnimationEnd({ target: null } as unknown as AnimationEvent)
    })
    expect(result.current.exiting).toBe(false)
    expect(result.current.present).toBe(false)
  })

  it("re-opens when open=true is set during closing phase", () => {
    const { result, rerender } = renderHook(
      ({ open }) => usePresence({ open }),
      { initialProps: { open: true } },
    )

    // Enter closing phase
    rerender({ open: false })
    expect(result.current.exiting).toBe(true)

    // Re-open before animation ends
    rerender({ open: true })
    expect(result.current.present).toBe(true)
    expect(result.current.exiting).toBe(false)
  })

  it("finishes closing when no animation event fires", () => {
    vi.useFakeTimers()
    const onExitComplete = vi.fn()
    const { result, rerender } = renderHook(
      ({ open }) => usePresence({ open, exitFallbackMs: 50, onExitComplete }),
      { initialProps: { open: true } },
    )

    rerender({ open: false })
    expect(result.current.present).toBe(true)

    act(() => {
      vi.advanceTimersByTime(50)
    })

    expect(result.current.present).toBe(false)
    expect(onExitComplete).toHaveBeenCalledOnce()
  })

  it("finishes closing on animation cancel", () => {
    const ref = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    ref.current = document.createElement("div")
    const { result, rerender } = renderHook(
      ({ open }) => usePresence({ open, ref }),
      { initialProps: { open: true } },
    )

    rerender({ open: false })
    act(() => {
      result.current.onAnimationCancel({ target: ref.current } as unknown as AnimationEvent)
    })

    expect(result.current.present).toBe(false)
  })
})
