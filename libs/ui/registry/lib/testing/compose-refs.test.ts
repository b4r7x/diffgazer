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
})
