import { describe, expect, it } from "vitest"
import {
  computePosition,
  resolveCollisionPosition,
  shift,
  wouldOverflow,
} from "../floating-position"

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
const vp = { width: 800, height: 600 }

describe("computePosition", () => {
  it("places below the trigger on the bottom side with start alignment", () => {
    expect(computePosition(trigger, content, "bottom", "start", 6, 0))
      .toEqual({ x: 100, y: 146 })
  })

  it("places above the trigger on the top side", () => {
    // top: y = trigger.top - content.height - sideOffset = 100 - 50 - 6 = 44
    expect(computePosition(trigger, content, "top", "start", 6, 0))
      .toEqual({ x: 100, y: 44 })
  })

  it("center-aligns horizontally for vertical sides", () => {
    // x = trigger.left + trigger.width/2 - content.width/2 = 100 + 40 - 60 = 80
    expect(computePosition(trigger, content, "bottom", "center", 0, 0).x)
      .toBe(80)
  })

  it("end-aligns horizontally for vertical sides", () => {
    // x = trigger.right - content.width - alignOffset = 180 - 120 - 0 = 60
    expect(computePosition(trigger, content, "top", "end", 0, 0).x)
      .toBe(60)
  })

  it("places to the right and center-aligns vertically for horizontal sides", () => {
    // right: x = trigger.right + sideOffset = 180 + 6 = 186
    // center y = trigger.top + trigger.height/2 - content.height/2 = 100 + 20 - 25 = 95
    expect(computePosition(trigger, content, "right", "center", 6, 0))
      .toEqual({ x: 186, y: 95 })
  })

  it("applies alignOffset to the cross axis", () => {
    const base = computePosition(trigger, content, "bottom", "start", 6, 0)
    const shifted = computePosition(trigger, content, "bottom", "start", 6, 10)
    expect(shifted.x - base.x).toBe(10)
  })

  // The public helper must keep the positional signature so existing plain-JS
  // copy/package consumers (no TS checking) keep getting correct results.
  it("interprets the first argument as the trigger rect, not an options object", () => {
    // The audited break: an options-object call would read the wrong fields and
    // return { x: 0, y: 0 }. The positional call must place below the trigger.
    expect(computePosition(trigger, content, "bottom", "start", 6, 10))
      .toEqual({ x: 110, y: 146 })
  })
})

describe("wouldOverflow", () => {
  it("reports overflow past the right edge", () => {
    expect(wouldOverflow(700, 100, content, 8, vp)).toBe(true)
  })

  it("reports overflow before the left/top padding", () => {
    expect(wouldOverflow(4, 100, content, 8, vp)).toBe(true)
    expect(wouldOverflow(100, 4, content, 8, vp)).toBe(true)
  })

  it("reports no overflow when fully inside the padded viewport", () => {
    expect(wouldOverflow(100, 100, content, 8, vp)).toBe(false)
  })
})

describe("shift", () => {
  it("clamps coordinates inside the padded viewport", () => {
    expect(shift(750, 580, content, 8, vp)).toEqual({ x: 672, y: 542 })
  })

  it("leaves already-inside coordinates unchanged", () => {
    expect(shift(100, 100, content, 8, vp)).toEqual({ x: 100, y: 100 })
  })
})

describe("resolveCollisionPosition", () => {
  it("keeps the preferred side when it does not overflow", () => {
    const result = resolveCollisionPosition(trigger, content, "bottom", "start", 6, 0, 8, vp)
    expect(result.side).toBe("bottom")
    expect(result).toMatchObject({ x: 100, y: 146 })
  })

  it("flips to the opposite side when the preferred side overflows", () => {
    const nearBottom = makeDOMRect(100, 540, 80, 40)
    const result = resolveCollisionPosition(nearBottom, content, "bottom", "center", 6, 0, 8, vp)
    expect(result).toMatchObject({ side: "top", x: 80, y: 484 })
  })

  it("falls back to the preferred side when every candidate overflows", () => {
    // A viewport smaller than the content forces every placement to overflow.
    const tinyVp = { width: 10, height: 10 }
    const result = resolveCollisionPosition(trigger, content, "left", "start", 6, 0, 8, tinyVp)
    expect(result.side).toBe("left")
  })
})
