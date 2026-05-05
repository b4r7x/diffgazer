import { describe, it, expect } from "vitest"
import { cn } from "../utils.js"

describe("cn", () => {
  it("merges classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1")
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("returns empty string for no input", () => {
    expect(cn()).toBe("")
  })
})
