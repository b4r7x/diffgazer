import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock("figlet")
  vi.doUnmock("figlet/importable-fonts/Big.js")
  vi.doUnmock("figlet/importable-fonts/Small.js")
})

describe("getFigletText", () => {
  it("renders multi-line ASCII art for the requested text when figlet is installed", async () => {
    const { getFigletText } = await import("./get-figlet-text.js")

    const result = await getFigletText("OK", "Small")

    expect(result.split("\n").length).toBeGreaterThan(1)
    expect(result.length).toBeGreaterThan(2)
  })

  it("memoizes the figlet module so repeated calls do not re-import", async () => {
    // Boundary mock: tracks how many times import('figlet') resolves to verify caching.
    let importCount = 0
    vi.doMock("figlet", async () => {
      importCount += 1
      const actual = await vi.importActual<typeof import("figlet")>("figlet")
      return actual
    })

    const { getFigletText } = await import("./get-figlet-text.js")

    await getFigletText("A", "Big")
    await getFigletText("B", "Big")
    await getFigletText("C", "Big")

    expect(importCount).toBe(1)
  })

  it("rejects with a clear message when the optional figlet peer is missing", async () => {
    // Boundary mock: simulates the absent optional peer dependency.
    vi.doMock("figlet", () => {
      throw new Error("Cannot find module 'figlet'")
    })

    const { getFigletText } = await import("./get-figlet-text.js")

    await expect(getFigletText("OK")).rejects.toThrow(
      /optional peer dependency 'figlet'/,
    )
  })
})
