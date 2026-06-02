import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { JSDOM } from "jsdom"
import { useActiveHeading, type ActiveHeadingActivation } from "../use-active-heading"

const originalInnerHeight = Object.getOwnPropertyDescriptor(window, "innerHeight")
const originalScrollY = Object.getOwnPropertyDescriptor(window, "scrollY")
const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame")
const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(window, "cancelAnimationFrame")
const originalMutationObserver = Object.getOwnPropertyDescriptor(window, "MutationObserver")
const originalScrollTo = Object.getOwnPropertyDescriptor(window, "scrollTo")

let frameCallbacks = new Map<number, FrameRequestCallback>()
let nextFrameId = 1
let mutationCallbacks: MutationCallback[] = []
let mutationDisconnect: ReturnType<typeof vi.fn<() => void>>
let cancelAnimationFrameMock: ReturnType<typeof vi.fn<(id: number) => void>>

function restoreProperty<T extends object>(target: T, key: keyof T, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor)
    return
  }
  Reflect.deleteProperty(target, key)
}

function makeDOMRect(top: number, height = 20): DOMRect {
  return {
    x: 0,
    y: top,
    width: 100,
    height,
    top,
    right: 100,
    bottom: top + height,
    left: 0,
    toJSON() {},
  }
}

function setHeadingRect(id: string, top: number, height?: number) {
  const heading = document.getElementById(id)
  if (!(heading instanceof HTMLElement)) throw new Error(`Missing heading ${id}`)
  heading.getBoundingClientRect = () => makeDOMRect(top, height)
}

function appendHeading(id: string) {
  const heading = document.createElement("h2")
  heading.id = id
  document.body.appendChild(heading)
  return heading
}

function flushFrames() {
  act(() => {
    const callbacks = Array.from(frameCallbacks.values())
    frameCallbacks.clear()
    for (const callback of callbacks) callback(0)
  })
}

function renderActiveHeading({
  ids = ["h1", "h2", "h3"],
  activation = "viewport-center",
}: {
  ids?: string[]
  activation?: ActiveHeadingActivation
} = {}) {
  return renderHook(
    (props: { ids: string[]; activation: ActiveHeadingActivation }) =>
      useActiveHeading({
        ids: props.ids,
        activation: props.activation,
        topOffset: 0,
        scrollOffset: 50,
        bottomLock: false,
      }),
    { initialProps: { ids, activation } },
  )
}

beforeEach(() => {
  document.body.replaceChildren()
  for (const id of ["h1", "h2", "h3", "h4"]) appendHeading(id)
  setHeadingRect("h1", 0)
  setHeadingRect("h2", 400)
  setHeadingRect("h3", 800)
  setHeadingRect("h4", 1000)

  frameCallbacks = new Map()
  nextFrameId = 1
  mutationCallbacks = []
  mutationDisconnect = vi.fn()
  cancelAnimationFrameMock = vi.fn((id: number) => {
    frameCallbacks.delete(id)
  })

  Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 })
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 })
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId
      nextFrameId += 1
      frameCallbacks.set(id, callback)
      return id
    }),
  })
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    value: cancelAnimationFrameMock,
  })
  Object.defineProperty(window, "MutationObserver", {
    configurable: true,
    value: class {
      constructor(callback: MutationCallback) {
        mutationCallbacks.push(callback)
      }
      observe() {}
      disconnect() {
        mutationDisconnect()
      }
    },
  })
})

afterEach(() => {
  document.body.replaceChildren()
  restoreProperty(window, "innerHeight", originalInnerHeight)
  restoreProperty(window, "scrollY", originalScrollY)
  restoreProperty(window, "requestAnimationFrame", originalRequestAnimationFrame)
  restoreProperty(window, "cancelAnimationFrame", originalCancelAnimationFrame)
  restoreProperty(window, "MutationObserver", originalMutationObserver)
  restoreProperty(window, "scrollTo", originalScrollTo)
})

