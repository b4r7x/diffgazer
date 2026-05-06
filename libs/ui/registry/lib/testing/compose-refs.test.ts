import { describe, it, expect, vi } from "vitest"
import { composeRefs } from "../compose-refs.js"

describe("composeRefs", () => {
  it("calls function refs with the element", () => {
    const fn = vi.fn()
    const composed = composeRefs(fn)
    const el = document.createElement("div")
    composed(el)
    expect(fn).toHaveBeenCalledWith(el)
  })

  it("assigns element to object ref .current", () => {
    const ref: { current: HTMLDivElement | null } = { current: null }
    const composed = composeRefs(ref)
    const el = document.createElement("div")
    composed(el)
    expect(ref.current).toBe(el)
  })

  it("skips null and undefined refs without throwing", () => {
    const composed = composeRefs(null, undefined)
    expect(() => composed(document.createElement("div"))).not.toThrow()
  })

  it("handles multiple mixed refs together", () => {
    const fn = vi.fn()
    const ref = { current: null as Element | null }
    const composed = composeRefs(fn, ref, null)
    const el = document.createElement("div")
    composed(el)
    expect(fn).toHaveBeenCalledWith(el)
    expect(ref.current).toBe(el)
  })

  it("returns a cleanup function when callback ref returns one", () => {
    const cleanup = vi.fn()
    const callbackRef = (el: any) => cleanup
    const composed = composeRefs(callbackRef)
    const el = document.createElement("div")

    const result = composed(el)

    expect(result).toBe(cleanup)
  })

  it("invokes cleanup function when the composed ref is called", () => {
    const cleanup = vi.fn()
    const callbackRef = vi.fn(() => cleanup)
    const composed = composeRefs(callbackRef)
    const el = document.createElement("div")

    const cleanupFn = composed(el)
    expect(cleanup).not.toHaveBeenCalled()

    // Call the cleanup function
    cleanupFn?.()
    expect(cleanup).toHaveBeenCalled()
  })

  it("handles multiple callback refs with cleanup functions", () => {
    const cleanup1 = vi.fn()
    const cleanup2 = vi.fn()
    const callbackRef1 = vi.fn(() => cleanup1)
    const callbackRef2 = vi.fn(() => cleanup2)

    const composed = composeRefs(callbackRef1, callbackRef2)
    const el = document.createElement("div")

    const cleanupFn = composed(el)
    expect(cleanup1).not.toHaveBeenCalled()
    expect(cleanup2).not.toHaveBeenCalled()

    cleanupFn?.()
    expect(cleanup1).toHaveBeenCalled()
    expect(cleanup2).toHaveBeenCalled()
  })

  it("mixes callback refs with cleanup and object refs", () => {
    const cleanup = vi.fn()
    const callbackRef = vi.fn(() => cleanup)
    const objectRef = { current: null as Element | null }

    const composed = composeRefs(callbackRef, objectRef)
    const el = document.createElement("div")

    const cleanupFn = composed(el)
    expect(objectRef.current).toBe(el)
    expect(cleanup).not.toHaveBeenCalled()

    cleanupFn?.()
    expect(cleanup).toHaveBeenCalled()
    expect(objectRef.current).toBeNull()
  })

  it("clears callback refs without cleanup when composed with object refs", () => {
    const callbackRef = vi.fn()
    const objectRef = { current: null as Element | null }
    const composed = composeRefs(callbackRef, objectRef)
    const el = document.createElement("div")

    const cleanupFn = composed(el)
    cleanupFn?.()

    expect(callbackRef).toHaveBeenNthCalledWith(1, el)
    expect(callbackRef).toHaveBeenNthCalledWith(2, null)
    expect(objectRef.current).toBeNull()
  })
})
