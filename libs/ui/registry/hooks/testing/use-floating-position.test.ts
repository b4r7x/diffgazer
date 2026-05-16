import { createElement, useRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import {
  computePosition,
  resolveCollisionPosition,
  shift,
  useFloatingPosition,
  wouldOverflow,
  type FloatingAlign,
  type FloatingSide,
} from "../use-floating-position.js"

function makeDOMRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    toJSON() {},
  }
}

const triggerRect = makeDOMRect(100, 100, 80, 40)
const contentRect = makeDOMRect(0, 0, 120, 50)
const viewport = { width: 800, height: 600 }
const originalInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth")
const originalInnerHeight = Object.getOwnPropertyDescriptor(window, "innerHeight")

function restoreProperty<T extends object>(target: T, key: keyof T, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor)
    return
  }
  Reflect.deleteProperty(target, key)
}

function setViewport(width = viewport.width, height = viewport.height) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width })
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height })
}

function formatPosition(position: ReturnType<typeof useFloatingPosition>["position"]) {
  return position ? `${position.side}:${position.x}:${position.y}` : "closed"
}

function FloatingHarness({
  open,
  side = "bottom",
  align = "start",
  avoidCollisions = false,
  getTriggerRect = () => triggerRect,
  getContentRect = () => contentRect,
}: {
  open: boolean
  side?: FloatingSide
  align?: FloatingAlign
  avoidCollisions?: boolean
  getTriggerRect?: () => DOMRect
  getContentRect?: () => DOMRect
}) {
  const triggerRef = useRef<HTMLElement | null>(null)
  const { position, contentRef } = useFloatingPosition({
    triggerRef,
    open,
    side,
    align,
    avoidCollisions,
  })

  return createElement(
    "div",
    null,
    createElement("button", {
      ref: (node: HTMLButtonElement | null) => {
        triggerRef.current = node
        if (node) node.getBoundingClientRect = getTriggerRect
      },
    }),
    createElement(
      "div",
      {
        ref: (node: HTMLDivElement | null) => {
          contentRef.current = node
          if (node) node.getBoundingClientRect = getContentRect
        },
        "data-testid": "position",
      },
      formatPosition(position),
    ),
  )
}

afterEach(() => {
  restoreProperty(window, "innerWidth", originalInnerWidth)
  restoreProperty(window, "innerHeight", originalInnerHeight)
})

describe("floating position helpers", () => {
  it("computes placement, overflow, shift, and collision fallback", () => {
    expect(computePosition(triggerRect, contentRect, "bottom", "start", 6, 10)).toEqual({ x: 110, y: 146 })
    expect(wouldOverflow(700, 100, contentRect, 8, viewport)).toBe(true)
    expect(shift(750, 580, contentRect, 8, viewport)).toEqual({ x: 672, y: 542 })

    const nearBottom = makeDOMRect(100, 540, 80, 40)
    expect(resolveCollisionPosition(nearBottom, contentRect, "bottom", "center", 6, 0, 8, viewport)).toMatchObject({
      side: "top",
      x: 80,
      y: 484,
    })
  })
})

describe("useFloatingPosition", () => {
  it("updates position when open changes", async () => {
    setViewport()
    const { rerender } = render(createElement(FloatingHarness, { open: false }))

    // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
    expect(screen.getByTestId("position")).toHaveTextContent("closed")

    rerender(createElement(FloatingHarness, { open: true }))

    await waitFor(() => {
      // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
      expect(screen.getByTestId("position")).toHaveTextContent("bottom:100:146")
    })
  })

  it("reports the collision-resolved side and shifted coordinates", async () => {
    setViewport()
    render(createElement(FloatingHarness, {
      open: true,
      side: "bottom",
      align: "center",
      avoidCollisions: true,
      getTriggerRect: () => makeDOMRect(100, 540, 80, 40),
    }))

    await waitFor(() => {
      // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
      expect(screen.getByTestId("position")).toHaveTextContent("top:80:484")
    })
  })

  it("updates on window resize and scroll", async () => {
    setViewport()
    let x = 100
    render(createElement(FloatingHarness, {
      open: true,
      getTriggerRect: () => makeDOMRect(x, 100, 80, 40),
    }))

    await waitFor(() => {
      // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
      expect(screen.getByTestId("position")).toHaveTextContent("bottom:100:146")
    })

    x = 120
    act(() => {
      window.dispatchEvent(new Event("resize"))
    })
    await waitFor(() => {
      // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
      expect(screen.getByTestId("position")).toHaveTextContent("bottom:120:146")
    })

    x = 140
    act(() => {
      window.dispatchEvent(new Event("scroll"))
    })
    await waitFor(() => {
      // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
      expect(screen.getByTestId("position")).toHaveTextContent("bottom:140:146")
    })
  })

  it("disconnects observers and removes window listeners on cleanup", async () => {
    setViewport()
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver")
    const disconnect = vi.fn()
    const removeListener = vi.spyOn(window, "removeEventListener")

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {}
        disconnect() {
          disconnect()
        }
      },
    })

    try {
      const { unmount } = render(createElement(FloatingHarness, { open: true }))

      await waitFor(() => {
        // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
        expect(screen.getByTestId("position")).toHaveTextContent("bottom:100:146")
      })

      unmount()

      // call-count IS the contract: ResizeObserver must be disconnected exactly once on cleanup (double-disconnect leaks observers)
      expect(disconnect).toHaveBeenCalledTimes(1)
      expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function))
      expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function))
    } finally {
      removeListener.mockRestore()
      restoreProperty(globalThis, "ResizeObserver", resizeObserverDescriptor)
    }
  })
})