describe("useActiveHeading", () => {
  it("syncs activeId when scroll, resize, and observed DOM changes move headings", () => {
    const { result } = renderActiveHeading({ ids: ["h1", "h2", "h3", "h4"] })
    flushFrames()
    expect(result.current.activeId).toBe("h1")

    setHeadingRect("h2", 250)
    act(() => {
      window.dispatchEvent(new Event("scroll"))
    })
    flushFrames()
    expect(result.current.activeId).toBe("h2")

    setHeadingRect("h3", 280)
    act(() => {
      window.dispatchEvent(new Event("resize"))
    })
    flushFrames()
    expect(result.current.activeId).toBe("h3")

    setHeadingRect("h4", 290)
    act(() => {
      for (const callback of mutationCallbacks) callback([], {} as MutationObserver)
    })
    flushFrames()
    expect(result.current.activeId).toBe("h4")
  })

  it("recomputes against new ids and activation options on rerender", () => {
    const { result, rerender } = renderActiveHeading({
      ids: ["h1", "h2"],
      activation: "top-line",
    })
    flushFrames()
    expect(result.current.activeId).toBe("h1")

    setHeadingRect("h4", 280)
    rerender({ ids: ["h1", "h2", "h4"], activation: "viewport-center" })
    flushFrames()

    expect(result.current.activeId).toBe("h4")
  })

  it("scrollTo updates activeId and scrolls to the heading with the configured offset", () => {
    const scrollTo = vi.fn()
    Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollTo })
    const { result } = renderActiveHeading()

    act(() => {
      result.current.scrollTo("h2")
    })

    expect(result.current.activeId).toBe("h2")
    expect(scrollTo).toHaveBeenCalledWith({ top: 350, behavior: "smooth" })
  })

  it("resumes scroll-spy after scrollTo targets an already-in-view heading", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    try {
      // scrollTo to an in-view heading produces no movement, so neither
      // "scroll" nor "scrollend" fires; the guard must still release on settle.
      Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() })
      const { result } = renderActiveHeading()
      flushFrames()

      act(() => {
        result.current.scrollTo("h2")
      })
      expect(result.current.activeId).toBe("h2")

      act(() => {
        vi.advanceTimersByTime(150)
      })

      setHeadingRect("h3", 250)
      act(() => {
        window.dispatchEvent(new Event("scroll"))
      })
      flushFrames()

      expect(result.current.activeId).toBe("h3")
    } finally {
      vi.useRealTimers()
    }
  })

  it("cleans up observers, listeners, and pending animation frames on unmount", () => {
    const removeListener = vi.spyOn(window, "removeEventListener")
    try {
      const { unmount } = renderActiveHeading()

      unmount()

      // call-count IS the contract: MutationObserver must be disconnected exactly once on cleanup (double-disconnect leaks observers)
      expect(mutationDisconnect).toHaveBeenCalledTimes(1)
      expect(cancelAnimationFrameMock).toHaveBeenCalled()
      expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function))
      expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function))
    } finally {
      removeListener.mockRestore()
    }
  })

  it("resolves headings and scroll listeners against a supplied ownerDocument", () => {
    const altDoc = document.implementation.createHTMLDocument("alt")
    const altView = {
      // Same-realm document, so its elements are host HTMLElement instances; the
      // hook reads the constructor from defaultView, so the mocked view exposes it.
      HTMLElement: window.HTMLElement,
      innerHeight: 600,
      scrollY: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        cb(0)
        return 1
      },
      cancelAnimationFrame: vi.fn(),
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => 0),
      matchMedia: () => ({ matches: false }) as MediaQueryList,
    }
    Object.defineProperty(altDoc, "defaultView", { configurable: true, value: altView })

    for (const id of ["a1", "a2"]) {
      const h = altDoc.createElement("h2")
      h.id = id
      altDoc.body.appendChild(h)
    }
    altDoc.getElementById("a1")!.getBoundingClientRect = () => makeDOMRect(0)
    altDoc.getElementById("a2")!.getBoundingClientRect = () => makeDOMRect(100)

    const hostAddListener = vi.spyOn(window, "addEventListener")
    try {
      const { result } = renderHook(() =>
        useActiveHeading({
          ids: ["a1", "a2"],
          activation: "viewport-center",
          topOffset: 0,
          bottomLock: false,
          observe: false,
          ownerDocument: altDoc,
        }),
      )

      // Active heading is read from the alt document's headings, not the host's.
      expect(result.current.activeId).toBe("a2")
      // Scroll/resize listeners attach to the alt document's view, never the host window.
      expect(altView.addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true })
      expect(altView.addEventListener).toHaveBeenCalledWith("resize", expect.any(Function))
      const hostScrollResize = hostAddListener.mock.calls.filter(
        ([type]) => type === "scroll" || type === "resize",
      )
      expect(hostScrollResize).toEqual([])
    } finally {
      hostAddListener.mockRestore()
    }
  })

  it("filters headings from a cross-realm ownerDocument whose elements are not host HTMLElement instances", () => {
    // A second JSDOM realm has its own HTMLElement constructor, so its elements
    // are NOT `instanceof` the host realm's HTMLElement. Filtering must derive
    // the constructor from `ownerDocument.defaultView`, not the host.
    const realm = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
    const crossDoc = realm.window.document

    expect(crossDoc.getElementById).toBeDefined()
    const cross = (id: string) => crossDoc.getElementById(id)!

    for (const id of ["x1", "x2"]) {
      const h = crossDoc.createElement("h2")
      h.id = id
      crossDoc.body.appendChild(h)
    }
    // Guard the premise: cross-realm elements are not host HTMLElement instances.
    expect(cross("x1") instanceof HTMLElement).toBe(false)
    expect(cross("x1") instanceof realm.window.HTMLElement).toBe(true)

    cross("x1").getBoundingClientRect = () => makeDOMRect(0)
    cross("x2").getBoundingClientRect = () => makeDOMRect(100)
    Object.defineProperty(realm.window, "innerHeight", { configurable: true, value: 600 })
    Object.defineProperty(realm.window, "scrollY", { configurable: true, value: 0 })
    realm.window.matchMedia = () => ({ matches: false }) as MediaQueryList
    // Drive the realm's animation frame synchronously so the effect's first update runs.
    Object.defineProperty(realm.window, "requestAnimationFrame", {
      configurable: true,
      value: (cb: FrameRequestCallback) => {
        cb(0)
        return 1
      },
    })
    Object.defineProperty(realm.window, "cancelAnimationFrame", { configurable: true, value: () => {} })

    try {
      const { result } = renderHook(() =>
        useActiveHeading({
          ids: ["x1", "x2"],
          activation: "viewport-center",
          topOffset: 0,
          bottomLock: false,
          observe: false,
          ownerDocument: crossDoc,
        }),
      )

      // viewport center = 300; x2 at top 100 is the last heading above the line.
      // A host-realm `instanceof HTMLElement` filter would drop both cross-realm
      // headings and activeId would fall back to the first id ("x1").
      expect(result.current.activeId).toBe("x2")
    } finally {
      realm.window.close()
    }
  })
})
