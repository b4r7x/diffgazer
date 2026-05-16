import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useActiveHeading, type ActiveHeadingActivation } from "../use-active-heading.js"

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
})
