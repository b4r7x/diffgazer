import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import {
  useFloatingPosition,
  computePosition,
  wouldOverflow,
  shift,
  resolveCollisionPosition,
} from "../use-floating-position.js"
import { createRef } from "react"

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

const trigger = makeDOMRect(100, 100, 80, 40)
const content = makeDOMRect(0, 0, 120, 50)

describe("computePosition", () => {
  it("positions below trigger for bottom-start", () => {
    const pos = computePosition(trigger, content, "bottom", "start", 6, 0)
    expect(pos.y).toBe(146) // trigger.bottom (140) + offset (6)
    expect(pos.x).toBe(100) // trigger.left
  })

  it("positions above trigger for top-center", () => {
    const pos = computePosition(trigger, content, "top", "center", 6, 0)
    expect(pos.y).toBe(44) // trigger.top (100) - content.height (50) - offset (6)
    expect(pos.x).toBe(80) // trigger.left (100) + trigger.width/2 (40) - content.width/2 (60) = 80
  })

  it("positions left of trigger for left-end", () => {
    const pos = computePosition(trigger, content, "left", "end", 6, 0)
    expect(pos.x).toBe(-26) // trigger.left (100) - content.width (120) - offset (6)
    expect(pos.y).toBe(90) // trigger.bottom (140) - content.height (50)
  })

  it("positions right of trigger for right-start", () => {
    const pos = computePosition(trigger, content, "right", "start", 6, 0)
    expect(pos.x).toBe(186) // trigger.right (180) + offset (6)
    expect(pos.y).toBe(100) // trigger.top
  })

  it("applies alignOffset", () => {
    const pos = computePosition(trigger, content, "bottom", "start", 6, 10)
    expect(pos.x).toBe(110) // trigger.left (100) + alignOffset (10)
  })
})

describe("wouldOverflow", () => {
  const vp = { width: 800, height: 600 }

  it("returns false when content fits within viewport", () => {
    expect(wouldOverflow(100, 100, content, 8, vp)).toBe(false)
  })

  it("returns true when content extends past right edge", () => {
    expect(wouldOverflow(700, 100, content, 8, vp)).toBe(true)
  })

  it("returns true when content extends past bottom edge", () => {
    expect(wouldOverflow(100, 560, content, 8, vp)).toBe(true)
  })

  it("returns true when x is less than padding", () => {
    expect(wouldOverflow(2, 100, content, 8, vp)).toBe(true)
  })

  it("returns true when y is less than padding", () => {
    expect(wouldOverflow(100, 2, content, 8, vp)).toBe(true)
  })
})

describe("shift", () => {
  const vp = { width: 800, height: 600 }

  it("clamps to left/top padding", () => {
    const pos = shift(-10, -20, content, 8, vp)
    expect(pos.x).toBe(8)
    expect(pos.y).toBe(8)
  })

  it("clamps to right/bottom edge", () => {
    const pos = shift(750, 580, content, 8, vp)
    expect(pos.x).toBe(672) // 800 - 120 - 8
    expect(pos.y).toBe(542) // 600 - 50 - 8
  })

  it("returns unchanged values when within bounds", () => {
    const pos = shift(200, 300, content, 8, vp)
    expect(pos.x).toBe(200)
    expect(pos.y).toBe(300)
  })
})

describe("resolveCollisionPosition", () => {
  const vp = { width: 800, height: 600 }

  it("returns preferred side when it fits", () => {
    const result = resolveCollisionPosition(trigger, content, "bottom", "center", 6, 0, 8, vp)
    expect(result.side).toBe("bottom")
  })

  it("flips to opposite side when preferred overflows", () => {
    const nearBottom = makeDOMRect(100, 540, 80, 40)
    const result = resolveCollisionPosition(nearBottom, content, "bottom", "center", 6, 0, 8, vp)
    expect(result.side).toBe("top")
  })

  it("falls back to cross-axis side when both preferred and opposite overflow", () => {
    const tall = makeDOMRect(0, 0, 120, 580)
    const smallContent = makeDOMRect(0, 0, 50, 50)
    const narrowVp = { width: 800, height: 600 }
    const result = resolveCollisionPosition(tall, smallContent, "top", "center", 6, 0, 8, narrowVp)
    // top overflows (y < padding), bottom overflows (tall.bottom + offset + content > viewport)
    // Should try left or right
    expect(["left", "right"]).toContain(result.side)
  })

  it("returns preferred side as last resort when all sides overflow", () => {
    const huge = makeDOMRect(0, 0, 790, 590)
    const result = resolveCollisionPosition(trigger, huge, "bottom", "center", 6, 0, 8, vp)
    expect(result.side).toBe("bottom")
  })
})

describe("useFloatingPosition", () => {
  it("returns null position when not open", () => {
    const triggerRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    triggerRef.current = document.createElement("button")

    const { result } = renderHook(() =>
      useFloatingPosition({ triggerRef, open: false }),
    )
    expect(result.current.position).toBeNull()
  })
})
