import { createRef } from "react"
import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Overflow } from "./index.js"
import { OverflowText } from "./overflow-text.js"

let resizeCallbacks: Array<() => void> = []
let animationCallbacks: FrameRequestCallback[] = []

beforeEach(() => {
  resizeCallbacks = []
  animationCallbacks = []

  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private cb: () => void) {}
      observe() {
        resizeCallbacks.push(this.cb)
      }
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    animationCallbacks.push(cb)
    return animationCallbacks.length
  })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
})

function mockDimensions(el: HTMLElement, dims: { scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number }) {
  Object.defineProperty(el, "scrollWidth", { value: dims.scrollWidth, configurable: true })
  Object.defineProperty(el, "clientWidth", { value: dims.clientWidth, configurable: true })
  Object.defineProperty(el, "scrollHeight", { value: dims.scrollHeight, configurable: true })
  Object.defineProperty(el, "clientHeight", { value: dims.clientHeight, configurable: true })
}

function flushObservers() {
  for (const callback of resizeCallbacks) callback()
  const callbacks = animationCallbacks
  animationCallbacks = []
  for (const callback of callbacks) callback(0)
}

describe("OverflowText", () => {
  it("does not expose a tooltip button when text is not overflowing", () => {
    render(<OverflowText tooltip>Short</OverflowText>)

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.getByText("Short")).toBeInTheDocument()
  })

  it("exposes tooltip trigger semantics only after text overflows", () => {
    render(<OverflowText tooltip>Long label</OverflowText>)

    const text = screen.getByText("Long label")
    mockDimensions(text, { scrollWidth: 300, clientWidth: 100, scrollHeight: 20, clientHeight: 20 })

    act(flushObservers)

    expect(screen.getByRole("button")).toHaveTextContent("Long label")
  })
})

describe("Overflow", () => {
  it("defaults to text mode", () => {
    const ref = createRef<HTMLDivElement>()

    render(<Overflow ref={ref} id="overflow-root" style={{ maxWidth: 120 }}>Default text</Overflow>)

    const root = screen.getByText("Default text")
    expect(root).toHaveTextContent("Default text")
    expect(root).toHaveAttribute("id", "overflow-root")
    expect(root).toHaveStyle({ maxWidth: "120px" })
    expect(ref.current).toBe(root)
  })

  it("renders explicit text mode", () => {
    render(<Overflow mode="text" lines={2}>Explicit text</Overflow>)

    expect(screen.getByText("Explicit text")).toHaveStyle({ overflow: "hidden" })
  })

  it("renders explicit items mode", () => {
    const ref = createRef<HTMLDivElement>()

    render(
      <Overflow mode="items" ref={ref} aria-label="Recent files" data-state="items" gap="gap-2">
        <span>One</span>
        <span>Two</span>
      </Overflow>,
    )

    const root = screen.getByLabelText("Recent files")
    expect(root).toHaveAttribute("data-state", "items")
    expect(root).toHaveTextContent("One")
    expect(root).toHaveTextContent("Two")
    expect(ref.current).toBe(root)
  })
})
