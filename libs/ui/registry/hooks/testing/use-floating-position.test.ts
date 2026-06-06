import { act, render, screen, waitFor } from "@testing-library/react"
import { JSDOM } from "jsdom"
import { createElement, useRef } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  computePosition,
  type FloatingAlign,
  type FloatingSide,
  resolveCollisionPosition,
  shift,
  useFloatingPosition,
  wouldOverflow,
} from "../use-floating-position"

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
      type: "button",
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

  describe("rAF batching of scroll/resize", () => {
    let rafCallbacks: FrameRequestCallback[] = []
    let rafCancelCount = 0
    const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame")
    const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(globalThis, "cancelAnimationFrame")

    beforeEach(() => {
      rafCallbacks = []
      rafCancelCount = 0
      // Boundary mock: replaces browser rAF/cAF scheduler so the test can assert exact frame coalescing
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb)
        return rafCallbacks.length
      })
      // Boundary mock: replaces browser rAF/cAF scheduler so the test can assert exact frame coalescing
      vi.stubGlobal("cancelAnimationFrame", () => {
        rafCancelCount += 1
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
      restoreProperty(globalThis, "requestAnimationFrame", originalRequestAnimationFrame)
      restoreProperty(globalThis, "cancelAnimationFrame", originalCancelAnimationFrame)
    })

    function flushFrames() {
      const callbacks = rafCallbacks
      rafCallbacks = []
      for (const cb of callbacks) cb(0)
    }

    it("coalesces multiple scroll/resize events within a frame into one update", async () => {
      setViewport()
      let triggerX = 100
      const triggerRectCalls = vi.fn(() => makeDOMRect(triggerX, 100, 80, 40))
      render(createElement(FloatingHarness, {
        open: true,
        getTriggerRect: triggerRectCalls,
      }))

      await waitFor(() => {
        // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
        expect(screen.getByTestId("position")).toHaveTextContent("bottom:100:146")
      })

      const callsAfterMount = triggerRectCalls.mock.calls.length
      rafCallbacks = []

      triggerX = 250
      act(() => {
        for (let i = 0; i < 10; i++) {
          window.dispatchEvent(new Event("scroll"))
        }
        window.dispatchEvent(new Event("resize"))
      })

      // call-count IS the contract: 11 listener invocations within one frame must schedule exactly one rAF
      expect(rafCallbacks.length).toBe(1)
      expect(triggerRectCalls.mock.calls.length).toBe(callsAfterMount)

      act(() => {
        flushFrames()
      })

      await waitFor(() => {
        // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
        expect(screen.getByTestId("position")).toHaveTextContent("bottom:250:146")
      })

      const callsAfterFlush = triggerRectCalls.mock.calls.length
      expect(callsAfterFlush - callsAfterMount).toBe(1)
    })

    it("schedules a fresh frame after the previous one flushed", async () => {
      setViewport()
      let triggerX = 100
      render(createElement(FloatingHarness, {
        open: true,
        getTriggerRect: () => makeDOMRect(triggerX, 100, 80, 40),
      }))

      await waitFor(() => {
        // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
        expect(screen.getByTestId("position")).toHaveTextContent("bottom:100:146")
      })

      rafCallbacks = []

      triggerX = 200
      act(() => {
        window.dispatchEvent(new Event("scroll"))
      })
      expect(rafCallbacks.length).toBe(1)

      act(() => {
        flushFrames()
      })

      await waitFor(() => {
        // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
        expect(screen.getByTestId("position")).toHaveTextContent("bottom:200:146")
      })

      triggerX = 350
      act(() => {
        window.dispatchEvent(new Event("scroll"))
      })
      expect(rafCallbacks.length).toBe(1)

      act(() => {
        flushFrames()
      })

      await waitFor(() => {
        // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
        expect(screen.getByTestId("position")).toHaveTextContent("bottom:350:146")
      })
    })

    it("cancels a pending frame on unmount", async () => {
      setViewport()
      const { unmount } = render(createElement(FloatingHarness, { open: true }))

      await waitFor(() => {
        // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
        expect(screen.getByTestId("position")).toHaveTextContent("bottom:100:146")
      })

      rafCallbacks = []
      rafCancelCount = 0

      act(() => {
        window.dispatchEvent(new Event("scroll"))
      })
      expect(rafCallbacks.length).toBe(1)

      unmount()

      expect(rafCancelCount).toBe(1)
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

  it("derives viewport and listener target from the trigger's ownerDocument", async () => {
    setViewport(1, 1)

    const altDoc = document.implementation.createHTMLDocument("alt")
    const altView = {
      innerWidth: 1280,
      innerHeight: 720,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        cb(0)
        return 1
      },
      cancelAnimationFrame: vi.fn(),
      getComputedStyle: () => ({ overflow: "", overflowX: "", overflowY: "", display: "block" }),
    }
    Object.defineProperty(altDoc, "defaultView", { configurable: true, value: altView })

    const hostAddListener = vi.spyOn(window, "addEventListener")

    const trigger = altDoc.createElement("button")
    const content = altDoc.createElement("div")
    altDoc.body.append(trigger, content)
    trigger.getBoundingClientRect = () => makeDOMRect(100, 100, 80, 40)
    content.getBoundingClientRect = () => makeDOMRect(0, 0, 120, 50)

    function CrossDocHarness() {
      const triggerRef = useRef<HTMLElement | null>(trigger)
      const { position, contentRef } = useFloatingPosition({
        triggerRef,
        open: true,
        side: "bottom",
        align: "center",
        avoidCollisions: true,
        collisionPadding: 0,
      })
      // Attach the cross-document content node so the hook's ref points at it.
      contentRef.current = content
      return createElement(
        "div",
        { "data-testid": "alt-position" },
        formatPosition(position),
      )
    }

    try {
      render(createElement(CrossDocHarness))

      await waitFor(() => {
        // Center alignment with alt viewport 1280x720 puts content at trigger.left + width/2 - content.width/2 = 100 + 40 - 60 = 80
        // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
        expect(screen.getByTestId("alt-position")).toHaveTextContent("bottom:80:146")
      })

      // Listeners attach on the trigger's own view, NOT the host window.
      expect(altView.addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true })
      expect(altView.addEventListener).toHaveBeenCalledWith("resize", expect.any(Function))
      // Walker must stop at iframe boundary: the host window must not receive any listeners from this hook.
      const hostScrollResize = hostAddListener.mock.calls.filter(
        ([type]) => type === "scroll" || type === "resize",
      )
      expect(hostScrollResize).toEqual([])
    } finally {
      hostAddListener.mockRestore()
    }
  })

  it("discovers a cross-realm overflow ancestor and observes resize via the trigger's own realm", async () => {
    // A second JSDOM realm has its own HTMLElement/ResizeObserver. Its elements
    // are NOT `instanceof` the host realm's HTMLElement, so the host-realm
    // scroll-ancestor check and the host ResizeObserver both miss them.
    const hostResizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver")
    const hostObserve = vi.fn()
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {
          hostObserve()
        }
        disconnect() {}
      },
    })

    const realm = new JSDOM("<!doctype html><html><body></body></html>", {
      pretendToBeVisual: true,
      url: "https://example.test/",
    })
    const realmWindow = realm.window as unknown as Window & typeof globalThis
    const crossDoc = realm.window.document

    const wrapper = crossDoc.createElement("div")
    const trigger = crossDoc.createElement("button")
    const content = crossDoc.createElement("div")
    wrapper.appendChild(trigger)
    crossDoc.body.append(wrapper, content)

    // Guard the premise: the overflow ancestor is not a host HTMLElement instance.
    expect(wrapper instanceof HTMLElement).toBe(false)
    expect(wrapper instanceof realm.window.HTMLElement).toBe(true)

    trigger.getBoundingClientRect = () => makeDOMRect(100, 100, 80, 40)
    content.getBoundingClientRect = () => makeDOMRect(0, 0, 120, 50)

    Object.defineProperty(realmWindow, "innerWidth", { configurable: true, value: 800 })
    Object.defineProperty(realmWindow, "innerHeight", { configurable: true, value: 600 })
    realmWindow.getComputedStyle = ((el: Element) =>
      el === wrapper
        ? ({ overflow: "", overflowX: "", overflowY: "auto", display: "block" } as CSSStyleDeclaration)
        : ({ overflow: "", overflowX: "", overflowY: "", display: "block" } as CSSStyleDeclaration)) as typeof window.getComputedStyle
    Object.defineProperty(realmWindow, "requestAnimationFrame", {
      configurable: true,
      value: (cb: FrameRequestCallback) => {
        cb(0)
        return 1
      },
    })
    Object.defineProperty(realmWindow, "cancelAnimationFrame", { configurable: true, value: () => {} })

    const realmObserve = vi.fn()
    Object.defineProperty(realmWindow, "ResizeObserver", {
      configurable: true,
      value: class {
        observe(target: Element) {
          realmObserve(target)
        }
        disconnect() {}
      },
    })

    const wrapperAddListener = vi.spyOn(wrapper, "addEventListener")

    function CrossRealmHarness() {
      const triggerRef = useRef<HTMLElement | null>(trigger)
      const { contentRef } = useFloatingPosition({
        triggerRef,
        open: true,
        side: "bottom",
        align: "start",
        avoidCollisions: false,
      })
      contentRef.current = content as unknown as HTMLDivElement
      return createElement("div", { "data-testid": "cross-realm-ready" }, "ready")
    }

    try {
      render(createElement(CrossRealmHarness))

      await waitFor(() => {
        expect(screen.getByTestId("cross-realm-ready")).toHaveTextContent("ready")
      })

      // Scroll-ancestor discovery must reach the cross-realm overflow wrapper.
      const wrapperScrollCalls = wrapperAddListener.mock.calls.filter(([type]) => type === "scroll")
      expect(wrapperScrollCalls.length).toBeGreaterThan(0)

      // Resize observation must run against the trigger's own realm, not the host.
      expect(realmObserve).toHaveBeenCalledWith(trigger)
      expect(realmObserve).toHaveBeenCalledWith(content)
      expect(hostObserve).not.toHaveBeenCalled()
    } finally {
      wrapperAddListener.mockRestore()
      realm.window.close()
      restoreProperty(globalThis, "ResizeObserver", hostResizeObserverDescriptor)
    }
  })

  describe("scroll-parent discovery", () => {
    const originalGetComputedStyle = window.getComputedStyle
    let overflowByElement: Map<Element, { overflow: string; overflowX: string; overflowY: string; display: string }>
    let wrapperAddCalls: Array<[type: string, listener: unknown, options?: unknown]>
    let restoreWrapperAdd: (() => void) | null

    beforeEach(() => {
      overflowByElement = new Map()
      wrapperAddCalls = []
      restoreWrapperAdd = null
      // Boundary mock: stubs computed style so overflow detection can be exercised without a real CSS engine
      window.getComputedStyle = ((el: Element) => {
        const override = overflowByElement.get(el)
        if (override) {
          return {
            overflow: override.overflow,
            overflowX: override.overflowX,
            overflowY: override.overflowY,
            display: override.display,
          } as CSSStyleDeclaration
        }
        return originalGetComputedStyle.call(window, el)
      }) as typeof window.getComputedStyle
    })

    afterEach(() => {
      restoreWrapperAdd?.()
      window.getComputedStyle = originalGetComputedStyle
    })

    function ScrollParentHarness({
      overflowStyle,
      testId,
    }: {
      overflowStyle: { overflow?: string; overflowX?: string; overflowY?: string }
      testId: string
    }) {
      const triggerRef = useRef<HTMLElement | null>(null)
      const { position, contentRef } = useFloatingPosition({
        triggerRef,
        open: true,
        side: "bottom",
        align: "start",
        avoidCollisions: false,
      })
      return createElement(
        "div",
        {
          ref: (node: HTMLDivElement | null) => {
            if (!node) return
            overflowByElement.set(node, {
              overflow: overflowStyle.overflow ?? "",
              overflowX: overflowStyle.overflowX ?? "",
              overflowY: overflowStyle.overflowY ?? "",
              display: "block",
            })
            if (restoreWrapperAdd) return
            const original = node.addEventListener.bind(node)
            node.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => {
              wrapperAddCalls.push([type, listener, options])
              original(type, listener, options)
            }) as typeof node.addEventListener
            restoreWrapperAdd = () => {
              node.addEventListener = original as typeof node.addEventListener
            }
          },
        },
        createElement("button", {
          type: "button",
          ref: (n: HTMLButtonElement | null) => {
            triggerRef.current = n
            if (n) n.getBoundingClientRect = () => triggerRect
          },
        }),
        createElement(
          "div",
          {
            ref: (n: HTMLDivElement | null) => {
              contentRef.current = n
              if (n) n.getBoundingClientRect = () => contentRect
            },
            "data-testid": testId,
          },
          formatPosition(position),
        ),
      )
    }

    it.each([
      {
        name: "skips overflowing-but-non-scrollable ancestors (overflow: visible)",
        overflowStyle: {},
        testId: "non-scroll-position",
        expectScrollListener: false,
      },
      {
        name: "attaches to ancestor with overflow-y: auto",
        overflowStyle: { overflowY: "auto" },
        testId: "auto-scroll-position",
        expectScrollListener: true,
      },
      {
        name: "attaches to ancestor with overflow: scroll (transformed containing block case)",
        overflowStyle: { overflow: "scroll" },
        testId: "transform-scroll-position",
        expectScrollListener: true,
      },
    ])("$name", async ({ overflowStyle, testId, expectScrollListener }) => {
      setViewport()
      render(createElement(ScrollParentHarness, { overflowStyle, testId }))

      await waitFor(() => {
        // getByTestId: hook output has no native role; harness pattern renders return values to data-testid for read-back
        expect(screen.getByTestId(testId)).toHaveTextContent("bottom:100:146")
      })

      const wrapperScrollCalls = wrapperAddCalls.filter(([type]) => type === "scroll")
      if (expectScrollListener) {
        expect(wrapperScrollCalls.length).toBeGreaterThan(0)
      } else {
        expect(wrapperScrollCalls).toEqual([])
      }
    })
  })
})
